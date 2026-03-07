// scripts/test-notion-standalone.ts

// --- TYPES ---
type NotionFilesExternal = {
	type: "external";
	name: string;
	external: {
		url: string;
	};
};

type NotionFilesFile = {
	type: "file";
	name: string;
	file: {
		url: string;
		expiry_time: string;
	};
};

type NotionFilesProperty = {
	type: "files";
	files: Array<NotionFilesExternal | NotionFilesFile>;
};

type NotionRichTextProperty = {
	type: "rich_text";
	rich_text: Array<{
		type: "text";
		text: {
			content: string;
			link: {
				url: string;
			} | null;
		};
		plain_text: string;
		href: string | null;
	}>;
};

type NotionTitleProperty = {
	type: "title";
	title: Array<{
		type: "text";
		text: {
			content: string;
			link: {
				url: string;
			} | null;
		};
		plain_text: string;
		href: string | null;
	}>;
};

type NotionUrlProperty = {
	type: "url";
	url: string | null;
};

type NotionSelectProperty = {
	type: "select";
	select: {
		id: string;
		name: string;
		color: string;
	} | null;
};

type NotionCheckboxProperty = {
	type: "checkbox";
	checkbox: boolean;
};

type NotionPage = {
	id: string;
	properties: Record<string, unknown>;
	icon: {
		emoji: string;
	} | null;
	cover: {
		external: {
			url: string;
		};
	} | null;
};

type NotionQueryResponse = {
	results: NotionPage[];
};

function inferKind(name: string): {
	kind: "image" | "video" | "other";
	ext: string;
} {
	const ext = (name.split(".").pop() || "").toLowerCase();
	if (["jpg", "jpeg", "png", "gif", "webp", "avif", "svg"].includes(ext)) {
		return { kind: "image", ext };
	}
	if (["mp4", "webm", "ogg", "mov", "m4v", "mkv"].includes(ext)) {
		return { kind: "video", ext };
	}
	return { kind: "other", ext };
}

// --- MAPPER ---
type MappedLinkTree = {
	pageId?: string;
	slug?: string;
	destination?: string;
	title?: string;
	description?: string;
	details?: string;
	iconEmoji?: string;
	imageUrl?: string;
	thumbnailUrl?: string;
	category?: string;
	pinned?: boolean;
	videoUrl?: string;
	files?: Array<{
		name: string;
		url: string;
		kind?: "image" | "video" | "other";
		ext?: string;
		expiry?: string;
	}>;
	linkTreeEnabled?: boolean;
	highlighted?: boolean;
	utm_source?: string;
	utm_medium?: string;
	utm_campaign?: string;
	utm_content?: string;
	utm_term?: string;
	utm_offer?: string;
	gclid?: string;
	utm_icp?: string;
};

