/* Generic seeder for exported JSON into Strapi via REST API. Updated for Strapi v5 + Supabase integration.
   Usage:
   STRAPI_URL=http://localhost:1337 STRAPI_TOKEN=... STRAPI_COLLECTION=categories pnpm run seed:generic

   Environment variables:
   - STRAPI_URL: Strapi server URL (default: http://localhost:1337)
   - STRAPI_TOKEN: Admin API token from Strapi
   - STRAPI_COLLECTION: Collection name (default: categories)
   - EXPORT_FILE: JSON file to import (default: content/strapi-export/{COLLECTION}.json)
*/
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

async function main() {
	const STRAPI_URL = process.env.STRAPI_URL || "http://localhost:1337";
	const STRAPI_TOKEN = process.env.STRAPI_TOKEN;
	const COLLECTION = process.env.STRAPI_COLLECTION || "categories";
	const EXPORT_FILE =
		process.env.EXPORT_FILE || `content/strapi-export/${COLLECTION}.json`;

	if (!STRAPI_TOKEN) {
		console.error(
			"❌ Missing STRAPI_TOKEN env. Create an Admin API Token in Strapi and set STRAPI_TOKEN.",
		);
		process.exit(1);
	}

	const filePath = resolve(process.cwd(), EXPORT_FILE);
	const raw = readFileSync(filePath, "utf-8");
	const items = JSON.parse(raw);

	console.log(
		`🚀 Starting import of ${items.length} items to ${STRAPI_URL}/api/${COLLECTION}`,
	);

	let created = 0;
	let errors = 0;

	for (const item of items) {
		try {
			const res = await fetch(`${STRAPI_URL}/api/${COLLECTION}`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${STRAPI_TOKEN}`,
				},
				body: JSON.stringify({ data: item }),
			});

			if (res.ok) {
				created++;
				console.log(`✅ Created: ${item.name || item.title || item.id}`);
			} else {
				const errorText = await res.text();
				console.error(
					`❌ Failed to create ${COLLECTION} item ${item.id}: ${res.status} ${res.statusText}`,
				);
				console.error(`   Error: ${errorText}`);
				errors++;
			}
		} catch (error) {
			console.error(`❌ Error creating ${COLLECTION} item ${item.id}:`, error);
			errors++;
		}
	}

	console.log("\n📊 Import Summary:");
	console.log(`   ✅ Created: ${created}`);
	console.log(`   ❌ Errors: ${errors}`);
	console.log(`   📁 Total: ${items.length}`);
	console.log(
		`🎯 Success Rate: ${((created / items.length) * 100).toFixed(1)}%`,
	);
}

main().catch((err) => {
	console.error("💥 Fatal error:", err);
	process.exit(1);
});
