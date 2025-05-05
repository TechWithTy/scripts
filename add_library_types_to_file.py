"""
Script to automatically insert import statements for all library.types modules into _schema.py.
"""
import re
from pathlib import Path
import argparse
import ast
import importlib.util

def snake_to_pascal(name: str) -> str:
    """Convert snake_case filename (with .py) to PascalCase class name."""
    return ''.join(part.capitalize() for part in name[:-3].split('_'))

def main() -> None:
    # Determine path to the schema file
    project_root = Path(__file__).resolve().parent.parent

    # Load TypesConfig from config file
    types_files = list(project_root.glob("backend/app/core/third_party_integrations/*/api/_types.py"))
    if not types_files:
        print("No _types.py found under third_party_integrations")
        return
    types_path = types_files[0]

    # Dynamically import TypesConfig from _types.py
    spec = importlib.util.spec_from_file_location("_types", str(types_path))
    types_mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(types_mod)
    config = types_mod.TypesConfig
    import_method = getattr(config, "import_method", "from library.types")
    conversion_method = getattr(config, "conversion_method", "camel_case")
    relative_file = getattr(config, "relative_file_path", "")
    filenames = getattr(config, "types", [])

    # Determine schema path and api directory
    schema_path = project_root / relative_file
    if not schema_path.exists():
        print(f"Schema file not found at {schema_path}")
        return
    api_dir = schema_path.parent

    parser = argparse.ArgumentParser(description="Insert library types imports into _schema.py")
    parser.add_argument('--files', nargs='+', help='List of module .py filenames to import')
    args = parser.parse_args()
    if args.files:
        filenames = args.files

    py_files = []
    for name in filenames:
        fpath = api_dir / name
        if not fpath.exists():
            print(f"Warning: {name} not found in {api_dir}")
        else:
            py_files.append(fpath)

    if conversion_method == 'camel_case':
        transformer = snake_to_pascal
    else:
        def identity(name: str) -> str:
            return Path(name).stem
        transformer = identity

    # Build import statements
    imports = [f"{import_method}.{f.stem} import {transformer(f.name)}" for f in py_files]

    # Read existing schema lines
    lines = schema_path.read_text().splitlines()

    # Find last import from library.types
    last_idx = -1
    for idx, line in enumerate(lines):
        if line.startswith('from library.types'):
            last_idx = idx
    
    # Filter out imports already present
    to_add = [imp for imp in imports if imp not in lines]
    if not to_add:
        print("No new imports to add.")
        return

    # Insert new imports after last existing import
    insertion = last_idx + 1
    new_lines = lines[:insertion] + to_add + lines[insertion:]

    # Write back
    schema_path.write_text("\n".join(new_lines) + "\n")

    print(f"Added {len(to_add)} imports to {schema_path}")

if __name__ == '__main__':
    main()
