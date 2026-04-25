"use client"

import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Truck, CheckCircle2, AlertCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { motion } from "framer-motion"

export function OrdersTable({ initialData, viewMode }: { initialData: any[], viewMode: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
      className="flex flex-col gap-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight text-foreground/90">
          {viewMode === 'NEW' ? '신규 수집 주문 내역' : viewMode === 'CONFIRMED' ? '발주 확인 완료 (출고 대기)' : '배송 추적 현황'}
        </h2>
        <div className="flex items-center gap-2">
          {viewMode === 'NEW' && (
            <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6 shadow-md hover:shadow-lg transition-all">
              <CheckCircle2 className="mr-2 h-4 w-4" /> 전체 발주 확인 처리
            </Button>
          )}
          {viewMode === 'CONFIRMED' && (
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-6 shadow-md hover:shadow-lg transition-all">
              <Truck className="mr-2 h-4 w-4" /> 엑셀 업로드 (송장 등록)
            </Button>
          )}
        </div>
      </div>

      <Card className="border-muted/60 shadow-sm overflow-hidden rounded-xl">
        <CardContent className="p-0">
          <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 text-xs">
              <TableHead>수집일시</TableHead>
              <TableHead>마켓</TableHead>
              <TableHead>주문번호</TableHead>
              <TableHead>고객명</TableHead>
              <TableHead className="text-right">결제금액</TableHead>
              <TableHead className="text-center">상태</TableHead>
              {viewMode !== 'NEW' && <TableHead>택배사/송장번호</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialData.length === 0 && (
               <TableRow>
                 <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                   해당 상태의 주문 데이터가 없습니다.
                 </TableCell>
               </TableRow>
            )}
            {initialData.map((order) => (
              <TableRow key={order.id} className="text-sm">
                <TableCell className="font-medium">{new Date(order.order_date).toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-semibold px-2 border-gray-300">
                    {order.market_name}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-muted-foreground">{order.order_number}</TableCell>
                <TableCell>{order.customer_name}</TableCell>
                <TableCell className="text-right font-semibold">
                  ₩ {Number(order.total_amount).toLocaleString()}
                </TableCell>
                <TableCell className="text-center">
                  <Badge 
                    variant="secondary" 
                    className={
                      order.status === 'NEW' ? "bg-blue-100 text-blue-700 hover:bg-blue-100" :
                      order.status === 'CONFIRMED' ? "bg-orange-100 text-orange-700 hover:bg-orange-100" :
                      "bg-green-100 text-green-700 hover:bg-green-100"
                    }
                  >
                    {order.status}
                  </Badge>
                </TableCell>
                {viewMode !== 'NEW' && (
                  <TableCell className="font-mono text-xs">
                    {order.tracking_number ? (
                      <span className="text-green-600 font-bold">{order.courier_name} {order.tracking_number}</span>
                    ) : (
                      <span className="text-muted-foreground flex items-center gap-1">
                        <AlertCircle className="w-3 h-3"/> 미등록
                      </span>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </CardContent>
      </Card>
    </motion.div>
  )
}
