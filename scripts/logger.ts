import { query } from '../src/lib/db';

export async function logAutomation(accountId: string, jobType: string, status: string, errorMessage: string = '', durationMs: number = 0) {
  try {
    await query(`
      INSERT INTO automation_logs (account_id, job_type, status, error_message, duration_ms)
      VALUES ($1, $2, $3, $4, $5)
    `, [accountId, jobType, status, errorMessage, durationMs]);
  } catch(e) {
    console.error('⚠️ 로깅 DB 저장 실패:', e);
  }
}
