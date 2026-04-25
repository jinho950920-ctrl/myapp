import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

let dbUrl = process.env.DATABASE_URL;
if (dbUrl) {
  const bracketMatch = dbUrl.match(/\[(.*?)\]/);
  if (bracketMatch) {
    const rawPw = bracketMatch[1];
    dbUrl = dbUrl.replace(`[${rawPw}]`, encodeURIComponent(rawPw));
  }
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function deleteTodayData() {
  const TARGET_DATES = ['2026-03-30', '2026-03-31'];
  console.log(`🗑️ DB에서 ${TARGET_DATES.join(', ')} 데이터 비우기 시작...`);

  let wingTotal = 0;
  let adsTotal = 0;

  for (const date of TARGET_DATES) {
    const wingDel = await pool.query(`DELETE FROM wing_sales WHERE date = $1`, [date]);
    wingTotal += wingDel.rowCount || 0;

    const adsDel = await pool.query(`DELETE FROM coupang_ads_performance WHERE date = $1`, [date]);
    adsTotal += adsDel.rowCount || 0;
  }

  console.log(`✅ wing_sales (판매분석) 데이터 ${wingTotal}건 삭제 완료!`);
  console.log(`✅ coupang_ads_performance (광고센터) 데이터 ${adsTotal}건 삭제 완료!`);

  await pool.end();
}

deleteTodayData().catch(console.error);
