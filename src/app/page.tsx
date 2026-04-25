"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, CreditCard, DollarSign, Users, PackageOpen, Target, ShieldAlert, Cpu } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { Wing2faAlert } from "@/components/automations/Wing2faAlert";
import { DailyProductProfitChart } from "@/components/finance/DailyProductProfitChart";

import { useState, useEffect } from "react";

export default function Home() {
  const [period, setPeriod] = useState("7days");
  const [chartData, setChartData] = useState([
    { name: "월", revenue: 4200000, profit: 1240000 },
    { name: "화", revenue: 3800000, profit: 1100000 },
    { name: "수", revenue: 5100000, profit: 1680000 },
    { name: "목", revenue: 4780000, profit: 1390000 },
    { name: "금", revenue: 6890000, profit: 2480000 },
    { name: "토", revenue: 8390000, profit: 3800000 },
    { name: "일", revenue: 7490000, profit: 3100000 },
  ]);

  useEffect(() => {
    fetch(`/api/dashboard/sales?period=${period}`)
      .then(res => res.json())
      .then(json => {
         if (json.success && json.data && json.data.length > 0) {
            // 원장 DB(입고 전표 + 플랫폼 수수료 정책) 기반 실시간 순이익 덮어쓰기
            const formatted = json.data.map((d: any) => ({
              name: d.name,
              revenue: Number(d.revenue),
              profit: Number(d.profit)
            }));
            setChartData(formatted);
         }
      })
      .catch(err => console.error("차트 데이터 페칭 에러:", err));
  }, [period]);

  return (
    <div className="flex flex-col gap-8 h-full w-full max-w-7xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
      <Wing2faAlert />
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent">
          컨트롤 타워 <span className="text-2xl font-semibold text-muted-foreground ml-2 tracking-normal">Mission Control</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl leading-relaxed">
          상품, 주문, 재무, 마케팅, 그리고 경쟁사 동향까지 모든 비즈니스 인텔리전스를 실시간으로 통합 지휘합니다.
        </p>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.05, ease: "easeOut" }}
        className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mt-4"
      >
        <Card className="rounded-xl shadow-sm border-muted/60 bg-gradient-to-br from-indigo-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">오늘 예상 총 매출</CardTitle>
            <DollarSign className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-indigo-900">₩ 0</div>
            <p className="text-xs text-muted-foreground mt-1">
              어제 대비 <span className="text-emerald-500 font-bold">+0.0%</span> 증가
            </p>
          </CardContent>
        </Card>
        
        <Card className="rounded-xl shadow-sm border-muted/60 bg-gradient-to-br from-fuchsia-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">현재 광고 ROAS</CardTitle>
            <Target className="h-4 w-4 text-fuchsia-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-fuchsia-900">0.0%</div>
            <p className="text-xs text-muted-foreground mt-1 text-red-500 font-medium whitespace-nowrap overflow-hidden text-ellipsis">
               위험 징후: [분석 중...]
            </p>
          </CardContent>
        </Card>
        
        <Card className="rounded-xl shadow-sm border-muted/60 bg-gradient-to-br from-rose-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">미처리 CS 접수건</CardTitle>
            <Users className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-rose-900">0 건</div>
            <p className="text-xs text-muted-foreground mt-1">
               <span className="text-rose-500 font-bold">AI 답변 초안</span> 대기 중
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-sm border-muted/60 bg-gradient-to-br from-amber-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">경쟁사 가격 방어</CardTitle>
            <ShieldAlert className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-900">정상 작동</div>
            <p className="text-xs text-muted-foreground mt-1">최근 방어 횟수: 0건 (탈환 성공)</p>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7 mt-4">
        <Card className="col-span-4 rounded-xl shadow-sm border-muted/60 overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Activity className="w-5 h-5 text-blue-600" /> 주간 통합 매출 트렌드</CardTitle>
              <Select value={period} onValueChange={(val) => setPeriod(val || "7days")}>
                <SelectTrigger className="w-[120px] h-8 text-xs bg-white border-muted/60 focus:ring-1 focus:ring-blue-500">
                  <SelectValue placeholder="기간 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7days">최근 7일</SelectItem>
                  <SelectItem value="30days">최근 30일</SelectItem>
                  <SelectItem value="thisMonth">이번 달</SelectItem>
                  <SelectItem value="lastMonth">저번 달</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <CardDescription className="text-xs mt-1">
              마켓별 매출과 광고 소진액, 순이익을 한눈에 실시간으로 비교합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] p-6 bg-white shrink-0 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₩${(val/10000).toLocaleString()}만`} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <Tooltip formatter={(value: any) => `₩${value.toLocaleString()}`} labelStyle={{color: '#333'}} />
                <Area type="monotone" dataKey="revenue" name="매출액" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                <Area type="monotone" dataKey="profit" name="순이익" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorProfit)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-3 rounded-xl shadow-sm border-muted/60 overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b pb-4">
            <CardTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-teal-600" /> AI 최근 수행 내역 (Audit Log)</CardTitle>
            <CardDescription className="text-xs mt-1">
              로봇이 백그라운드에서 자동으로 수행한 업무 로그입니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 bg-white">
            <div className="flex flex-col p-4 gap-4 h-[300px] overflow-y-auto">
              <div className="flex flex-col gap-1 border-b pb-3">
                <span className="text-xs text-amber-600 font-bold shrink-0">1분 전 - 가격 방어</span>
                <span className="text-sm text-foreground">경쟁사 가격 하락을 감지하여 내 가격을 35,500원으로 -10원 깎아서 최저가(위너)를 탈환했습니다.</span>
              </div>
              <div className="flex flex-col gap-1 border-b pb-3">
                <span className="text-xs text-rose-600 font-bold shrink-0">5분 전 - CS 센터</span>
                <span className="text-sm text-foreground">"배송이 언제 오나요?" 문의에 대해 AI가 쿠팡 송장을 조회하여 "내일 도착 예정입니다" 초안을 작성했습니다.</span>
              </div>
              <div className="flex flex-col gap-1 border-b pb-3">
                <span className="text-xs text-fuchsia-600 font-bold shrink-0">15분 전 - 마케팅 센터</span>
                <span className="text-sm text-foreground">[A상품] 캠페인의 목표 ROAS 300% 달성에 실패하여, 성과없는 3개 키워드의 입찰가를 150원 인하했습니다.</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-indigo-600 font-bold shrink-0">3시간 전 - 물류/배송</span>
                <span className="text-sm text-foreground">네이버 스마트스토어의 신규 주문 12건에 대해 발주 확인을 누르고 데이터를 수집했습니다.</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-2">
        <DailyProductProfitChart />
      </div>
    </div>
  );
}
