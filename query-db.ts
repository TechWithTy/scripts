import * as dotenv from "dotenv";
import { Client } from "@notionhq/client";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const main = async () => {
	const API_KEY = process.env.NOTION_API_KEY || process.env.NOTION_KEY;
	const DB_ID = process.env.NOTION_DATABASE_ID || process.env.NOTION_DB_ID;

	if (!API_KEY || !DB_ID) {
		throw new Error(
			"Missing NOTION_API_KEY/NOTION_KEY or NOTION_DATABASE_ID/NOTION_DB_ID",
		);
	}

	const notion = new Client({ auth: API_KEY });

	try {
		console.log(`Querying DB ${DB_ID}...`);
		// Query for just 1 page
		const response = await notion.databases.query({
			database_id: DB_ID,
			page_size: 1,
		});

		fs.writeFileSync(
			path.resolve(__dirname, "query_success.json"),
			JSON.stringify(response, null, 2),
		);
		console.log("QUERY_SUCCESS");
	} catch (e: any) {
		const errObj = {
			message: e.message,
			code: e.code,
			body: e.body,
		};
		fs.writeFileSync(
			path.resolve(__dirname, "query_error.json"),
			JSON.stringify(errObj, null, 2),
		);
		console.log("QUERY_ERROR");
	}
};
main();
