import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

let dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

let cleanedUrl = dbUrl;
const bracketMatch = dbUrl.match(/\[(.*?)\]/);
if (bracketMatch) {
  const rawPw = bracketMatch[1];
  cleanedUrl = dbUrl.replace(`[${rawPw}]`, encodeURIComponent(rawPw));
}

const pool = new Pool({
  connectionString: cleanedUrl,
  ssl: { rejectUnauthorized: false }
});

async function createTables() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. insight_sales_analysis
    await client.query(`
      CREATE TABLE IF NOT EXISTS insight_sales_analysis (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        account_alias VARCHAR(50) NOT NULL,
        product_name TEXT,
        vendor_item_id VARCHAR(50),
        option_id VARCHAR(50) NOT NULL,
        visitors INT DEFAULT 0,
        views INT DEFAULT 0,
        carts INT DEFAULT 0,
        orders INT DEFAULT 0,
        sales_qty INT DEFAULT 0,
        revenue NUMERIC DEFAULT 0,
        cvr NUMERIC DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(date, account_alias, option_id)
      )
    `);

    // 2. insight_traffic
    await client.query(`
      CREATE TABLE IF NOT EXISTS insight_traffic (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        account_alias VARCHAR(50) NOT NULL,
        source_type VARCHAR(100) NOT NULL,
        views INT DEFAULT 0,
        carts INT DEFAULT 0,
        orders INT DEFAULT 0,
        sales_qty INT DEFAULT 0,
        revenue NUMERIC DEFAULT 0,
        cvr NUMERIC DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(date, account_alias, source_type)
      )
    `);

    // 3. insight_keyword_summary
    await client.query(`
      CREATE TABLE IF NOT EXISTS insight_keyword_summary (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        account_alias VARCHAR(50) NOT NULL,
        vendor_item_id VARCHAR(50) NOT NULL,
        keyword VARCHAR(255) NOT NULL,
        search_vol INT DEFAULT 0,
        impressions INT DEFAULT 0,
        clicks INT DEFAULT 0,
        carts INT DEFAULT 0,
        sales_qty INT DEFAULT 0,
        revenue NUMERIC DEFAULT 0,
        cvr NUMERIC DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(date, account_alias, vendor_item_id, keyword)
      )
    `);

    // 4. insight_category_competitors
    await client.query(`
      CREATE TABLE IF NOT EXISTS insight_category_competitors (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        account_alias VARCHAR(50) NOT NULL,
        category_code VARCHAR(50) NOT NULL,
        rank_idx INT NOT NULL,
        competitor_product_name TEXT,
        impressions INT DEFAULT 0,
        clicks INT DEFAULT 0,
        ctr NUMERIC DEFAULT 0,
        sub_keywords JSONB, -- stores array of associated top keywords
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(date, account_alias, category_code, rank_idx)
      )
    `);

    // 5. insight_category_keywords
    await client.query(`
      CREATE TABLE IF NOT EXISTS insight_category_keywords (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        account_alias VARCHAR(50) NOT NULL,
        category_code VARCHAR(50) NOT NULL,
        rank_idx INT NOT NULL,
        keyword VARCHAR(255),
        search_vol INT DEFAULT 0,
        impressions INT DEFAULT 0,
        clicks INT DEFAULT 0,
        sub_products JSONB, -- stores array of associated top products
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(date, account_alias, category_code, rank_idx)
      )
    `);

    await client.query('COMMIT');
    console.log("Insight Tables successfully created or already exist!");
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error creating Insight tables:", error);
  } finally {
    client.release();
    pool.end();
  }
}

createTables();
