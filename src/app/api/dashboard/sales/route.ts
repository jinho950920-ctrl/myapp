import { NextResponse } from 'next/server';
import { fetchDailyProfitability } from '@/app/actions/finance';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || '7days';
    const platformFilter = searchParams.get('platform') || 'all'; // 'all', 'coupang', 'naver'

    // 1. Calculate the start date based on the period
    const now = new Date();
    now.setHours(now.getHours() + 9); // KST
    
    let startDate = new Date(now);
    if (period === '7days') {
      startDate.setDate(now.getDate() - 6);
    } else if (period === '30days') {
      startDate.setDate(now.getDate() - 29);
    } else if (period === 'thisMonth') {
      startDate.setDate(1);
    } else if (period === 'lastMonth') {
      startDate.setMonth(now.getMonth() - 1);
      startDate.setDate(1);
      const lastDayOfLastMonth = new Date(now);
      lastDayOfLastMonth.setDate(0);
      now.setTime(lastDayOfLastMonth.getTime());
    }

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = now.toISOString().split('T')[0];

    // 2. 통합 로직(fetchDailyProfitability) 호출 (MAPPED + UNMAPPED 모두 포함됨)
    const profitabilityData = await fetchDailyProfitability();

    const dailyStats: Record<string, { revenue: number, profit: number }> = {};
    
    // Pre-fill dates
    for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
        const dStr = d.toISOString().split('T')[0].substring(5).replace('-', '/');
        dailyStats[dStr] = { revenue: 0, profit: 0 };
    }

    // 3. 반환된 상품별 통합 일일 데이터를 기간 내 날짜에 맞춰 집계
    profitabilityData.forEach((item: any) => {
      if (platformFilter !== 'all' && item.platform !== platformFilter && item.platform !== 'unmapped') {
        return; // Filter out if platform doesn't match
      }

      // item.date is format 'YYYY-MM-DD'
      if (item.date >= startStr && item.date <= endStr) {
        const dStr = item.date.substring(5).replace('-', '/');
        if (!dailyStats[dStr]) {
          dailyStats[dStr] = { revenue: 0, profit: 0 };
        }
        dailyStats[dStr].revenue += (item.grossSales || 0);
        dailyStats[dStr].profit += (item.netProfit || 0);
      }
    });

    const result = Object.entries(dailyStats)
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([name, stats]) => ({
        name,
        revenue: Math.round(stats.revenue),
        profit: Math.round(stats.profit)
      }));

    return NextResponse.json({ success: true, data: result });
  } catch(error: any) {
    console.error("Dashboard API Error:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

