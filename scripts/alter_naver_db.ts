import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

let dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("No DATABASE_URL found in .env.local");
  process.exit(1);
}

const bracketMatch = dbUrl.match(/\[(.*?)\]/);
if (bracketMatch) {
  const rawPw = bracketMatch[1];
  dbUrl = dbUrl.replace(`[${rawPw}]`, encodeURIComponent(rawPw));
}

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function alterNaverSales() {
  try {
    await client.connect();
    console.log("Connected to Supabase PostgreSQL.");

    await client.query(`
      CREATE TABLE IF NOT EXISTS naver_sales (
        product_order_id VARCHAR(255) PRIMARY KEY,
        date DATE NOT NULL,
        account_alias VARCHAR(255),
        product_id VARCHAR(255),
        option_code VARCHAR(255),
        product_name VARCHAR(500),
        option_name VARCHAR(500),
        total_payment_amount INTEGER DEFAULT 0,
        delivery_fee_amount INTEGER DEFAULT 0,
        order_status VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ OK: naver_sales table created or already exists.");

    console.log("🎉 All Naver DB updates applied successfully!");
  } catch (err) {
    console.error("❌ Error altering database:", err);
  } finally {
    await client.end();
  }
}

alterNaverSales();
