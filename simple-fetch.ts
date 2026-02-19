
import * as dotenv from "dotenv";
import { Client } from "@notionhq/client";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });


const main = async () => {
    const API_KEY = process.env.NOTION_API_KEY || process.env.NOTION_KEY;
    const DB_ID = process.env.NOTION_DATABASE_ID || process.env.NOTION_DB_ID;

    if (!API_KEY || !DB_ID) {
        throw new Error("Missing NOTION_API_KEY/NOTION_KEY or NOTION_DATABASE_ID/NOTION_DB_ID");
    }
    
    const notion = new Client({ auth: API_KEY });


    try {
        const db: any = await notion.databases.retrieve({ database_id: DB_ID });
        fs.writeFileSync(path.resolve(__dirname, "fetch_success.json"), JSON.stringify(db, null, 2));
        console.log("DONE_SUCCESS");
    } catch (e: any) {
        const errObj = {
            message: e.message,
            code: e.code,
            body: e.body,
            stack: e.stack
        };
        fs.writeFileSync(path.resolve(__dirname, "fetch_error.json"), JSON.stringify(errObj, null, 2));
        console.log("DONE_ERROR");
    }
}
main();

