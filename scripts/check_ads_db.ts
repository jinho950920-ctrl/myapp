import { config } from "dotenv";
config({ path: ".env.local" });
import { Pool } from "pg";

let cleanedUrl = process.env.DATABASE_URL || '';
const bracketMatch = cleanedUrl.match(/\[(.*?)\]/);
if (bracketMatch) {
  cleanedUrl = cleanedUrl.replace(`[${bracketMatch[1]}]`, encodeURIComponent(bracketMatch[1]));
}

const pool = new Pool({
  connectionString: cleanedUrl,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const res = await pool.query('SELECT COUNT(*) as cnt FROM coupang_ads_performance;');
    console.log("coupang_ads_performance Total Rows:", res.rows[0].cnt);
    
    const sample = await pool.query('SELECT * FROM coupang_ads_performance LIMIT 2;');
    console.log("Sample Data:");
    console.table(sample.rows);
  } catch (err: any) {
    console.error('Error fetching rows:', err.message);
  } finally {
    pool.end();
  }
}
run();
