/**
 * Script to fetch and document the Notion Linktree database schema
 *
 * This fetches the database schema from Notion API and outputs:
 * 1. All property names and types
 * 2. Select option values (if applicable)
 * 3. TypeScript type definitions
 *
 * Usage:
 *   pnpm tsx scripts/notion/fetchLinktreeSchema.ts
 *   pnpm tsx scripts/notion/fetchLinktreeSchema.ts --write  # Write to files
 *
 * Environment variables required:
 *   - NOTION_KEY: Your Notion integration token
 *   - NOTION_REDIRECTS_ID: Your Notion database ID
 *
 * Alternative: Use the API endpoint /api/notion/linktree-schema instead
 */

import { resolve } from "node:path";

import { config } from "dotenv";

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

interface NotionDatabaseSchema {
	id: string;
	title: Array<{ plain_text: string }>;
	properties: Record<string, NotionPropertySchema>;
}

interface NotionPropertySchema {
	id: string;
	name: string;
	type:
		| "title"
		| "rich_text"
		| "number"
		| "select"
		| "multi_select"
		| "date"
		| "people"
		| "files"
		| "checkbox"
		| "url"
		| "email"
		| "phone_number"
		| "formula"
		| "relation"
		| "rollup"
		| "status"
		| "created_time"
		| "created_by"
		| "last_edited_time"
		| "last_edited_by";
	select?: {
		options: Array<{ id: string; name: string; color: string }>;
	};
	multi_select?: {
		options: Array<{ id: string; name: string; color: string }>;
	};
	status?: {
		options: Array<{ id: string; name: string; color: string }>;
	};
}

