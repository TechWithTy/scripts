import dotenv from "dotenv";
import { queryNotionDatabase } from "../src/utils/notion/notion";
import { mapNotionPageToLinkTree } from "../src/utils/notion/linktreeMapper";
import {
	NotionQueryResponse,
	NotionPage,
} from "../src/utils/notion/notionTypes";

dotenv.config();

async function test() {
	try {
		console.log("Testing Notion Connection...");
		const rawId = process.env.NOTION_REDIRECTS_ID;
		console.log("NOTION_REDIRECTS_ID:", rawId ? "Found" : "Missing");

		if (!rawId) throw new Error("Missing NOTION_REDIRECTS_ID");

		const addDashes = (id: string) =>
			id.replace(/^(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})$/, "$1-$2-$3-$4-$5");
		const dbId = rawId.includes("-")
			? rawId
			: rawId.length === 32
				? addDashes(rawId)
				: rawId;

		console.log("Querying database:", dbId);
		const data = (await queryNotionDatabase(dbId)) as NotionQueryResponse;
		console.log("Query successful. Results count:", data.results?.length);

		if (data.results && data.results.length > 0) {
			const results = data.results as NotionPage[];
			const items = results.map((page) => mapNotionPageToLinkTree(page));
			console.log("Mapped items count:", items.length);
			if (items.length > 0) {
				console.log("First item slug:", items[0].slug);
				console.log("First item title:", items[0].title);
				console.log("First item destination:", items[0].destination);
				console.log("First item linkTreeEnabled:", items[0].linkTreeEnabled);
			}
		} else {
			console.log("No results found.");
		}
	} catch (error) {
		console.error("Test failed:", error);
	}
}

test();
