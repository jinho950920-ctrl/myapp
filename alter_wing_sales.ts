import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
let cleanedUrl = process.env.DATABASE_URL || '';
const bracketMatch = cleanedUrl.match(/\[(.*?)\]/);
if (bracketMatch) {
  cleanedUrl = cleanedUrl.replace(`[${bracketMatch[1]}]`, encodeURIComponent(bracketMatch[1]));
}

const client = new Client({ connectionString: cleanedUrl, ssl: { rejectUnauthorized: false } });

async function run() {
  await client.connect();
  await client.query(`ALTER TABLE wing_sales ADD COLUMN IF NOT EXISTS fulfillment_type VARCHAR(50) DEFAULT '판매자배송';`);
  console.log("Added fulfillment_type column");
  await client.end();
}
run();
