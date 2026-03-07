import dotenv from "dotenv";

dotenv.config();

type NotionSelectOption = { id?: string; name: string; color?: string };
type NotionPropertyConfig = {
	type: string;
	select?: { options?: NotionSelectOption[] };
	status?: { options?: NotionSelectOption[] };
};

type NotionDatabaseResponse = {
	properties?: Record<string, NotionPropertyConfig>;
};

function normalizeDatabaseId(raw: string): string {
	return raw.includes("-")
		? raw
		: raw.replace(/^(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})$/, "$1-$2-$3-$4-$5");
}

function pickOptionName(
	prop: NotionPropertyConfig | undefined,
	preferred: string[],
	fallback?: string,
): string | undefined {
	const options =
		prop?.type === "status"
			? (prop.status?.options ?? []).map((o) => o.name)
			: (prop?.select?.options ?? []).map((o) => o.name);

	if (!options.length) return fallback;

	const lowerToOriginal = new Map(options.map((o) => [o.toLowerCase(), o]));
	for (const p of preferred) {
		const hit = lowerToOriginal.get(p.toLowerCase());
		if (hit) return hit;
	}
	return options[0];
}

function richText(content: string) {
	return [{ type: "text", text: { content } }];
}

function titleText(content: string) {
	return [{ type: "text", text: { content } }];
}

function externalFile(name: string, url: string) {
	return [{ name, type: "external", external: { url } }];
}

function daysFromNow(days: number): string {
	const d = new Date();
	d.setDate(d.getDate() + days);
	return d.toISOString();
}

function yyyymmdd(d: Date): string {
	return d.toISOString().slice(0, 10);
}

function buildProperties(
	schema: Record<string, NotionPropertyConfig>,
	mode: "Internal" | "External",
	slug: string,
) {
	const now = new Date();
	const start = yyyymmdd(now);
	const end = yyyymmdd(new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000));
	const isInternal = mode === "Internal";

	const destination = isInternal
		? "/linktree?from=internal-test"
		: "https://calendly.com/dealscale/demo?from=external-test";

	const statusValue = pickOptionName(
		schema.Status,
		["Ready", "Done", "Live"],
		"Ready",
	);
	const utmSource = pickOptionName(
		schema.utm_source,
		["linktree", "website"],
		"linktree",
	);
	const utmMedium = pickOptionName(
		schema.utm_medium,
		["linktree", "social"],
		"linktree",
	);
	const utmCampaign = pickOptionName(
		schema.utm_campaign,
		["beta2025", "brand2025", "cosw2025"],
		"beta2025",
	);
	const utmOffer = pickOptionName(
		schema.utm_offer,
		["Early Access", "ai5skipUnlimited"],
		"Early Access",
	);
	const redirectFirstFile = pickOptionName(
		schema["Redirect To Download First File"],
		["No", "Yes"],
		"No",
	);
	const highlighted = pickOptionName(schema.Highlighted, ["Yes", "No"], "Yes");
	const category = pickOptionName(schema.Category, ["Test", "Product"], "Test");
	const linkTreeEnabled = pickOptionName(
		schema["Link Tree Enabled"],
		["True", "False"],
		"True",
	);
	const redirectType = pickOptionName(schema["Redirect Type"], [mode], mode);
	const utmContent = pickOptionName(
		schema.utm_content,
		["cta-button", "primary-cta", "test-content"],
		"test-content",
	);
	const utmTerm = pickOptionName(
		schema.utm_term,
		["linktree-test", "redirect-test"],
		"linktree-test",
	);
	const utmIcp = pickOptionName(
		schema.utm_icp,
		["real-estate-investor", "agent", "test-icp"],
		"test-icp",
	);
	const maybeSelectOrRichText = (
		propName: string,
		value: string | undefined,
	): Record<string, unknown> | undefined => {
		if (!value) return undefined;
		const type = schema[propName]?.type;
		if (type === "rich_text") return { rich_text: richText(value) };
		return { select: { name: value } };
	};
	const affiliateCode = pickOptionName(
		schema["Affiliate Code"],
		["AFF-TEST-01"],
		"AFF-TEST-01",
	);
	const discountCode = pickOptionName(
		schema["Discount Code"],
		["TEST20"],
		"TEST20",
	);

	return {
		Slug: { title: titleText(slug) },
		Title: {
			rich_text: richText(
				`${mode} Link Redirect Test (${now.toISOString().slice(0, 16).replace("T", " ")})`,
			),
		},
		Status: statusValue ? { status: { name: statusValue } } : undefined,
		Details: {
			rich_text: richText(
				`Auto-created full-property ${mode.toLowerCase()} redirect test entry.`,
			),
		},
		Destination: { url: destination },
		Thumbnail: {
			url: "https://images.unsplash.com/photo-1498050108023-c5249f4df085",
		},
		Image: {
			files: externalFile(
				"test-image.jpg",
				"https://images.unsplash.com/photo-1555066931-4365d14bab8c",
			),
		},
		Video: {
			files: externalFile(
				"test-video.mp4",
				"https://www.w3schools.com/html/mov_bbb.mp4",
			),
		},
		File: {
			files: externalFile(
				"test-file.pdf",
				"https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
			),
		},
		"Redirect Type": redirectType
			? { select: { name: redirectType } }
			: undefined,
		"Redirect To Download First File": redirectFirstFile
			? { select: { name: redirectFirstFile } }
			: undefined,
		"Link Tree Enabled": linkTreeEnabled
			? { select: { name: linkTreeEnabled } }
			: undefined,
		Category: category ? { select: { name: category } } : undefined,
		Highlighted: highlighted ? { select: { name: highlighted } } : undefined,
		utm_source: utmSource ? { select: { name: utmSource } } : undefined,
		utm_medium: utmMedium ? { select: { name: utmMedium } } : undefined,
		utm_campaign: utmCampaign ? { select: { name: utmCampaign } } : undefined,
		utm_content: maybeSelectOrRichText("utm_content", utmContent),
		utm_term: maybeSelectOrRichText("utm_term", utmTerm),
		utm_offer: utmOffer ? { select: { name: utmOffer } } : undefined,
		utm_icp: maybeSelectOrRichText("utm_icp", utmIcp),
		gclid: {
			rich_text: richText(`TEST-GCLID-${mode.toUpperCase()}-${Date.now()}`),
		},
		"Redirects (Calls)": { number: 0 },
		"Redirects (Clicks)": { number: 0 },
		"Start Date": { date: { start } },
		"End Date": { date: { start: end } },
		"Affiliate Code": affiliateCode
			? { select: { name: affiliateCode } }
			: undefined,
		"Discount Code": discountCode
			? { select: { name: discountCode } }
			: undefined,
	};
}