function mapNotionPageToLinkTree(page: NotionPage): MappedLinkTree {
	const props = page.properties ?? {};
	const rawSlug = (props.Slug as NotionRichTextProperty | undefined)
		?.rich_text?.[0]?.plain_text;
	const slug = rawSlug?.startsWith("/") ? rawSlug.substring(1) : rawSlug;

	let destination =
		(props.Destination as NotionUrlProperty | undefined)?.url ??
		(props.Destination as NotionRichTextProperty | undefined)?.rich_text?.[0]
			?.plain_text;
	if (destination) {
		const d = destination
			.replace(/\uFEFF/g, "")
			.replace(/\u00A0/g, " ")
			.trim();
		destination = d.toLowerCase() === "none" ? undefined : d;
	}
	const titleRich = (props.Title as NotionRichTextProperty | undefined)
		?.rich_text?.[0]?.plain_text as string | undefined;
	const titleFromTitle =
		titleRich ??
		((props.Title as NotionTitleProperty | undefined)?.title?.[0]?.plain_text as
			| string
			| undefined);
	const title = titleFromTitle || slug;
	const description = (props.Description as NotionRichTextProperty | undefined)
		?.rich_text?.[0]?.plain_text as string | undefined;
	const details = (props.Details as NotionRichTextProperty | undefined)
		?.rich_text?.[0]?.plain_text as string | undefined;
	const iconEmoji = page.icon?.emoji as string | undefined;

	let thumbnailUrl: string | undefined;
	const thumbProp = props.Thumbnail as
		| NotionUrlProperty
		| NotionRichTextProperty
		| NotionFilesProperty
		| undefined;
	if (thumbProp?.type === "url") thumbnailUrl = thumbProp.url ?? undefined;
	if (!thumbnailUrl && thumbProp?.type === "rich_text")
		thumbnailUrl = thumbProp.rich_text?.[0]?.plain_text ?? undefined;
	if (
		!thumbnailUrl &&
		thumbProp?.type === "files" &&
		Array.isArray(thumbProp.files)
	) {
		const tf = thumbProp.files[0] as
			| NotionFilesFile
			| NotionFilesExternal
			| undefined;
		thumbnailUrl =
			(tf && (tf as NotionFilesFile).file?.url) ||
			(tf && (tf as NotionFilesExternal).external?.url) ||
			undefined;
	}

	let imageUrl: string | undefined;
	const imgProp = props.Image as
		| NotionUrlProperty
		| NotionRichTextProperty
		| NotionFilesProperty
		| undefined;
	if (imgProp?.type === "url") imageUrl = imgProp.url ?? undefined;
	if (!imageUrl && imgProp?.type === "rich_text")
		imageUrl = imgProp.rich_text?.[0]?.plain_text ?? undefined;
	if (!imageUrl && imgProp?.type === "files" && Array.isArray(imgProp.files)) {
		const first = imgProp.files[0] as
			| NotionFilesFile
			| NotionFilesExternal
			| undefined;
		imageUrl =
			(first && (first as NotionFilesFile).file?.url) ||
			(first && (first as NotionFilesExternal).external?.url) ||
			undefined;
	}
	if (!imageUrl && page.cover?.external?.url)
		imageUrl = page.cover.external.url ?? undefined;

	const lte = props["Link Tree Enabled"] as
		| NotionCheckboxProperty
		| NotionSelectProperty
		| undefined;
	let linkTreeEnabled = false;
	if (lte?.type === "checkbox") linkTreeEnabled = Boolean(lte.checkbox);
	else if (lte?.type === "select") {
		const name = (lte.select?.name ?? "").toString().toLowerCase();
		linkTreeEnabled = name === "true" || name === "yes" || name === "enabled";
	}

	const category =
		(props.Category as NotionSelectProperty | undefined)?.select?.name ??
		undefined;
	const pinned = Boolean(
		(props.Pinned as NotionCheckboxProperty | undefined)?.checkbox ||
			((props.Pinned as NotionSelectProperty | undefined)?.select?.name ?? "")
				.toString()
				.toLowerCase() === "true",
	);

	let highlighted = false;
	const hlSel = props.Highlighted as NotionSelectProperty | undefined;
	if (hlSel?.type === "select") {
		const name = (hlSel.select?.name ?? "").toString().toLowerCase();
		highlighted = name === "yes" || name === "true" || name === "enabled";
	}
	const hlCb = props.Highlighted as NotionCheckboxProperty | undefined;
	if (hlCb?.type === "checkbox")
		highlighted = highlighted || Boolean(hlCb.checkbox);
	let videoUrl =
		(props.Video as NotionUrlProperty | undefined)?.url ?? undefined;

	let redirectToFirstFile = false;
	const rtd = props["Redirect To Download First File"] as
		| NotionSelectProperty
		| undefined;
	if (rtd?.type === "select") {
		const name = (rtd.select?.name ?? "").toString().toLowerCase();
		redirectToFirstFile =
			name === "true" || name === "yes" || name === "enabled";
	}

	let files:
		| Array<{
				name: string;
				url: string;
				kind?: "image" | "video" | "other";
				ext?: string;
				expiry?: string;
		  }>
		| undefined;
	const filesProp =
		(props.Media as NotionFilesProperty | undefined) ??
		(props.Files as NotionFilesProperty | undefined) ??
		(props.Image as NotionFilesProperty | undefined) ??
		(props.File as NotionFilesProperty | undefined) ??
		(props.file as NotionFilesProperty | undefined);
	const videoFilesProp = props.video as NotionFilesProperty | undefined;
	type FileOut = {
		name: string;
		url: string;
		kind?: "image" | "video" | "other";
		ext?: string;
		expiry?: string;
	};
	const collected: FileOut[] = [];

	const mapNotionFile = (f: NotionFilesFile | NotionFilesExternal) => {
		if ((f as NotionFilesFile).type === "file") {
			const file = f as NotionFilesFile;
			const url = file.file?.url ?? "";
			const meta = inferKind(file.name || url);
			return {
				name: file.name ?? url,
				url,
				kind: meta.kind,
				ext: meta.ext,
				expiry: file.file?.expiry_time,
			};
		}
		if ((f as NotionFilesExternal).type === "external") {
			const extf = f as NotionFilesExternal;
			const url = extf.external?.url ?? "";
			const meta = inferKind(extf.name || url);
			return { name: extf.name ?? url, url, kind: meta.kind, ext: meta.ext };
		}
		return undefined;
	};

	const collectFrom = (prop?: NotionFilesProperty) => {
		if (prop?.type === "files" && Array.isArray(prop.files)) {
			for (const f of prop.files) {
				const mapped = mapNotionFile(
					f as NotionFilesFile | NotionFilesExternal,
				);
				if (mapped) collected.push(mapped);
			}
		}
	};

	collectFrom(filesProp);
	collectFrom(videoFilesProp);

	for (const val of Object.values(props)) {
		const maybe = val as NotionFilesProperty | undefined;
		if (maybe?.type === "files") collectFrom(maybe);
	}

	if (collected.length) {
		const seen = new Set<string>();
		files = collected.filter((f) => {
			if (!f?.url) return false;
			const k = f.url;
			if (seen.has(k)) return false;
			seen.add(k);
			return true;
		});
	}

	if (redirectToFirstFile) {
		const fileCol = props.File as NotionFilesProperty | undefined;
		const filesCol = props.Files as NotionFilesProperty | undefined;
		let firstFileUrl: string | undefined;
		const pickFirstFrom = (prop?: NotionFilesProperty) => {
			if (firstFileUrl) return;
			if (prop?.type === "files" && Array.isArray(prop.files)) {
				const f = prop.files[0] as
					| NotionFilesFile
					| NotionFilesExternal
					| undefined;
				if (f && (f as NotionFilesFile).type === "file")
					firstFileUrl = (f as NotionFilesFile).file?.url ?? firstFileUrl;
				else if (f && (f as NotionFilesExternal).type === "external")
					firstFileUrl =
						(f as NotionFilesExternal).external?.url ?? firstFileUrl;
			}
		};
		pickFirstFrom(fileCol);
		pickFirstFrom(filesCol);
		if (!firstFileUrl && files && files.length) firstFileUrl = files[0]?.url;
		if (firstFileUrl) destination = firstFileUrl;
	}

	if (!imageUrl && files && files.length) {
		const firstImage =
			files.find((f) => f.kind === "image") ||
			files.find((f) =>
				(f.ext ?? "").match(/^(jpg|jpeg|png|gif|webp|avif|svg)$/i),
			);
		if (firstImage) imageUrl = firstImage.url;
	}
	if (!videoUrl && files && files.length) {
		const playable = files.find((f) =>
			(f.ext ?? "").match(/^(mp4|webm|ogg|ogv|mov|m4v)$/i),
		);
		if (playable) {
			videoUrl = playable.url;
		} else {
			const anyVideo = files.find((f) => f.kind === "video");
			if (anyVideo?.url) {
				const cloud = process.env.CLOUDINARY_CLOUD_NAME;
				if (cloud) {
					const src = anyVideo.url;
					const base = `https://res.cloudinary.com/${cloud}/video/upload/f_mp4,vc_h264,q_auto:good/`;
					const transformed = base + encodeURIComponent(src);
					videoUrl = transformed;
				} else {
					videoUrl = anyVideo.url;
				}
			}
		}
	}

	const getSelectValue = (prop: unknown): string | undefined => {
		const sel = prop as NotionSelectProperty | undefined;
		return sel?.type === "select" ? sel.select?.name : undefined;
	};

	const getUtmValue = (prop: unknown): string | undefined => {
		const sel = prop as NotionSelectProperty | undefined;
		return sel?.type === "select" ? sel.select?.name : undefined;
	};

	const utm_campaign = getUtmValue(props.utm_campaign);

	return {
		pageId: page.id,
		slug,
		destination,
		title,
		description,
		details,
		iconEmoji,
		imageUrl,
		thumbnailUrl,
		category,
		pinned,
		videoUrl,
		files,
		linkTreeEnabled,
		highlighted,
		utm_source: getUtmValue(props.utm_source),
		utm_medium: getUtmValue(props.utm_medium),
		utm_campaign: getUtmValue(props.utm_campaign),
		utm_content: getUtmValue(props.utm_content),
		utm_term: getUtmValue(props.utm_term),
		utm_offer: getUtmValue(props.utm_offer),
		utm_icp: getUtmValue(props.utm_icp),
		gclid: getUtmValue(props.gclid),
	};
}

