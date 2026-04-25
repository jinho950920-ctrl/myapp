import { config } from "dotenv";
config({ path: ".env.local" });
import { query } from "../src/lib/db";

async function run() {
  try {
    const t = await query("SELECT id, alias FROM scraping_targets");
    console.log("=== Targets ===");
    console.table(t.rows);

    // The original 'h' query for scraping_history is replaced by the new query for ads_report_rows
    const res = await query('SELECT COUNT(*) as cnt FROM ads_report_rows;');
    console.log("ads_report_rows Total Rows:", res.rows[0].cnt);
  } catch (err) {
    console.error('Error fetching rows:', err);
  } finally {
    process.exit(0);
  }
}
run();
