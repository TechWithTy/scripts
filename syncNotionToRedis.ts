import { config } from 'dotenv';
import path from 'node:path';

// Load .env.local from the project root
config({ path: path.resolve(__dirname, '../.env') });

console.log('Environment variables loaded:', process.env.UPSTASH_REDIS_REST_URL ? 'UPSTASH_REDIS_REST_URL present' : 'UPSTASH_REDIS_REST_URL missing');
console.log('NOTION_KEY present:', !!process.env.NOTION_KEY);
console.log('NOTION_REDIRECTS_ID present:', !!process.env.NOTION_REDIRECTS_ID);
console.log('Redis URL:', process.env.UPSTASH_REDIS_REST_URL);

import { Redis } from '@upstash/redis';

// TODO: Remove hardcoded values after conference
export async function syncCampaigns() {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  const NOTION_API_KEY = process.env.NOTION_KEY!;
  const NOTION_REDIRECTS_ID = process.env.NOTION_REDIRECTS_ID!;

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

    const data = await response.json();
    console.log(`Synced ${data.results.length} campaigns`);
    console.log('Notion response:', JSON.stringify(data, null, 2));

    for (const page of data.results) {
      if (page.properties) {
        const slug = page.properties.Slug?.title?.[0]?.plain_text;
        const destination = page.properties.Destination?.rich_text?.[0]?.plain_text;
        const title = (page.properties.Title?.title?.[0]?.plain_text as string | undefined) || slug;
        const description = page.properties.Description?.rich_text?.[0]?.plain_text as string | undefined;
        const details = page.properties.Details?.rich_text?.[0]?.plain_text as string | undefined;
        const iconEmoji = (page as any)?.icon?.emoji as string | undefined;
        // try to resolve an image url from a property commonly named "Image" or "Thumbnail"
        const imageProp = (page as any).properties?.Image || (page as any).properties?.Thumbnail;
        let imageUrl: string | undefined = undefined;
        if (imageProp?.type === 'url') imageUrl = imageProp.url as string | undefined;
        if (!imageUrl && imageProp?.type === 'rich_text') imageUrl = imageProp.rich_text?.[0]?.plain_text as string | undefined;
        if (!imageUrl && (page as any)?.cover?.external?.url) imageUrl = (page as any).cover.external.url as string;
        // Link Tree Enabled can be a checkbox or a select with values like "True"/"False"
        const lteProp = (page as any).properties?.["Link Tree Enabled"];
        let linkTreeEnabled = false;
        if (lteProp?.type === 'checkbox') {
          linkTreeEnabled = Boolean(lteProp.checkbox);
        } else if (lteProp?.type === 'select') {
          const name = (lteProp.select?.name ?? '').toString().toLowerCase();
          linkTreeEnabled = name === 'true' || name === 'yes' || name === 'enabled';
        }
        // Optional metadata
        const category = (page as any).properties?.Category?.select?.name as string | undefined;
        const pinned = Boolean(
          ((page as any).properties?.Pinned?.checkbox as boolean | undefined) ||
          (((page as any).properties?.Pinned as any)?.select?.name?.toString().toLowerCase() === 'true')
        );
        const videoUrl = (page as any).properties?.Video?.url as string | undefined;
        // Files list
        let files: Array<{ name: string; url: string }> | undefined;
        const filesProp = (page as any).properties?.Files;
        if (filesProp?.type === 'files' && Array.isArray(filesProp.files)) {
          files = filesProp.files
            .map((f: any) => {
              if (f.type === 'file') return { name: f.name as string, url: f.file?.url as string };
              if (f.type === 'external') return { name: f.name as string, url: f.external?.url as string };
              return undefined;
            })
            .filter(Boolean) as Array<{ name: string; url: string }>;
        }
        const utm = {
          utm_source: page.properties.utm_source?.rich_text?.[0]?.plain_text,
          utm_campaign: page.properties.utm_campaign?.rich_text?.[0]?.plain_text,
          utm_medium: page.properties.utm_medium?.rich_text?.[0]?.plain_text,
        };

        if (slug && destination) {
          console.log(`Saving campaign: ${slug} -> ${destination}`);
          await redis.hset(`campaign:${slug}`, { 
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
            // store files as JSON string to be safe in hash field
            files: files ? JSON.stringify(files) : undefined,
          });
          console.log(`Synced campaign: ${slug}`);
        } else {
          console.log('Skipping page due to missing slug or destination:', page.id);
        }
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
