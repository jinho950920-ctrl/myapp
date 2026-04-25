"use client";

import { useEffect, useState, useMemo } from "react";
import { fetchDailyProfitability } from "@/app/actions/finance";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ResponsiveContainer, ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function DailyProductProfitChart() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<string>("ALL");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("ALL");

  useEffect(() => {
    fetchDailyProfitability().then((res) => {
      setData(res);
      setLoading(false);
    }).catch(e => {
      console.error(e);
      setLoading(false);
    });
  }, []);

  const uniqueProducts = useMemo(() => {
    const map = new Map<string, string>();
    data.forEach(d => {
      if (!map.has(d.masterCode)) {
        map.set(d.masterCode, d.name);
      }
    });
    return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
  }, [data]);

  const chartData = useMemo(() => {
    let filteredData = data;
    
    // 1. Platform Filter
    if (selectedPlatform !== "ALL") {
      filteredData = filteredData.filter(d => d.platform === selectedPlatform);
    }
    
    if (selectedProduct === "ALL") {
      // Aggregate by date for ALL products
      const aggMap = new Map<string, any>();
      filteredData.forEach(d => {
        if (!aggMap.has(d.date)) {
          aggMap.set(d.date, { date: d.date, rawDate: d.date, grossSales: 0, netProfit: 0, qty: 0, cogsAgg: 0, ads: 0, promoAgg: 0, fees: 0 });
        }
        const ex = aggMap.get(d.date);
        ex.grossSales += d.grossSales;
        ex.netProfit += d.netProfit;
        ex.qty += d.qty;
        ex.cogsAgg += d.cogsAgg;
        ex.ads += d.ads;
        ex.promoAgg += (d.promoAgg || 0);
        ex.fees += d.fees;
      });
      return Array.from(aggMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(r => ({
        ...r,
        // Shorten date format to MM/DD
        date: r.date.substring(5).replace('-', '/')
      }));
    } else {
      // 2. Product Filter with grouping (because same product might have coupang + naver rows on same day)
      const aggMap = new Map<string, any>();
      const prodData = filteredData.filter(d => d.masterCode === selectedProduct);
      
      prodData.forEach(d => {
        if (!aggMap.has(d.date)) {
          aggMap.set(d.date, { date: d.date, rawDate: d.date, grossSales: 0, netProfit: 0, qty: 0, cogsAgg: 0, ads: 0, promoAgg: 0, fees: 0 });
        }
        const ex = aggMap.get(d.date);
        ex.grossSales += d.grossSales;
        ex.netProfit += d.netProfit;
        ex.qty += d.qty;
        ex.cogsAgg += d.cogsAgg;
        ex.ads += d.ads;
        ex.promoAgg += (d.promoAgg || 0);
        ex.fees += d.fees;
      });
      
      return Array.from(aggMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(r => ({
        ...r,
        date: r.date.substring(5).replace('-', '/')
      }));
    }
  }, [data, selectedProduct, selectedPlatform]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const pData = payload[0].payload;
      return (
        <div className="bg-white p-4 border border-slate-200 shadow-xl rounded-xl z-50 text-sm">
          <p className="font-bold text-base border-b pb-2 mb-2 text-slate-800">{pData.rawDate || label}</p>
          <div className="space-y-1.5 font-medium">
            <p className="flex justify-between gap-6 text-blue-600"><span>총 매출액:</span> <span>₩ {pData.grossSales.toLocaleString()}</span></p>
            <p className="flex justify-between gap-6 text-emerald-600 font-bold border-b pb-1"><span>일일 순이익:</span> <span>₩ {pData.netProfit.toLocaleString()}</span></p>
            <p className="flex justify-between gap-6 text-slate-500 pt-1"><span>판매 수량:</span> <span>{pData.qty.toLocaleString()} 개</span></p>
            <p className="flex justify-between gap-6 text-orange-500"><span>프로모션 즉시할인:</span> <span>₩ -{(pData.promoAgg || 0).toLocaleString()}</span></p>
            <p className="flex justify-between gap-6 text-slate-500"><span>매출 원가(COGS):</span> <span>₩ -{pData.cogsAgg.toLocaleString()}</span></p>
            <p className="flex justify-between gap-6 text-slate-500"><span>플랫폼/배송비:</span> <span>₩ -{pData.fees.toLocaleString()}</span></p>
            <p className="flex justify-between gap-6 text-rose-500"><span>광고 지출비:</span> <span>₩ -{pData.ads.toLocaleString()}</span></p>
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Card className="shadow-sm border-slate-200 my-6">
        <CardContent className="h-[400px] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return null;
  }

  return (
    <Card className="shadow-sm border-slate-200 my-6">
      <CardHeader className="bg-slate-50/50 border-b pb-4">
        <div className="flex items-start md:items-center justify-between flex-col md:flex-row gap-4">
          <div>
            <CardTitle className="text-xl">일별 매출 및 순이익 (시계열)</CardTitle>
            <CardDescription className="pt-1 text-[13px]">특정 상품을 선택하여 일자별 성과와 이익률 흐름을 추적합니다.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={selectedPlatform} onValueChange={(val) => setSelectedPlatform(val || "ALL")}>
              <SelectTrigger className="w-[140px] bg-white">
                <SelectValue placeholder="플랫폼 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">통합 플랫폼</SelectItem>
                <SelectItem value="coupang">쿠팡(Coupang)</SelectItem>
                <SelectItem value="naver">네이버(Naver)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedProduct} onValueChange={(val) => setSelectedProduct(val || "ALL")}>
              <SelectTrigger className="w-[200px] bg-white">
                <SelectValue placeholder="상품 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">전체 상품 합계</SelectItem>
                {uniqueProducts.map(p => (
                  <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <defs>
              <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} minTickGap={20} />
            <YAxis 
              yAxisId="left" 
              axisLine={false} 
              tickLine={false} 
              tickFormatter={(value) => `${value / 10000}만`} 
              tick={{ fontSize: 11, fill: '#64748b' }} 
              dx={-10}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            
            <Area yAxisId="left" type="monotone" name="총 매출액 (Gross Sales)" dataKey="grossSales" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorGross)" />
            <Area yAxisId="left" type="monotone" name="진성 순이익 (Net Profit)" dataKey="netProfit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorNet)" />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
