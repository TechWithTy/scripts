/* Export company data from src/data/company.ts to JSON for Strapi seeding */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// Import company data
import { companyData } from "../../src/data/company";

function main() {
	const outPath = resolve(process.cwd(), "content/strapi-export/company.json");
	mkdirSync(dirname(outPath), { recursive: true });

	// Transform company data for Strapi
	const companyInfo = {
		id: "dealscale-company",
		name: companyData.companyName,
		tagline: companyData.companyDescription,
		description: companyData.companyDescription,
		mission: "AI-Powered Real Estate Automation", // Add mission if available
		vision:
			"Consistent, predictable deal pipelines for real estate professionals", // Add vision if available
		values: [], // Add values if available in companyData
		founded: "2024", // Add founded year if available
		headquarters: companyData.contactInfo?.address,
		website: "https://dealscale.io", // Add website if available
		socialLinks: companyData.socialLinks,
		team: [], // Add team data if available
		culture: "Innovation-focused, results-driven", // Add culture if available
	};

	// Write as a single object (or array if needed)
	writeFileSync(outPath, JSON.stringify([companyInfo], null, 2), {
		encoding: "utf-8",
	});
	console.log(`Exported company data -> ${outPath}`);
}

main();
