"use client"

import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { motion } from "framer-motion"
import { Upload, Download, Wallet, Calculator, ArrowUpRight, ArrowDownRight, RefreshCcw } from "lucide-react"

export function FinanceDashboard({ initialData, viewMode }: { initialData: any[], viewMode: string }) {
  if (viewMode === 'OVERVIEW') {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.05, ease: "easeOut" }}
        className="flex flex-col gap-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-muted/60 shadow-sm rounded-xl bg-gradient-to-br from-blue-50 to-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                이번 달 총 매출 (추정) <ArrowUpRight className="h-4 w-4 text-blue-600" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-900">₩ 0</div>
              <p className="text-xs text-muted-foreground mt-1">+0% from last month</p>
            </CardContent>
          </Card>
          <Card className="border-muted/60 shadow-sm rounded-xl bg-gradient-to-br from-red-50 to-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                이번 달 총 비용 (지출) <ArrowDownRight className="h-4 w-4 text-red-600" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-900">₩ 0</div>
              <p className="text-xs text-muted-foreground mt-1">물대, 배송비, 광고비 포함</p>
            </CardContent>
          </Card>
          <Card className="border-muted/60 shadow-sm rounded-xl bg-gradient-to-br from-teal-50 to-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                이번 달 순이익 (영업이익) <Wallet className="h-4 w-4 text-teal-600" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-teal-900">₩ 0</div>
              <p className="text-xs text-muted-foreground mt-1">영업이익률: 0%</p>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    )
  }

  if (viewMode === 'TAX') {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.05, ease: "easeOut" }}
        className="flex flex-col gap-6"
      >
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold tracking-tight text-foreground/90">부가세 및 종소세/법인세 추정기</h2>
          <Button className="bg-purple-600 hover:bg-purple-700 text-white rounded-full px-6 shadow-md transition-all">
            <Calculator className="mr-2 h-4 w-4" /> 세금 시뮬레이션 재계산
          </Button>
        </div>
        <Card className="border-muted/60 shadow-sm overflow-hidden rounded-xl p-12 flex flex-col items-center justify-center text-center">
          <Calculator className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-foreground">세금 추정 엔진 준비 중</h3>
          <p className="text-muted-foreground mt-2 max-w-sm">매출액과 매입액(세금계산서/신용카드/현금영수증 내역)이 충분히 쌓이면 자동으로 부가세 납부 예상액을 계산합니다.</p>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: 0.05, ease: "easeOut" }}
      className="flex flex-col gap-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight text-foreground/90">은행 입출금 원장 (Ledger)</h2>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-full px-6 shadow-sm border-gray-300">
            <Download className="mr-2 h-4 w-4" /> 엑셀 다운로드
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6 shadow-md transition-all">
            <Upload className="mr-2 h-4 w-4" /> 홈택스/은행 엑셀 업로드
          </Button>
        </div>
      </div>

      <Card className="border-muted/60 shadow-sm overflow-hidden rounded-xl">
        <CardContent className="p-0">
          <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 text-xs">
              <TableHead>거래일자</TableHead>
              <TableHead>카테고리</TableHead>
              <TableHead>적요 (내용)</TableHead>
              <TableHead>계좌/카드명</TableHead>
              <TableHead className="text-right">금액</TableHead>
              <TableHead className="text-center">대사 (정산매칭) 상태</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialData.length === 0 ? (
               <TableRow>
                 <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    등록된 거래 장부(Ledger) 데이터가 없습니다. 홈택스 내역을 업로드해주세요.
                 </TableCell>
               </TableRow>
            ) : (
              initialData.map((tx) => (
                <TableRow key={tx.id} className="text-sm">
                  <TableCell className="font-medium">{new Date(tx.transaction_date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-semibold px-2 border-gray-300">
                      {tx.category}
                    </Badge>
                  </TableCell>
                  <TableCell>{tx.description}</TableCell>
                  <TableCell className="text-muted-foreground">{tx.bank_account_name}</TableCell>
                  <TableCell className={`text-right font-semibold ${tx.category === 'REVENUE' ? 'text-blue-600' : 'text-red-600'}`}>
                    {tx.category === 'EXPENSE' ? '-' : ''}₩ {Number(tx.amount).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center">
                    {tx.is_reconciled ? (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-600/30 bg-emerald-50 gap-1 rounded-full">
                        매칭됨
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-600/30 bg-amber-50 gap-1 rounded-full">
                        <RefreshCcw className="w-3 h-3"/> 미대사
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
    </motion.div>
  )
}
