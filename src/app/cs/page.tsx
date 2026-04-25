"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MessageSquare, Bot, AlertTriangle, Clock, CheckCircle, Search, ThumbsUp, Truck, Package, ChevronRight, Image as ImageIcon, Send, User } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CSPage() {
  const kpis = [
    { title: "오늘 신규 인입", value: 42, icon: MessageSquare, color: "text-blue-600", bg: "bg-blue-100" },
    { title: "미응답 대기", value: 5, icon: Clock, color: "text-rose-600", bg: "bg-rose-100", alert: true },
    { title: "평균 응답 시간", value: "12분", icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-100" },
    { title: "AI 자동 방어율", value: "68.5%", icon: Bot, color: "text-indigo-600", bg: "bg-indigo-100" },
  ];

  const tickets = [
    { id: 1, channel: "쿠팡 (로켓)", customer: "박*호", type: "배송문의", time: "12분 전", title: "배송이 너무 늦어요. 언제 오나요?", status: "대기중", urgency: "높음", active: true },
    { id: 2, channel: "스마트스토어", customer: "김*영", type: "교환/반품", time: "35분 전", title: "상품 파손으로 교환 요청합니다.", status: "대기중", urgency: "보통", active: false },
    { id: 3, channel: "자사몰", customer: "최*민", type: "상품문의", time: "1시간 전", title: "AA 건전지는 몇 개월 가나요?", status: "답변완료", urgency: "낮음", active: false },
    { id: 4, channel: "11번가", customer: "정*수", type: "배송문의", time: "2시간 전", title: "송장 조회해도 안나옴", status: "AI처리됨", urgency: "낮음", active: false },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 max-w-7xl mx-auto h-full animate-in fade-in">
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-rose-500" /> 통합 CS 및 AI 지원센터
          </h1>
          <p className="text-muted-foreground">다중 판매 채널의 고객 문의를 통합하고, 마스터 DB(주문/물류)와 연동된 AI가 답변을 자동 초안 작성합니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="shadow-sm">
            채널 문의 수동 동기화
          </Button>
          <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 px-4 py-2 rounded-lg shadow-sm">
            <Bot className="w-5 h-5 text-indigo-600" />
            <span className="text-sm font-bold text-indigo-800">AI 챗봇 엔진 (오토 파일럿) 가동 중</span>
            <div className="relative inline-flex items-center cursor-not-allowed ml-2 opacity-80" title="퍼미션 필요">
              <input type="checkbox" className="sr-only peer" defaultChecked disabled />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <Card key={i} className={`shadow-sm ${kpi.alert ? 'border-rose-400 border-2' : ''}`}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`p-3 rounded-lg ${kpi.bg} ${kpi.color}`}><kpi.icon className="w-6 h-6"/></div>
              <div>
                <p className="text-sm font-medium text-slate-500">{kpi.title}</p>
                <h3 className={`text-2xl font-bold ${kpi.alert ? 'text-rose-600' : ''}`}>{kpi.value}</h3>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-6 min-h-[600px]">
        {/* Left: Ticket List */}
        <Card className="col-span-4 shadow-sm flex flex-col">
          <CardHeader className="bg-slate-50/50 pb-3 border-b px-4 py-3">
            <div className="flex justify-between items-center mb-3">
              <CardTitle className="text-md font-bold">수집된 문의 목록</CardTitle>
              <span className="bg-rose-100 text-rose-700 text-xs font-bold px-2 py-1 rounded-full">대기 5건</span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="고객명, 주문번호 겅색..." className="pl-9 pr-3 py-1.5 border rounded-md text-xs w-full bg-white focus:ring-1 focus:ring-rose-200 outline-none" />
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto bg-slate-50">
            <div className="divide-y">
              {tickets.map(t => (
                <div key={t.id} className={`p-4 cursor-pointer transition-colors border-l-4 ${t.active ? 'bg-white border-l-rose-500 shadow-sm z-10 relative' : 'hover:bg-slate-100/80 border-l-transparent'}`}>
                  <div className="flex justify-between items-start mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${t.channel === '쿠팡 (로켓)' ? 'bg-rose-100 text-rose-800' : t.channel === '스마트스토어' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-800'}`}>{t.channel}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${t.type === '배송문의' ? 'bg-blue-100 text-blue-800 border border-blue-200' : t.type === '교환/반품' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-slate-100 border border-slate-200'}`}>{t.type}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">{t.time}</span>
                  </div>
                  <p className="font-bold text-sm text-slate-800 truncate">{t.title}</p>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-slate-500 font-medium flex items-center gap-1"><User className="w-3 h-3"/> {t.customer}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.status === '대기중' ? 'bg-rose-50 text-rose-600 border border-rose-200' : t.status === 'AI처리됨' ? 'bg-indigo-50 text-indigo-600 border border-indigo-200' : 'bg-slate-100 text-slate-500'}`}>{t.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Right: Ticket Detail & AI Chat */}
        <Card className="col-span-8 shadow-sm flex flex-col border-t-4 border-t-rose-500 overflow-hidden">
          <CardHeader className="bg-white pb-0 border-b p-0">
            <div className="p-5 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded text-xs">쿠팡</span>
                  <span className="bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded text-xs border border-blue-200">배송문의</span>
                  <span className="text-slate-400 text-xs font-mono">TKT-20260322-001</span>
                </div>
                <h2 className="text-xl font-bold tracking-tight">배송이 너무 늦어요. 언제 오나요?</h2>
                <p className="text-sm text-slate-500 mt-1 flex items-center gap-2"><User className="w-4 h-4"/> 박*호 고객님 (일반 회원)</p>
              </div>
              <Button variant="outline" size="sm" className="shadow-sm">
                주문 상세뷰 보기 <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            <div className="bg-blue-50/50 px-5 py-3 border-t border-blue-100 grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-blue-600 font-bold mb-1 uppercase">연동 주문 번호</p>
                <p className="font-mono font-semibold">ORD-260322-002</p>
              </div>
              <div>
                <p className="text-xs text-blue-600 font-bold mb-1 uppercase">주문 상품</p>
                <p className="font-semibold truncate">고속 무선 충전스탠드 15W 블랙 (1개)</p>
              </div>
              <div>
                <p className="text-xs text-blue-600 font-bold mb-1 uppercase">현재 물류 상태</p>
                <p className="font-bold flex items-center gap-1.5 text-amber-600"><Truck className="w-4 h-4"/> 출고 대기 (발주확인)</p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0 flex-1 bg-slate-50 flex flex-col relative">
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              
              {/* Customer Message */}
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                  <User className="w-6 h-6 text-slate-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-bold text-slate-800">고객님</span>
                    <span className="text-xs text-slate-400">12분 전</span>
                  </div>
                  <div className="bg-white border rounded-2xl rounded-tl-none p-4 shadow-sm inline-block max-w-[85%]">
                    <p className="text-slate-800 text-sm leading-relaxed">
                      오늘 도착한다고 해서 샀는데 택배 조회해보니까 아직 간선하차도 안됐네요.
                      왜 안오는건가요? 취소해야하나요?
                    </p>
                  </div>
                </div>
              </div>

              {/* System Note */}
              <div className="flex justify-center">
                <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-3 py-1 rounded-full">
                  ERP 자동 조회 결과 봇(Bot) 분석 완료
                </span>
              </div>

              {/* AI Draft Response */}
              <div className="flex gap-4 flex-row-reverse">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 border border-indigo-200">
                  <Bot className="w-6 h-6 text-indigo-600" />
                </div>
                <div className="flex-1 flex flex-col items-end">
                  <div className="flex items-baseline gap-2 mb-1 flex-row-reverse">
                    <span className="font-bold text-indigo-800">AI Assistant (초안 작성됨)</span>
                    <span className="text-xs text-indigo-400">방금 전</span>
                  </div>
                  <div className="bg-indigo-600 text-white rounded-2xl rounded-tr-none p-4 shadow-md inline-block max-w-[85%]">
                    <p className="text-sm leading-relaxed opacity-90 mb-3">
                      <strong className="text-indigo-200 block mb-1">[AI 분석 이유]</strong>
                      실제 물류 데이터 상 "택배사 인계 후 허브 이동 중"이며, 최근 배송 지연 SLA 경고가 뜬 주문 건입니다. 쿠팡 정책상 출고 후 판매자 임의 취소가 불가하여 양해를 구하는 템플릿을 선택했습니다.
                    </p>
                    <p className="text-sm font-medium leading-relaxed bg-indigo-700/50 p-3 rounded-lg border border-indigo-500">
                      안녕하세요 박*호 고객님, 저희 제품을 구매해 주셔서 진심으로 감사드립니다.
                      <br/><br/>
                      우선 배송 출발일 안내 이후 도착이 지연되어 불편을 드린 점 머리 숙여 사과드립니다. 현재 운송장(CJ대한통운 6823-1123-4552) 조회 결과, 상품은 택배사 허브에 정상 도착했으나 택배사 물량 폭증으로 인해 각 지역 터미널로의 이동이 하루 정도 지체되고 있는 것으로 확인됩니다.
                      <br/><br/>
                      늦어도 내일(23일) 오후 중으로는 담당 기사님이 배달을 완료할 예정입니다. 조금만 더 너른 마음으로 양해를 부탁드립니다.
                      감사합니다.
                    </p>
                  </div>
                  
                  {/* AI Feedback Actions */}
                  <div className="flex gap-2 mt-2 mr-1">
                    <Button variant="outline" size="sm" className="h-7 text-xs bg-white text-rose-600 border-rose-200 hover:bg-rose-50">
                      <AlertTriangle className="w-3 h-3 mr-1"/> 다른 초안 작성 (보상안 포함)
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs bg-white text-slate-600">
                      <ThumbsUp className="w-3 h-3 mr-1"/> AI 평가 (정확함)
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Input Box */}
            <div className="bg-white border-t p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-slate-400">판매 채널로 발송하기 전에 초안을 직접 수정할 수 있습니다.</span>
              </div>
              <div className="relative">
                <textarea className="w-full border rounded-xl bg-slate-50 pl-4 pr-12 py-3 text-sm focus:ring-1 focus:ring-indigo-300 outline-none resize-none h-20" defaultValue="안녕하세요 박*호 고객님, 저희 제품을 구매해 주셔서 진심으로 감사드립니다.
우선 배송 출발일 안내 이후 도착이 지연되어 불편을 드린 점 머리 숙여 사과드립니다..." />
                <Button size="icon" className="absolute right-2 bottom-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg h-8 w-8" onClick={() => alert('읽기 전용: 쿠팡 API로의 실제 메시지 전송이 차단되었습니다.')}>
                  <Send className="w-4 h-4 text-white" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
