#!/usr/bin/env tsx
/**
 * Script to add `export const runtime = 'edge';` to all routes missing it
 * Excludes routes that are incompatible with edge runtime (e.g., events/[slug])
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const EXCLUDE_PATTERNS = [
  'events/[slug]', // Uses generateStaticParams which is incompatible
];

function shouldExclude(filePath: string): boolean {
  return EXCLUDE_PATTERNS.some((pattern) => filePath.includes(pattern));
}

function findRouteFiles(dir: string, fileList: string[] = []): string[] {
  const files = readdirSync(dir);

  for (const file of files) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      findRouteFiles(filePath, fileList);
    } else if (file === 'route.ts' || file === 'page.tsx' || file === 'page.ts') {
      fileList.push(filePath);
    }
  }

  return fileList;
}

function addEdgeRuntime(filePath: string): boolean {
  if (shouldExclude(filePath)) {
    console.log(`⏭️  Skipping (excluded): ${filePath}`);
    return false;
  }

  const content = readFileSync(filePath, 'utf-8');

  // Skip if already has edge runtime
  if (content.includes("export const runtime = 'edge'")) {
    return false;
  }

  // Find the best place to add it - after imports, before exports
  const lines = content.split('\n');
  let insertIndex = -1;

  // Find the last import statement
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('import ')) {
      insertIndex = i + 1;
    } else if (insertIndex >= 0 && lines[i].trim() === '') {
      // Found empty line after imports, use this
      insertIndex = i;
      break;
    }
  }

  // If no imports found, insert at the top (after any comments)
  if (insertIndex === -1) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('//') || lines[i].trim().startsWith('/*')) {
        continue;
      }
      if (lines[i].trim() !== '') {
        insertIndex = i;
        break;
      }
    }
  }

  // Insert the edge runtime export
  const edgeRuntimeLine = "export const runtime = 'edge';";
  const newLines = [
    ...lines.slice(0, insertIndex),
    edgeRuntimeLine,
    '', // Add empty line for readability
    ...lines.slice(insertIndex),
  ];

  writeFileSync(filePath, newLines.join('\n'), 'utf-8');
  return true;
}

function main() {
  const appDir = join(process.cwd(), 'src/app');
  if (!existsSync(appDir)) {
    console.error(`❌ src/app directory not found at ${appDir}`);
    process.exit(1);
  }

  const allFiles = findRouteFiles(appDir);
  let added = 0;
  let skipped = 0;

  console.log(`📋 Found ${allFiles.length} route/page files to check\n`);

  for (const file of allFiles) {
    const relativePath = file.replace(process.cwd() + '/', '');
    if (addEdgeRuntime(file)) {
      console.log(`✅ Added edge runtime: ${relativePath}`);
      added++;
    } else {
      skipped++;
    }
  }

  console.log(`\n✨ Done! Added edge runtime to ${added} files, skipped ${skipped} files.`);
}

main();
