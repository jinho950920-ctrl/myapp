"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, ArchiveX, PackageOpen } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { motion } from "framer-motion"

export function SkuManager({ initialData }: { initialData: any[] }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col gap-6"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              type="search"
              placeholder="상품명 또는 SKU 검색..."
              className="pl-10 h-10 w-[280px] sm:w-[350px] bg-background border-muted-foreground/20 rounded-full shadow-sm focus-visible:ring-primary/20 transition-all"
            />
          </div>
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-md hover:shadow-lg transition-all px-6">
          <Plus className="mr-2 h-4 w-4" /> 신규 SKU 등록
        </Button>
      </div>

      <Card className="border-muted/60 shadow-sm overflow-hidden rounded-xl">
        <CardContent className="p-0">
          <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[150px]">SKU 코드</TableHead>
              <TableHead>상품명</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="text-right">현재 재고(개)</TableHead>
              <TableHead className="text-right">최근 수입 단가</TableHead>
              <TableHead className="text-right">예상 소진일</TableHead>
              {/* TODO: 추후 [erp_import_batches DB]와 연동 필요 (현재 미구현) */}
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialData.length === 0 && (
               <TableRow>
                 <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                   등록된 상품이 없습니다. 신규 상품을 등록해주세요.
                 </TableCell>
               </TableRow>
            )}
            {initialData.map((item, idx) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono font-medium">{item.sku_code}</TableCell>
                <TableCell>{item.name}</TableCell>
                <TableCell>
                  <Badge variant="default" className={item.status === 'ACTIVE' ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-gray-500/10 text-gray-500"}>
                    {item.status === 'ACTIVE' ? '판매중' : '단종'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-semibold text-lg">{item.stock_quantity}</TableCell>
                <TableCell className="text-right text-muted-foreground">-</TableCell>
                <TableCell className="text-right">
                  <span className={item.stock_quantity > item.safe_days_to_stockout ? "text-orange-500 font-medium" : "text-red-500 font-bold"}>
                    D-?
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-16 text-muted-foreground gap-1 text-[10px] font-bold">
                    <ArchiveX className="h-4 w-4" /> 🚧
                  </Button>
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
