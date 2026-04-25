// 일회성 마이그레이션 스크립트 (DB 제약조건 추가용)
import path from 'path';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function fixConstraint() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    console.log("Adding UNIQUE constraint to ads_report_rows(row_hash)...");
    await pool.query(`ALTER TABLE ads_report_rows ADD CONSTRAINT unique_row_hash UNIQUE (row_hash);`);
    console.log("✅ Constraint added successfully!");
  } catch(e: any) {
    if(e.message.includes('already exists')) {
      console.log("✅ Constraint already exists!");
    } else {
      console.error("❌ Error:", e.message);
    }
  } finally {
    await pool.end();
  }
}

fixConstraint();
