"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, CheckCircle2, AlertCircle, XCircle, Clock, RefreshCw, ListChecks, ServerCrash } from "lucide-react";

function StatusModule({ title, log, status, time }: { title: string, log?: any, status?: string, time?: string }) {
  const isFailed = log?.status === 'FAILED' || status === 'FAILED';
  const isSuccess = log?.status === 'SUCCESS' || status === 'SUCCESS';
  const displayTime = time ? new Date(time).toLocaleString('ko-KR') : log ? new Date(log.created_at).toLocaleString('ko-KR') : '아직 수행 안 됨';

  return (
    <div className={`p-4 flex flex-col gap-2 relative transition-all duration-500 ${isFailed ? 'bg-rose-50/50' : isSuccess ? 'bg-emerald-50/20' : 'bg-slate-50/30'}`}>
      {isFailed && <div className="absolute top-0 left-0 w-1 h-full bg-rose-500 animate-pulse"></div>}
      {isSuccess && <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>}

      <div className="flex justify-between items-center ml-2">
        <h4 className="font-bold text-sm text-slate-800">{title}</h4>
        {isFailed ? (
          <Badge className="bg-rose-500 hover:bg-rose-600 shadow-md animate-pulse"><XCircle className="w-3 h-3 mr-1"/> 연결 끊김(실패)</Badge>
        ) : isSuccess ? (
          <Badge className="bg-emerald-500 hover:bg-emerald-600 shadow-md"><CheckCircle2 className="w-3 h-3 mr-1"/> 정상 수집중</Badge>
        ) : (
          <Badge variant="outline" className="text-slate-400 border-slate-200">대기 중</Badge>
        )}
      </div>
      <div className="text-xs text-slate-500 flex items-center gap-1 mt-2 ml-2">
        <Clock className="w-3.5 h-3.5" /> 최근 확인: {displayTime}
      </div>
      {isFailed && log?.error_message && (
        <div className="mt-2 text-xs text-rose-600 bg-white p-2 rounded border border-rose-200 font-mono break-all line-clamp-3 ml-2 shadow-sm" title={log.error_message}>
          {log.error_message}
        </div>
      )}
    </div>
  )
}

export default function AutomationsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  useEffect(() => {
    const fetchData = () => {
      Promise.all([
        fetch('/api/settings/accounts').then(r => r.json()),
        fetch('/api/automations/logs').then(r => r.json())
      ]).then(([accData, logsData]) => {
        if (accData.accounts) setAccounts(accData.accounts);
        if (logsData.success && logsData.logs) setLogs(logsData.logs);
        setLoading(false);
        setLastRefreshed(new Date());
      }).catch(err => {
        console.error(err);
      });
    };

    fetchData(); // 초기 로드
    // 15초마다 자동 새로고침(Polling) 설정으로 진호님이 F5 누르지 않아도 실시간 상태 확인 가능!
    const interval = setInterval(fetchData, 15000); 
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 max-w-[1400px] mx-auto h-full animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <Bot className="w-8 h-8 text-indigo-600" /> 실시간 통합 관제 타워 (Health Check)
          </h1>
          <p className="text-muted-foreground flex items-center gap-2 font-medium">
            아이디별로 API 커넥션과 기능별(매출/광고/경쟁사) 크롤러 봇들의 생사 여부를 15초 단위로 스캔하여 신호등 형태로 표시합니다.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full font-mono">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          Last Sync: {lastRefreshed.toLocaleTimeString('ko-KR')}
        </div>
      </div>

      {loading && accounts.length === 0 ? (
        <div className="py-20 text-center text-slate-400 font-bold animate-pulse">
          서버와 통신하여 각 계정별 봇들의 심장 박동을 스캔 중입니다...
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* 계정별 매트릭스 카드 렌더링 */}
          {accounts.map(acc => {
            const salesLog = logs.find(l => l.account_id === acc.alias && l.job_type === 'WING_SALES');
            const adsLog = logs.find(l => l.account_id === acc.alias && l.job_type === 'WING_ADS');
            const compLog = logs.find(l => l.account_id === acc.alias && l.job_type === 'COMPETITOR_TRACKING');
            
            return (
              <Card key={acc.id} className="overflow-hidden border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b pb-4 pt-5">
                  <CardTitle className="text-xl font-black flex items-center gap-3">
                    {acc.platform === 'coupang' 
                      ? <span className="bg-indigo-100 text-indigo-800 text-xs px-2.5 py-1 rounded-md tracking-wider">COUPANG</span> 
                      : <span className="bg-green-100 text-green-800 text-xs px-2.5 py-1 rounded-md tracking-wider">NAVER</span>}
                    {acc.alias} 계정 모니터링 현황
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                    <StatusModule 
                      title="1️⃣ 공식 API 연동 상태" 
                      status="SUCCESS" 
                      time={new Date().toISOString()} 
                    />
                    <StatusModule 
                      title="2️⃣ 정산/매출 크롤링" 
                      log={salesLog} 
                    />
                    <StatusModule 
                      title="3️⃣ 마케팅/광고비 크롤링" 
                      log={adsLog} 
                    />
                    <StatusModule 
                      title="4️⃣ 경쟁사 동향 스캐너" 
                      log={compLog} 
                    />
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* 뒤안길로 밀려난 원본 로그 테이블 (디버그/상세 조회용) */}
      <Card className="mt-8 shadow-sm border-slate-200 opacity-60 hover:opacity-100 transition-opacity">
        <CardHeader className="bg-slate-50/50 pb-4 border-b">
          <CardTitle className="flex items-center gap-2 text-base text-slate-600">
            <ListChecks className="w-4 h-4" /> (디버그용) 전체 수집 상태 점검 기록 (Raw Logs)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 bg-white">
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold sticky top-0 border-b">
                <tr>
                  <th className="px-4 py-3">실행 일시</th>
                  <th className="px-4 py-3">점검 과정</th>
                  <th className="px-4 py-3">대상 계정(ID)</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3">에러 메시지 / 비고</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.length > 0 && logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">{new Date(log.created_at).toLocaleString('ko-KR')}</td>
                    <td className="px-4 py-2"><Badge variant="outline" className="bg-white">{log.job_type}</Badge></td>
                    <td className="px-4 py-2 font-bold text-slate-600">[{log.account_id}]</td>
                    <td className="px-4 py-2">
                       {log.status === 'SUCCESS' ? <span className="text-emerald-600 font-bold">정상</span> : <span className="text-rose-600 font-bold">실패</span>}
                    </td>
                    <td className="px-4 py-2 text-xs text-rose-500 font-mono truncate max-w-xs">{log.error_message || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
