#!/usr/bin/env tsx
/**
 * Script to add `export const runtime = 'edge';` to all API routes and dynamic pages
 * for Cloudflare Pages compatibility.
 */

import { readdir, readFile, writeFile, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ROOT = join(__dirname, '..');
const APP_DIR = join(PROJECT_ROOT, 'src', 'app');

const EDGE_RUNTIME_EXPORT = "export const runtime = 'edge';\n";

async function isDirectory(path: string): Promise<boolean> {
	try {
		const stats = await stat(path);
		return stats.isDirectory();
	} catch {
		return false;
	}
}

async function findRouteFiles(dir: string, fileList: string[] = []): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = join(dir, entry.name);

		if (entry.isDirectory()) {
			// Skip node_modules and other build directories
			if (
				entry.name === 'node_modules' ||
				entry.name === '.next' ||
				entry.name === 'dist' ||
				entry.name.startsWith('.')
			) {
				continue;
			}
			await findRouteFiles(fullPath, fileList);
		} else if (entry.name === 'route.ts' || entry.name === 'route.tsx') {
			fileList.push(fullPath);
		} else if (
			entry.name === 'page.tsx' ||
			entry.name === 'page.ts'
		) {
			// Check if it's a dynamic route (contains [slug] or similar in path)
			// OR if it's one of the specific pages that need edge runtime
			const needsEdge = 
				fullPath.includes('[') && fullPath.includes(']') && !fullPath.includes('events/[slug]') ||
				fullPath.includes('page.tsx') && (
					fullPath.includes('app/page.tsx') ||
					fullPath.includes('app/linktree/page.tsx') ||
					fullPath.includes('app/products/page.tsx') ||
					fullPath.includes('app/vas/apply/page.tsx')
				);
			
			if (needsEdge) {
				fileList.push(fullPath);
			}
		}
	}

	return fileList;
}

async function addEdgeRuntime(filePath: string): Promise<boolean> {
	try {
		const content = await readFile(filePath, 'utf-8');

		// Skip if already has runtime export
		if (content.includes("export const runtime")) {
			console.log(`⏭️  Skipping ${filePath} (already has runtime export)`);
			return false;
		}

		// Skip if it's a layout file (layouts shouldn't use edge runtime typically)
		if (filePath.includes('layout.')) {
			console.log(`⏭️  Skipping ${filePath} (layout file)`);
			return false;
		}

		// Skip events/[slug] page (uses generateStaticParams which is incompatible)
		if (filePath.includes('events/[slug]')) {
			console.log(`⏭️  Skipping ${filePath} (uses generateStaticParams)`);
			return false;
		}

		// Find the first import statement or export
		const lines = content.split('\n');
		let insertIndex = 0;

		// Find where to insert (after imports, before first export)
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();
			// Stop at first export that's not an import
			if (line.startsWith('export ') && !line.startsWith('export {')) {
				insertIndex = i;
				break;
			}
			// If we hit a blank line after imports, insert there
			if (line === '' && i > 0 && lines[i - 1].trim().startsWith('import')) {
				insertIndex = i;
				break;
			}
		}

		// If no good spot found, insert after last import or at top
		if (insertIndex === 0) {
			for (let i = lines.length - 1; i >= 0; i--) {
				if (lines[i].trim().startsWith('import')) {
					insertIndex = i + 1;
					break;
				}
			}
		}

		// Insert the runtime export
		lines.splice(insertIndex, 0, EDGE_RUNTIME_EXPORT.trim());

		const newContent = lines.join('\n');
		await writeFile(filePath, newContent, 'utf-8');

		console.log(`✅ Added edge runtime to ${filePath}`);
		return true;
	} catch (error) {
		console.error(`❌ Error processing ${filePath}:`, error);
		return false;
	}
}

async function main() {
	console.log('🔍 Finding route files...\n');

	const routeFiles = await findRouteFiles(APP_DIR);
	console.log(`Found ${routeFiles.length} route files\n`);

	let updated = 0;
	let skipped = 0;

	for (const file of routeFiles) {
		const wasUpdated = await addEdgeRuntime(file);
		if (wasUpdated) {
			updated++;
		} else {
			skipped++;
		}
	}

	console.log(`\n✨ Done! Updated ${updated} files, skipped ${skipped} files.`);
}

main().catch(console.error);









