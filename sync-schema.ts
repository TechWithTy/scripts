import { Client } from "@notionhq/client";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const NOTION_API_KEY = process.env.NOTION_API_KEY;
// Prioritize NOTION_DATABASE_ID (correct from debugging) then fallback
const DATABASE_ID = process.env.NOTION_DATABASE_ID || process.env.NOTION_DB_ID;

if (!NOTION_API_KEY || !DATABASE_ID) {
	console.error("Missing NOTION_API_KEY or NOTION_DATABASE_ID/NOTION_DB_ID");
	process.exit(1);
}

const notion = new Client({ auth: NOTION_API_KEY });

// Helper to convert Notion property names to camelCase for code usage
function toCamelCase(str: string): string {
	// Remove special chars and extra spaces
	const clean = str.replace(/[^a-zA-Z0-9 ]/g, "").trim();
	return clean
		.split(" ")
		.map((word, index) => {
			if (index === 0) return word.toLowerCase();
			return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
		})
		.join("");
}

// Map Notion types to Zod validators
function mapToZod(type: string, optionsName?: string): string {
	switch (type) {
		case "title":
		case "rich_text":
		case "url":
			return "z.string().optional()";
		case "email":
			return 'z.string().email("Invalid email").optional().or(z.literal(""))';
		case "phone_number":
			return "z.string().optional()";
		case "number":
			return "z.preprocess((val) => Number(val), z.number().optional())";
		case "select":
			// If we have options, we could make a specialized Enum, but string is safer for sync
			return "z.string().optional()";
		case "multi_select":
			return "z.array(z.string()).optional()";
		case "date":
			return "z.string().optional()";
		case "checkbox":
			return "z.boolean().optional()";
		default:
			return "z.any().optional()";
	}
}

// Map Notion types to Form Field config types
function mapToFieldType(type: string): string {
	switch (type) {
		case "title":
		case "rich_text":
			return '"text"';
		case "email":
			return '"email"';
		case "phone_number":
			return '"tel"';
		case "url":
			return '"url"';
		case "number":
			return '"number"';
		case "select":
			return '"select"';
		case "multi_select":
			return '"multiselect"';
		case "date":
			return '"date"';
		case "checkbox":
			return '"checkbox"';
		default:
			return '"text"';
	}
}

// Map Notion property names (exact) to Form Field Keys (camelCase) used in the app
// This ensures we don't break the API route or React components that rely on specific keys.
const PROPERTY_KEY_MAP: Record<string, string> = {
	" Name": "name",
	Email: "email",
	Phone: "phone",
	"Business Type / Niche": "businessType",
	"ICP Category": "icpCategory",
	"Describe Your Ideal Customer Profile": "icpDescription",
	"High-Intent Lead Sources": "highIntentSources",
	"Avg Deal Amount ($)": "avgDealAmount",
	"Deals / Month": "dealsPerMonth",
	"Lead Volume / Month": "leadVolumePerMonth",
	"Conversion Rate %": "conversionRate",
	"Current CRM": "currentCrm",
	"Existing Lead Lists?": "existingLeadLists",
	"Who will be responsible for reviewing and acting on the leads?": "leadOwner",
	"Main Pain Point(s)": "painPoints",
	"Monthly Budget": "monthlyBudget",
	"Priority Level": "priorityLevel",
	"What is your expectation for initial validation?": "validationExpectation",
	"Start Date ": "startDate",
	"If approved, how soon can you actively work and test a new lead list?":
		"speed",
	"Detailed Scraping Instructions ?": "scrapingInstructions",
	"Can we connect directly to your CRM?": "crmConnection",
	"Interested in these features?": "interestedFeatures",
	"Are you willing to pay for a small pilot to validate lead quality before scaling":
		"paidPilot",
	"Schedule Kickoff Call": "kickoffDate",
	"Company Website ?": "website",
	Notes: "notes",
	"Disqualification Reason": "disqualificationReason",
};

// Properties to IGNORE in the form (internal use only)
const IGNORE_PROPERTIES = [
	"Qualified", // Status field managed internally
	"Date Created",
	"Last Edited Time",
	"Disqualification Reason", // Internal field
];

