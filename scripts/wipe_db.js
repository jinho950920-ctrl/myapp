const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.isjdjroiwwxnkoutgion:wlsghdud45%21%40@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres'
});

async function clean() {
  try {
    console.log("Cleaning crawled data history...");
    await pool.query('DELETE FROM crawled_sales_data');
    console.log("Resetting scraping targets stats...");
    await pool.query('UPDATE scraping_targets SET last_price = NULL, last_review_count = NULL, last_buy_count = NULL, last_scraped_at = NULL');
    console.log("Database successfully cleaned!");
  } catch (err) {
    console.error("Error cleaning database:", err);
  } finally {
    await pool.end();
  }
}

clean();
