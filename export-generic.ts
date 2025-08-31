/* Generic exporter: load any TS/JS module that exports an array and write JSON to content/strapi-export.

Usage examples:
  MODULE=src/data/categories.ts OUT=content/strapi-export/categories.json pnpm run export:generic
  MODULE=src/data/products/list.ts EXPORT=products COLLECTION=products pnpm run export:generic

Env vars:
  - MODULE: required. Path to TS/JS file exporting an array (default/named).
  - EXPORT: optional. Named export to use.
  - OUT: optional. Output path. Defaults to content/strapi-export/<name>.json
          name will be COLLECTION if provided, otherwise basename of MODULE (no ext).
  - COLLECTION: optional. Used only to build default OUT filename if OUT not provided.
*/
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";

function pickArrayFromModule(mod: any, expName?: string): unknown[] {
  if (expName && Object.prototype.hasOwnProperty.call(mod, expName)) {
    const v = mod[expName];
    if (Array.isArray(v)) return v;
  }
  if (Array.isArray(mod?.default)) return mod.default as unknown[];
  for (const key of Object.keys(mod)) {
    const v = mod[key];
    if (Array.isArray(v)) return v as unknown[];
  }
  throw new Error("No array export found in module. Provide EXPORT=<name>.");
}

function main() {
  const MODULE = process.env.MODULE;
  const EXPORT = process.env.EXPORT;
  const COLLECTION = process.env.COLLECTION || process.env.STRAPI_COLLECTION;
  if (!MODULE) throw new Error("Missing MODULE env. Example: MODULE=src/data/categories.ts");

  const abs = resolve(process.cwd(), MODULE);
  // ts-node is registered via scripts/run-ts.js, so require can load TS
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require(abs);
  const items = pickArrayFromModule(mod, EXPORT);

  const defaultName = (COLLECTION && String(COLLECTION)) || basename(MODULE).replace(/\.[^.]+$/, "");
  const outPath = resolve(process.cwd(), process.env.OUT || `content/strapi-export/${defaultName}.json`);

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(items, null, 2), { encoding: "utf-8" });

  // eslint-disable-next-line no-console
  console.log(`Exported ${items.length} items -> ${outPath}`);
}

main();