// Manual options override for select/multi_select fields
// Use this when the Source Database is inaccessible and page scanning doesn't capture all options
// Format: { "Notion Property Name": ["Option 1", "Option 2", ...] }
const MANUAL_OPTIONS_OVERRIDE: Record<string, string[]> = {
	// Business Type / Niche - multiselect
	"Business Type / Niche": [
		"🏘️Real Estate",
		"💼 B2B  Niche",
		"💹Marketplace",
		"🛠️ Contractor / Home Service",
		"🧪 Herbal / Botanical Niche",
		"🎤 Event & Creative Niche",
		"🙌🏽Coaching Niche",
		"🧑‍💻 Tech & SaaS Niche",
		"🛍️ E-commerce & Retail",
		"🧘 Health / Wellness",
		"🧾 Professional Services",
		"🌱 Alternative / Mission-Driven",
		"♎ B2C High Virality",
		"🔧 Misc. Flexible Options",
		"Agency",
		"SaaS",
	],
	// ICP Category - select (up to 1)
	"ICP Category": [
		"Real Estate Agencies",
		"Residential Real Estate Agents",
		"Commercial Real Estate Agents",
		"Residential Real Estate Brokers",
		"Commercial Real Estate Brokers",
		"Commercial Real Estate Investors",
		"Residential Real Estate Investors",
		"Residential Real Estate Wholesalers",
		"Commercial Real Estate Wholesalers",
		"SaaS Founders",
		"Tech Startups",
		"B2B Service Providers",
		"Local Business Owners",
		"E-commerce Brands",
		"Consultant / Coachs",
		"Solopreneurs",
		"Construction / Contractors",
		"Home Services (HVAC Plumbing Roofing etc.)",
		"Marketing Agency",
		"Freelancer",
		"Nonprofit / Community Org",
		"Event Curator / Event Organizer",
		"Herbalist / Botanical Products",
		"Dating App Users",
		"Consumers with inherent virality",
		"Other",
		"B2B",
	],
	// Existing Lead Lists? - multiselect
	"Existing Lead Lists?": ["Yes   Clean", "Yes   Messy", "No", "Yes"],
	// Who will be responsible for reviewing and acting on the leads? - select
	"Who will be responsible for reviewing and acting on the leads?": [
		"❌ No dedicated owner yet",
		"🤖 Automation / outbound system (Deal Scale)",
		"👥 Sales rep / SDR",
		"👤 Founder",
		"Myself",
	],
	// Main Pain Point(s) - multiselect (up to 3)
	"Main Pain Point(s)": [
		"Not enough high-quality leads",
		"Hard to find high-intent leads",
		"Don't know which websites to scrape",
		"Lead lists are outdated",
		"Lead lists are incomplete",
		"Missing phone numbers",
		"Missing emails",
		"Missing social profiles",
		"Data is messy or inconsistent",
		"Need accurate contact information",
		"Need verified leads only",
		"Need more targeted prospects",
		"Hard to identify ideal customers",
		"Need lookalike audience generation",
		"Need lead scoring or ranking",
		"Leads are scattered across too many places",
		"Need centralized lead database",
		"Want automated recurring scraping",
		"Need bulk enrichment for large lists",
		"Hard to qualify leads quickly",
		"Need faster data collection",
		"Lead Quality",
		"Volume",
	],
	// Monthly Budget - select
	"Monthly Budget": [
		"$3k+",
		"$1k–$3k",
		"$250–$1k",
		"<$250",
		"$1k - $3k",
		"$3k - $5k",
	],
	// Priority Level - multiselect
	"Priority Level": ["High", "Medium", "Low"],
	// What is your expectation for initial validation? - select
	"What is your expectation for initial validation?": [
		"❌ Not sure",
		"💰 Closed revenue required",
		"📊 Conversion over 30–60 days",
		"📈 Directional signal (reply / interest rate)",
		"10 Verified Leads",
	],
	// If approved, how soon can you actively work and test a new lead list? - select
	"If approved, how soon can you actively work and test a new lead list?": [
		"⏱ Not sure / depends",
		"⏱ 2–4 weeks",
		"⏱ Within 7–10 business days",
		"⏱ Within 3–5 business days",
		"Immediately",
	],
	// Can we connect directly to your CRM? - select
	"Can we connect directly to your CRM?": [
		"Yes i dont want to manually upload leads",
		"No id rather manually upload the generated leads",
		"Yes",
	],
	// Interested in these features? - multiselect
	"Interested in these features?": [
		"Look-A-like Audinece Generation (Find leads similar to your top closed clients)",
		"Lead Enrichment - Find Phone numbers emails and socials of leads.",
		"Automated Outreach Text/Call/Linkedin-Instagram-Facebook  (Deal Scale)",
		"Search Engine Optimization (Get Discovered On Search Engines)",
		"AI  Engine Optimization (Get suggested by AI)",
		"Lead Enrichment",
	],
	// Are you willing to pay for a small pilot to validate lead quality before scaling - select
	"Are you willing to pay for a small pilot to validate lead quality before scaling":
		[
			"❌ No   we only test free",
			"⚠️ Depends on price",
			"✅ Yes   paid pilot is fine",
			"Yes",
		],
};

