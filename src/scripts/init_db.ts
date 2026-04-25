import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error("No DATABASE_URL found in .env.local");
  process.exit(1);
}

// Clean up brackets if user accidentally left them around password and encode special chars like @
let cleanedUrl = dbUrl;
const bracketMatch = dbUrl.match(/\[(.*?)\]/);
if (bracketMatch) {
  const rawPw = bracketMatch[1];
  const encodedPw = encodeURIComponent(rawPw);
  cleanedUrl = dbUrl.replace(`[${rawPw}]`, encodedPw);
}

const client = new Client({
  connectionString: cleanedUrl,
  ssl: { rejectUnauthorized: false } // Required for Supabase external connects
});

async function createTables() {
  try {
    await client.connect();
    console.log("Connected to Supabase PostgreSQL.");

    await client.query(`
      CREATE TABLE IF NOT EXISTS products_dim (
        code VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        stock INTEGER DEFAULT 0,
        daily_out INTEGER DEFAULT 0,
        runway INTEGER DEFAULT 999,
        is_direct BOOLEAN DEFAULT true,
        direct_fee INTEGER DEFAULT 0,
        is_3pl BOOLEAN DEFAULT false,
        fee_3pl INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ OK: products_dim");

    await client.query(`
      CREATE TABLE IF NOT EXISTS product_mappings (
        mapping_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        master_code VARCHAR(255) REFERENCES products_dim(code) ON DELETE CASCADE,
        platform VARCHAR(50) NOT NULL,
        mapping_type VARCHAR(50) NOT NULL,
        raw_key VARCHAR(500) NOT NULL,
        target_url VARCHAR(1000),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ OK: product_mappings");

    await client.query(`
      CREATE TABLE IF NOT EXISTS trade_receipts (
        receipt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        master_code VARCHAR(255) REFERENCES products_dim(code) ON DELETE CASCADE,
        qty INTEGER NOT NULL,
        supplier_date DATE,
        cogs_krw INTEGER DEFAULT 0,
        shipping_fee INTEGER DEFAULT 0,
        tariff INTEGER DEFAULT 0,
        delivery_method VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ OK: trade_receipts");

    await client.query(`
      CREATE TABLE IF NOT EXISTS unmatched_queue (
        queue_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        platform VARCHAR(50),
        data_type VARCHAR(50),
        title VARCHAR(255),
        raw_id_or_text VARCHAR(500) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ OK: unmatched_queue");

    await client.query(`
      CREATE TABLE IF NOT EXISTS scraping_targets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        url VARCHAR(2000) NOT NULL,
        alias VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        last_scraped_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ OK: scraping_targets");

    await client.query(`
      CREATE TABLE IF NOT EXISTS crawled_sales_data (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        master_code VARCHAR(255) REFERENCES products_dim(code) ON DELETE CASCADE,
        date DATE DEFAULT CURRENT_DATE,
        order_id VARCHAR(255),
        amount INTEGER,
        status VARCHAR(50),
        raw_item_name VARCHAR(500),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ OK: crawled_sales_data");

    // [광고 자동화] 쿠팡의 방대한 69개 맞춤보고서 컬럼 중 핵심만 추출하여 저장하는 전용 테이블
    await client.query(`
      CREATE TABLE IF NOT EXISTS coupang_ads_performance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        date DATE NOT NULL,
        campaign_name VARCHAR(500),
        ad_name VARCHAR(500),
        targeting_product_name VARCHAR(1000),
        conversion_option_id VARCHAR(100),
        conversion_product_name VARCHAR(1000),
        impressions INTEGER DEFAULT 0,
        clicks INTEGER DEFAULT 0,
        ad_spend INTEGER DEFAULT 0,
        orders_1d INTEGER DEFAULT 0,
        sales_1d INTEGER DEFAULT 0,
        roas_1d NUMERIC(15,2) DEFAULT 0,
        orders_14d INTEGER DEFAULT 0,
        sales_14d INTEGER DEFAULT 0,
        roas_14d NUMERIC(15,2) DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (date, campaign_name, ad_name, conversion_option_id)
      );
    `);
    console.log("✅ OK: coupang_ads_performance");

    console.log("🎉 All tables created successfully!");
  } catch (err) {
    console.error("❌ Error creating tables:", err);
  } finally {
    await client.end();
  }
}

createTables();
