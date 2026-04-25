const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

let cleanedUrl = process.env.DATABASE_URL || '';
const bracketMatch = cleanedUrl.match(/\[(.*?)\]/);
if (bracketMatch) cleanedUrl = cleanedUrl.replace(`[${bracketMatch[1]}]`, encodeURIComponent(bracketMatch[1]));

const client = new Client({ connectionString: cleanedUrl, ssl: { rejectUnauthorized: false } });

async function check() {
  await client.connect();

  // 1. 계정별 최근 날짜 확인 (쿠상 데이터 있는지)
  const r1 = await client.query(`
    SELECT account_alias, date::text, COUNT(*) as rows
    FROM coupang_ads_performance
    GROUP BY account_alias, date
    ORDER BY date DESC LIMIT 20
  `);
  console.log('\n[1] 계정별 날짜 분포:');
  console.table(r1.rows);

  // 2. product_platform_costs 컬럼 및 데이터
  const r2 = await client.query(`SELECT * FROM product_platform_costs LIMIT 5`);
  console.log('\n[2] product_platform_costs 컬럼:', Object.keys(r2.rows[0] || {}));
  console.table(r2.rows);

  // 3. master products
  const r3 = await client.query(`SELECT code, name FROM master_products LIMIT 10`);
  console.log('\n[3] master_products:');
  console.table(r3.rows);

  // 4. wing_sales 최근 데이터 (실제 매출, 반품 제외된 것)
  const r4 = await client.query(`
    SELECT date::text, account_alias, SUM(sales_amount) as total_sales, SUM(sales_qty) as total_qty
    FROM wing_sales
    GROUP BY date, account_alias
    ORDER BY date DESC LIMIT 10
  `);
  console.log('\n[4] wing_sales 최근 매출:');
  console.table(r4.rows);

  await client.end();
}
check().catch(console.error);