// --- MAIN TEST ---
import dotenv from "dotenv";

dotenv.config();

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

async function queryNotionDatabase(databaseId: string) {
	const resp = await fetch(`${NOTION_API_BASE}/databases/${databaseId}/query`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${process.env.NOTION_KEY}`,
			"Notion-Version": NOTION_VERSION,
			"Content-Type": "application/json",
		},
		cache: "no-store",
		body: JSON.stringify({ page_size: 100 }),
	});
	if (!resp.ok) {
		const text = await resp.text();
		throw new Error(`Notion DB query failed ${resp.status}: ${text}`);
	}
	return resp.json();
}

async function test() {
	try {
		console.log("Testing Notion Connection...");
		const rawId = process.env.NOTION_REDIRECTS_ID;
		console.log("NOTION_REDIRECTS_ID:", rawId ? "Found" : "Missing");

		if (!rawId) throw new Error("Missing NOTION_REDIRECTS_ID");

		const addDashes = (id: string) =>
			id.replace(/^(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})$/, "$1-$2-$3-$4-$5");
		const dbId = rawId.includes("-")
			? rawId
			: rawId.length === 32
				? addDashes(rawId)
				: rawId;

		console.log("Querying database:", dbId);
		const data = (await queryNotionDatabase(dbId)) as NotionQueryResponse;
		console.log("Query successful. Results count:", data.results?.length);

		if (data.results && data.results.length > 0) {
			const results = data.results as NotionPage[];
			const items = results.map((page) => mapNotionPageToLinkTree(page));
			console.log("Mapped items count:", items.length);

			items.forEach((item) => {
				console.log(
					`- Slug: ${item.slug}, Enabled: ${item.linkTreeEnabled}, Title: ${item.title}`,
				);
			});
		} else {
			console.log("No results found.");
		}
	} catch (error) {
		console.error("Test failed:", error);
	}
}

test();
