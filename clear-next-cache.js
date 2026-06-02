#!/usr/bin/env node

/**
 * Clear Next.js Build Cache
 * 
 * This script clears all Next.js build artifacts and webpack cache
 * to resolve webpack module factory corruption issues.
 * 
 * Usage:
 *   node scripts/clear-next-cache.js
 *   npm run clean:cache (if added to package.json)
 */

const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");

// Directories to remove
const cacheDirs = [
	path.join(projectRoot, ".next"),
	path.join(projectRoot, ".next/cache"),
	path.join(projectRoot, ".next/cache/webpack"),
];

console.log("🧹 Cleaning Next.js caches...\n");

let cleaned = 0;
let skipped = 0;

for (const dir of cacheDirs) {
	if (fs.existsSync(dir)) {
		try {
			fs.rmSync(dir, { recursive: true, force: true });
			console.log(`✅ Removed: ${path.relative(projectRoot, dir)}`);
			cleaned++;
		} catch (error) {
			console.error(`❌ Failed to remove ${dir}:`, error.message);
		}
	} else {
		console.log(`⏭️  Skipped (not found): ${path.relative(projectRoot, dir)}`);
		skipped++;
	}
}

console.log("\n" + "=".repeat(60));
console.log(`\n✨ Cache cleanup complete!`);
console.log(`   - Cleaned: ${cleaned} directories`);
console.log(`   - Skipped: ${skipped} directories (already clean)\n`);

console.log("📋 Next steps:");
console.log("   1. Clear your browser cache:");
console.log("      - Firefox: Ctrl+Shift+Delete → Cached Web Content");
console.log("      - Chrome: Ctrl+Shift+Delete → Cached images and files");
console.log("      - Edge: Ctrl+Shift+Delete → Cached data and files");
console.log("   2. Restart your development server:");
console.log("      pnpm dev (or npm run dev)\n");
console.log("=".repeat(60) + "\n");

