/* Export categories from src/data/categories.ts to JSON for Strapi seeding */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Import the data
import { categories } from "../src/data/categories";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function main() {
  const outPath = resolve(__dirname, "../content/strapi-export/categories.json");
  mkdirSync(dirname(outPath), { recursive: true });

  // Write as a plain JSON array
  writeFileSync(outPath, JSON.stringify(categories, null, 2), { encoding: "utf-8" });
  console.log(`Exported ${categories.length} categories -> ${outPath}`);
}

main();
