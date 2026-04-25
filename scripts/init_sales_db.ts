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

async function createTable() {
  try {
    await client.connect();

    const ddl = `
      CREATE TABLE IF NOT EXISTS wing_sales (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        option_id VARCHAR(100) NOT NULL,
        product_name TEXT,
        option_name TEXT,
        seller_product_code VARCHAR(100),
        orders INTEGER DEFAULT 0,
        sales_qty INTEGER DEFAULT 0,
        sales_amount NUMERIC(15, 2) DEFAULT 0,
        views INTEGER DEFAULT 0,
        visitors INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(date, option_id)
      );
    `;

    console.log("🛠️ Creating table 'wing_sales'...");
    await client.query(ddl);
    console.log("✅ Table 'wing_sales' initialized successfully with UNIQUE(date, option_id) constraint.");

  } catch (e) {
    console.error("❌ Error initializing table:", e);
  } finally {
    await client.end();
  }
}

createTable();
