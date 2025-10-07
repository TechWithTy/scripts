/* Export services data from src/data/service/ to JSON for Strapi seeding */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// Import service data - we'll need to check what service files exist
// For now, let's create a basic structure based on what we know exists
import { generalHowItWorks } from "../../src/data/service/slug_data/how_it_works";

function main() {
  const outPath = resolve(process.cwd(), "content/strapi-export/services.json");
  mkdirSync(dirname(outPath), { recursive: true });

  // Transform service workflow data for Strapi
  const services = [
    {
      id: "general-how-it-works",
      name: "General How It Works",
      type: "workflow",
      steps: generalHowItWorks.map(step => ({
        stepNumber: step.stepNumber,
        title: step.title,
        subtitle: step.subtitle,
        description: step.description,
        icon: step.icon,
        label: step.label,
        positionLabel: step.positionLabel,
        payload: step.payload,
        indicator: step.indicator
      }))
    }
    // Add more services as we identify them
  ];

  // Write as a plain JSON array
  writeFileSync(outPath, JSON.stringify(services, null, 2), { encoding: "utf-8" });
  console.log(`Exported ${services.length} services -> ${outPath}`);
}

main();
