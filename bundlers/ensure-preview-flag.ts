import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Usage: tsx scripts/bundlers/ensure-preview-flag.ts rspack:test
// Ensures .env.preview.local has the expected preview flags

const FLAG = process.argv[2] || "rspack:test";
const ENV_FILE = resolve(process.cwd(), ".env.preview.local");

function toKV(lines: string[]): Record<string, string> {
	const kv: Record<string, string> = {};
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const idx = trimmed.indexOf("=");
		if (idx === -1) continue;
		const key = trimmed.slice(0, idx).trim();
		const val = trimmed.slice(idx + 1).trim();
		kv[key] = val;
	}
	return kv;
}

function writeEnv(kv: Record<string, string>) {
	const lines = Object.entries(kv).map(([k, v]) => `${k}=${v}`);
	writeFileSync(ENV_FILE, lines.join("\n"));
}

function main() {
	let kv: Record<string, string> = {};
	if (existsSync(ENV_FILE)) {
		try {
			const raw = readFileSync(ENV_FILE, "utf-8");
			kv = toKV(raw.split(/\r?\n/));
		} catch {}
	}

	kv.NEXT_PUBLIC_PREVIEW_BUNDLER = FLAG;
	kv.NEXT_PUBLIC_ENV = "preview";

	writeEnv(kv);
	// eslint-disable-next-line no-console
	console.log(
		`[ensure-preview-flag] Wrote ${ENV_FILE} with NEXT_PUBLIC_PREVIEW_BUNDLER=${FLAG}`,
	);
}

main();
