const { Pool } = require('pg');
require('dotenv').config({path: '.env.local'});
let dbUrl = process.env.DATABASE_URL||'';
const m = dbUrl.match(/\[(.*?)\]/);
if(m) dbUrl=dbUrl.replace('['+m[1]+']', encodeURIComponent(m[1]));
const pool = new Pool({connectionString: dbUrl, ssl:{rejectUnauthorized:false}});

async function check() {
  const resSales = await pool.query(`
    SELECT date, account_alias, SUM(sales_amount) as total_sales, SUM(sales_qty) as total_qty
    FROM wing_sales 
    WHERE date >= '2026-04-01' AND date <= '2026-04-19'
    GROUP BY date, account_alias 
    ORDER BY date, account_alias
  `);
  
  console.log('=== 일별 계정별 매출액 (wing_sales) ===');
  let dailyTotals = {};
  resSales.rows.forEach(r => {
    let d = '';
    if (r.date) {
       d = new Date(r.date.getTime() + 9*60*60*1000).toISOString().split('T')[0];
    } else { d = 'unknown'; }

    if(!dailyTotals[d]) dailyTotals[d] = { 
      '쿠팡 모딩': 0, '쿠팡 쿠상': 0, '쿠팡 온하인': 0, total: 0 
    };
    dailyTotals[d][r.account_alias] = Number(r.total_sales);
    dailyTotals[d].total += Number(r.total_sales);
  });
  
  for(const d in dailyTotals) {
    const t = dailyTotals[d];
    console.log(`${d} | 총합: ${t.total.toLocaleString().padStart(10)} | 모딩: ${t['쿠팡 모딩'].toLocaleString().padStart(9)} | 쿠상: ${t['쿠팡 쿠상'].toLocaleString().padStart(8)} | 온하인: ${(t['쿠팡 온하인']||0).toLocaleString().padStart(9)}`);
  }

  const resUnmapped = await pool.query(`
    SELECT date, account_alias, campaign_name, conversion_option_id, ad_spend, sales_1d, sales_14d
    FROM coupang_ads_performance
    WHERE date >= '2026-04-13' AND date <= '2026-04-15'
  `);
  
  console.log('\\n=== 4/13~4/15 ads_performance ===');
  let adTotals = {};
  resUnmapped.rows.forEach(r => {
    let d = '';
    if (r.date) {
       d = new Date(r.date.getTime() + 9*60*60*1000).toISOString().split('T')[0];
    } else { d = 'unknown'; }
    if(!adTotals[d]) adTotals[d] = 0;
    adTotals[d] += Number(r.ad_spend);
  });
  console.log('광고비 합계:', adTotals);

  await pool.end();
}
check();
