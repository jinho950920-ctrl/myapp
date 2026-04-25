"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Lock, Plus, RotateCw, DownloadCloud, AlertCircle, Link, Key, ShoppingCart, TrendingDown, Globe, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect, useTransition } from "react";
import { createMasterProduct, createTradeReceipt, assignMappingFromQueue, saveMasterMappings, savePlatformCost, deleteTradeReceipt, updateTradeReceipt } from "@/app/actions/productActions";
import { BadgeDollarSign } from "lucide-react";

export default function ProductsClient({ initialProducts, initialUnmatched }: { initialProducts: any[], initialUnmatched: any[] }) {
  const [isPending, startTransition] = useTransition();
  const [deliveryMethod, setDeliveryMethod] = useState("direct");

  // 모달 제어용 상태들
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [newProductForm, setNewProductForm] = useState({ code: "", name: "", stock: 0 });

  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptForm, setReceiptForm] = useState({
    id: null as string | null,
    sku: "",
    qty: 0,
    price: 0,
    shippingFee: 0,
    tariff: 0,
    date: new Date().toISOString().split('T')[0],
    blNumber: "",
    domesticShipping: 0,
    supplierDate: "",
    agencyDate: "",
    tariffDate: ""
  });

  const getRunwayStatus = (days: number) => {
    if (days <= 7) return { text: `${days} 일 (품절 임박)`, className: "bg-rose-100 text-rose-800" };
    if (days <= 20) return { text: `${days} 일 (품절 예상)`, className: "bg-amber-100 text-amber-800" };
    return { text: `${days} 일 (안정)`, className: "bg-emerald-100 text-emerald-800" };
  };

  const [products, setProducts] = useState(initialProducts);
  const [unmatchedData, setUnmatchedData] = useState(initialUnmatched);
  const [mappingTargetSku, setMappingTargetSku] = useState("");

  // DB에서 데이터가 교체되면 (revalidatePath 실행 시) 리렌더링 주입
  useEffect(() => setProducts(initialProducts), [initialProducts]);
  useEffect(() => setUnmatchedData(initialUnmatched), [initialUnmatched]);

  // Handler: 새 상품 추가
  const handleAddProduct = () => {
    if (!newProductForm.code || !newProductForm.name) return alert("코드와 이름을 입력해주세요.");
    
    startTransition(async () => {
      await createMasterProduct({
        code: newProductForm.code,
        name: newProductForm.name,
        stock: Number(newProductForm.stock)
      });
      setNewProductOpen(false);
      setNewProductForm({ code: "", name: "", stock: 0 });
      alert("새 상품이 마스터 DB에 영구 등록되었습니다.");
    });
  };

  // Handler: 전표 최종 발행
  const handlePublishReceipt = () => {
    if (!receiptForm.sku || receiptForm.qty <= 0) {
      alert("마스터 상품 지정 및 올바른 수량을 입력해주세요.");
      return;
    }
    
    startTransition(async () => {
      const payload = {
        qty: Number(receiptForm.qty),
        date: receiptForm.date,
        deliveryMethod: deliveryMethod,
        shippingFee: Number(receiptForm.shippingFee) || 0,
        tariff: Number(receiptForm.tariff) || 0,
        domesticShipping: Number(receiptForm.domesticShipping) || 0,
        totalPrice: Number(receiptForm.price) || 0,
        blNumber: receiptForm.blNumber || "",
        supplierDate: receiptForm.supplierDate || "",
        agencyDate: receiptForm.agencyDate || "",
        tariffDate: receiptForm.tariffDate || ""
      };

      if (receiptForm.id) {
        await updateTradeReceipt(receiptForm.id, payload);
        alert(`[${receiptForm.sku}] 수정된 전표 내용이 과거 이력 및 원가 계산에 완벽히 연동되었습니다.`);
      } else {
        await createTradeReceipt({ sku: receiptForm.sku, ...payload });
        alert(`[${receiptForm.sku}] 신규 입고 전표가 DB에 발행되어 영구 반영되었습니다.`);
      }
      setReceiptOpen(false);
    });
  };

  // Handler: 미매칭 큐에서 수동 타겟 지정
  const handleAssignUnmatched = (umId: string, rawData: string, type: string) => {
    if (!mappingTargetSku) return alert("귀속할 마스터 상품을 먼저 선택해야 합니다!");

    startTransition(async () => {
      await assignMappingFromQueue(umId, mappingTargetSku, rawData, type);
      setMappingTargetSku("");
      alert(`매핑된 데이터 [${rawData}]가 DB 매핑 테이블에 안전하게 적재되었습니다!`);
    });
  };


  // 인라인 수정 핸들러: 각 행의 모달 내 입력값 제어
  const updateProductMapping = (sku: string, key: string, value: string) => {
    setProducts(products.map(p => {
      if (p.code === sku) {
        return { ...p, mappings: { ...p.mappings, [key]: value } };
      }
      return p;
    }));
  };

  const handleSaveMappings = (sku: string, mappingsObj: any) => {
    startTransition(async () => {
      await saveMasterMappings(sku, mappingsObj);
      alert(`[${sku}] 상세 코드 매핑 데이터가 DB에 최종 반영되었습니다!`);
    });
  };

  const [costForm, setCostForm] = useState<any>({});
  const initCostForm = (p: any, platform: string) => {
    const existing = p.platformCosts?.[platform] || {};
    setCostForm({
      shippingFee: existing.shippingFee || 0,
      packagingFee: existing.packagingFee || 0,
      commissionPercent: existing.commissionPercent || 0,
      promoDiscount: existing.promoDiscount || 0,
      growthLogistics: existing.growthLogistics || 0
    });
  };

  const handleSavePlatformCost = (sku: string, platformType: string) => {
    startTransition(async () => {
      await savePlatformCost(sku, platformType, costForm);
      alert(`[${sku}] 플랫폼 정산/비용 설정이 이력 DB에 영구 보존되었습니다.`);
    });
  };

  const handleDeleteReceipt = (receiptId: string) => {
    if (confirm("이 입고/수입 전표를 삭제하시겠습니까? (연결된 마스터 재고 수량과 가중평균 원가에서 영구적으로 제외됩니다)")) {
      startTransition(async () => {
        await deleteTradeReceipt(receiptId);
      });
    }
  };

  const handleEditReceipt = (log: any, masterCode: string) => {
    const totalPurchaseAmt = (log.cogs * log.qty) - log.shippingFee - log.tariff - log.domesticShipping;
    setReceiptForm({
      id: log.id,
      sku: masterCode,
      qty: log.qty,
      price: totalPurchaseAmt > 0 ? totalPurchaseAmt : 0,
      shippingFee: log.shippingFee,
      tariff: log.tariff,
      date: log.date,
      blNumber: log.blNumber || "",
      domesticShipping: log.domesticShipping || 0,
      supplierDate: log.supplierDate || "",
      agencyDate: log.agencyDate || "",
      tariffDate: log.tariffDate || ""
    });
    setDeliveryMethod(log.supplier);
    setReceiptOpen(true);
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 max-w-7xl mx-auto h-full animate-in fade-in">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Package className="w-8 h-8 text-indigo-500" /> 상품 및 연동 관리
        </h1>
        <p className="text-muted-foreground flex items-center gap-2">
          현재 등록된 마스터 상품의 실시간 재고 현황 및 데이터 매핑을 관제합니다. <span className="flex items-center text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded text-xs border border-emerald-200"><Check className="w-3 h-3 mr-1"/>쓰기 권한 활성화</span>
        </p>
      </div>

      <div className="flex items-center gap-3 mt-2">
        <Dialog open={receiptOpen} onOpenChange={(open) => {
          if(!open) setReceiptForm({ id: null, sku: "", qty: 0, price: 0, shippingFee: 0, tariff: 0, date: new Date().toISOString().split('T')[0], blNumber: "", domesticShipping: 0, supplierDate: "", agencyDate: "", tariffDate: "" });
          setReceiptOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm font-bold">
              <DownloadCloud className="w-4 h-4 mr-2" /> 새 무역/입고 전표 등록
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-5xl gap-4 max-h-[90vh] overflow-y-auto px-6 py-6">
            <DialogHeader className="mb-2">
              <DialogTitle className="text-2xl font-black text-indigo-900">{receiptForm.id ? "과거 무역입고전표 전면 재수정" : "신규 무역입고전표 등록 (Trade Receipt)"}</DialogTitle>
              <DialogDescription className="text-sm mt-1">{receiptForm.id ? "입력된 값을 변경하여 발행 시, 전체 마스터 재고와 이동평균 원가가 자동으로 보정(델타 처리)됩니다." : "해외 수입 및 배송 중인 상품의 총 비용 데이터를 기입하여 실제 재고에 반영합니다."}</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-4 gap-x-6 gap-y-6">
              <div className="col-span-4 bg-slate-50 p-4 rounded-lg border flex flex-col gap-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs">1</span> 구매 기본 정보
                </h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="grid gap-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">대상 마스터 상품 <span className="text-rose-500">*</span></label>
                    <select className="px-3 py-2 border rounded-md bg-white text-sm" value={receiptForm.sku} onChange={e => setReceiptForm({...receiptForm, sku: e.target.value})}>
                      <option value="">상품 선택...</option>
                      {products.map(p => <option key={p.code} value={p.code}>{p.name} ({p.code})</option>)}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">입고 수량 <span className="text-rose-500">*</span></label>
                    <input type="number" className="px-3 py-2 border rounded-md text-sm bg-white" value={receiptForm.qty} onChange={e => setReceiptForm({...receiptForm, qty: Number(e.target.value)})} />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">총 매입 금액 (물대) <span className="text-rose-500">*</span></label>
                    <div className="relative shadow-sm">
                      <span className="absolute left-3 top-2 text-slate-400 text-sm font-bold">₩</span>
                      <input type="number" className="pl-8 pr-3 py-2 border rounded-md text-sm w-full bg-white focus:ring-1 focus:ring-indigo-500" value={receiptForm.price} onChange={e => setReceiptForm({...receiptForm, price: Number(e.target.value)})} placeholder="전체 수입/구매 금액" />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">결제일 / 입고일 <span className="text-rose-500">*</span></label>
                    <input type="date" className="px-3 py-2 border rounded-md text-sm bg-white" value={receiptForm.date} onChange={e => setReceiptForm({...receiptForm, date: e.target.value})} />
                  </div>
                </div>
              </div>

              {/* Section 2: 물류 및 배송 */}
              <div className="col-span-4 bg-blue-50/40 p-4 rounded-lg border border-blue-100 flex flex-col gap-4">
                <h3 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center text-xs">2</span> 배송 및 물류 비용
                </h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="grid gap-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">B/L 번호</label>
                    <input type="text" className="px-3 py-2 border rounded-md text-sm font-mono bg-white shadow-sm" value={receiptForm.blNumber||''} onChange={e => setReceiptForm({...receiptForm, blNumber: e.target.value})} placeholder="HBL-..." />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">해외 배송비용</label>
                    <div className="relative shadow-sm">
                      <span className="absolute left-3 top-2 text-slate-400 text-sm font-bold">₩</span>
                      <input type="number" className="pl-8 pr-3 py-2 border rounded-md text-sm w-full bg-white focus:ring-1 focus:ring-indigo-500" value={receiptForm.shippingFee||''} onChange={(e) => setReceiptForm({...receiptForm, shippingFee: Number(e.target.value)})} placeholder="0" />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">국내 운송 방식 <span className="text-rose-500">*</span></label>
                    <select 
                      className="px-3 py-2 border rounded-md text-sm bg-white shadow-sm focus:ring-1 focus:ring-indigo-500"
                      value={deliveryMethod}
                      onChange={(e) => setDeliveryMethod(e.target.value)}
                    >
                      <option value="direct">직접 수령 (본사/창고)</option>
                      <option value="coupang">쿠팡 입고 (로켓그로스 등)</option>
                    </select>
                  </div>
                  <div className="grid gap-2 relative">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                      국내 운송 비용
                      {deliveryMethod === "coupang" && <span className="text-blue-500 ml-1">(쿠팡 귀속)</span>}
                    </label>
                    <div className="relative shadow-sm">
                      <span className="absolute left-3 top-2 text-slate-400 text-sm font-bold">₩</span>
                      {deliveryMethod === "coupang" ? (
                        <input type="text" className="pl-8 pr-3 py-2 border rounded-md text-sm w-full bg-slate-100 text-slate-400 cursor-not-allowed" value="입력 불가 (쿠팡 측에서 처리)" disabled />
                      ) : (
                        <input type="number" className="pl-8 pr-3 py-2 border rounded-md text-sm w-full bg-white focus:ring-1 focus:ring-indigo-500" value={receiptForm.domesticShipping||''} onChange={e => setReceiptForm({...receiptForm, domesticShipping: Number(e.target.value)})} placeholder="직접 운송비 입력" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: 통관 및 관세 */}
              <div className="col-span-4 bg-amber-50/40 p-4 rounded-lg border border-amber-100 flex flex-col gap-4">
                <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center text-xs">3</span> 관세 및 제세공과금
                </h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="grid gap-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">발생 관세 (Tariff)</label>
                    <div className="relative shadow-sm mt-2">
                      <span className="absolute left-3 top-2 text-slate-400 text-sm font-bold">₩</span>
                      <input type="number" className="pl-8 pr-3 py-2 border rounded-md text-sm w-full bg-white focus:ring-1 focus:ring-indigo-500" value={receiptForm.tariff||''} onChange={(e) => setReceiptForm({...receiptForm, tariff: Number(e.target.value)})} placeholder="0" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 4: 결제 및 일정 스케줄 */}
              <div className="col-span-4 bg-emerald-50/40 p-4 rounded-lg border border-emerald-100 flex flex-col gap-4">
                <h3 className="text-sm font-bold text-emerald-900 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center text-xs">4</span> 결제 및 최종 입고 일정
                </h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="grid gap-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">해외 거래처 결제 날짜</label>
                    <input type="date" className="px-3 py-2 border rounded-md text-sm bg-white shadow-sm focus:ring-1 focus:ring-indigo-500" value={receiptForm.supplierDate||''} onChange={e => setReceiptForm({...receiptForm, supplierDate: e.target.value})} />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">배송대행지 결제 날짜</label>
                    <input type="date" className="px-3 py-2 border rounded-md text-sm bg-white shadow-sm focus:ring-1 focus:ring-indigo-500" value={receiptForm.agencyDate||''} onChange={e => setReceiptForm({...receiptForm, agencyDate: e.target.value})} />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">관세 결제 날짜</label>
                    <input type="date" className="px-3 py-2 border rounded-md text-sm bg-white shadow-sm focus:ring-1 focus:ring-indigo-500" value={receiptForm.tariffDate||''} onChange={e => setReceiptForm({...receiptForm, tariffDate: e.target.value})} />
                  </div>
                </div>
              </div>

            </div>

            <div className="flex justify-between items-center mt-6 pt-4 border-t">
              <Button variant="outline" onClick={() => setReceiptOpen(false)}>취소</Button>
              <Button disabled={isPending} onClick={handlePublishReceipt} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold w-48 shadow-sm">
                {isPending ? "저장 중..." : (receiptForm.id ? "수정된 데이터 보정 및 저장" : "전표 영구 기록 및 재고 발행")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={newProductOpen} onOpenChange={setNewProductOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="shadow-sm font-bold text-slate-700 hover:bg-slate-100">
              <Plus className="w-4 h-4 mr-2" /> 신규 마스터 상품 생성
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>신규 마스터 상품 생성</DialogTitle>
              <DialogDescription>ERP 시스템의 뼈대가 될 깨끗한 상태의 마스터 SKU를 생성합니다.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase">상품 바코드 / SKU 코드</label>
                <input type="text" className="px-3 py-2 border rounded-md" value={newProductForm.code} onChange={e => setNewProductForm({...newProductForm, code: e.target.value})} placeholder="SKU-NEW-001" />
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase">상품 명의</label>
                <input type="text" className="px-3 py-2 border rounded-md" value={newProductForm.name} onChange={e => setNewProductForm({...newProductForm, name: e.target.value})} placeholder="예: 슈퍼 건전지 40입" />
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase">초기 실사 재고 (옵션)</label>
                <input type="number" className="px-3 py-2 border rounded-md" value={newProductForm.stock} onChange={e => setNewProductForm({...newProductForm, stock: Number(e.target.value)})} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNewProductOpen(false)}>취소</Button>
              <Button className="bg-indigo-600 text-white" onClick={handleAddProduct}>DB 등록</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {unmatchedData.length > 0 && (
        <Card className="shadow-sm border-amber-200 bg-amber-50/30">
          <CardHeader className="pb-3 border-b border-amber-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-amber-900 flex items-center gap-2"><AlertCircle className="w-5 h-5 text-amber-600"/> 매핑 대기 중인 고아(Orphaned) 외부 데이터</CardTitle>
              <CardDescription className="text-amber-700/80">API나 스크래퍼가 주워왔지만 소유주를 찾지 못한 데이터들입니다. 어떤 마스터 상품으로 묶어줄 지 결정해 주세요!</CardDescription>
            </div>
            <Badge className="bg-amber-500 text-white font-bold px-3 py-1">{unmatchedData.length}건 대기중</Badge>
          </CardHeader>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {unmatchedData.map(um => (
              <div key={um.id} className="p-3 border border-amber-200 bg-white rounded-lg flex flex-col gap-2 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-amber-400"></div>
                <div className="flex justify-between items-start pl-2">
                  <Badge variant="outline" className="text-[10px] font-bold border-amber-200 bg-amber-50 text-amber-700">{um.platform} / {um.type}</Badge>
                </div>
                <h4 className="font-bold text-slate-800 text-xs md:text-sm pl-2 mt-1">{um.title}</h4>
                <div className="flex items-center justify-between mt-1 pl-2 border-t pt-2">
                  <span className="text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">ID/KEY: {um.rawId}</span>
                  
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] font-bold text-amber-700 hover:text-amber-900 hover:bg-amber-100 p-1 px-2 border border-amber-100 bg-amber-50" onClick={() => setMappingTargetSku("")}>
                        <Link className="w-3 h-3 mr-1"/> 마스터 지정
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>매핑 대상 마스터 상품 지정</DialogTitle>
                        <DialogDescription>'{um.title}' (데이터 폼: {um.rawId}) 요소를 어떠한 마스터 상품의 매핑 필드로 곧장 쏠까요?</DialogDescription>
                      </DialogHeader>
                      <select className="w-full px-3 py-2 border rounded-md font-bold text-slate-700 mt-2" 
                              value={mappingTargetSku} 
                              onChange={(e) => setMappingTargetSku(e.target.value)}>
                        <option value="">상품을 선택하세요...</option>
                        {products.map(p => <option key={p.code} value={p.code}>{p.name} [{p.code}]</option>)}
                      </select>
                      <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                        <Button className="bg-indigo-600 text-white font-bold" onClick={() => handleAssignUnmatched(um.id, um.rawId, um.type)}>이 상품 정보에 흡수 (Merge)</Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6">
        <Card className="shadow-sm">
          <CardHeader className="bg-slate-50/50 pb-4 border-b">
            <CardTitle>마스터 상품 목록 정밀 조회</CardTitle>
            <CardDescription>ERP 아키텍처의 기준이 되는 순수 뼈대 상품들입니다. [연동 연결] 을 눌러 이 상품에 흡수된 매핑 ID들을 확인하세요.</CardDescription>
          </CardHeader>
          <CardContent className="p-0 bg-white overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b">
                <tr>
                  <th className="px-6 py-4">상품 코드</th>
                  <th className="px-6 py-4 min-w-[300px]">상품명</th>
                  <th className="px-6 py-4 text-right">현재고</th>
                  <th className="px-6 py-4 text-right">일평균 출고(30일)</th>
                  <th className="px-6 py-4">소진 예상일</th>
                  <th className="px-6 py-4 text-center">정밀 연동 관리 / 매핑 현황</th>
                </tr>
              </thead>
              <tbody className="divide-y relative">
                {products.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-400">데이터가 없습니다.</td></tr>
                ) : products.map((p) => {
                  const status = getRunwayStatus(p.runway);
                  return (
                    <tr key={p.code} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs">
                        <Dialog>
                          <DialogTrigger asChild>
                            <button className="text-indigo-600 hover:underline font-bold text-left focus:outline-none">{p.code}</button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-2xl gap-3">
                            <DialogHeader>
                              <DialogTitle className="text-lg">수입 및 입고 일지</DialogTitle>
                            </DialogHeader>
                            <table className="w-full text-sm text-left border mt-2">
                              <thead className="bg-slate-50 border-b">
                                <tr>
                                  <th className="px-4 py-2 font-semibold">일자 / 공급사</th>
                                  <th className="px-4 py-2 text-right font-semibold">수량</th>
                                  <th className="px-4 py-2 text-right font-semibold">개당 원가</th>
                                  <th className="px-4 py-2 text-center font-semibold">관리</th>
                                </tr>
                              </thead>
                              <tbody>
                                {p.importLogs.map((log: any, idx: number) => (
                                  <tr key={idx} className="border-b bg-white hover:bg-slate-50">
                                    <td className="px-4 py-2"><span className="font-bold text-slate-800">{log.date}</span><br/><span className="text-xs text-slate-500">{log.supplier}</span></td>
                                    <td className="px-4 py-2 text-right font-mono">{log.qty.toLocaleString()}개</td>
                                    <td className="px-4 py-2 text-right font-mono font-bold text-slate-700">{log.cogs.toLocaleString()}원</td>
                                    <td className="px-4 py-2 text-center text-xs font-bold space-x-3">
                                      <button className="text-teal-600 hover:text-teal-800 hover:underline" onClick={() => handleEditReceipt(log, p.code)}>수정</button>
                                      <button className="text-rose-500 hover:text-rose-700 hover:underline" onClick={() => handleDeleteReceipt(log.id)}>삭제</button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </DialogContent>
                        </Dialog>
                      </td>
                      <td className="px-6 py-4 font-black text-slate-700">
                        {p.name}
                        <div className="text-[10px] text-slate-400 font-mono mt-1">이동평균 원가: {p.avgCogs?.toLocaleString()}원</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col items-end">
                          <span className={`${p.calculatedStock < 50 ? 'text-rose-600 font-bold' : 'font-black text-slate-800'}`}>{p.calculatedStock?.toLocaleString() || 0} 개</span>
                          <span className="text-[10px] text-slate-500 mt-1">총 입고: {p.totalIn?.toLocaleString() || 0} / 자동 차감: <span className="text-indigo-600 font-bold">-{p.totalSold?.toLocaleString() || 0}</span></span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono">{p.dailyOut} 개/일</td>
                      <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs font-semibold ${status.className}`}>{status.text}</span></td>
                      
                      <td className="px-6 py-4 text-center">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 shadow-sm border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold group relative">
                              <Link className="w-4 h-4 mr-1.5" /> 연동 연결 
                              {/* 매핑된 개수를 알려주는 알람 뱃지 */}
                              {(p.mappings.coupangVendorIds || p.mappings.coupangAdCampaigns || p.mappings.scrapingKeywords) && (
                                <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                                </span>
                              )}
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-2xl gap-3">
                            <DialogHeader>
                              <DialogTitle className="text-xl flex items-center gap-2"><Lock className="w-5 h-5 text-indigo-600"/> 데이터 정밀 매치업 (Match-up 방명록)</DialogTitle>
                              <DialogDescription>마스터 상품 [{p.name}] 하나에 복수(1:N)의 코드 및 스크랩 기록들이 아래와 같이 흡수되어 있습니다.</DialogDescription>
                            </DialogHeader>
                            
                            <Tabs defaultValue="orders" className="w-full mt-4">
                              <TabsList className="grid w-full grid-cols-3 bg-slate-100 p-1 rounded-lg">
                                <TabsTrigger value="orders" className="font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-700"><ShoppingCart className="w-4 h-4 mr-2"/>주문 다중매핑</TabsTrigger>
                                <TabsTrigger value="ads" className="font-bold data-[state=active]:bg-white data-[state=active]:text-rose-700"><TrendingDown className="w-4 h-4 mr-2"/>광고비 매핑</TabsTrigger>
                                <TabsTrigger value="scraping" className="font-bold data-[state=active]:bg-white data-[state=active]:text-emerald-700"><Globe className="w-4 h-4 mr-2"/>스크랩 텍스트 매칭</TabsTrigger>
                              </TabsList>
                              
                              <TabsContent value="orders" className="p-5 border rounded-lg bg-slate-50 grid gap-4">
                                <div>
                                  <label className="text-xs font-bold text-slate-500 flex items-center gap-1">Coupang (VendorItemID 등 복수 코드) <Badge variant="outline" className="text-[9px] h-4 bg-indigo-50 border-indigo-200 text-indigo-700">1:N 지원</Badge></label>
                                  <textarea className="w-full mt-1.5 px-3 py-2 border rounded-md font-mono text-xs focus:ring-1 focus:ring-indigo-500 bg-white shadow-sm resize-none" rows={4} 
                                            value={p.mappings.coupangVendorIds} 
                                            onChange={(e) => updateProductMapping(p.code, 'coupangVendorIds', e.target.value)} 
                                            placeholder={"803120012\n803120013\n803120014..."}></textarea>
                                </div>
                                <div>
                                  <label className="text-xs font-bold text-slate-500">Naver (Product ID)</label>
                                  <input type="text" className="w-full mt-1.5 px-3 py-2 border rounded-md font-mono text-sm bg-white shadow-sm focus:ring-1 focus:ring-indigo-500" 
                                         value={p.mappings.naverProductId} 
                                         onChange={(e) => updateProductMapping(p.code, 'naverProductId', e.target.value)} 
                                         placeholder="예: 994029112" />
                                </div>
                              </TabsContent>
                              
                              <TabsContent value="ads" className="p-5 border rounded-lg bg-slate-50 grid gap-4">
                                <div>
                                  <label className="text-xs font-bold text-slate-500 flex items-center gap-1">Coupang Ad Campaign ID <Badge variant="outline" className="text-[9px] h-4 bg-rose-50 border-rose-200 text-rose-700">다중지원</Badge></label>
                                  <textarea className="w-full mt-1.5 px-3 py-2 border rounded-md font-mono text-xs border-rose-200 bg-white focus:ring-1 focus:ring-rose-500 shadow-sm resize-none" rows={4} 
                                            value={p.mappings.coupangAdCampaigns} 
                                            onChange={(e) => updateProductMapping(p.code, 'coupangAdCampaigns', e.target.value)} 
                                            placeholder={"CMP-49930\nCMP-49931..."}></textarea>
                                </div>
                              </TabsContent>
                              
                              <TabsContent value="scraping" className="p-5 border rounded-lg bg-slate-50 grid gap-4">
                                <div>
                                  <label className="text-xs font-bold text-slate-500 flex items-center gap-1">웹 스크래핑 텍스트 / 옵션명 식별자 매칭 <Badge variant="outline" className="text-[9px] h-4 bg-emerald-50 border-emerald-200 text-emerald-700">고유ID 없음</Badge></label>
                                  <textarea className="w-full mt-1.5 px-3 py-2 border rounded-md font-mono text-xs border-emerald-200 bg-white focus:ring-1 focus:ring-emerald-500 shadow-sm resize-none" rows={4} 
                                            value={p.mappings.scrapingKeywords} 
                                            onChange={(e) => updateProductMapping(p.code, 'scrapingKeywords', e.target.value)} 
                                            placeholder="예: 자사 베이직 건전지 24입"></textarea>
                                </div>
                                <div>
                                  <label className="text-xs font-bold text-slate-500 flex items-center gap-1">단순 타겟 추적 URL (선택)</label>
                                  <input type="url" className="w-full mt-1.5 px-3 py-2 border border-emerald-200 rounded-md font-mono text-sm bg-emerald-50/50 shadow-sm focus:ring-1 focus:ring-emerald-500" 
                                         value={p.mappings.scrapingUrl} 
                                         onChange={(e) => updateProductMapping(p.code, 'scrapingUrl', e.target.value)} 
                                         placeholder="https://www.coupang.com/vp/products/..." />
                                </div>
                              </TabsContent>
                            </Tabs>

                            <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                              <Button className="bg-indigo-600 text-white font-bold" onClick={() => handleSaveMappings(p.code, p.mappings)}>
                                {isPending ? "저장 중..." : "수동 편집 내용 최종 저장"}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" onClick={() => initCostForm(p, 'smartstore')} className="h-8 shadow-sm border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 font-bold ml-2">
                              <BadgeDollarSign className="w-4 h-4 mr-1.5" /> 비용/정산 세팅
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-2xl gap-3">
                            <DialogHeader>
                              <DialogTitle className="text-xl flex items-center gap-2"><BadgeDollarSign className="w-5 h-5 text-amber-600"/> 플랫폼 정산 및 부가비용 동적 할당</DialogTitle>
                              <DialogDescription>마스터 상품 [{p.name}]이 판매될 플랫폼의 정책을 기입합니다. 변경 시점부터 향후 모든 매출 내역의 순이익에 반영됩니다.</DialogDescription>
                            </DialogHeader>
                            
                            <Tabs defaultValue="smartstore" className="w-full mt-4" onValueChange={(val) => initCostForm(p, val)}>
                              <TabsList className="grid w-full grid-cols-3 bg-slate-100 p-1 rounded-lg">
                                <TabsTrigger value="smartstore" className="font-bold data-[state=active]:bg-white data-[state=active]:text-emerald-600">SmartStore</TabsTrigger>
                                <TabsTrigger value="coupang_general" className="font-bold data-[state=active]:bg-white data-[state=active]:text-blue-600">쿠팡(일반배송)</TabsTrigger>
                                <TabsTrigger value="coupang_growth" className="font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-600">쿠팡(로켓그로스)</TabsTrigger>
                              </TabsList>
                              
                              {['smartstore', 'coupang_general', 'coupang_growth'].map(platform => (
                                <TabsContent key={platform} value={platform} className="p-5 border rounded-lg bg-slate-50 grid gap-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    {platform !== 'coupang_growth' && (
                                      <>
                                        <div>
                                          <label className="text-xs font-bold text-slate-500">배송/택배비 (원)</label>
                                          <input type="number" className="w-full mt-1.5 px-3 py-2 border rounded-md font-mono text-sm bg-white" value={costForm.shippingFee||''} onChange={e => setCostForm({...costForm, shippingFee: Number(e.target.value)})} placeholder="0" />
                                        </div>
                                        <div>
                                          <label className="text-xs font-bold text-slate-500">포장비자재/인건비 (원)</label>
                                          <input type="number" className="w-full mt-1.5 px-3 py-2 border rounded-md font-mono text-sm bg-white" value={costForm.packagingFee||''} onChange={e => setCostForm({...costForm, packagingFee: Number(e.target.value)})} placeholder="0" />
                                        </div>
                                      </>
                                    )}
                                    
                                    <div>
                                      <label className="text-xs font-bold text-slate-500">플랫폼 수수료율 (%)</label>
                                      <div className="relative">
                                        <input type="number" step="0.1" className="w-full mt-1.5 px-3 py-2 border rounded-md font-mono text-sm bg-white pr-8" value={costForm.commissionPercent||''} onChange={e => setCostForm({...costForm, commissionPercent: Number(e.target.value)})} placeholder="0" />
                                        <span className="absolute right-3 top-3.5 text-slate-400 font-bold">%</span>
                                      </div>
                                    </div>

                                    {platform.includes('coupang') && (
                                      <div>
                                        <label className="text-xs font-bold text-slate-500">프로모션 즉시할인 (원)</label>
                                        <input type="number" className="w-full mt-1.5 px-3 py-2 border rounded-md font-mono text-sm bg-white" value={costForm.promoDiscount||''} onChange={e => setCostForm({...costForm, promoDiscount: Number(e.target.value)})} placeholder="0" />
                                      </div>
                                    )}

                                    {platform === 'coupang_growth' && (
                                      <div>
                                        <label className="text-xs font-bold text-slate-500">그로스 물류/보관비용 (원)</label>
                                        <input type="number" className="w-full mt-1.5 px-3 py-2 border rounded-md font-mono text-sm bg-white shadow-sm" value={costForm.growthLogistics||''} onChange={e => setCostForm({...costForm, growthLogistics: Number(e.target.value)})} placeholder="0" />
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                                    <Button className="bg-amber-600 hover:bg-amber-700 text-white font-bold" onClick={() => handleSavePlatformCost(p.code, platform)}>
                                      {isPending ? "저장 중..." : "이 플랫폼 정산/비용 정책 저장"}
                                    </Button>
                                  </div>
                                </TabsContent>
                              ))}
                            </Tabs>
                          </DialogContent>
                        </Dialog>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
