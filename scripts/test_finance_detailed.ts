import { fetchDailyProfitability } from '../src/app/actions/finance';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function check() {
  const res = await fetchDailyProfitability();
  console.log('Sample rows for 2026-04-18:', res.filter(r => r.date === '2026-04-18').slice(0, 3));
  process.exit(0);
}
check();
