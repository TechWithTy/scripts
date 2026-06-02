#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const { existsSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");

const shouldSkip =
	process.env.SKIP_HUSKY === "1" ||
	process.env.HUSKY === "0" ||
	process.env.NODE_ENV === "production" ||
	process.env.CI === "true" ||
	process.env.CI === "1";

if (shouldSkip) {
	console.log(
		"Skipping Husky install (SKIP_HUSKY/HUSKY/NODE_ENV signaled non-dev environment).",
	);
	process.exit(0);
}

const projectRoot = process.cwd();
const huskyDir = join(projectRoot, ".husky");

if (!existsSync(huskyDir)) {
	mkdirSync(huskyDir, { recursive: true });
}

const spawnOptions = {
	stdio: "inherit",
	shell: process.platform === "win32",
};

const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(pnpmCmd, ["exec", "husky", "install"], spawnOptions);

if (result.status !== 0) {
	console.error("Failed to install Husky hooks.");
	process.exit(result.status ?? 1);
}

console.log("Husky hooks installed successfully.");
