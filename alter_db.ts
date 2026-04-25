import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

let cleanedUrl = process.env.DATABASE_URL || '';
const bracketMatch = cleanedUrl.match(/\[(.*?)\]/);
if (bracketMatch) {
  const rawPw = bracketMatch[1];
  cleanedUrl = cleanedUrl.replace(`[${rawPw}]`, encodeURIComponent(rawPw));
}

const client = new Client({
  connectionString: cleanedUrl,
  ssl: { rejectUnauthorized: false }
});

async function alterTable() {
  try {
    await client.connect();
    await client.query(`ALTER TABLE scraping_targets ADD COLUMN IF NOT EXISTS last_price VARCHAR(50);`);
    await client.query(`ALTER TABLE scraping_targets ADD COLUMN IF NOT EXISTS last_review_count VARCHAR(50);`);
    await client.query(`ALTER TABLE scraping_targets ADD COLUMN IF NOT EXISTS last_buy_count VARCHAR(50);`);
    console.log("✅ Columns added to scraping_targets");
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

alterTable();
