"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Truck, CheckCircle, FileText, RefreshCcw, Search, Calendar, AlertCircle, ShoppingBag, AlertTriangle, MapPin, Package, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function OrdersPage() {
  // TODO: 추후 [통합 주문 DB/API]와 연동 필요 (현재 미구현)
  // 기획-구현 구조적 불일치(Mock 데이터) 보존 규칙 적용
  const mockOrders = [
    { id: "ORD-260322-001", channel: "스마트스토어", customer: "김*호", item: "자사 베이직 건전지 AA 24입", qty: 2, amount: 22900, status: "신규주문", date: "2026-03-22 14:20", deadline: "오늘 16:00까지" },
    { id: "ORD-260322-002", channel: "쿠팡 (로켓)", customer: "이*영", item: "고속 무선 충전스탠드 15W 블랙", qty: 1, amount: 45000, status: "출고대기", date: "2026-03-22 13:10", deadline: "오늘 18:00까지" },
    { id: "ORD-260322-003", channel: "자사몰", customer: "박*준", item: "C to C 100W PD 고속 충전 케이블 2m", qty: 5, amount: 75000, status: "배송중", date: "2026-03-21 18:40", tracking: "CJ대한통운 6823-1123-4552" },
    { id: "ORD-260321-099", channel: "11번가", customer: "최*민", item: "자사 베이직 건전지 AAA 24입", qty: 10, amount: 110000, status: "배송지연", date: "2026-03-19 10:00", deadline: "지연 (SLA 초과)" },
  ];

  const getStatusBadge = (status: string) => {
    switch(status) {
      case '신규주문': return 'bg-blue-100 text-blue-700 border-blue-200';
      case '출고대기': return 'bg-amber-100 text-amber-700 border-amber-200';
      case '배송중': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case '배송지연': return 'bg-rose-100 text-rose-700 border-rose-200 animate-pulse';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 max-w-7xl mx-auto h-full animate-in fade-in">
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <ShoppingBag className="w-8 h-8 text-blue-500" /> 통합 발주 및 물류 현황
          </h1>
          <p className="text-muted-foreground">다중 판매 채널(스마트스토어, 쿠팡, 자사몰 등)의 실시간 주문 및 배송 상태를 통합 관리합니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" className="shadow-sm">
            <RefreshCcw className="w-4 h-4 mr-2 text-slate-500" /> 🚧 [개발 예정] 전체 채널 수동 동기화
          </Button>
            <CheckCircle className="w-4 h-4 mr-2" /> 🚧 [개발 예정] 선택 발주 승인 (출고 처리)
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-lg"><ShoppingBag className="w-6 h-6"/></div>
            <div>
              <p className="text-sm font-medium text-slate-500">통합 신규 주문</p>
              <h3 className="text-2xl font-bold">142<span className="text-sm font-normal text-slate-500 ml-1">건</span></h3>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-amber-100 text-amber-600 rounded-lg"><Truck className="w-6 h-6"/></div>
            <div>
              <p className="text-sm font-medium text-slate-500">출고 대기 (발주확인)</p>
              <h3 className="text-2xl font-bold">85<span className="text-sm font-normal text-slate-500 ml-1">건</span></h3>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-rose-100 text-rose-600 rounded-lg"><AlertTriangle className="w-6 h-6"/></div>
            <div>
              <p className="text-sm font-medium text-slate-500">배송 지연 / CS 인입</p>
              <h3 className="text-2xl font-bold text-rose-600">4<span className="text-sm font-normal text-rose-400 ml-1">건</span></h3>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="p-4 flex items-center justify-between h-full">
            <div>
              <p className="text-sm font-medium text-blue-800">출고 지시 기준 오늘 예상 매출</p>
              <h3 className="text-2xl font-black text-blue-900 mt-1">₩ 4,250,000</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white p-3 rounded-lg border shadow-sm flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="주문 번호, 고객명, 송장번호 검색..." className="pl-9 pr-4 py-2 border rounded-md text-sm w-full bg-slate-50 focus:bg-white transition-colors outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300" />
        </div>
        <select className="px-3 py-2 border rounded-md text-sm bg-white min-w-[140px] outline-none">
          <option>모든 판매 채널</option>
          <option>스마트스토어</option>
          <option>쿠팡 (로켓)</option>
          <option>자사몰</option>
        </select>
        <select className="px-3 py-2 border rounded-md text-sm bg-white min-w-[140px] outline-none">
          <option>모든 주문 상태</option>
          <option>신규 주문</option>
          <option>출고 대기</option>
          <option>배송 중</option>
        </select>
        <div className="relative flex items-center gap-2 px-3 py-2 border rounded-md text-sm bg-white text-slate-600 cursor-not-allowed opacity-80 decoration-dotted underline">
          <Calendar className="w-4 h-4" /> 기간: 3월 26일 (당일)
        </div>
        <div className="flex-1"></div>
        <Button variant="outline" className="shadow-sm" onClick={() => alert('읽기 전용 규칙: 템플릿 다운로드 대기 중.')}>
          <FileText className="w-4 h-4 mr-2" /> 🚧 [개발 예정] 엑셀 다운로드 (출고)
        </Button>
      </div>

      <div className="grid gap-6">
        <Card className="shadow-sm border-t-4 border-t-blue-500">
          <CardHeader className="bg-slate-50/50 pb-4 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle>통합 주문 목록 상세</CardTitle>
              <CardDescription className="mt-1">주문 번호를 클릭하면 개별 고객의 배송지 및 상세 송장 이력을 확인하실 수 있습니다.</CardDescription>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600 font-medium bg-white border px-3 py-1.5 rounded-full shadow-sm">
              <AlertCircle className="w-4 h-4 text-amber-500"/> 출고 마감 임박 건 최상단 강제 노출 중
            </div>
          </CardHeader>
          <CardContent className="p-0 bg-white overflow-x-auto min-h-[400px]">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b">
                <tr>
                  <th className="px-4 py-3 text-center w-12"><input type="checkbox" className="rounded border-slate-300" /></th>
                  <th className="px-4 py-3">판매 채널</th>
                  <th className="px-4 py-3">처리 상태</th>
                  <th className="px-4 py-3">고객 명</th>
                  <th className="px-4 py-3">주문 상품 및 옵션</th>
                  <th className="px-4 py-3 text-right">결제 금액 (수량)</th>
                  <th className="px-4 py-3">처리 마감 기한 / 송장</th>
                </tr>
              </thead>
              <tbody className="divide-y relative">
                {mockOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-4 text-center"><input type="checkbox" className="rounded border-slate-300" /></td>
                    <td className="px-4 py-4 font-semibold text-slate-700">{o.channel}</td>
                    <td className="px-4 py-4">
                      <span className={`px-2.5 py-1 text-[11px] font-bold rounded border ${getStatusBadge(o.status)}`}>{o.status}</span>
                    </td>
                    <td className="px-4 py-4 font-medium text-slate-700">
                      <Dialog>
                        <DialogTrigger asChild>
                          <button className="text-blue-600 hover:text-blue-800 hover:underline font-bold focus:outline-none flex flex-col items-start">
                            <span>{o.customer}</span>
                            <span className="font-mono text-[10px] text-slate-400 mt-0.5 pointer-events-none font-normal">{o.id}</span>
                          </button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-2xl gap-0 p-0 overflow-hidden">
                          <div className="bg-slate-50 p-5 border-b">
                            <div className="flex justify-between items-start">
                              <div>
                                <DialogTitle className="text-xl mb-1">{o.customer} 고객 주문 상세</DialogTitle>
                                <DialogDescription className="font-mono text-[11px]">System ID: {o.id} | 수집처: {o.channel} | 주문 일시: {o.date}</DialogDescription>
                              </div>
                              <span className={`px-2.5 py-1 text-xs font-bold rounded border ${getStatusBadge(o.status)}`}>{o.status}</span>
                            </div>
                          </div>
                          <div className="p-6 grid grid-cols-2 gap-x-8 gap-y-6 bg-white">
                            <div className="col-span-2">
                              <h4 className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-1"><Package className="w-3 h-3"/> 주문 상품 정보</h4>
                              <div className="bg-slate-50 border rounded-lg p-3 flex justify-between items-center">
                                <div>
                                  <p className="font-bold text-slate-800 text-sm">{o.item}</p>
                                  <p className="text-xs text-slate-500 mt-1">선택 옵션: 단일 / 주문 수량: <span className="font-bold text-slate-700">{o.qty}</span>개</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-lg text-slate-800 flex flex-col">
                                    ₩ {o.amount.toLocaleString()}
                                  </p>
                                  <p className="text-[11px] text-blue-600 font-medium mt-1">배송비: 3,000원 선결제</p>
                                </div>
                              </div>
                            </div>
                            
                            <div>
                              <h4 className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-1"><MapPin className="w-3 h-3"/> 수령인 정보 및 배송지</h4>
                              <div className="space-y-1 text-sm bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                                <p><span className="font-medium text-slate-500 inline-block w-16">수령인:</span> {o.customer}</p>
                                <p><span className="font-medium text-slate-500 inline-block w-16">연락처:</span> 010-****-1234</p>
                                <p className="mt-2 text-slate-700 leading-relaxed bg-white p-2 border rounded text-xs">[06232] 서울특별시 강남구 테헤란로 123, 가상의 402호</p>
                                <p className="text-[11px] text-rose-600 font-bold py-1 px-2 bg-rose-50 rounded mt-2 border border-rose-100 border-dashed">배송 메모: 문 앞에 두고 초인종 누르지 마세요.</p>
                              </div>
                            </div>

                            <div>
                              <h4 className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-1"><History className="w-3 h-3"/> 취합 및 출고 타임라인</h4>
                              <div className="space-y-3 pt-1">
                                <div className="relative pl-4 border-l-2 border-blue-200">
                                  <div className="absolute w-2 h-2 bg-blue-500 rounded-full -left-[5px] top-1.5 ring-4 ring-white"></div>
                                  <p className="text-xs font-bold text-blue-800 mb-0.5">쇼핑몰 결제 완료 및 ERP 수집</p>
                                  <p className="text-[11px] text-slate-500">{o.date}</p>
                                </div>
                                {o.status === "신규주문" && (
                                  <div className="relative pl-4 border-l-2 border-slate-200">
                                    <div className="absolute w-2 h-2 bg-slate-300 rounded-full -left-[5px] top-1.5 ring-4 ring-white"></div>
                                    <p className="text-xs font-bold text-slate-400 mb-0.5">창고 발주 지시 대기</p>
                                  </div>
                                )}
                                {o.status !== "신규주문" && (
                                  <div className="relative pl-4 border-l-2 border-amber-200">
                                    <div className="absolute w-2 h-2 bg-amber-500 rounded-full -left-[5px] top-1.5 ring-4 ring-white animate-pulse"></div>
                                    <p className="text-xs font-bold text-amber-800 mb-0.5">피킹(Picking) 및 발주 확정</p>
                                    {o.status === "출고대기" ? (
                                      <div className="mt-2">
                                        <p className="text-[11px] text-amber-700 mb-1">임시 송장 발급 대기 중...</p>
                                      </div>
                                    ) : (
                                      <p className="text-[11px] text-slate-500">담당자가 발주 확인 처리함.</p>
                                    )}
                                  </div>
                                )}
                                {o.tracking && (
                                  <div className="relative pl-4 border-l-2 border-emerald-200">
                                    <div className="absolute w-2 h-2 bg-emerald-500 rounded-full -left-[5px] top-1.5 ring-4 ring-white"></div>
                                    <p className="text-xs font-bold text-emerald-800 mb-0.5">송장 발행 완료 (택배사 인계)</p>
                                    <p className="text-[11px] text-emerald-700 font-mono bg-emerald-50 border border-emerald-100 px-1 py-0.5 rounded mt-1 inline-block">{o.tracking}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="bg-slate-100/50 p-4 border-t flex justify-between items-center">
                            <Button variant="ghost" className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-sm h-9" onClick={() => alert('읽기 전용 규칙: 외부 판매 채널에 강제 취소 명령이 차단되었습니다.')}>🚧 [개발 예정] 주문 취소 연동</Button>
                            <div className="flex gap-2">
                              <Button variant="outline" className="h-9 text-sm">🚧 [개발 예정] 주소지 및 옵션 수정</Button>
                              <Button className="bg-blue-600 hover:bg-blue-700 text-white h-9 text-sm" onClick={() => alert('읽기 전용 규칙: 실서버 운송장 일괄 전송 테스트가 차단되었습니다.')}>🚧 [개발 예정] 발주 확정 & 운송장 전송</Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </td>
                    <td className="px-4 py-4 max-w-[200px] truncate font-medium text-slate-800" title={o.item}>{o.item}</td>
                    <td className="px-4 py-4 text-right">
                      <span className="font-bold text-slate-800">₩ {o.amount.toLocaleString()}</span> 
                      <span className="text-slate-400 text-[11px] ml-1">({o.qty}개)</span>
                    </td>
                    <td className="px-4 py-4">
                      {o.tracking ? (
                        <span className="text-emerald-700 text-xs font-mono bg-emerald-50 px-2 py-1 rounded inline-block border border-emerald-200">{o.tracking}</span>
                      ) : (
                        <span className={`text-xs font-semibold px-2 py-1 rounded ${o.status === '배송지연' ? 'text-rose-600 bg-rose-50' : 'text-amber-600 bg-amber-50 border-amber-100'}`}>{o.deadline}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
