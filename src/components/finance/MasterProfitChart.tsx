"use client";

import { useEffect, useState } from "react";
import { fetchMasterProfitability } from "@/app/actions/finance";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Line, Cell } from "recharts";
import { Loader2 } from "lucide-react";

export function MasterProfitChart() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMasterProfitability().then((res) => {
      // 매출(grossSales) 기준으로 내림차순 정렬 (상위 15개)
      const sorted = res.sort((a, b) => b.grossSales - a.grossSales).slice(0, 15);
      setData(sorted);
      setLoading(false);
    }).catch(e => {
      console.error(e);
      setLoading(false);
    });
  }, []);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 border border-slate-200 shadow-xl rounded-xl z-50 text-sm">
          <p className="font-bold text-base border-b pb-2 mb-2 text-slate-800">{label}</p>
          <div className="space-y-1.5 font-medium">
            <p className="flex justify-between gap-6 text-blue-600"><span>총 매출액:</span> <span>₩ {data.grossSales.toLocaleString()}</span></p>
            <p className="flex justify-between gap-6 text-emerald-600 font-bold border-b pb-1"><span>최종 순이익:</span> <span>₩ {data.netProfit.toLocaleString()}</span></p>
            <p className="flex justify-between gap-6 text-slate-500 pt-1"><span>판매 수량:</span> <span>{data.qty.toLocaleString()} 개</span></p>
            <p className="flex justify-between gap-6 text-slate-500"><span>매출 원가(COGS):</span> <span>₩ -{data.cogsAgg.toLocaleString()}</span></p>
            <p className="flex justify-between gap-6 text-slate-500"><span>플랫폼/배송비:</span> <span>₩ -{data.fees.toLocaleString()}</span></p>
            <p className="flex justify-between gap-6 text-rose-500"><span>광고 지출비:</span> <span>₩ -{data.ads.toLocaleString()}</span></p>
            <p className="text-[11px] text-slate-400 mt-2 text-right">*(현재 쿠팡 한정 매핑 데이터 기준)</p>
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
    return (
      <Card className="shadow-sm border-slate-200 my-6">
        <CardContent className="h-[400px] flex items-center justify-center flex-col gap-3">
          <p className="text-slate-500 font-medium">매핑된 매출 데이터가 아직 없습니다.</p>
          <p className="text-sm text-slate-400">Wing 크롤러를 우선 실행하고 상품 매핑을 설정해 주세요.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm border-slate-200 my-6">
      <CardHeader className="bg-slate-50/50 border-b pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">마스터 상품별 수익성 분석 (Net Profit Breakdown)</CardTitle>
            <CardDescription className="pt-1 text-[13px]">마스터 코드 기준으로 흩어진 매출(Wing)과 광고비, 수입원가(COGS)를 병합하여 진성 순이익을 계산합니다.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 h-[450px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} angle={0} />
            <YAxis 
              yAxisId="left" 
              axisLine={false} 
              tickLine={false} 
              tickFormatter={(value) => `${value / 10000}만`} 
              tick={{ fontSize: 11, fill: '#64748b' }} 
              dx={-10}
            />
            <Tooltip content={<CustomTooltip />} cursor={{fill: '#f1f5f9'}} />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            
            {/* Sales Bar */}
            <Bar yAxisId="left" name="총 매출액 (Gross Sales)" dataKey="grossSales" barSize={35} radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                 <Cell key={`cell-sales-${index}`} fill="#3b82f6" />
              ))}
            </Bar>
            
            {/* Net Profit Line */}
            <Line yAxisId="left" type="monotone" name="진성 순이익 (Net Profit)" dataKey="netProfit" stroke="#10b981" strokeWidth={4} activeDot={{ r: 8 }} />
            
            {/* Cost Line (Hidden by default, can be toggled by Legend if supported, or just keep as separate ref) */}
            <Line yAxisId="left" type="monotone" name="물류/광고/플랫폼 지출" dataKey={(d) => d.cogsAgg + d.ads + d.fees} stroke="#f43f5e" strokeDasharray="5 5" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