async function fetchDatabaseSchema(
	databaseId: string,
): Promise<NotionDatabaseSchema> {
	const NOTION_KEY = process.env.NOTION_KEY;
	if (!NOTION_KEY) {
		throw new Error("NOTION_KEY environment variable is required");
	}

	const url = `${NOTION_API_BASE}/databases/${databaseId}`;
	const response = await fetch(url, {
		method: "GET",
		headers: {
			Authorization: `Bearer ${NOTION_KEY}`,
			"Notion-Version": NOTION_VERSION,
			"Content-Type": "application/json",
		},
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(
			`Failed to fetch database schema: ${response.status} ${response.statusText}\n${errorText}`,
		);
	}

	return (await response.json()) as NotionDatabaseSchema;
}

function formatSchemaAsTypeScript(schema: NotionDatabaseSchema): string {
	const props = Object.entries(schema.properties);
	const lines: string[] = [];

	lines.push("/**");
	lines.push(" * Notion Linktree Database Schema");
	lines.push(" *");
	lines.push(" * Auto-generated from Notion API");
	lines.push(` * Database ID: ${schema.id}`);
	lines.push(" *");
	lines.push(` * Last updated: ${new Date().toISOString()}`);
	lines.push(" */");
	lines.push("");
	lines.push("import type {");
	lines.push("\tNotionFilesProperty,");
	lines.push("\tNotionRichTextProperty,");
	lines.push("\tNotionTitleProperty,");
	lines.push("\tNotionUrlProperty,");
	lines.push("\tNotionSelectProperty,");
	lines.push('} from "./notionTypes";');
	lines.push("");
	lines.push("// Additional Notion property types not in notionTypes.ts");
	lines.push("export type NotionStatusProperty = {");
	lines.push('\ttype: "status";');
	lines.push("\tstatus: {");
	lines.push("\t\tid: string;");
	lines.push("\t\tname: string;");
	lines.push("\t\tcolor: string;");
	lines.push("\t} | null;");
	lines.push("};");
	lines.push("");
	lines.push("export type NotionDateProperty = {");
	lines.push('\ttype: "date";');
	lines.push("\tdate: {");
	lines.push("\t\tstart: string;");
	lines.push("\t\tend: string | null;");
	lines.push("\t\ttime_zone: string | null;");
	lines.push("\t} | null;");
	lines.push("};");
	lines.push("");
	lines.push("export type NotionNumberProperty = {");
	lines.push('\ttype: "number";');
	lines.push("\tnumber: number | null;");
	lines.push("};");
	lines.push("");
	lines.push("export interface LinkTreeNotionDatabaseProperties {");

	for (const [propertyName, property] of props) {
		const safeName = propertyName.replace(/[^a-zA-Z0-9_]/g, "_");
		const comment = `// Property: "${propertyName}" (${property.type})`;
		lines.push(`\t${comment}`);

		let typeDefinition = "";
		switch (property.type) {
			case "title":
				typeDefinition = "NotionTitleProperty";
				break;
			case "rich_text":
				typeDefinition = "NotionRichTextProperty";
				break;
			case "url":
				typeDefinition = "NotionUrlProperty";
				break;
			case "checkbox":
				typeDefinition = "NotionCheckboxProperty";
				break;
			case "select":
				typeDefinition = "NotionSelectProperty";
				if (property.select?.options) {
					const options = property.select.options
						.map((o) => `"${o.name}"`)
						.join(" | ");
					typeDefinition += ` // Options: ${options}`;
				}
				break;
			case "multi_select":
				typeDefinition = "NotionMultiSelectProperty";
				if (property.multi_select?.options) {
					const options = property.multi_select.options
						.map((o) => `"${o.name}"`)
						.join(" | ");
					typeDefinition += ` // Options: ${options}`;
				}
				break;
			case "files":
				typeDefinition = "NotionFilesProperty";
				break;
			case "number":
				typeDefinition = "NotionNumberProperty";
				break;
			case "date":
				typeDefinition = "NotionDateProperty";
				break;
			case "created_time":
				typeDefinition = "NotionCreatedTimeProperty";
				break;
			case "last_edited_time":
				typeDefinition = "NotionLastEditedTimeProperty";
				break;
			case "status":
				typeDefinition = "NotionStatusProperty";
				if (property.status?.options) {
					const options = property.status.options
						.map((o) => `"${o.name}"`)
						.join(" | ");
					typeDefinition += ` // Options: ${options}`;
				}
				break;
			case "relation":
				typeDefinition = "NotionRelationProperty";
				break;
			case "rollup":
				typeDefinition = "NotionRollupProperty";
				break;
			case "formula":
				typeDefinition = "NotionFormulaProperty";
				break;
			case "people":
				typeDefinition = "NotionPeopleProperty";
				break;
			case "created_by":
				typeDefinition = "NotionCreatedByProperty";
				break;
			case "last_edited_by":
				typeDefinition = "NotionLastEditedByProperty";
				break;
			case "email":
				typeDefinition = "NotionEmailProperty";
				break;
			case "phone_number":
				typeDefinition = "NotionPhoneNumberProperty";
				break;
			default:
				typeDefinition = `NotionProperty // Unknown type: ${property.type}`;
		}

		// Use unquoted property name if it's a valid identifier, otherwise use quoted
		const isValidIdentifier = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(propertyName);
		const propertyKey = isValidIdentifier ? propertyName : `"${propertyName}"`;

		// Ensure semicolon at end if there's a comment
		const hasComment = typeDefinition.includes("//");
		const definition = hasComment
			? typeDefinition.replace(/\s*$/, ";")
			: `${typeDefinition};`;

		lines.push(`\t${propertyKey}: ${definition}`);
		lines.push("");
	}

	lines.push("}");
	return lines.join("\n");
}

function formatSchemaAsMarkdown(schema: NotionDatabaseSchema): string {
	const lines: string[] = [];

	lines.push("# Notion Linktree Database Schema");
	lines.push("");
	lines.push(`**Database ID:** \`${schema.id}\``);
	lines.push(`**Last Updated:** ${new Date().toISOString()}`);
	lines.push("");
	lines.push("## Properties");
	lines.push("");
	lines.push("| Property Name | Type | Options/Notes |");
	lines.push("|--------------|------|---------------|");

	const props = Object.entries(schema.properties).sort(([a], [b]) =>
		a.localeCompare(b),
	);

	for (const [propertyName, property] of props) {
		let options = "";
		if (property.type === "select" && property.select?.options) {
			options = property.select.options.map((o) => o.name).join(", ");
		} else if (
			property.type === "multi_select" &&
			property.multi_select?.options
		) {
			options = property.multi_select.options.map((o) => o.name).join(", ");
		} else if (property.type === "status" && property.status?.options) {
			options = property.status.options.map((o) => o.name).join(", ");
		}

		lines.push(
			`| \`${propertyName}\` | ${property.type} | ${options || "-"} |`,
		);
	}

	return lines.join("\n");
}

async function main() {
	const NOTION_DB_ID = process.env.NOTION_REDIRECTS_ID;
	if (!NOTION_DB_ID) {
		console.error("Error: NOTION_REDIRECTS_ID environment variable is not set");
		console.error("Please set it in your .env.local file");
		process.exit(1);
	}

	try {
		console.log("Fetching Notion database schema...");
		console.log(`Database ID: ${NOTION_DB_ID}`);
		console.log("");

		const schema = await fetchDatabaseSchema(NOTION_DB_ID);

		console.log("✅ Successfully fetched database schema!");
		console.log("");
		console.log("=".repeat(80));
		console.log("DATABASE SCHEMA SUMMARY");
		console.log("=".repeat(80));
		console.log("");

		console.log(
			`Database Name: ${schema.title.map((t) => t.plain_text).join("")}`,
		);
		console.log(`Total Properties: ${Object.keys(schema.properties).length}`);
		console.log("");

		console.log("Properties:");
		const props = Object.entries(schema.properties).sort(([a], [b]) =>
			a.localeCompare(b),
		);
		for (const [name, prop] of props) {
			console.log(`  - ${name} (${prop.type})`);
			if (prop.type === "select" && prop.select?.options) {
				console.log(
					`    Options: ${prop.select.options.map((o) => o.name).join(", ")}`,
				);
			}
			if (prop.type === "multi_select" && prop.multi_select?.options) {
				console.log(
					`    Options: ${prop.multi_select.options.map((o) => o.name).join(", ")}`,
				);
			}
		}

		console.log("");
		console.log("=".repeat(80));
		console.log("TYPESCRIPT TYPE DEFINITION");
		console.log("=".repeat(80));
		console.log("");
		console.log(formatSchemaAsTypeScript(schema));

		console.log("");
		console.log("=".repeat(80));
		console.log("MARKDOWN DOCUMENTATION");
		console.log("=".repeat(80));
		console.log("");
		console.log(formatSchemaAsMarkdown(schema));

		// Optionally write to file
		if (process.argv.includes("--write")) {
			const fs = await import("node:fs/promises");
			await fs.writeFile(
				"src/utils/notion/linktreeDatabaseSchema.ts",
				formatSchemaAsTypeScript(schema),
			);
			await fs.writeFile(
				"_docs/notion/linktree-database-schema.md",
				formatSchemaAsMarkdown(schema),
			);
			console.log("");
			console.log("✅ Schema written to:");
			console.log("  - src/utils/notion/linktreeDatabaseSchema.ts");
			console.log("  - _docs/notion/linktree-database-schema.md");
		}
	} catch (error) {
		console.error("Error fetching database schema:", error);
		if (error instanceof Error) {
			console.error(error.message);
		}
		process.exit(1);
	}
}

main().catch((error) => {
	console.error("Unhandled error:", error);
	process.exit(1);
});
