const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.isjdjroiwwxnkoutgion:wlsghdud45%21%40@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres'
});

async function run() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS scraping_history (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        target_id UUID REFERENCES scraping_targets(id) ON DELETE CASCADE,
        scraped_date DATE NOT NULL DEFAULT CURRENT_DATE,
        price INTEGER,
        review_count VARCHAR(255),
        buy_count VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(target_id, scraped_date)
      );
    `);
    console.log("History table created successfully.");
  } catch(e) { console.error(e); }
  await pool.end();
}
run();
