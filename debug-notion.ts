import { Client } from "@notionhq/client";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

dotenv.config();

const API_KEY = process.env.NOTION_API_KEY;
const DATABASE_ID = process.env.NOTION_DATABASE_ID || process.env.NOTION_DB_ID;

const notion = new Client({ auth: API_KEY });

async function main() {
	console.log("--- DEBUGGER ---");
	console.log(`ID: ${DATABASE_ID}`);
	const logs: string[] = [];
	const log = (...args: any[]) => {
		console.log(...args);
		logs.push(args.map((a) => JSON.stringify(a, null, 2)).join(" "));
	};

	try {
		log("1. Attempting notion.databases.retrieve...");
		const db = await notion.databases.retrieve({ database_id: DATABASE_ID! });
		log("✅ Retrieve Success:", db);
	} catch (e: any) {
		log("❌ Retrieve Failed:", e.message, e.code, e.status);
	}

	try {
		log("2. Attempting notion.request (databases/{id}/query)...");
		const resp = await notion.request({
			path: `databases/${DATABASE_ID}/query`,
			method: "post",
			body: { page_size: 1 },
		});
		log("✅ Request Success:", resp);
	} catch (e: any) {
		log("❌ Request Failed:", e.message, e.code, e.status);
	}

	// Try finding the DB via search
	try {
		log("3. Attempting Search for Database...");
		const search = await notion.search({
			filter: { value: "database", property: "object" },
			page_size: 5,
		});
		log(
			"Search results:",
			search.results.map((r: any) => ({ id: r.id, title: r.title })),
		);

		const match = search.results.find(
			(r: any) => r.id.replace(/-/g, "") === DATABASE_ID?.replace(/-/g, ""),
		);
		if (match) {
			log("✅ FOUND MATCH in Search:", match.id);
		} else {
			log("⚠️ ID NOT FOUND in Search results.");
		}
	} catch (e: any) {
		log("❌ Search Failed:", e.message);
	}

	fs.writeFileSync("debug_trace.txt", logs.join("\n---\n"));
	console.log("Logs written to debug_trace.txt");
}

main();
