import { fetchDailyProfitability } from '../src/app/actions/finance';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function check() {
  const res = await fetchDailyProfitability();
  const byDate: Record<string, any> = {};
  res.forEach(r => {
    if (!byDate[r.date]) byDate[r.date] = { grossSales: 0, netProfit: 0 };
    byDate[r.date].grossSales += r.grossSales;
    byDate[r.date].netProfit += r.netProfit;
  });
  console.log('--- 일일 총매출 및 순이익 ---');
  Object.keys(byDate).sort().forEach(k => {
    if (k >= '2026-04-17') console.log(k, byDate[k]);
  });
  process.exit(0);
}
check();
