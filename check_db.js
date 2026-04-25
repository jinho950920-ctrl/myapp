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

const client = new Client({
  connectionString: cleanedUrl,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    await client.connect();
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ads_report_rows';
    `);
    console.log("Columns in ads_report_rows:", res.rows);
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    await client.end();
  }
}

check();
