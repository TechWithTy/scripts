#!/usr/bin/env node

const { spawnSync } = require('node:child_process');

const shouldSkip =
	process.env.SKIP_HUSKY === '1' ||
	process.env.NODE_ENV === 'production' ||
	process.env.CI === 'true' ||
	process.env.CI === '1' ||
	// Some CIs set CI to other truthy values; treat presence as a hint to skip
	(typeof process.env.CI !== 'undefined' && process.env.CI !== '');

if (shouldSkip) {
	console.log(
		'[prepare] Skipping Husky install because SKIP_HUSKY=1 or NODE_ENV=production.'
	);
	process.exit(0);
}

const result = spawnSync('pnpm', ['exec', 'husky'], {
	stdio: 'inherit',
	shell: true,
});

if (result.error) {
	console.warn('[prepare] Unable to run Husky:', result.error.message);
	process.exit(0);
}

// If husky isn't available (e.g., devDeps not installed), don't fail install
if (typeof result.status === 'number' && result.status !== 0) {
	console.warn('[prepare] Husky not available or returned non-zero. Skipping.');
	process.exit(0);
}

process.exit(0);









