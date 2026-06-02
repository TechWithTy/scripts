#!/usr/bin/env ts-node
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

type MetricDescriptor = {
	id: string;
	label: string;
};

const SERVER_URL = process.env.LIGHTHOUSE_BASE_URL ?? "http://localhost:3000";
const DASHBOARD_URL = new URL("/dashboard", SERVER_URL).toString();
const REPORT_JSON = path.resolve("reports/lighthouse/local.report.json");
const SUMMARY_FILE = path.resolve("reports/lighthouse/local.summary.md");
const AUTH_HEADERS = path.resolve("reports/lighthouse/local.headers.json");
const READINESS_TIMEOUT_MS = 60_000;
const READINESS_POLL_INTERVAL_MS = 2_000;

async function runCommand(
	command: string,
	args: string[],
	options?: { cwd?: string; env?: NodeJS.ProcessEnv },
) {
	return new Promise<void>((resolve, reject) => {
		const child = spawn(command, args, {
			stdio: "inherit",
			shell: process.platform === "win32",
			cwd: options?.cwd,
			env: { ...process.env, ...options?.env },
		});

		child.on("error", reject);
		child.on("exit", (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
			}
		});
	});
}

async function waitForServer(url: string) {
	const start = Date.now();
	while (Date.now() - start < READINESS_TIMEOUT_MS) {
		try {
			const response = await fetch(url, { method: "GET" });
			if (response.ok) {
				return;
			}
		} catch {
			// swallow network errors until timeout
		}

		await new Promise((resolve) =>
			setTimeout(resolve, READINESS_POLL_INTERVAL_MS),
		);
	}

	throw new Error(
		`Server did not respond at ${url} within ${READINESS_TIMEOUT_MS}ms`,
	);
}

function startServer() {
	const child = spawn("pnpm", ["start"], {
		stdio: "inherit",
		shell: process.platform === "win32",
	});
	return child;
}

async function stopServer(child: ReturnType<typeof spawn>) {
	if (!child || child.killed) {
		return;
	}

	return new Promise<void>((resolve) => {
		child.once("exit", () => resolve());
		if (process.platform === "win32") {
			spawn("taskkill", ["/pid", String(child.pid), "/f", "/t"]);
		} else {
			child.kill("SIGINT");
		}
	});
}

type LighthouseReport = {
	categories: {
		performance: {
			score: number;
		};
	};
	audits: Record<
		string,
		{
			id: string;
			title: string;
			displayValue?: string;
			description?: string;
			score: number | null;
			details?: {
				type?: string;
				overallSavingsMs?: number;
			};
		}
	>;
};

const METRICS: MetricDescriptor[] = [
	{ id: "first-contentful-paint", label: "FCP" },
	{ id: "largest-contentful-paint", label: "LCP" },
	{ id: "speed-index", label: "Speed Index" },
	{ id: "total-blocking-time", label: "Total Blocking Time" },
	{ id: "cumulative-layout-shift", label: "CLS" },
	{ id: "interactive", label: "Time to Interactive" },
];

async function createSummary(reportPath: string, outputPath: string) {
	const raw = await fs.readFile(reportPath, "utf-8");
	const report: LighthouseReport = JSON.parse(raw);
	const performanceScore =
		report.categories.performance.score != null
			? Math.round(report.categories.performance.score * 100)
			: "N/A";

	const metricLines = METRICS.map(({ id, label }) => {
		const audit = report.audits[id];
		const value = audit?.displayValue ?? "N/A";
		return `- **${label}:** ${value}`;
	}).join("\n");

	const opportunities = Object.values(report.audits)
		.filter(
			(audit) =>
				audit?.details?.type === "opportunity" &&
				typeof audit.details.overallSavingsMs === "number",
		)
		.sort(
			(a, b) =>
				(b.details?.overallSavingsMs ?? 0) -
				(a.details?.overallSavingsMs ?? 0),
		)
		.slice(0, 3);

	const opportunityLines =
		opportunities.length > 0
			? opportunities
					.map((audit, index) => {
						const savings = audit.details?.overallSavingsMs
							? `${Math.round(audit.details.overallSavingsMs)} ms potential savings`
							: "Potential savings not provided";
						return `${index + 1}. **${audit.title}:** ${savings}`;
					})
					.join("\n")
			: "No opportunity diagnostics were returned in this run.";

	const summary = `# Lighthouse Local Summary

- **Generated:** ${new Date().toISOString()}
- **Dashboard URL:** ${DASHBOARD_URL}
- **Performance Score:** ${performanceScore}

## Core Web Vitals & Key Metrics
${metricLines}

## Top Opportunities
${opportunityLines}

> This summary is auto-generated from \`${path.relative(
		process.cwd(),
		reportPath,
	)}\`. Use it directly in LLM conversations or incident reports.
`;

	await fs.writeFile(outputPath, summary, "utf-8");
}

async function main() {
	console.log("[perf] Building production bundle...");
	await runCommand("pnpm", ["build"]);

	console.log("[perf] Starting Next.js server...");
	const serverProcess = startServer();

	try {
		await waitForServer(SERVER_URL);
		console.log("[perf] Server is responding, running authenticated Lighthouse...");
		await runCommand("pnpm", ["perf:lighthouse:local-auth"]);

		console.log("[perf] Creating markdown summary...");
		await createSummary(REPORT_JSON, SUMMARY_FILE);
		console.log(`[perf] Summary written to ${SUMMARY_FILE}`);
	} finally {
		console.log("[perf] Shutting down server...");
		await stopServer(serverProcess);
	}
}

main().catch((error) => {
	console.error("[perf] Local performance run failed:", error);
	process.exitCode = 1;
});








