#!/usr/bin/env node

const { existsSync } = require("node:fs");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

const target = join(__dirname, "run-husky.cjs");

if (!existsSync(target)) {
	console.log(
		"Skipping Husky prepare step: scripts/setup/run-husky.cjs not found.",
	);
	process.exit(0);
}

const result = spawnSync("node", [target], { stdio: "inherit" });

if (result.status !== 0) {
	process.exit(result.status ?? 1);
}








