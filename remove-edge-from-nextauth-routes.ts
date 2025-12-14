#!/usr/bin/env tsx
/**
 * Script to remove edge runtime from routes that use next-auth
 * (next-auth requires Node.js built-ins and is incompatible with Edge Runtime)
 */

import { readFile, writeFile } from 'fs/promises';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ROOT = join(__dirname, '..');
const APP_DIR = join(PROJECT_ROOT, 'src', 'app', 'api');

async function findRouteFiles(dir: string, fileList: string[] = []): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = join(dir, entry.name);

		if (entry.isDirectory()) {
			if (
				entry.name === 'node_modules' ||
				entry.name === '.next' ||
				entry.name === 'dist' ||
				entry.name.startsWith('.') ||
				entry.name === '_docs' ||
				entry.name === '_debug'
			) {
				continue;
			}
			await findRouteFiles(fullPath, fileList);
		} else if (entry.name === 'route.ts' || entry.name === 'route.tsx') {
			fileList.push(fullPath);
		}
	}

	return fileList;
}

async function checkUsesNextAuth(filePath: string): Promise<boolean> {
	try {
		const content = await readFile(filePath, 'utf-8');
		return (
			content.includes('next-auth') ||
			content.includes('getServerSession') ||
			content.includes('getSession') ||
			content.includes('NextAuth')
		);
	} catch {
		return false;
	}
}

async function removeEdgeRuntime(filePath: string): Promise<boolean> {
	try {
		const content = await readFile(filePath, 'utf-8');

		// Check if file has edge runtime
		if (!content.includes("export const runtime = 'edge'")) {
			return false;
		}

		// Remove the line (handle different patterns)
		let newContent = content
			.replace(/^export const runtime = 'edge';\s*\n/gm, '') // Standalone line
			.replace(/^export const runtime = 'edge';\s*$/gm, '') // At end of line
			.replace(/\n\s*export const runtime = 'edge';\s*\n/g, '\n') // Between lines
			.replace(/export const runtime = 'edge';\s*\n\s*\n/g, '\n'); // With extra newline

		// Clean up multiple consecutive newlines
		newContent = newContent.replace(/\n{3,}/g, '\n\n');

		if (newContent !== content) {
			await writeFile(filePath, newContent, 'utf-8');
			console.log(`✅ Removed edge runtime from ${filePath}`);
			return true;
		}

		return false;
	} catch (error) {
		console.error(`❌ Error processing ${filePath}:`, error);
		return false;
	}
}

async function main() {
	console.log('🔍 Finding route files that use next-auth...\n');

	const routeFiles = await findRouteFiles(APP_DIR);
	console.log(`Found ${routeFiles.length} route files\n`);

	let updated = 0;
	let skipped = 0;

	for (const file of routeFiles) {
		const usesNextAuth = await checkUsesNextAuth(file);
		if (usesNextAuth) {
			const wasUpdated = await removeEdgeRuntime(file);
			if (wasUpdated) {
				updated++;
			} else {
				skipped++;
			}
		}
	}

	console.log(`\n✨ Done! Updated ${updated} files, skipped ${skipped} files.`);
}

main().catch(console.error);









