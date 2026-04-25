import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { query } from '../src/lib/db';

async function fix() {
  try {
    await query('ALTER TABLE scraping_targets ADD COLUMN IF NOT EXISTS last_sales_metric TEXT;');
    await query('ALTER TABLE scraping_targets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();');
    console.log('✅ 컬럼 추가 완료');
  } catch (e) {
    console.error('❌ 에러:', e);
  }
}
fix();