// Manual descriptions for form fields (displayed under the label)
const MANUAL_DESCRIPTIONS: Record<string, string> = {
	" Name": "Used so we know who to contact and personalize communication.",
	Email:
		"Your best email to receive follow-ups, reports, and onboarding details.",
	Phone:
		"Optional   if you'd like us to text or call you with updates or appointment confirmations.",
	"Business Type / Niche":
		"“What specific niche does your business operate in?” Example: wholesaling, Airbnb, botanicals, SaaS apps, e-commerce, event management, coaching, etc.",
	"ICP Category":
		"Who is your ideal customer? The type of people or businesses you aim to serve or sell to.",
	"Describe Your Ideal Customer Profile":
		"Tell us who your ideal customer is. Describe the type of person or business you want to attract, serve, or sell to including demographics, behavior, buying intent, and any specific traits that define a perfect-fit client",
	"High-Intent Lead Sources":
		"“List any websites, URLs, or platforms you believe would have high-value leads for your business. These are the places you’d want us to scrape, monitor, or extract leads from.” Examples: Zillow links, MLS boards, competitor sites, directory pages, Google Maps, LinkedIn searches, etc.",
	"Avg Deal Amount ($)":
		"“On average, how much do you earn per deal, appointment, or closed customer?” Used to estimate ROI and automation impact.",
	"Deals / Month":
		"“How many deals or clients do you typically close each month?” This helps us estimate your sales velocity.",
	"Lead Volume / Month":
		"“How many new leads do you want generated monthly across all channels?” Useful for scoring lead flow and automation capacity.",
	"Conversion Rate %": "What percent of leads do you convert",
	"Current CRM":
		"“What CRM or system do you use today to manage your leads?” Examples: HubSpot, Zoho, GHL, Lofty, spreadsheets, none.",
	"Existing Lead Lists?":
		"“Do you already have spreadsheets or contact lists you'd like us to clean, enrich, or import?”",
	"Main Pain Point(s)":
		"“What’s the biggest challenge you want solved right now?” Examples: lead quality, inconsistent appointments, too much manual work, bad data, etc.",
	"Monthly Budget": "This helps us match you with the right plan or solution.",
	"Priority Level": "How urgent is this problem for your business?",
	"Start Date ":
		"What date would you like to begin? Please enter your ideal start date for onboarding, setup, or automation work.",
	"Detailed Scraping Instructions ?":
		"“Please describe exactly what you want us to scrape. Include any URLs, keywords, filters, pages, or specific data points you want captured.”",
	"Interested in these features?":
		"Select any features you’re interested in using. This helps us tailor your setup, automation, and pricing to the tools that matter most for your business.",
	"Are you willing to pay for a small pilot to validate lead quality before scaling":
		"Paid pilots help us ensure high-quality data tailored to your needs.",
	"Schedule Kickoff Call":
		"If you qualify when can you hop on a kick off call to meet your start date deadlines? Book here: https://calendar.notion.so/meet/cyberoni/em2w42l93",
	Notes:
		"Add any additional context, goals, or details about your business we should know.",
	"Company Website ?": "Your primary business website URL.",
	"Who will be responsible for reviewing and acting on the leads?":
		"Select the primary person or system handling these leads.",
	"If approved, how soon can you actively work and test a new lead list?":
		"This helps us schedule your onboarding timeline.",
	"What is your expectation for initial validation?":
		"Define what a successful pilot looks like for you.",
	"Can we connect directly to your CRM?":
		"This allows for seamless lead handoff.",
};

// field order definition
const FIELD_ORDER = [
	// 1. Essentials
	" Name",
	"Email",
	"Phone",
	"Company Website ?",
	"Business Type / Niche",
	// 2. Qualification
	"Monthly Budget",
	"Main Pain Point(s)",
	"Start Date ",
	"Priority Level",
	// 3. Scope
	"ICP Category",
	"Describe Your Ideal Customer Profile",
	"High-Intent Lead Sources",
	"Detailed Scraping Instructions ?",
	// 4. Details
	"Lead Volume / Month",
	"Deals / Month",
	"Avg Deal Amount ($)",
	"Conversion Rate %",
	// 5. Logistics
	"Current CRM",
	"Can we connect directly to your CRM?",
	"Existing Lead Lists?",
	"Who will be responsible for reviewing and acting on the leads?",
	"What is your expectation for initial validation?",
	"If approved, how soon can you actively work and test a new lead list?",
	"Are you willing to pay for a small pilot to validate lead quality before scaling",
	// 6. Closing
	"Interested in these features?",
	"Notes",
	"Schedule Kickoff Call",
];

