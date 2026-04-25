const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

let cleanedUrl = process.env.DATABASE_URL || '';
const match = cleanedUrl.match(/\[(.*?)\]/);
if (match) cleanedUrl = cleanedUrl.replace('['+match[1]+']', encodeURIComponent(match[1]));

const client = new Client({ connectionString: cleanedUrl, ssl: { rejectUnauthorized: false } });

client.connect()
  .then(() => client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'"))
  .then(res => { console.log(JSON.stringify(res.rows, null, 2)); return client.end(); })
  .catch(console.error);
