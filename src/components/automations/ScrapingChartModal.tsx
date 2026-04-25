"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getScrapingHistory } from "@/app/actions/scraperActions";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";

export function ScrapingChartModal({ isOpen, onClose, target }: { isOpen: boolean, onClose: () => void, target: any }) {
  const [data, setData] = useState<any[]>([]);
  const [days, setDays] = useState(30);

  useEffect(() => {
    if (isOpen && target?.id) {
      getScrapingHistory(target.id, days).then((res) => {
        if (res.success) {
          const formatted = res.history?.map((row: any) => ({
            ...row,
            scraped_date: new Date(row.scraped_date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
            price: Number(row.price),
            review_count: Number(row.review_count || 0),
            buy_count: Number(row.buy_count || 0)
          }));
          setData(formatted || []);
        }
      });
    }
  }, [isOpen, target?.id, days]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl bg-white border-fuchsia-100 shadow-xl">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-xl text-fuchsia-900 font-bold flex items-center gap-2">
            📈 [{target?.alias}] 경쟁사 성장 추이 분석
          </DialogTitle>
          <p className="text-sm text-slate-500">지정한 기간 동안의 가격 정책 및 구매전환율(리뷰/리얼구매자) 추세를 시계열 선형 그래프로 확인합니다.</p>
        </DialogHeader>
        
        <div className="flex gap-2 mb-2 mt-4">
          <Button variant={days === 7 ? "default" : "outline"} size="sm" onClick={() => setDays(7)} className={days === 7 ? "bg-fuchsia-600 hover:bg-fuchsia-700" : ""}>7일 (1주)</Button>
          <Button variant={days === 30 ? "default" : "outline"} size="sm" onClick={() => setDays(30)} className={days === 30 ? "bg-fuchsia-600 hover:bg-fuchsia-700" : ""}>30일 (1개월)</Button>
          <Button variant={days === 90 ? "default" : "outline"} size="sm" onClick={() => setDays(90)} className={days === 90 ? "bg-fuchsia-600 hover:bg-fuchsia-700" : ""}>90일 (3개월)</Button>
        </div>

        <div className="h-[450px] w-full mt-4 bg-slate-50/50 rounded-xl p-4 border border-slate-100">
          {data.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400">데이터를 불러오는 중이거나 아직 누적된 히스토리가 없습니다.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="scraped_date" tick={{fontSize: 12, fill: "#64748B"}} tickMargin={10} axisLine={false} tickLine={false} />
                <YAxis yAxisId="price" tick={{fontSize: 12, fill: "#059669"}} axisLine={false} tickLine={false} tickFormatter={(val) => `₩${val.toLocaleString()}`} />
                <YAxis yAxisId="social" orientation="right" tick={{fontSize: 12, fill: "#C026D3"}} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                  formatter={(value: any, name: any) => [name === '가격' ? `₩${Number(value).toLocaleString()}` : `${value}건`, name]}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Line yAxisId="price" type="monotone" name="가격" dataKey="price" stroke="#059669" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 7}} />
                <Line yAxisId="social" type="monotone" name="리뷰 수" dataKey="review_count" stroke="#F59E0B" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 7}} />
                <Line yAxisId="social" type="monotone" name="리얼 구매자수" dataKey="buy_count" stroke="#C026D3" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 7}} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
