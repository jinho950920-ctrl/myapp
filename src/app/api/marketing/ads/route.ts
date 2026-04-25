import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || '7days';

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

    // 2. Fetch Ad Performance over the period
    const adsRes = await query(`
      SELECT 
        date as report_date,
        campaign_name as name,
        ad_name,
        conversion_option_id,
        SUM(ad_spend) as ad_spend,
        SUM(sales_1d) as sales_1d,
        SUM(clicks) as clicks,
        SUM(orders_1d) as orders_1d
      FROM coupang_ads_performance
      WHERE date >= '${startStr}' AND date <= '${endStr}'
      GROUP BY date, campaign_name, ad_name, conversion_option_id
    `);

    // 3. Fetch Wing Sales (Actual revenue) over the period
    const wingRes = await query(`
      SELECT 
        date as report_date,
        option_id, 
        SUM(sales_amount) as sales_amount
      FROM wing_sales
      WHERE date >= '${startStr}' AND date <= '${endStr}'
      GROUP BY date, option_id
    `);

    // 윙 세일즈 날짜별, 옵션별 맵 구상 (중복 차감 피하기 위함)
    const wingMap = new Map<string, number>();
    wingRes.rows.forEach(r => {
       // KST 날짜 변환 보완
       const dStr = new Date(new Date(r.report_date).getTime() + 9 * 60 * 60 * 1000).toISOString().split('T')[0].substring(5);
       const key = `${dStr}_${r.option_id}`;
       wingMap.set(key, (wingMap.get(key) || 0) + (Number(r.sales_amount) || 0));
    });

    // 4. Group Ads Data by Campaign Name
    const campaignsMap = new Map<string, any>();
    const trendMap = new Map<string, { spend: number, cpRevenue: number, realRevenue: number }>();

    let totalSpend = 0;
    let totalCoupangRevenue = 0;
    let totalRealRevenue = 0;
    let totalClicks = 0;
    let totalOrders = 0;
    let lastUpdated = 'N/A';

    adsRes.rows.forEach((row: any) => {
      const cName = row.name || '알 수 없는 캠페인';
      const adObjective = row.ad_name || 'None';  // 광고 목표
      const campaignSetKey = `${cName}|||${adObjective}`;  // 캠페인+광고목표 세트
      const cvId = row.conversion_option_id;
      const dStrFull = new Date(new Date(row.report_date).getTime() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
      const dStr = dStrFull.substring(5);
      
      const spend = Number(row.ad_spend) || 0;
      const cpRev = Number(row.sales_1d) || 0;
      const clicks = Number(row.clicks) || 0;
      const orders = Number(row.orders_1d) || 0;

      let realRev = 0;
      if (cvId && cvId !== 'NO_CONVERSION') {
         const wKey = `${dStr}_${cvId}`;
         if (wingMap.has(wKey)) {
             realRev = wingMap.get(wKey)!;
             wingMap.delete(wKey); 
         }
      }

      totalSpend += spend;
      totalCoupangRevenue += cpRev;
      totalRealRevenue += realRev;
      totalClicks += clicks;
      totalOrders += orders;

      // 캠페인 이름 + 광고 목표를 하나의 세트로 그룹핑
      if (!campaignsMap.has(campaignSetKey)) {
        campaignsMap.set(campaignSetKey, { 
          name: cName, 
          adObjective: adObjective,  // 광고 목표
          platform: 'Coupang Ads', 
          spend: 0, 
          cpRev: 0, 
          realRev: 0, 
          clicks: 0, 
          status: 'Active',
          dailyStats: new Map<string, any>()
        });
      }
      const c = campaignsMap.get(campaignSetKey);
      c.spend += spend;
      c.cpRev += cpRev;
      c.realRev += realRev;
      c.clicks += clicks;

      if (!c.dailyStats.has(dStrFull)) {
        c.dailyStats.set(dStrFull, { spend: 0, cpRev: 0, realRev: 0 });
      }
      const cd = c.dailyStats.get(dStrFull);
      cd.spend += spend;
      cd.cpRev += cpRev;
      cd.realRev += realRev;

      if (!trendMap.has(dStrFull)) trendMap.set(dStrFull, { spend: 0, cpRevenue: 0, realRevenue: 0 });
      const t = trendMap.get(dStrFull)!;
      t.spend += spend;
      t.cpRevenue += cpRev;
      t.realRevenue += realRev; 
      
      if (dStrFull > lastUpdated || lastUpdated === 'N/A') lastUpdated = dStrFull;
    });

    // KPI ROAS는 부가세 포함액( * 1.1 ) 기준으로 계산!!!
    // 매출은 쿠팡 매출 대신 '실제 매출(윙)' 기준으로 표출!
    const vatSpend = totalSpend * 1.1;
    const globalRoas = vatSpend > 0 ? (totalRealRevenue / vatSpend) * 100 : 0;
    const conversionRate = totalClicks > 0 ? (totalOrders / totalClicks) * 100 : 0;

    // 5. 프론트엔드로 내려보낼 Payload 조합
    const payload = {
      kpi: {
        spend: Math.round(totalSpend), // UI는 원본값 표출
        revenue: Math.round(totalRealRevenue), // 실제 매출 표출
        roas: Math.round(globalRoas), // 목표 300% 비교를 위해 실제 매출 / 부가세포함 지출
        conversionRate: conversionRate.toFixed(1),
        lastUpdated
      },
      performanceData: Array.from(trendMap.entries())
        .map(([fullDate, val]) => ({
          date: fullDate.substring(5).replace('-', '/'),
          spend: Math.round(val.spend),
          revenue: Math.round(val.realRevenue) // 추이 그래프는 실제 매출 우선
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      
      campaignData: Array.from(campaignsMap.values()).map((c: any, idx: number) => {
        const vatCSpend = c.spend * 1.1;
        const cpRoas = vatCSpend > 0 ? (c.cpRev / vatCSpend) * 100 : 0;
        const realRoas = vatCSpend > 0 ? (c.realRev / vatCSpend) * 100 : 0;

        const dailyStatsArray = Array.from(c.dailyStats.entries()).map(([dt, ds]: any) => {
          const vSpend = ds.spend * 1.1;
          const dsCpRoas = vSpend > 0 ? (ds.cpRev / vSpend) * 100 : 0;
          const dsRealRoas = vSpend > 0 ? (ds.realRev / vSpend) * 100 : 0;
          return {
            date: dt.substring(5).replace('-', '/'),
            spend: Math.round(ds.spend),
            cpRoas: Math.round(dsCpRoas),
            realRoas: Math.round(dsRealRoas)
          };
        }).sort((a, b) => a.date.localeCompare(b.date)); // 오름차순 정렬
        
        return {
          id: `CPG-00${idx + 1}`,
          platform: c.platform,
          name: c.name,
          adObjective: c.adObjective,       // 광고 목표 (광고명)
          status: c.status,
          spend: Math.round(c.spend),        // 소진액 (VAT 별도)
          cpRevenue: Math.round(c.cpRev),    // 쿠팡 매출
          realRevenue: Math.round(c.realRev), // 실제 매출 (윙)
          cpRoas: Math.round(cpRoas),        // 쿠팡 ROAS
          realRoas: Math.round(realRoas),    // 실제 ROAS
          clicks: c.clicks,
          dailyStats: dailyStatsArray
        };
      }).sort((a, b) => b.realRoas - a.realRoas) // 실제 ROAS 높은 순 정렬
    };

    return NextResponse.json({ success: true, data: payload });
  } catch (error: any) {
    console.error('마케팅 데이터 페칭 에러:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

