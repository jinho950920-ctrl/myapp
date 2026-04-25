import { fetchDailyProfitability } from '../src/app/actions/finance';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function check() {
  const res = await fetchDailyProfitability();
  
  console.log('=== 전체 데이터 통계 ===');
  console.log('Total rows:', res.length);
  console.log('Platforms:', [...new Set(res.map(r => r.platform))]);
  
  // 통합(ALL) 일별 합산
  const allByDate: Record<string, any> = {};
  res.forEach(r => {
    if (!allByDate[r.date]) allByDate[r.date] = { grossSales: 0, netProfit: 0 };
    allByDate[r.date].grossSales += r.grossSales;
    allByDate[r.date].netProfit += r.netProfit;
  });
  console.log('\n=== 통합(ALL) 일별 매출 (4/20~) ===');
  Object.keys(allByDate).sort().forEach(k => {
    if (k >= '2026-04-20') console.log(k, allByDate[k]);
  });

  // 네이버 전용
  const naverByDate: Record<string, any> = {};
  res.filter(r => r.platform === 'naver').forEach(r => {
    if (!naverByDate[r.date]) naverByDate[r.date] = { grossSales: 0, netProfit: 0, fees: 0 };
    naverByDate[r.date].grossSales += r.grossSales;
    naverByDate[r.date].netProfit += r.netProfit;
    naverByDate[r.date].fees += r.fees;
  });
  console.log('\n=== 네이버 전용 일별 매출 (4/20~) ===');
  Object.keys(naverByDate).sort().forEach(k => {
    if (k >= '2026-04-20') console.log(k, naverByDate[k]);
  });

  // 쿠팡 전용
  const coupangByDate: Record<string, any> = {};
  res.filter(r => r.platform === 'coupang').forEach(r => {
    if (!coupangByDate[r.date]) coupangByDate[r.date] = { grossSales: 0, netProfit: 0 };
    coupangByDate[r.date].grossSales += r.grossSales;
    coupangByDate[r.date].netProfit += r.netProfit;
  });
  console.log('\n=== 쿠팡 전용 일별 매출 (4/20~) ===');
  Object.keys(coupangByDate).sort().forEach(k => {
    if (k >= '2026-04-20') console.log(k, coupangByDate[k]);
  });

  // OVBG0001 상품의 네이버 데이터 샘플
  const ovbg = res.filter(r => r.masterCode === 'OVBG0001' && r.platform === 'naver');
  console.log('\n=== OVBG0001(네이버) 상세 ===');
  ovbg.forEach(r => {
    console.log(`  ${r.date} | 매출:${r.grossSales} | 원가:${r.cogsAgg} | 수수료:${r.fees} | 순이익:${r.netProfit}`);
  });

  process.exit(0);
}
check();
