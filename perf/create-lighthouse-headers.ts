import fs from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

type CliOptions = {
	baseUrl: string;
	email: string;
	password: string;
	outputPath: string;
	dashboardPath: string;
};

function getArg(flag: string): string | undefined {
	const index = process.argv.findIndex((arg) => arg === flag);
	if (index === -1) {
		return undefined;
	}
	return process.argv[index + 1];
}

function resolveOptions(): CliOptions {
	const baseUrl =
		getArg("--base") ??
		process.env.LIGHTHOUSE_BASE_URL ??
		"http://localhost:3000";
	const email =
		getArg("--email") ??
		process.env.LIGHTHOUSE_DEMO_EMAIL ??
		"admin@example.com";
	const password =
		getArg("--password") ??
		process.env.LIGHTHOUSE_DEMO_PASSWORD ??
		"password123";
	const outputPath =
		getArg("--output") ??
		process.env.LIGHTHOUSE_HEADERS_PATH ??
		path.resolve("reports/lighthouse/.auth-headers.json");
	const dashboardPath =
		getArg("--dashboard") ??
		process.env.LIGHTHOUSE_DASHBOARD_PATH ??
		"/dashboard";

	return { baseUrl, email, password, outputPath, dashboardPath };
}

async function ensureDirectory(filePath: string) {
	const dir = path.dirname(filePath);
	await fs.mkdir(dir, { recursive: true });
}

async function main() {
	const options = resolveOptions();
	const loginUrl = new URL(
		`/signin?callbackUrl=${encodeURIComponent(
			new URL(options.dashboardPath, options.baseUrl).toString(),
		)}`,
		options.baseUrl,
	).toString();

	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext();
	const page = await context.newPage();

	try {
		console.log(`[lighthouse-auth] Navigating to ${loginUrl}`);
		await page.goto(loginUrl, { waitUntil: "networkidle" });
		const emailField = page.locator("#email");

		if (await emailField.count()) {
			await emailField.fill(options.email);
			await page.fill("#password", options.password);
			await Promise.all([
				page.waitForURL(
					(url) => url.pathname.startsWith(options.dashboardPath),
					{ timeout: 30000 },
				),
				page.click('button[type="submit"]'),
			]);
		} else {
			const loginButton = page
				.getByRole("button", { name: /Login as/i })
				.first();
			await Promise.all([
				page.waitForURL(
					(url) => url.pathname.startsWith(options.dashboardPath),
					{ timeout: 30000 },
				),
				loginButton.click(),
			]);
		}

		const cookies = await context.cookies();
		if (!cookies.length) {
			throw new Error(
				"No cookies captured; verify credentials or login flow selectors.",
			);
		}

		const cookieHeader = cookies
			.map((cookie) => `${cookie.name}=${cookie.value}`)
			.join("; ");

		const headers = {
			Cookie: cookieHeader,
			"User-Agent": await page.evaluate(() => navigator.userAgent),
		};

		await ensureDirectory(options.outputPath);
		await fs.writeFile(
			options.outputPath,
			JSON.stringify(headers, null, 2),
			"utf-8",
		);

		console.log(
			`[lighthouse-auth] Headers written to ${options.outputPath}.`,
		);
	} catch (error) {
		console.error("[lighthouse-auth] Failed to capture headers.", error);
		process.exitCode = 1;
	} finally {
		await browser.close();
	}
}

main();

