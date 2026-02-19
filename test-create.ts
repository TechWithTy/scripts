
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


    const payload = {
        parent: { database_id: DB_ID },
        properties: {}
    };


    try {
        console.log(`Creating page in ${DB_ID}...`);
        const response = await notion.pages.create(payload as any);
        fs.writeFileSync(path.resolve(__dirname, "create_success.json"), JSON.stringify(response, null, 2));
        console.log("CREATE_SUCCESS");
    } catch (e: any) {
        const errObj = {
            message: e.message,
            code: e.code,
            body: e.body
        };
        fs.writeFileSync(path.resolve(__dirname, "create_error.json"), JSON.stringify(errObj, null, 2));
        console.log("CREATE_ERROR");
    }
}
main();
