import { Client } from "@notionhq/client";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const createTestLead = async () => {
	// 1. Credentials
	const API_KEY = process.env.NOTION_API_KEY || process.env.NOTION_KEY;
	const DATABASE_ID =
		process.env.NOTION_DATABASE_ID || process.env.NOTION_DB_ID;

	if (!API_KEY || !DATABASE_ID) {
		console.error("❌ Missing API config.");
		console.error("NOTION_API_KEY:", API_KEY ? "Set" : "Missing");
		console.error("NOTION_DATABASE_ID:", DATABASE_ID ? "Set" : "Missing");
		return;
	}

	console.log(`Using DB ID: ${DATABASE_ID}`);
	const notion = new Client({ auth: API_KEY });

	// 2. Verified Property Names
	// Title is " Name" (with a leading space)
	// Email is "Email" (rich_text)
	// Phone is "Phone" (rich_text)
	// Website is "Company Website ?" (url)

	const payload: any = {
		parent: { database_id: DATABASE_ID },
		properties: {
			" Name": {
				title: [{ text: { content: "Test Lead Full Payload" } }],
			},
			Email: {
				rich_text: [{ text: { content: "full_test@example.com" } }],
			},
			Phone: {
				rich_text: [{ text: { content: "555-000-TEST" } }],
			},
			"Company Website ?": {
				url: "https://full-test.com",
			},
			// Selects & Multi-Selects (Using "Other" or generic values to minimize validation errors)
			"Business Type / Niche": {
				multi_select: [{ name: "Agency" }],
			},
			"Avg Deal Amount ($)": {
				number: 5000,
			},
			"Deals / Month": {
				number: 10,
			},
			"Lead Volume / Month": {
				number: 1000,
			},
			"Conversion Rate %": {
				number: 5,
			},
			"Current CRM": {
				rich_text: [{ text: { content: "HubSpot" } }],
			},
			"Existing Lead Lists?": {
				multi_select: [{ name: "Yes" }],
			},
			"Who will be responsible for reviewing and acting on the leads?": {
				select: { name: "Myself" },
			},
			"Main Pain Point(s)": {
				multi_select: [{ name: "Lead Quality" }],
			},
			"Monthly Budget": {
				select: { name: "$1k - $3k" },
			},
			"Priority Level": {
				multi_select: [{ name: "High" }],
			},
			"Start Date ": {
				// Note the trailing space
				date: { start: new Date().toISOString() },
			},
			"ICP Category": {
				multi_select: [{ name: "B2B" }],
			},
			"Describe Your Ideal Customer Profile": {
				rich_text: [{ text: { content: "SaaS companies in US" } }],
			},
			"High-Intent Lead Sources": {
				rich_text: [{ text: { content: "LinkedIn, Google" } }],
			},
			"What is your expectation for initial validation?": {
				select: { name: "10 Verified Leads" },
			},
			"If approved, how soon can you actively work and test a new lead list?": {
				select: { name: "Immediately" },
			},
			"Detailed Scraping Instructions ?": {
				rich_text: [{ text: { content: "Scrape all emails" } }],
			},
			"Can we connect directly to your CRM?": {
				multi_select: [{ name: "Yes" }],
			},
			"Interested in these features?": {
				multi_select: [{ name: "Lead Enrichment" }],
			},
			"Are you willing to pay for a small pilot to validate lead quality before scaling":
				{
					select: { name: "Yes" },
				},
			"Schedule Kickoff Call": {
				date: { start: new Date().toISOString() },
			},
			Notes: {
				rich_text: [{ text: { content: "This is a full payload test." } }],
			},
			Qualified: {
				select: { name: "Pending" },
			},
		},
	};

	try {
		console.log("Creating page...");
		const response = await notion.pages.create(payload);
		console.log("✅ SUCCESS! Lead created.");
		console.log("ID:", response.id);
		console.log("URL:", (response as any).url);

		// Write result to file for verification if needed
		fs.writeFileSync(
			path.resolve(__dirname, "final_creation_success.json"),
			JSON.stringify(response, null, 2),
		);
	} catch (error: any) {
		console.error("❌ Failed to create lead.");
		console.error("Error Message:", error.message);
		if (error.body) {
			console.error("Body:", error.body);
		}

		fs.writeFileSync(
			path.resolve(__dirname, "final_creation_error.json"),
			JSON.stringify(error, null, 2),
		);
	}
};

createTestLead();
