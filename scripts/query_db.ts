import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

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
  try {
    const res = await pool.query(`
      SELECT 
        date, 
        SUM(sales_1d) as total_sales, 
        SUM(ad_spend) as total_ad_spend 
      FROM coupang_ads_performance 
      GROUP BY date 
      ORDER BY date ASC
    `);
    
    console.table(res.rows);
  } catch (error) {
    console.error("DB Error:", error);
  } finally {
    await pool.end();
  }
}

run();