function stripUndefined<T extends Record<string, unknown>>(
	obj: T,
): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(obj)) {
		if (v !== undefined) out[k] = v;
	}
	return out;
}

async function notionRequest(
	path: string,
	init: RequestInit,
	notionKey: string,
): Promise<Response> {
	return fetch(`https://api.notion.com/v1${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${notionKey}`,
			"Notion-Version": "2022-06-28",
			"Content-Type": "application/json",
			...(init.headers || {}),
		},
	});
}

async function createEntry(
	dbId: string,
	notionKey: string,
	mode: "Internal" | "External",
	suffix: string,
	schema: Record<string, NotionPropertyConfig>,
) {
	const slug = `tree-${mode.toLowerCase()}-full-test-${suffix}`;
	const properties = stripUndefined(buildProperties(schema, mode, slug));

	const createResp = await notionRequest(
		"/pages",
		{
			method: "POST",
			body: JSON.stringify({
				parent: { database_id: dbId },
				properties,
			}),
		},
		notionKey,
	);

	if (!createResp.ok) {
		const err = await createResp.text();
		throw new Error(
			`Failed to create ${mode} entry (${createResp.status}): ${err}`,
		);
	}

	const page = (await createResp.json()) as { id: string; url?: string };
	return { mode, slug, id: page.id, url: page.url };
}

async function run() {
	const notionKey = process.env.NOTION_KEY;
	const rawDbId = process.env.NOTION_REDIRECTS_ID;
	if (!notionKey || !rawDbId) {
		throw new Error("Missing NOTION_KEY or NOTION_REDIRECTS_ID");
	}

	const dbId = normalizeDatabaseId(rawDbId);
	const dbResp = await notionRequest(
		`/databases/${dbId}`,
		{ method: "GET" },
		notionKey,
	);
	if (!dbResp.ok) {
		const err = await dbResp.text();
		throw new Error(
			`Failed to read database schema (${dbResp.status}): ${err}`,
		);
	}
	const dbJson = (await dbResp.json()) as NotionDatabaseResponse;
	const schema = dbJson.properties ?? {};

	const suffix = new Date()
		.toISOString()
		.replace(/[-:.TZ]/g, "")
		.slice(0, 12);
	const created = await Promise.all([
		createEntry(dbId, notionKey, "Internal", suffix, schema),
		createEntry(dbId, notionKey, "External", suffix, schema),
	]);

	console.log("Created Linktree redirect test entries:");
	for (const entry of created) {
		console.log(
			`- ${entry.mode}: slug=${entry.slug}, pageId=${entry.id}, url=${entry.url ?? "n/a"}`,
		);
	}
}

run().catch((error) => {
	console.error(error);
	process.exit(1);
});
