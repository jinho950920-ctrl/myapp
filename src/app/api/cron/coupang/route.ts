import { NextResponse } from 'next/server';
import { runCoupangSync } from '@/scripts/coupang_sync';

export async function GET(request: Request) {
  // 간단한 API Route 인증 처리 (보안)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'dev_secret'}`) {
    return new NextResponse('Unauthorized access', { status: 401 });
  }

  try {
    const result = await runCoupangSync();
    if (result.success) {
      return NextResponse.json({ message: 'Coupang Sync Successful', data: result.data });
    } else {
      return NextResponse.json({ message: 'Scraping failed', error: result.error }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ message: 'Internal Server Error', error: String(error) }, { status: 500 });
  }
}
