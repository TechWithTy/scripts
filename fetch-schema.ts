import { Client } from "@notionhq/client";
import * as dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Explicitly load .env from the parent directory
const envPath = path.resolve(__dirname, "../.env");
console.log(`Loading .env from: ${envPath}`);
const result = dotenv.config({ path: envPath });

if (result.error) {
	console.error("❌ Error loading .env file:", result.error);
}

const fetchSchema = async () => {
	// Redo keys definition
	const { NOTION_API_KEY, NOTION_DB_ID, NOTION_DATABASE_ID } = process.env;
	const dbId = NOTION_DATABASE_ID || NOTION_DB_ID;

	const API_KEY = NOTION_API_KEY || process.env.NOTION_KEY;
	const DB_ID = dbId;

	console.log(`Using Key: ${API_KEY.substring(0, 10)}...`);
	console.log(`Using ID: ${DB_ID}`);

	const notion = new Client({ auth: API_KEY });

	try {
		console.log(`Fetching schema for Database ID: ${DB_ID}...`);
		const response = await notion.databases.retrieve({ database_id: DB_ID });

		const schemaPath = path.resolve(__dirname, "schema.json");
		fs.writeFileSync(
			schemaPath,
			JSON.stringify(response.properties, null, 2),
			"utf-8",
		);
		console.log(`✅ Schema written successfully to ${schemaPath}`);
	} catch (error: any) {
		console.error("❌ Notion API Error:", error.message);
		if (error.body) {
			// Write error body to file if it's too large
			fs.writeFileSync(
				path.resolve(__dirname, "fetch_error.json"),
				JSON.stringify(error.body, null, 2),
				"utf-8",
			);
			console.log("Error details written to fetch_error.json");
		}
	}
};

fetchSchema();
