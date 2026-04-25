"use client";

import React, { useState } from "react";
import { motion, Variants } from "framer-motion";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Target, TrendingUp, Download, Calendar, ArrowUpRight, ArrowDownRight, 
  Search, PlayCircle, PauseCircle, MousePointerClick, DollarSign, Activity
} from "lucide-react";

// --- State Data Structure ---
interface KpiData {
  spend: number;
  revenue: number;
  roas: number;
  conversionRate: string;
  lastUpdated: string;
}

interface CampaignData {
  id: string;
  platform: string;
  name: string;
  adObjective: string;
  status: string;
  spend: number;
  cpRevenue: number;
  realRevenue: number;
  cpRoas: number;
  realRoas: number;
  clicks: number;
  dailyStats: any[];
}

// Fixed platform data (can be dynamic if needed later)
const platformData = [
  { name: "Coupang", value: 100, color: "#eab308" }, // Coupang dominates for now
];

// --- Animation Variants ---
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export default function MarketingPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  const [kpiData, setKpiData] = useState<KpiData>({ spend: 0, revenue: 0, roas: 0, conversionRate: '0.0', lastUpdated: 'N/A' });
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [campaignData, setCampaignData] = useState<CampaignData[]>([]);

  React.useEffect(() => {
    fetch('/api/marketing/ads')
      .then(res => res.json())
      .then(json => {
         if (json.success && json.data) {
            setKpiData(json.data.kpi);
            setPerformanceData(json.data.performanceData);
            setCampaignData(json.data.campaignData);
         }
      })
      .catch(err => console.error("마케팅 데이터 페칭 에러:", err))
      .finally(() => setIsLoading(false));
  }, []);

  const filteredCampaigns = campaignData.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.platform.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.adObjective && c.adObjective.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 max-w-[1600px] mx-auto min-h-full">
      
      {/* Header Section */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
      >
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Target className="w-8 h-8 text-fuchsia-500" /> 
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
              마케팅 및 광고
            </span>
          </h1>
          <p className="text-sm text-muted-foreground ml-10">광고 매체별 ROAS 현황과 실시간 캠페인 효율을 분석합니다.</p>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button variant="outline" size="sm" className="hidden sm:flex">
            <Calendar className="w-4 h-4 mr-2 text-slate-500" />
            최근 7일
          </Button>
          <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-fuchsia-600 dark:hover:bg-fuchsia-700">
            <Download className="w-4 h-4 mr-2" />
            보고서 내보내기
          </Button>
        </div>
      </motion.div>

      {/* KPI Cards Grid */}
      <motion.div 
        variants={containerVariants} 
        initial="hidden" 
        animate="show" 
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {/* KPI 1: Spend */}
        <motion.div variants={itemVariants}>
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpiData.lastUpdated} 기준 총 광고비</CardTitle>
              <DollarSign className="w-4 h-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₩ {kpiData.spend.toLocaleString()}</div>
              <p className="text-xs text-rose-500 flex items-center mt-1 font-medium">
                 {/* 변화율 표시 제거 및 단순 알림 */}
                <span className="text-muted-foreground font-normal ml-1">오늘 수집 완료</span>
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* KPI 2: Revenue */}
        <motion.div variants={itemVariants}>
          <Card className="shadow-sm border-emerald-100 hover:shadow-md transition-shadow relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{kpiData.lastUpdated} 총 광고 매출</CardTitle>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₩ {kpiData.revenue.toLocaleString()}</div>
              <p className="text-xs text-emerald-600 flex items-center mt-1 font-medium">
                <span className="text-muted-foreground font-normal ml-1">오늘 수집 완료</span>
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* KPI 3: ROAS */}
        <motion.div variants={itemVariants}>
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">이날 평균 ROAS</CardTitle>
              <Target className="w-4 h-4 text-fuchsia-500" />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <div className="text-2xl font-bold text-fuchsia-600">{kpiData.roas}%</div>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-fuchsia-200 text-fuchsia-600 bg-fuchsia-50">목표 300%</Badge>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-fuchsia-500 rounded-full" style={{ width: `${Math.min(100, (kpiData.roas / 300) * 100)}%` }} />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* KPI 4: Conversion Rate */}
        <motion.div variants={itemVariants}>
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">이날 평균 전환율</CardTitle>
              <MousePointerClick className="w-4 h-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiData.conversionRate}%</div>
              <p className="text-xs text-emerald-500 flex items-center mt-1 font-medium">
                <span className="text-muted-foreground font-normal ml-1">오늘 수집 완료</span>
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Charts Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ delay: 0.3 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-4"
      >
        {/* Trend Area Chart */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="w-5 h-5 text-slate-500" />
                  광고 성과 추이
                </CardTitle>
                <CardDescription>최근 7일간의 지출 대비 발생 매출액 비교</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={performanceData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `₩${value.toLocaleString()}`} tick={{ fontSize: 12, fill: '#64748b' }} dx={-10} width={80} />
                  <RechartsTooltip 
                    formatter={(value: any) => `₩${value.toLocaleString()}`}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area type="monotone" dataKey="revenue" name="매출액" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                  <Area type="monotone" dataKey="spend" name="광고비" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorSpend)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Platform Donut Chart */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">플랫폼별 매출 기여도</CardTitle>
            <CardDescription>채널별 발생 수익 파이프라인 비중</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-0">
            <div className="h-[240px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={platformData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {platformData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    formatter={(value: any) => `${value}%`}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
              {/* Center Text for Donut */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8 text-center">
                <span className="text-3xl font-bold text-slate-800 dark:text-slate-100">100%</span>
                <span className="text-xs text-muted-foreground font-medium">Coupang Top</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Campaign Detail Table */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ delay: 0.4 }}
      >
        <Card className="shadow-sm overflow-hidden border-slate-200/60">
          <div className="p-4 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50 dark:bg-slate-900/50">
            <div>
              <CardTitle className="text-lg">활성 캠페인 리포트</CardTitle>
              <CardDescription className="mt-1">상세 캠페인별 지출 및 성과 배율을 추적합니다.</CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input 
                type="text" 
                placeholder="캠페인 이름 또는 매체 검색..." 
                className="pl-9 h-9 bg-white dark:bg-slate-950" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/80 dark:bg-slate-900/80">
                <TableRow>
                  <TableHead className="w-[100px]">상태</TableHead>
                  <TableHead>캠페인 명</TableHead>
                  <TableHead>광고 목표</TableHead>
                  <TableHead>매체</TableHead>
                  <TableHead className="text-right">소진액 <span className="text-[10px] font-normal text-muted-foreground">(VAT별도)</span></TableHead>
                  <TableHead className="text-right">쿠팡 매출</TableHead>
                  <TableHead className="text-right font-bold text-emerald-600">실제 매출 (윙)</TableHead>
                  <TableHead className="text-right">쿠팡 ROAS</TableHead>
                  <TableHead className="text-right font-bold text-fuchsia-600">실제 ROAS <span className="text-[10px] font-normal text-fuchsia-400 focus:text-fuchsia-400">(VAT포함)</span></TableHead>
                  <TableHead className="text-right">클릭수</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCampaigns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      검색 조건에 맞는 캠페인이 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCampaigns.map((c) => (
                    <React.Fragment key={c.id}>
                      <TableRow 
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                        onClick={() => setExpandedCampaignId(expandedCampaignId === c.id ? null : c.id)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {c.status === "Active" ? (
                              <PlayCircle className="w-5 h-5 text-emerald-500" />
                            ) : (
                              <PauseCircle className="w-5 h-5 text-slate-400" />
                            )}
                            <span className="text-xs font-medium text-slate-500">{c.status}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-slate-800 dark:text-slate-200">
                          {c.name}
                          <div className="text-xs text-muted-foreground font-normal mt-0.5">{c.id}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300">
                            {c.adObjective || 'None'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-normal border-transparent bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {c.platform}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-slate-600 font-mono">₩ {c.spend.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-slate-500 font-mono">₩ {c.cpRevenue.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                          ₩ {c.realRevenue.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-medium inline-flex items-center gap-1 ${c.cpRoas > 300 ? 'text-blue-500' : 'text-slate-500'}`}>
                            {c.cpRoas}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-bold inline-flex items-center gap-1 ${c.realRoas > 300 ? 'text-fuchsia-600' : 'text-slate-700'}`}>
                            {c.realRoas}%
                            {c.realRoas > 300 && <TrendingUp className="w-3 h-3 text-fuchsia-500" />}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-slate-500 text-sm">
                          {c.clicks.toLocaleString()}
                        </TableCell>
                      </TableRow>
                      
                      {/* Accordion Expanded Row */}
                      {expandedCampaignId === c.id && (
                        <TableRow className="bg-slate-50/50 dark:bg-slate-900/30">
                          <TableCell colSpan={10} className="p-0 border-b-0">
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }} 
                              animate={{ height: "auto", opacity: 1 }} 
                              className="overflow-hidden"
                            >
                              <div className="p-4 border-l-4 border-fuchsia-400 bg-white dark:bg-slate-950 m-2 rounded shadow-sm">
                                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-slate-500" />
                                  최근 7일 일별 상세 성과 (ROAS 계산 시 지출 VAT 자동 반영)
                                </h4>
                                <Table className="w-full text-xs">
                                  <TableHeader>
                                    <TableRow className="bg-slate-50/80">
                                      <TableHead className="py-2">날짜</TableHead>
                                      <TableHead className="py-2 text-right">소진액 (원본)</TableHead>
                                      <TableHead className="py-2 text-right">쿠팡 ROAS</TableHead>
                                      <TableHead className="py-2 text-right font-bold text-fuchsia-600">실제 ROAS (윙)</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {c.dailyStats?.map((ds, idx) => (
                                      <TableRow key={idx}>
                                        <TableCell className="py-2 font-medium">{ds.date}</TableCell>
                                        <TableCell className="py-2 text-right font-mono text-slate-600">₩ {ds.spend.toLocaleString()}</TableCell>
                                        <TableCell className="py-2 text-right font-mono">
                                          <span className={ds.cpRoas > 300 ? 'text-blue-500 font-medium' : 'text-slate-500'}>{ds.cpRoas}%</span>
                                        </TableCell>
                                        <TableCell className="py-2 text-right font-mono font-bold text-fuchsia-600">
                                          <span className={ds.realRoas > 300 ? 'text-fuchsia-600' : 'text-slate-700'}>{ds.realRoas}%</span>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                    {(!c.dailyStats || c.dailyStats.length === 0) && (
                                      <TableRow>
                                        <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">일별 데이터가 없습니다.</TableCell>
                                      </TableRow>
                                    )}
                                  </TableBody>
                                </Table>
                              </div>
                            </motion.div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </motion.div>

    </div>
  );
}
