#!/usr/bin/env tsx
/**
 * Script to remove duplicate 'export const runtime = "edge"' declarations
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

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

function removeDuplicateEdgeRuntime(filePath: string): boolean {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Find all lines with 'export const runtime'
  const runtimeLines: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.includes("export const runtime") && (line.includes("'edge'") || line.includes('"edge"'))) {
      runtimeLines.push(i);
    }
  }

  // If there's only one or zero, no duplicates
  if (runtimeLines.length <= 1) {
    return false;
  }

  // Keep the first one, remove the rest
  const linesToRemove = runtimeLines.slice(1).reverse(); // Reverse to remove from bottom up
  let modified = false;

  for (const lineNum of linesToRemove) {
    // Remove the line and any empty line after it if it exists
    lines.splice(lineNum, 1);
    // Also remove empty line after if present
    if (lineNum < lines.length && lines[lineNum].trim() === '') {
      lines.splice(lineNum, 1);
    }
    modified = true;
  }

  if (modified) {
    writeFileSync(filePath, lines.join('\n'), 'utf-8');
    return true;
  }

  return false;
}

function main() {
  const appDir = join(process.cwd(), 'src/app');
  if (!existsSync(appDir)) {
    console.error(`❌ src/app directory not found at ${appDir}`);
    process.exit(1);
  }

  const allFiles = findRouteFiles(appDir);
  let fixed = 0;
  let skipped = 0;

  console.log(`📋 Checking ${allFiles.length} route/page files for duplicate edge runtime declarations\n`);

  for (const file of allFiles) {
    const relativePath = file.replace(process.cwd() + '/', '');
    if (removeDuplicateEdgeRuntime(file)) {
      console.log(`✅ Fixed duplicates: ${relativePath}`);
      fixed++;
    } else {
      skipped++;
    }
  }

  console.log(`\n✨ Done! Fixed ${fixed} files, skipped ${skipped} files.`);
}

main();



