"use client"

import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { motion } from "framer-motion"
import { Play, Pause, Target, TrendingUp, AlertTriangle, Crosshair, Ban } from "lucide-react"

export function MarketingDashboard({ campaigns, keywords, viewMode }: { campaigns: any[], keywords: any[], viewMode: string }) {
  if (viewMode === 'CAMPAIGNS') {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.05, ease: "easeOut" }}
        className="flex flex-col gap-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-foreground/90">현재 가동 중인 AI 광고 캠페인</h2>
        </div>

        <Card className="border-muted/60 shadow-sm overflow-hidden rounded-xl">
          <CardContent className="p-0">
            <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 text-xs">
                <TableHead>마켓</TableHead>
                <TableHead>캠페인 및 연결 상품</TableHead>
                <TableHead className="text-right">일예산</TableHead>
                <TableHead className="text-right">총 소진액</TableHead>
                <TableHead className="text-right">매출액</TableHead>
                <TableHead className="text-center">목표 ROAS</TableHead>
                <TableHead className="text-center">현재 ROAS</TableHead>
                <TableHead className="text-center">AI 상태 제어</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.length === 0 ? (
                 <TableRow>
                   <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      수집된 광고 캠페인이 없습니다.
                   </TableCell>
                 </TableRow>
              ) : (
                campaigns.map((camp) => (
                  <TableRow key={camp.id} className="text-sm border-b transition-colors hover:bg-muted/50">
                    <TableCell>
                      <Badge variant="outline" className="font-semibold px-2 border-fuchsia-300 text-fuchsia-700 bg-fuchsia-50">
                        {camp.market_name}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">{camp.campaign_name}</div>
                      <div className="text-xs text-muted-foreground mt-1">{camp.product_name || '전체 상품'}</div>
                    </TableCell>
                    <TableCell className="text-right">₩ {Number(camp.daily_budget).toLocaleString()}</TableCell>
                    <TableCell className="text-right">₩ {Number(camp.total_spend).toLocaleString()}</TableCell>
                    <TableCell className="text-right font-semibold text-blue-600">₩ {Number(camp.total_revenue).toLocaleString()}</TableCell>
                    <TableCell className="text-center font-bold text-slate-700">{camp.target_roas}%</TableCell>
                    <TableCell className="text-center">
                      <span className={`font-bold ${Number(camp.current_roas) >= Number(camp.target_roas) ? 'text-emerald-600' : 'text-red-500'}`}>
                        {camp.current_roas}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center pl-2 pr-4">
                      {camp.status === 'ACTIVE' ? (
                        <Button size="sm" variant="outline" className="h-8 rounded-full border-red-200 text-red-600 hover:bg-red-50 w-24">
                          <Pause className="w-3 h-3 mr-1" /> AI 정지
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="h-8 rounded-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 w-24">
                          <Play className="w-3 h-3 mr-1" /> AI 가동
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  // KEYWORDS Mode
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: 0.05, ease: "easeOut" }}
      className="flex flex-col gap-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight text-foreground/90">자동 입찰 스나이퍼 대시보드 (ROAS 최적화)</h2>
        <Button className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-full px-6 shadow-md transition-all">
          <Crosshair className="mr-2 h-4 w-4" /> AI 즉시 입찰 최적화
        </Button>
      </div>

      <Card className="border-muted/60 shadow-sm overflow-hidden rounded-xl">
        <CardContent className="p-0">
          <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 text-xs text-left">
              <TableHead className="w-[200px]">타겟 키워드</TableHead>
              <TableHead>마켓/캠페인</TableHead>
              <TableHead className="text-right">현재 입찰가</TableHead>
              <TableHead className="text-right">클릭수</TableHead>
              <TableHead className="text-right">전환수</TableHead>
              <TableHead className="text-right">총 소진액</TableHead>
              <TableHead className="text-center font-bold">ROAS 📊</TableHead>
              <TableHead className="text-center">액션 (제외 제어)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keywords.length === 0 ? (
               <TableRow>
                 <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    자동 분석 중인 키워드 데이터가 없습니다.
                 </TableCell>
               </TableRow>
            ) : (
              keywords.map((kw) => (
                <TableRow key={kw.id} className="text-sm">
                  <TableCell className="font-semibold text-foreground">{kw.keyword}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <span className="font-bold text-fuchsia-600">{kw.market_name}</span> - {kw.campaign_name}
                  </TableCell>
                  <TableCell className="text-right font-mono">₩ {Number(kw.current_bid).toLocaleString()}</TableCell>
                  <TableCell className="text-right">{kw.clicks}</TableCell>
                  <TableCell className="text-right">{kw.conversions}</TableCell>
                  <TableCell className="text-right pb-2">₩ {Number(kw.cost).toLocaleString()}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className={`font-bold ${kw.roas > 300 ? 'bg-emerald-100 text-emerald-700' : kw.roas < 100 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                      {kw.roas}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {kw.status === 'EXCLUDED' ? (
                      <Badge variant="outline" className="text-slate-500 border-slate-300 bg-slate-50 gap-1 rounded-full px-3">
                        제외됨
                      </Badge>
                    ) : (
                      <Button size="sm" variant="ghost" className="h-8 rounded-full text-red-600 hover:bg-red-50 hover:text-red-700 transition">
                        <Ban className="w-3 h-3 mr-1"/> 제외 등록
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </CardContent>
      </Card>
    </motion.div>
  )
}
