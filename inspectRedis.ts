import { config } from 'dotenv';
import path from 'node:path';
import { Redis } from '@upstash/redis';

config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Usage: node scripts/run-ts.js scripts/inspectRedis.ts <slug>');
    process.exit(1);
  }
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!redisUrl || !redisToken) {
    throw new Error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN in environment');
  }
  const redis = new Redis({
    url: redisUrl,
    token: redisToken,
  });
  const key = `campaign:${slug}`;
  const data = await redis.hgetall<Record<string, unknown>>(key);
  if (!data) {
    console.log(`No hash found for ${key}`);
    return;
  }
  console.log(`Hash ${key}:`);
  console.dir(data, { depth: 4 });
  if (typeof data.files === 'string') {
    try {
      const files = JSON.parse(data.files);
      console.log('Parsed files:', files);
    } catch (e) {
      console.log('Could not parse files:', e);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
