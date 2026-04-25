"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Link2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { motion } from "framer-motion"

export function CostBatchManager({ initialData, products }: { initialData: any[], products: any[] }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
      className="flex flex-col gap-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight text-foreground/90">최근 입고 전표 내역 <span className="text-sm font-normal text-muted-foreground ml-2">(현금주의)</span></h2>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-md hover:shadow-lg transition-all px-6">
          <Plus className="mr-2 h-4 w-4" /> 수입 원가 전표 등록
        </Button>
      </div>

      <Card className="border-muted/60 shadow-sm overflow-hidden rounded-xl">
        <CardContent className="p-0">
          <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 text-xs uppercase">
              <TableHead>입고일자</TableHead>
              <TableHead>상품(SKU)</TableHead>
              <TableHead className="text-right">수량</TableHead>
              <TableHead className="text-right">공장 원가</TableHead>
              <TableHead className="text-right">해운 물류비</TableHead>
              <TableHead className="text-right">관부가세/국내화물</TableHead>
              <TableHead className="text-right bg-primary/5 text-primary font-bold">최종 단가</TableHead>
              <TableHead className="text-center w-[120px]">이중지출 방어</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialData.length === 0 && (
               <TableRow>
                 <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                   등록된 입고/수입 원가 내역이 없습니다. 신규 전표를 등록해주세요.
                 </TableCell>
               </TableRow>
            )}
            {initialData.map((b) => (
              <TableRow key={b.id} className="text-sm">
                <TableCell className="font-medium">{new Date(b.import_date).toLocaleDateString()}</TableCell>
                <TableCell>{b.sku_code}</TableCell>
                <TableCell className="text-right">{b.quantity.toLocaleString()}개</TableCell>
                <TableCell className="text-right text-muted-foreground">₩ {Number(b.factory_cost).toLocaleString()}</TableCell>
                <TableCell className="text-right text-muted-foreground">₩ {Number(b.shipping_cost).toLocaleString()}</TableCell>
                <TableCell className="text-right text-muted-foreground">₩ {Number(b.tax_cost + b.domestic_freight).toLocaleString()}</TableCell>
                <TableCell className="text-right font-bold text-primary">₩ {Number(b.unit_cost).toLocaleString()}</TableCell>
                <TableCell className="text-center">
                  {b.card_expense_id ? (
                    <Badge variant="outline" className="text-emerald-600 border-emerald-600/30 bg-emerald-50 gap-1 rounded-full px-3">
                      <CheckCircle2 className="h-3 w-3" /> 매칭 완료
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-50/50 gap-1 rounded-full px-3 shadow-sm">
                      <Link2 className="h-3 w-3" /> 매칭 대기
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </CardContent>
      </Card>
      <div className="text-sm text-muted-foreground flex items-center px-2">
        <span className="flex h-2 w-2 rounded-full bg-amber-500 mr-2"></span>
        <span className="font-semibold mr-1">"매칭 대기"</span> 전표는 향후 재무 탭의 [카드 매출 업로드] 시 같은 결제일자의 해외 결제 내역과 자동으로 매칭되어 순수익에서 이중 차감되는 것을 방지합니다.
      </div>
    </motion.div>
  )
}
