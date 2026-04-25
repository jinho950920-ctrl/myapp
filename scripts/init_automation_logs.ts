import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { query } from '../src/lib/db';

async function setupAutomationLogs() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS automation_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        account_id TEXT NOT NULL,
        job_type TEXT NOT NULL,
        status TEXT NOT NULL,
        error_message TEXT,
        duration_ms INTEGER
      );
    `);
    
    // UI 로딩 성능 향상을 위한 인덱스 추가
    await query(`CREATE INDEX IF NOT EXISTS idx_automation_logs_created_at ON automation_logs (created_at DESC);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_automation_logs_job_type ON automation_logs (account_id, job_type);`);

    console.log('✅ TABLE automation_logs created successfully!');
  } catch(e) {
    console.error('❌ Failed to create table:', e);
  }
}

setupAutomationLogs();
