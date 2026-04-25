import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const res = await query(`
      SELECT 
        id, 
        created_at, 
        account_id, 
        job_type, 
        status, 
        error_message, 
        duration_ms
      FROM automation_logs
      ORDER BY created_at DESC
      LIMIT 100
    `);
    
    return NextResponse.json({ success: true, logs: res.rows });
  } catch (error: any) {
    console.error('Failed to fetch automation logs:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
