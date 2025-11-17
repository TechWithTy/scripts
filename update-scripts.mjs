#!/usr/bin/env node
/**
 * Safely merge package.json scripts without duplicating existing ones.
 * - Adds test:rspack that seeds preview flags then runs your existing test:vitest (if present)
 * - If test:vitest is missing but Vitest is installed, it adds a minimal test:vitest
 * - Adds doctor:rspack to run RSDoctor build + UI without requiring cross-env
 */
import { readFileSync, writeFileSync } from 'node:fs';

const pkgPath = new URL('../package.json', import.meta.url);
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
pkg.scripts ||= {};

const hasVitest = Boolean(
  (pkg.devDependencies && pkg.devDependencies.vitest) ||
    (pkg.dependencies && pkg.dependencies.vitest)
);

// Ensure test:vitest exists if vitest is installed
if (!pkg.scripts['test:vitest'] && hasVitest) {
  pkg.scripts['test:vitest'] = 'vitest run';
}

// Add test:rspack to leverage ensure-preview-flag.ts and your existing test:vitest
if (!pkg.scripts['test:rspack']) {
  const testCmd = pkg.scripts['test:vitest'] ? 'pnpm run test:vitest' : (hasVitest ? 'vitest run' : 'pnpm test');
  pkg.scripts['test:rspack'] = 'pnpm exec tsx scripts/bundlers/ensure-preview-flag.ts rspack:test && ' + testCmd;
}

// Add RSDoctor runner without cross-env issues (uses a node wrapper)
if (!pkg.scripts['doctor:rspack']) {
  pkg.scripts['doctor:rspack'] = 'node scripts/doctor/rspack-build.mjs';
}

// If build:rspack points to the old config path, switch to override config that fixes warnings
if (pkg.scripts['build:rspack'] && typeof pkg.scripts['build:rspack'] === 'string') {
  if (pkg.scripts['build:rspack'].includes('tools/rspack-preview/rsbuild.config.ts')) {
    pkg.scripts['build:rspack'] = pkg.scripts['build:rspack'].replace(
      'tools/rspack-preview/rsbuild.config.ts',
      'tools/rspack-preview/rsbuild.override.config.ts',
    );
  }
}

writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('Updated package.json scripts:');
console.log(' - test:rspack');
if (hasVitest && !pkg.scripts['test:vitest']) console.log(' - test:vitest');
console.log(' - doctor:rspack');
