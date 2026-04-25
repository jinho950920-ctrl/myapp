"use client"

import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, Bot, AlertTriangle, Send } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { motion } from "framer-motion"

export function TicketsTable({ initialData, viewMode }: { initialData: any[], viewMode: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: 0.05, ease: "easeOut" }}
      className="flex flex-col gap-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight text-foreground/90">
          {viewMode === 'PENDING' ? '답변 대기중인 신규 문의' : viewMode === 'IN_PROGRESS' ? '확인/처리중인 문의' : '해결된 고객의 소리'}
        </h2>
        {viewMode === 'PENDING' && (
          <Button className="bg-rose-600 hover:bg-rose-700 text-white rounded-full px-6 shadow-md hover:shadow-lg transition-all">
            <Bot className="mr-2 h-4 w-4" /> AI 일괄 답변 생성
          </Button>
        )}
      </div>

      <Card className="border-muted/60 shadow-sm overflow-hidden rounded-xl">
        <CardContent className="p-0">
          <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 text-xs">
              <TableHead>접수일시</TableHead>
              <TableHead>채널</TableHead>
              <TableHead>고객명</TableHead>
              <TableHead>문의유형</TableHead>
              <TableHead>문의내용</TableHead>
              <TableHead>연결상품</TableHead>
              <TableHead className="text-center">상태/액션</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialData.length === 0 && (
               <TableRow>
                 <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                   {viewMode === 'PENDING' ? '👏 현재 대기 중인 고객 문의가 없습니다!' : '조건에 맞는 문의 데이터가 없습니다.'}
                 </TableCell>
               </TableRow>
            )}
            {initialData.map((ticket) => (
              <TableRow key={ticket.id} className="text-sm">
                <TableCell className="font-medium">{new Date(ticket.created_at).toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-semibold px-2 border-gray-300">
                    {ticket.market_name}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium text-foreground/80">{ticket.customer_name}</TableCell>
                <TableCell>
                  <Badge 
                    variant="secondary" 
                    className={
                      ticket.inquiry_type === 'EXCHANGE' ? "bg-orange-100 text-orange-700" :
                      ticket.inquiry_type === 'RETURN' ? "bg-red-100 text-red-700" :
                      "bg-blue-100 text-blue-700"
                    }
                  >
                    {ticket.inquiry_type === 'EXCHANGE' ? '교환' : ticket.inquiry_type === 'RETURN' ? '반품' : '일반문의'}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[250px] truncate" title={ticket.inquiry_content}>
                  {ticket.inquiry_content}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">{ticket.product_name || '-'}</TableCell>
                <TableCell className="text-center">
                  {viewMode === 'PENDING' ? (
                     <Button size="sm" variant="outline" className="h-8 rounded-full border-rose-200 text-rose-700 hover:bg-rose-50">
                       <MessageSquare className="w-3 h-3 mr-1" /> 답변하기
                     </Button>
                  ) : viewMode === 'IN_PROGRESS' ? (
                    <Badge variant="outline" className="text-amber-600 border-amber-600/30 bg-amber-50 gap-1 rounded-full">
                      지연됨
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-emerald-600 border-emerald-600/30 bg-emerald-50 gap-1 rounded-full">
                      완료
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </CardContent>
      </Card>
    </motion.div>
  )
}
