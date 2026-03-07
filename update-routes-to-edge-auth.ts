/**
 * Script to update all API routes from next-auth to Edge-compatible auth
 * Run with: pnpm exec tsx scripts/update-routes-to-edge-auth.ts
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const API_DIR = join(process.cwd(), "src", "app", "api");

async function findRouteFiles(dir: string): Promise<string[]> {
	const files: string[] = [];
	try {
		const entries = await readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = join(dir, entry.name);
			if (entry.isDirectory()) {
				files.push(...(await findRouteFiles(fullPath)));
			} else if (entry.name === "route.ts") {
				files.push(fullPath);
			}
		}
	} catch (error) {
		// Ignore errors (e.g., permission denied)
	}
	return files;
}

async function updateRouteFile(filePath: string): Promise<boolean> {
	try {
		const content = await readFile(filePath, "utf-8");

		// Skip if already updated or doesn't use next-auth
		if (
			!content.includes('from "next-auth"') &&
			!content.includes("from 'next-auth'")
		) {
			return false;
		}

		// Skip if already has edge runtime
		if (content.includes('export const runtime = "edge"')) {
			return false;
		}

		// Skip next-auth route handler itself
		if (filePath.includes("auth/[...nextauth]")) {
			return false;
		}

		let updated = content;

		// Replace imports
		updated = updated.replace(
			/import\s+{\s*authOptions\s*}\s+from\s+["']@\/lib\/authOptions["'];?\s*\n/,
			"",
		);
		updated = updated.replace(
			/import\s+{\s*getServerSession\s*}\s+from\s+["']next-auth["'];?\s*\n/,
			'import { getServerSession } from "@/lib/auth-edge";\n',
		);

		// Add edge runtime if not present
		if (!updated.includes('export const runtime = "edge"')) {
			// Find the first export statement and add runtime before it
			const exportMatch = updated.match(/^(export\s+(async\s+)?function)/m);
			if (exportMatch) {
				const insertPos = updated.indexOf(exportMatch[0]);
				updated =
					updated.slice(0, insertPos) +
					'export const runtime = "edge";\n\n' +
					updated.slice(insertPos);
			}
		}

		// Replace getServerSession(authOptions) with getServerSession(req)
		updated = updated.replace(
			/getServerSession\s*\(\s*authOptions\s*\)/g,
			"getServerSession(req)",
		);

		// Ensure req parameter is available in function signature
		// This is a simple check - if the function doesn't have req, we can't fix it automatically
		// Most routes already have req: NextRequest parameter

		if (updated !== content) {
			await writeFile(filePath, updated, "utf-8");
			console.log(`Updated: ${filePath}`);
			return true;
		}
	} catch (error) {
		console.error(`Error updating ${filePath}:`, error);
	}
	return false;
}

async function main() {
	console.log("Finding route files...");
	const routeFiles = await findRouteFiles(API_DIR);
	console.log(`Found ${routeFiles.length} route files`);

	let updatedCount = 0;
	for (const file of routeFiles) {
		if (await updateRouteFile(file)) {
			updatedCount++;
		}
	}

	console.log(`\nUpdated ${updatedCount} files`);
}

main().catch(console.error);
