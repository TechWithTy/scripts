import { config } from 'dotenv';
import path from 'node:path';

// Load .env.local from the project root
config({ path: path.resolve(__dirname, '../.env') });

console.log('Environment variables loaded:', process.env.UPSTASH_REDIS_REST_URL ? 'UPSTASH_REDIS_REST_URL present' : 'UPSTASH_REDIS_REST_URL missing');
console.log('NOTION_KEY present:', !!process.env.NOTION_KEY);
console.log('NOTION_REDIRECTS_ID present:', !!process.env.NOTION_REDIRECTS_ID);
console.log('Redis URL:', process.env.UPSTASH_REDIS_REST_URL);

import { Redis } from '@upstash/redis';
import type {
  NotionCheckboxProperty,
  NotionFilesExternal,
  NotionFilesFile,
  NotionFilesProperty,
  NotionPage,
  NotionQueryResponse,
  NotionRichTextProperty,
  NotionSelectProperty,
  NotionTitleProperty,
  NotionUrlProperty,
} from "../src/utils/notion/notionTypes";
import { inferKind } from "../src/utils/notion/notionTypes";

export async function syncCampaigns() {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  const NOTION_API_KEY = process.env.NOTION_KEY;
  const NOTION_REDIRECTS_ID = process.env.NOTION_REDIRECTS_ID;
  if (!NOTION_API_KEY || !NOTION_REDIRECTS_ID) {
    throw new Error('Missing NOTION_KEY or NOTION_REDIRECTS_ID in environment');
  }

  function removeNullUndefined(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null && value !== undefined) {
        result[key] = value;
      }
    }
    return result;
  }

  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${NOTION_REDIRECTS_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ page_size: 100 })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Notion API error: ${response.status} ${response.statusText}`, errorBody);
      throw new Error(`Notion API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as NotionQueryResponse;
    console.log(`Synced ${data.results.length} campaigns`);
    console.log('Notion response:', JSON.stringify(data, null, 2));

    for (const page of data.results as NotionPage[]) {
      const props = page.properties ?? {};
      const rawSlug = (props.Slug as NotionRichTextProperty | undefined)?.rich_text?.[0]?.plain_text;
      const slug = rawSlug?.startsWith('/') ? rawSlug.substring(1) : rawSlug;
      const destination = (props.Destination as NotionRichTextProperty | undefined)?.rich_text?.[0]?.plain_text;
      // Support Notion "Title" property stored as rich_text or title
      const titleRich = (props.Title as NotionRichTextProperty | undefined)?.rich_text?.[0]?.plain_text as string | undefined;
      const titleFromTitle = titleRich ?? (props.Title as NotionTitleProperty | undefined)?.title?.[0]?.plain_text as string | undefined;
      const title = titleFromTitle || slug;
      const description = (props.Description as NotionRichTextProperty | undefined)?.rich_text?.[0]?.plain_text as string | undefined;
      const details = (props.Details as NotionRichTextProperty | undefined)?.rich_text?.[0]?.plain_text as string | undefined;
      const iconEmoji = page.icon?.emoji as string | undefined;

      // Image from Image/Thumbnail URL/Rich text/Files or page cover
      const imageProp = (props.Image as NotionUrlProperty | NotionRichTextProperty | NotionFilesProperty | undefined)
        ?? (props.Thumbnail as NotionUrlProperty | NotionRichTextProperty | NotionFilesProperty | undefined);
      let imageUrl: string | undefined;
      if (imageProp?.type === 'url') imageUrl = imageProp.url ?? undefined;
      if (!imageUrl && imageProp?.type === 'rich_text') imageUrl = imageProp.rich_text?.[0]?.plain_text ?? undefined;
      if (!imageUrl && imageProp?.type === 'files' && Array.isArray(imageProp.files)) {
        const first = imageProp.files.find((f) => (f as NotionFilesFile).file?.url || (f as NotionFilesExternal).external?.url);
        const fFile = first as NotionFilesFile | NotionFilesExternal | undefined;
        imageUrl = (fFile && 'file' in fFile ? fFile.file?.url : (fFile && 'external' in fFile ? fFile.external?.url : undefined)) ?? undefined;
      }
      if (!imageUrl && page.cover?.external?.url) imageUrl = page.cover.external.url ?? undefined;

      // Link Tree Enabled can be checkbox or select
      const lte = props['Link Tree Enabled'] as (NotionCheckboxProperty | NotionSelectProperty | undefined);
      let linkTreeEnabled = false;
      if (lte?.type === 'checkbox') linkTreeEnabled = Boolean(lte.checkbox);
      else if (lte?.type === 'select') {
        const name = (lte.select?.name ?? '').toString().toLowerCase();
        linkTreeEnabled = name === 'true' || name === 'yes' || name === 'enabled';
      }

      // Optional metadata
      const category = (props.Category as NotionSelectProperty | undefined)?.select?.name ?? undefined;
      const pinned = Boolean(
        (props.Pinned as NotionCheckboxProperty | undefined)?.checkbox ||
        ((props.Pinned as NotionSelectProperty | undefined)?.select?.name ?? '').toString().toLowerCase() === 'true'
      );
      let videoUrl = (props.Video as NotionUrlProperty | undefined)?.url ?? undefined;

      // Files list (support Media/Files/Image/File/video as Files & media)
      let files: Array<{ name: string; url: string; kind?: 'image' | 'video' | 'other'; ext?: string; expiry?: string }> | undefined;
      const filesProp = (props.Media as NotionFilesProperty | undefined)
        ?? (props.Files as NotionFilesProperty | undefined)
        ?? (props.Image as NotionFilesProperty | undefined)
        ?? (props.File as NotionFilesProperty | undefined);
      const videoFilesProp = props.video as NotionFilesProperty | undefined;
      if (filesProp?.type === 'files' && Array.isArray(filesProp.files)) {
        files = filesProp.files
          .map((f) => {
            if ((f as NotionFilesFile).type === 'file') {
              const file = f as NotionFilesFile;
              const url = file.file?.url ?? '';
              const meta = inferKind(file.name || url);
              return { name: file.name ?? url, url, kind: meta.kind, ext: meta.ext, expiry: file.file?.expiry_time };
            }
            if ((f as NotionFilesExternal).type === 'external') {
              const extf = f as NotionFilesExternal;
              const url = extf.external?.url ?? '';
              const meta = inferKind(extf.name || url);
              return { name: extf.name ?? url, url, kind: meta.kind, ext: meta.ext };
            }
            return undefined;
          })
          .filter(Boolean) as Array<{ name: string; url: string; kind?: 'image' | 'video' | 'other'; ext?: string; expiry?: string }>;
      }
      // Merge in explicit "video" files property, if present
      if (videoFilesProp?.type === 'files' && Array.isArray(videoFilesProp.files)) {
        const extra = videoFilesProp.files
          .map((f) => {
            if ((f as NotionFilesFile).type === 'file') {
              const file = f as NotionFilesFile;
              const url = file.file?.url ?? '';
              const meta = inferKind(file.name || url);
              return { name: file.name ?? url, url, kind: 'video' as const, ext: meta.ext, expiry: file.file?.expiry_time };
            }
            if ((f as NotionFilesExternal).type === 'external') {
              const extf = f as NotionFilesExternal;
              const url = extf.external?.url ?? '';
              const meta = inferKind(extf.name || url);
              return { name: extf.name ?? url, url, kind: 'video' as const, ext: meta.ext };
            }
            return undefined;
          })
          .filter(Boolean) as Array<{ name: string; url: string; kind?: 'image' | 'video' | 'other'; ext?: string; expiry?: string }>;
        files = [...(files ?? []), ...extra];
      }

        // Fallbacks from files if explicit image/video not set
        if (!imageUrl && files && files.length) {
          const firstImage = files.find((f) => f.kind === 'image') || files.find((f) => (f.ext ?? '').match(/^(jpg|jpeg|png|gif|webp|avif|svg)$/i));
          if (firstImage) imageUrl = firstImage.url;
        }
        if (!videoUrl && files && files.length) {
          const firstVideo = files.find((f) => f.kind === 'video') || files.find((f) => (f.ext ?? '').match(/^(mp4|webm|ogg|mov|m4v)$/i));
          if (firstVideo) videoUrl = firstVideo.url;
        }
        const utm = {
          utm_source: (props.utm_source as NotionRichTextProperty | undefined)?.rich_text?.[0]?.plain_text,
          utm_campaign: (props.utm_campaign as NotionRichTextProperty | undefined)?.rich_text?.[0]?.plain_text,
          utm_medium: (props.utm_medium as NotionRichTextProperty | undefined)?.rich_text?.[0]?.plain_text,
        };

      if (slug && destination) {
        console.log(`Saving campaign: ${slug} -> ${destination}`);
        // Remove stale fields when media is no longer present
        const key = `campaign:${slug}`;
        if (!imageUrl) {
          try { await redis.hdel(key, 'imageUrl'); } catch {}
        }
        if (!videoUrl) {
          try { await redis.hdel(key, 'videoUrl'); } catch {}
        }
        if (!files || files.length === 0) {
          try { await redis.hdel(key, 'files'); } catch {}
        }
        const dataToStore = removeNullUndefined({
          destination,
          utm,
          linkTreeEnabled,
          title,
          description,
          details,
          iconEmoji,
          imageUrl,
          category,
          pinned,
          videoUrl,
          files: files ? JSON.stringify(files) : undefined,
        });
        await redis.hset(key, dataToStore);
        console.log(`Synced campaign: ${slug}`);
      } else {
        console.log('Skipping page due to missing slug or destination:', page.id);
      }
    }
  } catch (error) {
    console.error('Sync error:', error);
  } finally {
    // Verify keys in Redis
    const keys = await redis.keys('campaign:*');
    console.log('Campaign keys in Redis:', keys);
    
    // Test Redis set/get
    await redis.set('test_key', 'test_value');
    const testValue = await redis.get('test_key');
    console.log('Redis test value:', testValue);
  }
}

syncCampaigns().then(() => process.exit(0));
