/* Shared Strapi seeding utilities */
import { readFileSync } from "node:fs";

export type SeedConfig = {
  url: string;
  token: string;
  collection: string; // e.g. "categories" -> /api/categories
};

export function loadConfig(defaultCollection?: string): SeedConfig {
  const url =
    process.env.STRAPI_URL?.trim() ||
    process.env.NEXT_PUBLIC_STRAPI_URL?.trim() ||
    "http://localhost:1337";

  const token =
    process.env.STRAPI_TOKEN?.trim() ||
    process.env.STRAPI_EXTERNAL_KEY?.trim() ||
    process.env.NEXT_PUBLIC_STRAPI_TOKEN?.trim() ||
    "";

  if (!token) {
    throw new Error(
      "Missing Strapi token. Set STRAPI_TOKEN or STRAPI_EXTERNAL_KEY in your environment."
    );
  }

  const collection =
    process.env.STRAPI_COLLECTION?.trim() || defaultCollection || "";

  if (!collection) {
    throw new Error(
      "Missing collection. Pass --collection or set STRAPI_COLLECTION."
    );
  }

  return { url, token, collection };
}

export async function postItems(
  cfg: SeedConfig,
  items: unknown[],
  { verbose = true }: { verbose?: boolean } = {}
) {
  let created = 0;
  for (const item of items) {
    const res = await fetch(`${cfg.url}/api/${cfg.collection}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.token}`,
      },
      body: JSON.stringify({ data: item }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (verbose) {
        console.error(
          `Failed to create ${cfg.collection} item: ${res.status} ${res.statusText} -> ${text}`
        );
      }
      continue;
    }
    created++;
  }
  if (verbose) {
    console.log(`Created ${created}/${items.length} at ${cfg.url}/api/${cfg.collection}`);
  }
}

export function readJsonArray<T = unknown>(path: string): T[] {
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as T[];
}
