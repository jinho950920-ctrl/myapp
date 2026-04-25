"use client"

import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { motion } from "framer-motion"
import { Radar, Crosshair, TrendingDown, EyeOff, ShieldAlert, CrosshairIcon, Swords } from "lucide-react"

export function CompetitorDashboard({ competitors, rules, viewMode }: { competitors: any[], rules: any[], viewMode: string }) {
  if (viewMode === 'COMPETITORS') {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.05, ease: "easeOut" }}
        className="flex flex-col gap-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-foreground/90">경쟁사 가격 & 재고 추적 망원경</h2>
          <Button className="bg-amber-600 hover:bg-amber-700 text-white rounded-full px-6 shadow-md transition-all">
            <Radar className="mr-2 h-4 w-4" /> 🚧 [공사 중] 지금 즉시 전체 스크래핑
          </Button>
        </div>

        <Card className="border-muted/60 shadow-sm overflow-hidden rounded-xl">
          <CardContent className="p-0">
            <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 text-xs">
                <TableHead>마지막 수집</TableHead>
                <TableHead>감시 대상 (내 상품)</TableHead>
                <TableHead>경쟁 업체명</TableHead>
                <TableHead className="text-right">경쟁사 현재가</TableHead>
                <TableHead className="text-center">재고 상태</TableHead>
                <TableHead className="text-center">카탈로그 매칭</TableHead>
                <TableHead className="text-center">모니터링 제어</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {competitors.length === 0 ? (
                 <TableRow>
                   <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      현재 등록된 경쟁사 스파이 타겟이 없습니다.
                   </TableCell>
                 </TableRow>
              ) : (
                competitors.map((comp) => (
                  <TableRow key={comp.id} className="text-sm">
                    <TableCell className="font-medium">{new Date(comp.last_scraped_at).toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="font-semibold text-foreground">{comp.product_name}</div>
                      <div className="text-xs text-muted-foreground">{comp.sku_code}</div>
                    </TableCell>
                    <TableCell className="font-medium text-amber-900">{comp.competitor_name}</TableCell>
                    <TableCell className="text-right font-bold text-red-600">₩ {Number(comp.current_price).toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      {comp.is_out_of_stock ? (
                        <Badge variant="outline" className="text-red-500 border-red-500/30 bg-red-50">품절됨</Badge>
                      ) : (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-600/30 bg-emerald-50">판매중</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {comp.is_catalog_matched ? (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-700">위너 묶임</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-slate-100 text-slate-700">단독 상품</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center pl-2 pr-4">
                      <Button size="sm" variant="ghost" className="h-8 rounded-full text-slate-500 hover:bg-slate-100 transition">
                        <EyeOff className="w-3 h-3 mr-1" /> 🚧 [공사 중] 추적 중지
                      </Button>
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

  // PRICING Mode
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: 0.05, ease: "easeOut" }}
      className="flex flex-col gap-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight text-foreground/90">다이내믹 프라이싱 (10원 깎기) 방어선 설정</h2>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-6 shadow-md transition-all">
          <ShieldAlert className="mr-2 h-4 w-4" /> 🚧 [개발 예정] 심야 자동 복구(정상가) 가동
        </Button>
      </div>

      <Card className="border-muted/60 shadow-sm overflow-hidden rounded-xl">
        <CardContent className="p-0">
          <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 text-xs text-left">
              <TableHead className="w-[200px]">타겟 상품</TableHead>
              <TableHead className="text-right">마지노선 (최저가)</TableHead>
              <TableHead className="text-right">복구 목표가 (최고가)</TableHead>
              <TableHead className="text-center">목표 마진율</TableHead>
              <TableHead className="text-center">최후 업데이트</TableHead>
              <TableHead className="text-center">오토봇 상태</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.length === 0 ? (
               <TableRow>
                 <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    자동 가격 방어 로직이 설정된 상품이 없습니다.
                 </TableCell>
               </TableRow>
            ) : (
              rules.map((rule) => (
                <TableRow key={rule.id} className="text-sm">
                  <TableCell>
                     <div className="font-semibold text-foreground">{rule.product_name}</div>
                     <div className="text-xs text-muted-foreground">{rule.sku_code}</div>
                  </TableCell>
                  <TableCell className="text-right font-bold text-red-600">₩ {Number(rule.min_price).toLocaleString()}</TableCell>
                  <TableCell className="text-right font-bold text-emerald-600">₩ {Number(rule.max_price).toLocaleString()}</TableCell>
                  <TableCell className="text-center font-mono">
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700">{rule.target_margin_percent}%</Badge>
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground text-xs">{new Date(rule.updated_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-center">
                    {rule.is_active ? (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-600/30 bg-emerald-50 gap-1 rounded-full px-3">
                        <Swords className="w-3 h-3"/> 방어 가동중
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-slate-500 border-slate-300 bg-slate-50 gap-1 rounded-full px-3">
                        방어 해제
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </CardContent>
      </Card>
      <div className="text-sm text-muted-foreground flex items-center px-2">
        <span className="flex h-2 w-2 rounded-full bg-emerald-500 mr-2"></span>
        <span className="font-semibold mr-1">"방어 가동중"</span> 상태일 경우, 경쟁사가 가격을 낮추면 봇이 자동으로 내 가격을 -10원씩 내려서 매번 1위를 차지합니다. 마지노선 아래로는 절대 내려가지 않아 적자 판매를 원천 차단합니다.
      </div>
    </motion.div>
  )
}
