/* Generic seeding script: load any TS/JS module that exports mock data (array) and POST to Strapi.

Usage examples:
  STRAPI_TOKEN=... STRAPI_URL=http://localhost:1337 \
  MODULE=src/data/categories.ts COLLECTION=categories pnpm exec ts-node scripts/seed-generic.ts

  # Named export
  STRAPI_TOKEN=... MODULE=src/data/products/list.ts EXPORT=products COLLECTION=products pnpm exec ts-node scripts/seed-generic.ts

Optional env:
  - EXPORT: named export to use (falls back to module.default then first export found)
  - DRY=1: don't POST, just print count
  - BATCH=50: batch size (currently sequential, kept for future improvement)
  - STRAPI_COLLECTION: overrides COLLECTION
*/
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { loadConfig, postItems } from "./strapi-utils";

function parseFieldMap(src?: string): Record<string, string> {
  if (!src) return {};
  const map: Record<string, string> = {};
  for (const pair of src.split(",")) {
    const [from, to] = pair.split(":");
    if (from && to) map[from.trim()] = to.trim();
  }
  return map;
}

function applyFieldMap(obj: any, map: Record<string, string>) {
  if (!map || Object.keys(map).length === 0) return obj;
  const out: any = { ...obj };
  for (const [from, to] of Object.entries(map)) {
    if (Object.prototype.hasOwnProperty.call(out, from)) {
      out[to] = out[from];
      delete out[from];
    }
  }
  return out;
}

async function loadModuleData(modPath: string, expName?: string): Promise<unknown[]> {
  const abs = resolve(process.cwd(), modPath);
  const mod = await import(pathToFileURL(abs).href);

  let data: unknown | undefined;
  if (expName && Object.prototype.hasOwnProperty.call(mod, expName)) {
    data = (mod as Record<string, unknown>)[expName];
  } else if ("default" in mod && Array.isArray((mod as any).default)) {
    data = (mod as any).default;
  } else {
    // pick first array export
    for (const key of Object.keys(mod)) {
      const val = (mod as Record<string, unknown>)[key];
      if (Array.isArray(val)) {
        data = val;
        break;
      }
    }
  }

  if (!Array.isArray(data)) {
    throw new Error(
      `No array export found in module ${modPath}. Provide EXPORT=<name> when calling.`
    );
  }
  return data as unknown[];
}

async function main() {
  const MODULE = process.env.MODULE;
  const EXPORT = process.env.EXPORT;
  const DRY = process.env.DRY === "1" || process.env.DRY === "true";
  const FIELD_MAP = parseFieldMap(process.env.FIELD_MAP);

  if (!MODULE) {
    throw new Error(
      "Missing MODULE env. Example: MODULE=src/data/categories.ts COLLECTION=categories"
    );
  }

  const collection = process.env.STRAPI_COLLECTION || process.env.COLLECTION || "";
  const cfg = loadConfig(collection);

  const items = await loadModuleData(MODULE, EXPORT);
  console.log(`Loaded ${items.length} items from ${MODULE}${EXPORT ? ":" + EXPORT : ""}`);

  if (DRY) {
    console.log("DRY run: not posting to Strapi.");
    return;
  }

  const mapped = items.map((it) => applyFieldMap(it as any, FIELD_MAP));
  await postItems(cfg, mapped);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
