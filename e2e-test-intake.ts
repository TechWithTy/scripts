/**
 * E2E Test Script for Intake Form -> Notion Database
 * 
 * Run with: npx tsx scripts/e2e-test-intake.ts
 */

const API_URL = process.env.API_URL || "http://localhost:3555";

// Complete test payload with all fields
const testPayload = {
  // Required fields
  name: `E2E Test User - ${new Date().toISOString()}`,
  email: `test.e2e.${Date.now()}@example.com`,
  
  // Optional text fields
  phone: "+1234567890",
  currentCrm: "HubSpot",
  icpDescription: "B2B SaaS companies with 10-50 employees looking to scale their lead generation",
  highIntentSources: "LinkedIn Sales Navigator, Product Hunt, TechCrunch",
  scrapingInstructions: "Scrape LinkedIn for SaaS founders in San Francisco Bay Area",
  website: "https://test-company.example.com",
  notes: "This is an E2E test submission - please ignore and delete",
  
  // Number fields
  avgDealAmount: 5000,
  dealsPerMonth: 10,
  leadVolumePerMonth: 500,
  conversionRate: 15,
  
  // Multiselect fields (arrays)
  businessType: ["🧑‍💻 Tech & SaaS Niche", "💼 B2B  Niche"],
  icpCategory: ["SaaS Founders", "Tech Startups"],
  existingLeadLists: ["Yes   Clean"],
  painPoints: ["Not enough high-quality leads", "Hard to find high-intent leads", "Missing emails"],
  priorityLevel: ["High"],
  crmConnection: ["Yes i dont want to manually upload leads"],
  interestedFeatures: ["Lead Enrichment - Find Phone numbers emails and socials of leads.", "Lead Enrichment"],
  
  // Select fields (single value)
  leadOwner: "👤 Founder",
  monthlyBudget: "$1k–$3k",
  validationExpectation: "📊 Conversion over 30–60 days",
  speed: "Immediately",
  paidPilot: "✅ Yes   paid pilot is fine",
  
  // Date fields
  startDate: "2026-03-01",
  kickoffDate: "2026-03-05",
};

async function runTest() {
  console.log("🧪 Starting E2E Test: Intake Form -> Notion Database\n");
  console.log("📝 Test Payload:");
  console.log(JSON.stringify(testPayload, null, 2));
  console.log("\n" + "=".repeat(60) + "\n");
  
  try {
    console.log(`📤 Sending POST request to ${API_URL}/api/contact/intake...`);
    
    const response = await fetch(`${API_URL}/api/contact/intake`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testPayload),
    });
    
    const result = await response.json();
    
    console.log(`\n📥 Response Status: ${response.status} ${response.statusText}`);
    console.log("📦 Response Body:", JSON.stringify(result, null, 2));
    
    if (response.ok && result.success) {
      console.log("\n✅ SUCCESS! Lead was created in Notion database.");
      console.log("\n📋 Summary:");
      console.log(`   - Name: ${testPayload.name}`);
      console.log(`   - Email: ${testPayload.email}`);
      console.log(`   - Business Types: ${testPayload.businessType.join(", ")}`);
      console.log(`   - ICP Categories: ${testPayload.icpCategory.join(", ")}`);
      console.log(`   - Pain Points: ${testPayload.painPoints.join(", ")}`);
      console.log(`   - Monthly Budget: ${testPayload.monthlyBudget}`);
      console.log(`   - Priority: ${testPayload.priorityLevel.join(", ")}`);
      console.log("\n🎉 E2E Test PASSED! Check your Notion database to verify the entry.");
      return true;
    } else {
      console.log("\n❌ FAILED! API returned an error.");
      console.log("   Error:", result.error || "Unknown error");
      return false;
    }
    
  } catch (error: any) {
    console.error("\n💥 ERROR! Test failed with exception:");
    console.error("   ", error.message);
    
    if (error.cause?.code === "ECONNREFUSED") {
      console.log("\n⚠️  Make sure the dev server is running: pnpm dev");
    }
    
    return false;
  }
}

// Run the test
runTest().then((success) => {
  process.exit(success ? 0 : 1);
});
