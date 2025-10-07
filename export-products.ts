/* Export products data from src/data/products/hero.ts to JSON for Strapi seeding */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// Import the hero grid data
import { DEFAULT_GRID } from "../src/data/products/hero";

function main() {
  const outPath = resolve(process.cwd(), "content/strapi-export/products.json");
  mkdirSync(dirname(outPath), { recursive: true });

  // Transform hero grid items for Strapi
  const products = DEFAULT_GRID.map(item => ({
    id: item.categoryId,
    name: item.label,
    description: item.description,
    imageUrl: item.src,
    link: item.link,
    categoryId: item.categoryId,
    altText: item.alt,
    colSpan: item.colSpan,
    rowSpan: item.rowSpan,
    ariaLabel: item.ariaLabel
  }));

  // Write as a plain JSON array
  writeFileSync(outPath, JSON.stringify(products, null, 2), { encoding: "utf-8" });
  console.log(`Exported ${products.length} products -> ${outPath}`);
}

main();