async function main() {
	console.log(`Fetching schema from Database ID: ${DATABASE_ID}...`);

	try {
		let properties: any = null;
		let usingFallback = false;

		// 1. Try to get full schema from Source Database (best for Options)
		let targetDbId = DATABASE_ID!;
		try {
			let db = await notion.databases.retrieve({ database_id: DATABASE_ID! });

			// Handle Linked Views
			if ((db as any).data_sources && (db as any).data_sources.length > 0) {
				const realDbId = (db as any).data_sources[0].id;
				targetDbId = realDbId; // Update target for fallback query
				console.log(
					`ℹ️  Provided ID is a View. Attempting to resolve Source ID: ${realDbId}`,
				);
				try {
					db = await notion.databases.retrieve({ database_id: realDbId });
					properties = db.properties;
				} catch (e: any) {
					console.warn(
						`⚠️  Could not access Source Database (${realDbId}). Missing permissions?`,
					);
					console.warn(
						`   Falling back to Page Inspection. Select Options will be empty.`,
					);
				}
			} else {
				properties = db.properties;
			}
		} catch (e: any) {
			console.warn("⚠️  Could not retrieve Database info.");
			console.warn("DEBUG: Retrieve Error:", e.message || e);
		}

		// 2. Fallback: Query multiple pages to inspect properties AND collect select options
		// Map to store all unique select/multiselect options found across all pages
		const collectedOptions: Map<string, Set<string>> = new Map();

		if (!properties) {
			console.log(
				`ℹ️  Falling back to querying the database to infer schema from pages...`,
			);
			console.log(
				`ℹ️  Will also collect select/multiselect options from all pages.`,
			);

			// Use raw fetch as notion.request keeps failing with "Invalid request URL"
			// Query the View ID directly since the Source Database is not shared with the integration
			const apiUrl = `https://api.notion.com/v1/databases/${DATABASE_ID}/query`;

			const fetchResp = await fetch(apiUrl, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${NOTION_API_KEY}`,
					"Notion-Version": "2022-06-28",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ page_size: 100 }), // Fetch more pages to collect options
			});

			if (!fetchResp.ok) {
				const errBody = await fetchResp.text();
				throw new Error(`Notion API Error: ${fetchResp.status} - ${errBody}`);
			}

			const query = await fetchResp.json();

			if (query.results && query.results.length > 0) {
				properties = (query.results[0] as any).properties;
				usingFallback = true;

				// Collect select options from ALL pages
				console.log(
					`ℹ️  Scanning ${query.results.length} pages to collect select options...`,
				);
				for (const page of query.results) {
					const pageProps = page.properties;
					for (const [propName, propValue] of Object.entries(pageProps)) {
						const pv = propValue as any;
						if (pv.type === "select" && pv.select?.name) {
							if (!collectedOptions.has(propName))
								collectedOptions.set(propName, new Set());
							collectedOptions.get(propName)!.add(pv.select.name);
						} else if (pv.type === "multi_select" && pv.multi_select) {
							if (!collectedOptions.has(propName))
								collectedOptions.set(propName, new Set());
							for (const opt of pv.multi_select) {
								if (opt.name) collectedOptions.get(propName)!.add(opt.name);
							}
						}
					}
				}
				console.log(
					`✅ Collected options for ${collectedOptions.size} select/multiselect properties`,
				);
			} else {
				throw new Error(
					"Could not retrieve Source Database AND Database is empty. Cannot infer schema.",
				);
			}
		}

		if (!properties) {
			// Should be caught above
			throw new Error("Could not retrieve properties.");
		}

		console.log(
			`✅ Properties retrieved` +
				(usingFallback ? " (via Page Inspection)" : " (via Database Schema)"),
		);

		let optionsCode = "";
		let zodSchemaFields = "";
		let formFieldsConfig = "";

		// Determine sort order
		// 1. Start with explicit FIELD_ORDER
		// 2. Add any remaining keys from 'properties' that weren't in FIELD_ORDER (sorted at the end)
		const allKeys = Object.keys(properties);
		const validOrderedKeys = FIELD_ORDER.filter((key) => allKeys.includes(key));
		const remainingKeys = allKeys
			.filter((key) => !FIELD_ORDER.includes(key))
			.sort();

		const finalSortedKeys = [...validOrderedKeys, ...remainingKeys];

		for (const key of finalSortedKeys) {
			if (IGNORE_PROPERTIES.includes(key)) continue;

			const prop = properties[key];
			// Use mapped key or fallback to camelCase
			const camelName = PROPERTY_KEY_MAP[key] || toCamelCase(key);
			const propType = prop.type;

			// --- 1. Handle Options (Select / Multi-Select) ---
			let optionsVarName = "undefined"; // Default to undefined so it doesn't appear in object if not needed

			if (propType === "select" || propType === "multi_select") {
				let options: { name: string }[] | undefined;

				// Priority 1: Manual overrides (most reliable when Source DB is inaccessible)
				if (MANUAL_OPTIONS_OVERRIDE[key]) {
					options = MANUAL_OPTIONS_OVERRIDE[key].map((name) => ({ name }));
					console.log(
						`  → Using ${options.length} options for "${key}" from MANUAL_OPTIONS_OVERRIDE`,
					);
				}

				// Priority 2: Get options from database schema (if source DB was accessible)
				if (!options || options.length === 0) {
					const propData = (prop as any)[propType];
					const schemaOptions = propData?.options;
					if (schemaOptions && schemaOptions.length > 0) {
						options = schemaOptions;
					}
				}

				// Priority 3: Use collected options from page scanning
				if ((!options || options.length === 0) && collectedOptions.has(key)) {
					const collected = Array.from(collectedOptions.get(key)!);
					if (collected.length > 0) {
						options = collected.map((name) => ({ name }));
						console.log(
							`  → Using ${collected.length} options for "${key}" from page scan`,
						);
					}
				}

				if (options && options.length > 0) {
					const varName = `${camelName}Options`;
					optionsCode += `const ${varName} = ${JSON.stringify(
						options.map((o: any) => ({
							value: o.name,
							label: o.name, // Using name as label
						})),
						null,
						2,
					)};\n\n`;
					optionsVarName = varName;
				} else {
					optionsVarName = "[]";
				}
			}

			// --- 2. Build Zod Schema ---
			// We assume most fields are optional for the generated schema to be safe,
			// but in the real app 'name' and 'email' might be required.
			// We can add specific overrides here if needed.
			let zodDefinition = mapToZod(propType);
			if (camelName === "name")
				zodDefinition = 'z.string().min(2, "Name is required")';
			if (camelName === "email")
				zodDefinition = 'z.string().email("Invalid email address")';

			const zodLine = `  ${camelName}: ${zodDefinition},\n`;
			zodSchemaFields += zodLine;

			// --- 3. Build Form Field Config ---
			const label = key; // Use Notion property name as label
			const fieldType = mapToFieldType(propType);

			// Construct the field object cleanly
			let fieldObj = `  {
    name: "${camelName}",
    label: "${label}",
    type: ${fieldType},
    placeholder: "${label}...",
    value: ${propType === "multi_select" ? "[]" : '""'},
    description: ${MANUAL_DESCRIPTIONS[key] ? `"${MANUAL_DESCRIPTIONS[key]}"` : "undefined"},
    onChange: () => {},`;

			if (optionsVarName !== "undefined") {
				fieldObj += `\n    options: ${optionsVarName},`;
			}

			fieldObj += `\n  },\n`;
			formFieldsConfig += fieldObj;
		}

		// Assemble the full file content
		const fileContent = `import type { FieldConfig } from "@/types/contact/formFields";
import { z } from "zod";

// * ------------------------------------------------------------------
// * AUTO-GENERATED BY scripts/sync-schema.ts
// * ------------------------------------------------------------------

// * Options definitions
${optionsCode}

// * Zod Schema
export const intakeFormSchema = z.object({
${zodSchemaFields}
});

export type IntakeFormValues = z.infer<typeof intakeFormSchema>;

// * Field Configurations
export const intakeFormFields: FieldConfig[] = [
${formFieldsConfig}
];
`;

		// Write to file
		const outputPath = path.resolve(
			__dirname,
			"../src/data/contact/intakeFormFields.ts",
		);

		// BACKUP existing file
		if (fs.existsSync(outputPath)) {
			fs.copyFileSync(outputPath, outputPath + ".bak");
			console.log(`📦 Backup created at ${outputPath}.bak`);
		}

		fs.writeFileSync(outputPath, fileContent);
		console.log(`✅ Successfully synced Notion schema to ${outputPath}`);
	} catch (error: any) {
		console.error("Failed to sync schema:", error);
		fs.writeFileSync(
			"sync_debug.log",
			JSON.stringify(error, Object.getOwnPropertyNames(error), 2),
		);
	}
}

main();
