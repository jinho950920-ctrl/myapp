const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

let cleanedUrl = process.env.DATABASE_URL || '';
const bracketMatch = cleanedUrl.match(/\[(.*?)\]/);
if (bracketMatch) {
  const rawPw = bracketMatch[1];
  cleanedUrl = cleanedUrl.replace(`[${rawPw}]`, encodeURIComponent(rawPw));
}
const client = new Client({ connectionString: cleanedUrl, ssl: { rejectUnauthorized: false } });

async function dump() {
  await client.connect();
  const sales = await client.query(`SELECT date, option_id, option_name, product_name, sales_amount, sales_qty, fulfillment_type FROM wing_sales WHERE date >= CURRENT_DATE - INTERVAL '6 days'`);
  const ads = await client.query(`SELECT report_date, sum(ad_cost_amount) as total_ads FROM ads_report_rows GROUP BY report_date`);
  
  console.log("SALES RECENT:", JSON.stringify(sales.rows.filter(r => r.date.toISOString().includes('03-23')), null, 2));
  console.log("ADS RECENT:", JSON.stringify(ads.rows.filter(r => r.report_date.toISOString().includes('03-23')), null, 2));
  
  await client.end();
}
dump();
