"use client";

import { useState, useEffect } from "react";
import { getScrapingTargets } from "@/app/actions/scraperActions";
import { ScrapingChartModal } from "@/components/automations/ScrapingChartModal";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart2, Users, Eye, ShoppingCart, PackageOpen, Award, 
  TrendingUp, TrendingDown, Tag, Hash, MousePointerClick, Crosshair
} from "lucide-react";

// Delta UI Helper Component
function DeltaIndicator({ 
  current, 
  yesterday, 
  type = 'number', 
  inverse = false 
}: { 
  current: number, 
  yesterday: number, 
  type?: 'number' | 'percent' | 'currency' | 'rank' | 'flat',
  inverse?: boolean 
}) {
  const diff = current - yesterday;
  if (diff === 0) return <span className="text-[10px] text-slate-400 font-medium ml-2">-</span>;

  let isPositive = diff > 0;
  // For ranks or ad spend, decreasing is usually "good" or positive in sentiment
  if (inverse) isPositive = !isPositive;

  const colorClass = isPositive ? "text-emerald-500" : "text-rose-500";
  const arrow = diff > 0 ? "▲" : "▼";
  const absDiff = Math.abs(diff);

  let displayValue = "";
  if (type === 'percent') {
    const pct = (absDiff / yesterday) * 100;
    displayValue = `${pct.toFixed(1)}%`;
  } else if (type === 'currency') {
    displayValue = `₩${absDiff.toLocaleString()}`;
  } else if (type === 'flat') {
    displayValue = `${absDiff.toFixed(1)}`;
  } else {
    displayValue = `${absDiff.toLocaleString()}`;
  }

  return (
    <span className={`text-[10px] font-bold ml-1.5 ${colorClass} flex items-center gap-0.5`}>
      <span className="text-[8px]">{arrow}</span> {displayValue}
    </span>
  );
}

