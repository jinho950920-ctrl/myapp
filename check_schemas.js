const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

let cleanedUrl = process.env.DATABASE_URL || '';
const match = cleanedUrl.match(/\[(.*?)\]/);
if (match) cleanedUrl = cleanedUrl.replace('['+match[1]+']', encodeURIComponent(match[1]));

const client = new Client({ connectionString: cleanedUrl, ssl: { rejectUnauthorized: false } });

async function run() {
  await client.connect();
  const tables = ['insight_traffic', 'insight_keyword_summary', 'insight_sales_analysis'];
  for (const t of tables) {
    const res = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1`, [t]);
    console.log(`--- ${t} schema ---`);
    console.log(res.rows);
  }
  await client.end();
}
run().catch(console.error);
