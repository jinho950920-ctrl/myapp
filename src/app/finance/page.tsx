"use client";

import { useState, useEffect } from "react";
import { MasterProfitChart } from "@/components/finance/MasterProfitChart";
import { DailyProductProfitChart } from "@/components/finance/DailyProductProfitChart";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Button } from "@/components/ui/button";
import { Wallet, TrendingUp, FileText, DownloadCloud, DollarSign, Receipt, AlertTriangle, RefreshCcw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function FinancePage() {
  const [financialData, setFinancialData] = useState<any[]>([
    { date: "03/16", revenue: 8400000, profit: 2100000 },
    { date: "03/17", revenue: 9200000, profit: 2500000 },
    { date: "03/18", revenue: 7800000, profit: 1900000 },
    { date: "03/19", revenue: 11500000, profit: 3400000 },
    { date: "03/20", revenue: 9800000, profit: 2700000 },
    { date: "03/21", revenue: 13200000, profit: 4100000 },
    { date: "03/22", revenue: 4250000, profit: 1250000 },
  ]);

  useEffect(() => {
    fetch('/api/dashboard/sales')
      .then(res => res.json())
      .then(json => {
         if (json.success && json.data && json.data.length > 0) {
            const formatted = json.data.map((d: any) => ({
              date: d.name,
              revenue: Number(d.revenue),
              profit: Number(d.profit)
            }));
            setFinancialData(formatted);
         }
      })
      .catch(err => console.error("차트 데이터 페칭 에러:", err));
  }, []);

  const settlements = [
    { platform: "스마트스토어", period: "26.03.11 ~ 03.17", amount: 45200000, fee: 1356000, status: "정산완료", date: "03-19" },
    { platform: "쿠팡 (로켓)", period: "26.02.01 ~ 02.28", amount: 128000000, fee: 38400000, status: "지급대기", date: "03-25 예정" },
    { platform: "11번가", period: "26.03.01 ~ 03.15", amount: 15400000, fee: 1848000, status: "정산완료", date: "03-18" },
  ];

  const taxInvoices = [
    { id: "TAX-2603-001", partner: "대한통운(주)", amount: 1540000, type: "매입", status: "수취완료", date: "03-10" },
    { id: "TAX-2603-002", partner: "Shenzhen Battery(수입관세)", amount: 350000, type: "매입", status: "수취완료", date: "03-15" },
    { id: "TAX-2603-088", partner: "(주) 비투비도매", amount: 8500000, type: "매출", status: "발행대기", date: "03-25 한도" },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 max-w-7xl mx-auto h-full animate-in fade-in">
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Wallet className="w-8 h-8 text-emerald-500" /> 재무 및 정산 관리
          </h1>
          <p className="text-muted-foreground">플랫폼별 정산 현황, 매출 총이익(Gross Profit), 세금계산서 내역을 통합 추적합니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="shadow-sm" onClick={() => alert('읽기 전용: 홈택스 연동 인증서 갱신이 필요합니다.')}>
            <RefreshCcw className="w-4 h-4 mr-2 text-slate-500" /> 홈택스/플랫폼 스크래핑
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
            <DownloadCloud className="w-4 h-4 mr-2" /> 월마감 재무제표 엑셀
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="shadow-sm border-l-4 border-l-slate-800">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-slate-100 text-slate-700 rounded-lg"><DollarSign className="w-6 h-6"/></div>
            <div>
              <p className="text-sm font-medium text-slate-500">당월 누적 매출액 (VAT포함)</p>
              <h3 className="text-2xl font-bold">₩ 245.8<span className="text-sm font-normal text-slate-500 ml-1">M</span></h3>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-l-4 border-l-rose-500">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-rose-100 text-rose-600 rounded-lg"><TrendingUp className="w-6 h-6"/></div>
            <div>
              <p className="text-sm font-medium text-slate-500">당월 누적 상품 원가(COGS)</p>
              <h3 className="text-2xl font-bold">₩ 98.4<span className="text-sm font-normal text-slate-500 ml-1">M</span></h3>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-l-4 border-l-emerald-500">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg"><Wallet className="w-6 h-6"/></div>
            <div>
              <p className="text-sm font-medium text-slate-500">추정 영업이익 (판관비 제외)</p>
              <h3 className="text-2xl font-bold text-emerald-700">₩ 76.5<span className="text-sm font-normal text-emerald-500 ml-1">M</span></h3>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm bg-slate-50 border-l-4 border-l-indigo-500">
          <CardContent className="p-4 flex items-center justify-between h-full">
            <div>
              <p className="text-sm font-medium text-indigo-800">이번주 입금 예정 정산금</p>
              <h3 className="text-2xl font-black text-indigo-900 mt-1">₩ 128.0<span className="text-sm tracking-tight font-bold ml-1">M</span></h3>
            </div>
            <Receipt className="w-8 h-8 text-indigo-200" />
          </CardContent>
        </Card>
      </div>

      <MasterProfitChart />
      <DailyProductProfitChart />

      <div className="grid grid-cols-3 gap-6">
        {/* Main Chart */}
        <Card className="col-span-2 shadow-sm">
          <CardHeader className="bg-white pb-2 border-b">
            <CardTitle className="text-lg">주간 매출 및 이익률 추이</CardTitle>
            <CardDescription>순매출액(Revenue)과 순이익(Net Profit)의 7일간 흐름을 비교합니다.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={financialData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} tickFormatter={(value) => `₩${value/1000000}M`} />
                  <Tooltip 
                    formatter={(value: any) => `₩${value.toLocaleString()}`}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="top" height={36} />
                  <Area type="monotone" name="총 매출액" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                  <Area type="monotone" name="이익 (Gross Profit)" dataKey="profit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 정산 대기 현황 */}
        <Card className="col-span-1 shadow-sm flex flex-col">
          <CardHeader className="bg-slate-50/50 pb-4 border-b">
            <CardTitle className="text-lg">플랫폼 정산 현황</CardTitle>
            <CardDescription>수수료 공제 후 실제 입금 예정액</CardDescription>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-auto">
            <div className="divide-y">
              {settlements.map((s, i) => (
                <div key={i} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-bold text-slate-800">{s.platform}</h4>
                      <p className="text-xs text-slate-500">{s.period}</p>
                    </div>
                    <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full ${s.status === '정산완료' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>{s.status}</span>
                  </div>
                  <div className="flex justify-between items-end mt-3">
                    <div>
                      <p className="text-[10px] text-rose-500 font-medium pb-1">수수료 예약 공제: ₩ -{s.fee.toLocaleString()}</p>
                      <p className="text-lg font-black text-slate-900 tracking-tight">₩ {(s.amount - s.fee).toLocaleString()}</p>
                    </div>
                    <p className="text-xs font-semibold text-indigo-600 underline decoration-indigo-300 underline-offset-4 cursor-pointer">{s.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
          <div className="p-3 border-t bg-slate-50">
            <Button variant="ghost" className="w-full text-xs text-blue-600 font-bold">정산 마감 캘린더 보기 →</Button>
          </div>
        </Card>
      </div>

      {/* 세금계산서 테이블 */}
      <Card className="shadow-sm">
        <CardHeader className="bg-slate-50/50 pb-4 border-b flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">세금계산서 발급/수취 관리</CardTitle>
            <CardDescription>국세청 홈택스 연동 기반 매입 및 매출 계산서 내역입니다.</CardDescription>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                <FileText className="w-4 h-4 mr-2" /> 새 계산서 수기 발행
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>매출 세금계산서 국세청 발행</DialogTitle>
                <DialogDescription>홈택스와 연동되어 지연 없이 즉시 발급 처리됩니다.</DialogDescription>
              </DialogHeader>
              <div className="py-6 flex flex-col gap-4">
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-md text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5"/>
                  읽기 전용 모드: 보안 규칙에 의해 홈택스 연동 실 발급이 차단되었습니다.
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline">명령 취소 및 닫기</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b">
              <tr>
                <th className="px-6 py-3 text-center">유형 구분</th>
                <th className="px-6 py-3">거래처 (Supplier/Client)</th>
                <th className="px-6 py-3 text-right">공급가액 (VAT별도)</th>
                <th className="px-6 py-3">발행 품목/적요</th>
                <th className="px-6 py-3 text-center">신고 일자</th>
                <th className="px-6 py-3 text-center">국세청 상태</th>
                <th className="px-6 py-3 text-center">원본 증빙</th>
              </tr>
            </thead>
            <tbody className="divide-y relative">
              {taxInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 text-[11px] font-bold rounded ${inv.type === '매출' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'}`}>{inv.type}</span>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-700">{inv.partner}</td>
                  <td className="px-6 py-4 text-right font-semibold">₩ {inv.amount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-slate-500">{inv.type === '매입' ? '화물 운송 및 물류비' : '대량 B2B 도매 납품 건'}</td>
                  <td className="px-6 py-4 text-center font-mono text-xs text-slate-500">{inv.date}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 text-[11px] font-bold rounded-full border ${inv.status === '수취완료' ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-amber-100 border-amber-200 text-amber-700 animate-pulse'}`}>{inv.status}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Button variant="ghost" size="sm" className="h-8 shadow-sm border bg-white" onClick={() => alert('읽기 전용 규칙: XML 원본 다운로드가 제한되었습니다.')}>조회</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