export default function DataCenterPage() {
  const [dateStr] = useState(new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }));
  const [dbCompetitors, setDbCompetitors] = useState<any[]>([]);
  const [chartTarget, setChartTarget] = useState<any>(null);

  useEffect(() => {
    async function loadCompetitors() {
      try {
        const res = await getScrapingTargets();
        if (res.success && res.targets) {
          setDbCompetitors(res.targets);
        }
      } catch (err) {
        console.error("Failed to load competitors:", err);
      }
    }
    loadCompetitors();
  }, []);

  // TODO: 추후 [daily_sales_metrics DB]와 연동 필요 (현재 미구현)
  // 기획-구현 불일치 방어 규칙 2조: Mock 데이터 렌더링 유지
  const myProducts = [
    {
      id: "SKU-BAT-001",
      name: "자사 베이직 건전지 AA 24입",
      metrics: {
        visitors: { c: 1245, y: 1100 },
        views: { c: 1890, y: 1950 },
        cartAdds: { c: 112, y: 100 },
        orders: { c: 87, y: 80 },
        salesQty: { c: 105, y: 95 },
        revenue: { c: 950000, y: 880000 },
        conversionRate: { c: 6.98, y: 7.2 },
        price: { c: 8900, y: 8900 },
        naverRank: { c: 12, y: 15 },
        coupangRank: { c: 4, y: 3 },
        adSpend: { c: 45000, y: 55000 },
      },
      trend: "up"
    },
    {
      id: "SKU-CHG-002",
      name: "고속 무선 충전스탠드 15W 블랙",
      metrics: {
        visitors: { c: 856, y: 800 },
        views: { c: 1120, y: 1050 },
        cartAdds: { c: 45, y: 45 },
        orders: { c: 22, y: 28 },
        salesQty: { c: 22, y: 30 },
        revenue: { c: 638000, y: 870000 },
        conversionRate: { c: 2.57, y: 3.5 },
        price: { c: 29000, y: 29000 },
        naverRank: { c: 45, y: 40 },
        coupangRank: { c: 18, y: 18 },
        adSpend: { c: 120000, y: 110000 },
      },
      trend: "down"
    },
    {
      id: "SKU-CAB-003",
      name: "C to C 100W PD 고속 충전 케이블 2m",
      metrics: {
        visitors: { c: 3420, y: 2900 },
        views: { c: 5100, y: 4800 },
        cartAdds: { c: 340, y: 310 },
        orders: { c: 285, y: 240 },
        salesQty: { c: 410, y: 350 },
        revenue: { c: 3239000, y: 2765000 },
        conversionRate: { c: 8.33, y: 8.27 },
        price: { c: 7900, y: 7900 },
        naverRank: { c: 3, y: 4 },
        coupangRank: { c: 1, y: 2 },
        adSpend: { c: 85000, y: 90000 },
      },
      trend: "up"
    }
  ];

  const competitors = [
    {
      id: "COMP-01",
      name: "D사 알카라인 건전지 20입",
      myTarget: "SKU-BAT-001",
      metrics: {
        rank: { c: 1, y: 1 },
        price: { c: 8500, y: 8600 },
        estSalesDay: { c: 350, y: 340 }
      },
      threatLevel: "High"
    },
    {
      id: "COMP-02",
      name: "B사 고속충전거치대 화이트",
      myTarget: "SKU-CHG-002",
      metrics: {
        rank: { c: 5, y: 4 },
        price: { c: 24900, y: 24900 },
        estSalesDay: { c: 85, y: 95 }
      },
      threatLevel: "Medium"
    }
  ];

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 max-w-[1600px] mx-auto h-full animate-in fade-in">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <BarChart2 className="w-8 h-8 text-indigo-500" /> 데이터 센터 (Data Center)
          </h1>
          <p className="text-muted-foreground flex items-center gap-2">
            내 상품의 모든 핵심 퍼포먼스 지표를 전일(Yesterday)과 비교하여 증감률을 정밀 분석합니다.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg border shadow-sm">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-sm font-bold text-slate-700">Today: {dateStr} (Live)</span>
        </div>
      </div>

      <Tabs defaultValue="my-products" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-8 bg-slate-100/80 p-1 rounded-xl">
          <TabsTrigger value="my-products" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm">내 상품 일일 데이터</TabsTrigger>
          <TabsTrigger value="competitors" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-rose-700 data-[state=active]:shadow-sm">경쟁자 트래킹</TabsTrigger>
        </TabsList>

        <TabsContent value="my-products" className="focus-visible:outline-none">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {myProducts.map((p) => (
              <Card key={p.id} className="shadow-md border-slate-200 overflow-hidden hover:border-indigo-300 transition-all duration-300 group">
                <div className={`h-1.5 w-full ${p.trend === 'up' ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : 'bg-gradient-to-r from-rose-400 to-orange-400'}`} />
                <CardHeader className="pb-3 bg-slate-50/50 flex flex-row items-start justify-between">
                  <div>
                    <CardDescription className="font-mono text-xs font-bold text-indigo-500 mb-1">{p.id}</CardDescription>
                    <CardTitle className="text-lg md:text-xl text-slate-800 tracking-tight">{p.name}</CardTitle>
                  </div>
                  <Badge variant="outline" className={`font-bold border bg-white shadow-sm ${p.trend === 'up' ? 'text-emerald-600 border-emerald-200' : 'text-rose-600 border-rose-200'}`}>
                    {p.trend === 'up' ? '상승 유입' : '주의 요망'}
                  </Badge>
                </CardHeader>
                
                <CardContent className="p-0">
                  <div className="grid grid-cols-2 sm:grid-cols-4 border-b">
                    {/* Traffic & Conversion */}
                    <div className="p-4 border-r border-b sm:border-b-0 flex flex-col gap-1.5 bg-white">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><Users className="w-3 h-3"/> 방문자 (DAU)</span>
                      <div className="flex items-baseline">
                        <span className="text-xl font-black text-slate-700">{p.metrics.visitors.c.toLocaleString()}</span>
                        <DeltaIndicator current={p.metrics.visitors.c} yesterday={p.metrics.visitors.y} type="percent" />
                      </div>
                    </div>
                    <div className="p-4 border-r border-b sm:border-b-0 flex flex-col gap-1.5 bg-white">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><Eye className="w-3 h-3"/> 조회수 (PV)</span>
                      <div className="flex items-baseline">
                        <span className="text-xl font-black text-slate-700">{p.metrics.views.c.toLocaleString()}</span>
                        <DeltaIndicator current={p.metrics.views.c} yesterday={p.metrics.views.y} type="percent" />
                      </div>
                    </div>
                    <div className="p-4 border-r flex flex-col gap-1.5 bg-indigo-50/50">
                      <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1"><MousePointerClick className="w-3 h-3"/> 장바구니</span>
                      <div className="flex items-baseline">
                        <span className="text-xl font-black text-indigo-700">{p.metrics.cartAdds.c.toLocaleString()}</span>
                        <DeltaIndicator current={p.metrics.cartAdds.c} yesterday={p.metrics.cartAdds.y} type="number" />
                      </div>
                    </div>
                    <div className="p-4 flex flex-col gap-1.5 bg-indigo-50 relative overflow-hidden">
                      <div className="absolute right-[-10px] top-[-10px] opacity-10"><Crosshair className="w-20 h-20 text-indigo-600" /></div>
                      <span className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider flex items-center gap-1 relative z-10"><TrendingUp className="w-3 h-3"/> 전환율 (CVR)</span>
                      <div className="flex items-baseline relative z-10">
                        <span className="text-2xl font-black text-indigo-600">{p.metrics.conversionRate.c}%</span>
                        <DeltaIndicator current={p.metrics.conversionRate.c} yesterday={p.metrics.conversionRate.y} type="flat" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 border-b">
                    {/* Sales Metrics */}
                    <div className="p-4 border-r border-b md:border-b-0 flex flex-col gap-1.5 bg-white">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><ShoppingCart className="w-3 h-3"/> 주문 건수</span>
                      <div className="flex items-baseline">
                        <span className="text-xl font-black text-slate-700">{p.metrics.orders.c.toLocaleString()}</span>
                        <DeltaIndicator current={p.metrics.orders.c} yesterday={p.metrics.orders.y} type="number" />
                      </div>
                    </div>
                    <div className="p-4 border-r border-b md:border-b-0 flex flex-col gap-1.5 bg-white">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><PackageOpen className="w-3 h-3"/> 실 판매량</span>
                      <div className="flex items-baseline">
                        <span className="text-xl font-black text-slate-700">{p.metrics.salesQty.c.toLocaleString()}</span>
                        <DeltaIndicator current={p.metrics.salesQty.c} yesterday={p.metrics.salesQty.y} type="number" />
                      </div>
                    </div>
                    <div className="p-4 col-span-2 md:col-span-1 flex flex-col gap-1.5 bg-emerald-50 relative">
                      <div className="absolute right-0 bottom-0 w-16 h-16 bg-gradient-to-tl from-emerald-200 to-transparent opacity-50 rounded-tl-full pointer-events-none" />
                      <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1 relative z-10"><Award className="w-3 h-3"/> 총 매출 (일)</span>
                      <div className="flex items-baseline relative z-10">
                        <span className="text-xl font-black text-emerald-700">₩{p.metrics.revenue.c.toLocaleString()}</span>
                        <DeltaIndicator current={p.metrics.revenue.c} yesterday={p.metrics.revenue.y} type="percent" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 bg-slate-50/30">
                    {/* Market & Ads */}
                    <div className="p-4 border-r border-b sm:border-b-0 flex flex-col gap-1.5">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><Tag className="w-3 h-3"/> 현재가</span>
                      <div className="flex items-baseline">
                        <span className="font-bold text-slate-600">₩{p.metrics.price.c.toLocaleString()}</span>
                        <DeltaIndicator current={p.metrics.price.c} yesterday={p.metrics.price.y} type="currency" inverse={true} />
                      </div>
                    </div>
                    <div className="p-4 border-r border-b sm:border-b-0 flex flex-col gap-1.5">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><Hash className="w-3 h-3"/> 네이버 순위</span>
                      <div className="flex items-baseline">
                        <span className="font-black text-emerald-500">{p.metrics.naverRank.c}위</span>
                        <DeltaIndicator current={p.metrics.naverRank.c} yesterday={p.metrics.naverRank.y} type="rank" inverse={true} />
                      </div>
                    </div>
                    <div className="p-4 border-r flex flex-col gap-1.5">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><Hash className="w-3 h-3"/> 쿠팡 순위</span>
                      <div className="flex items-baseline">
                        <span className="font-black text-rose-500">{p.metrics.coupangRank.c}위</span>
                        <DeltaIndicator current={p.metrics.coupangRank.c} yesterday={p.metrics.coupangRank.y} type="rank" inverse={true} />
                      </div>
                    </div>
                    <div className="p-4 flex flex-col gap-1.5">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><TrendingDown className="w-3 h-3"/> 소진 광고비</span>
                      <div className="flex items-baseline">
                        <span className="font-bold text-slate-500">₩{p.metrics.adSpend.c.toLocaleString()}</span>
                        <DeltaIndicator current={p.metrics.adSpend.c} yesterday={p.metrics.adSpend.y} type="percent" inverse={true} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="competitors" className="focus-visible:outline-none">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dbCompetitors.length > 0 ? (
              dbCompetitors.map((comp) => {
                const currentPrice = parseInt(comp.last_price || "0");
                const currentSales = parseInt(comp.last_buy_count || "0");
                const currentReview = comp.last_review_count || "0";
                
                return (
                  <Card key={comp.id} className="shadow-sm border-slate-200 hover:border-rose-300 transition-all">
                    <CardHeader className="pb-3 border-b bg-rose-50/30">
                      <CardTitle className="text-lg text-slate-800">{comp.alias}</CardTitle>
                      <CardDescription className="text-xs">
                        수집 갱신: {comp.last_scraped_at ? new Date(comp.last_scraped_at).toLocaleString() : '대기 중...'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="grid grid-cols-2 border-b">
                        <div className="p-5 border-r flex flex-col gap-1.5 items-center justify-center bg-white">
                          <span className="text-xs font-bold text-slate-400 uppercase">최저 가격</span>
                          <div className="flex items-baseline">
                            <span className="text-2xl font-black text-rose-600">₩{currentPrice.toLocaleString()}</span>
                            {comp.prev_price && <DeltaIndicator current={currentPrice} yesterday={Number(comp.prev_price)} type="percent" inverse={true} />}
                          </div>
                        </div>
                        <div className="p-5 flex flex-col gap-1.5 items-center justify-center bg-indigo-50/30">
                          <span className="text-xs font-bold text-indigo-500 uppercase">결제 고객 수</span>
                          <div className="flex items-baseline mb-0.5">
                            <span className="text-2xl font-black text-indigo-700">{currentSales.toLocaleString()}</span>
                            <span className="text-sm font-bold text-indigo-600 ml-1">명</span>
                            {comp.prev_buy && <DeltaIndicator current={currentSales} yesterday={Number(comp.prev_buy)} type="percent" />}
                          </div>
                        </div>
                      </div>
                      <div className="p-5 flex flex-col gap-3 bg-slate-50 relative">
                        <Button 
                           variant="outline" 
                           size="sm" 
                           className="absolute top-4 right-4 h-7 text-xs bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                           onClick={() => setChartTarget(comp)}
                        >
                           <BarChart2 className="w-3 h-3 mr-1" /> 추이 분석
                        </Button>
                        <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                          <BarChart2 className="w-4 h-4"/> 스니핑 기반 최신 지표
                        </span>
                        
                        <div className="flex justify-between items-end border-b pb-2 mt-1">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm text-yellow-500 tracking-widest text-[16px]">⭐⭐⭐⭐⭐</span>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-xl font-bold text-slate-600">{currentReview} <span className="text-sm font-medium">건</span></span>
                            {comp.prev_review && <DeltaIndicator current={Number(currentReview)} yesterday={Number(comp.prev_review)} type="flat" />}
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-end">
                          <span className="text-sm font-medium text-slate-600">추정 달성 매출</span>
                          <div className="flex items-baseline gap-2">
                            <span className="font-black text-emerald-600">₩{(currentSales * currentPrice).toLocaleString()}</span>
                            {comp.prev_buy && comp.prev_price && <DeltaIndicator current={currentSales * currentPrice} yesterday={Number(comp.prev_buy) * Number(comp.prev_price)} type="percent" />}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="col-span-3 py-12 text-center text-slate-400 font-medium">
                등록된 실시간 경쟁자 데이터가 없습니다. 봇을 구동하여 데이터를 수집해 주세요.
              </div>
            )}
          </div>
        </TabsContent>
        
      </Tabs>
      <ScrapingChartModal isOpen={!!chartTarget} onClose={() => setChartTarget(null)} target={chartTarget} />
    </div>
  );
}
