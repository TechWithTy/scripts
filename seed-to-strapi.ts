/* Seed exported JSON into Strapi via REST API.
   Usage:
   STRAPI_URL=http://localhost:1337 STRAPI_TOKEN=... pnpm run seed:categories

   Optional env:
   - STRAPI_COLLECTION: defaults to "categories" (endpoint: /api/categories)
*/
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type Category = {
  id: string;
  name: string;
};

async function main() {
  const STRAPI_URL = process.env.STRAPI_URL || "http://localhost:1337";
  const STRAPI_TOKEN = process.env.STRAPI_TOKEN;
  const COLLECTION = process.env.STRAPI_COLLECTION || "categories";

  if (!STRAPI_TOKEN) {
    console.error("Missing STRAPI_TOKEN env. Create an Admin API Token in Strapi and set STRAPI_TOKEN.");
    process.exit(1);
  }

  const filePath = resolve(process.cwd(), "content/strapi-export/categories.json");
  const raw = readFileSync(filePath, "utf-8");
  const items: Category[] = JSON.parse(raw);

  let created = 0;
  for (const item of items) {
    const res = await fetch(`${STRAPI_URL}/api/${COLLECTION}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${STRAPI_TOKEN}`,
      },
      body: JSON.stringify({ data: item }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Failed to create ${COLLECTION} item id=${item.id}: ${res.status} ${res.statusText} -> ${text}`);
      process.exitCode = 1;
      continue;
    }
    created++;
  }

  console.log(`Seeded ${created}/${items.length} items to ${STRAPI_URL}/api/${COLLECTION}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
