import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

let dbUrl = process.env.DATABASE_URL;
if (dbUrl) {
  const bracketMatch = dbUrl.match(/\[(.*?)\]/);
  if (bracketMatch) {
    const rawPw = bracketMatch[1];
    dbUrl = dbUrl.replace(`[${rawPw}]`, encodeURIComponent(rawPw));
  }
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const wingRes = await pool.query('SELECT DISTINCT date FROM wing_sales ORDER BY date DESC LIMIT 5');
  console.log("=== wing_sales Recent Dates ===");
  console.table(wingRes.rows);

  const adsRes = await pool.query('SELECT DISTINCT date FROM coupang_ads_performance ORDER BY date DESC LIMIT 5');
  console.log("=== coupang_ads_performance Recent Dates ===");
  console.table(adsRes.rows);

  await pool.end();
}

run().catch(console.error);
