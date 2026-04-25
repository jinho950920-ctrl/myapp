import { fetchDailyProfitability } from '../src/app/actions/finance';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function check() {
  const res = await fetchDailyProfitability();
  
  // Show only naver platform data
  const naverData = res.filter(r => r.platform === 'naver');
  console.log('=== 네이버 플랫폼 데이터 ===');
  console.log('Total naver rows:', naverData.length);
  
  if (naverData.length > 0) {
    console.log('Sample naver rows:');
    naverData.slice(0, 5).forEach(r => {
      console.log(`  ${r.date} | ${r.name} | 매출:${r.grossSales} | 수수료:${r.fees} | 순이익:${r.netProfit}`);
    });
  }

  // Date summary for naver
  const byDate: Record<string, any> = {};
  naverData.forEach(r => {
    if (!byDate[r.date]) byDate[r.date] = { grossSales: 0, netProfit: 0, qty: 0 };
    byDate[r.date].grossSales += r.grossSales;
    byDate[r.date].netProfit += r.netProfit;
    byDate[r.date].qty += r.qty;
  });
  console.log('\n=== 네이버 일별 합산 ===');
  Object.keys(byDate).sort().forEach(k => {
    if (k >= '2026-04-20') console.log(k, byDate[k]);
  });

  process.exit(0);
}
check();
