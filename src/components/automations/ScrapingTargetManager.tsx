"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Globe, Plus, Trash2, Power, PowerOff } from "lucide-react";
import { getScrapingTargets, addScrapingTarget, toggleTargetState, deleteTarget } from "@/app/actions/scraperActions";
import { toast } from "sonner";

export function ScrapingTargetManager() {
  const [targets, setTargets] = useState<any[]>([]);
  const [url, setUrl] = useState("");
  const [alias, setAlias] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchTargets = async () => {
    const res = await getScrapingTargets();
    if (res.success) setTargets(res.targets || []);
  };

  useEffect(() => {
    fetchTargets();
  }, []);

  const handleAdd = async () => {
    if (!url || !alias) return;
    setLoading(true);
    await addScrapingTarget(url, alias);
    setUrl("");
    setAlias("");
    await fetchTargets();
    setLoading(false);
  };

  const handleToggle = async (id: string, currentState: boolean) => {
    await toggleTargetState(id, currentState);
    await fetchTargets();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await deleteTarget(id);
    await fetchTargets();
  };

  return (
    <Card className="shadow-sm border-slate-200 md:col-span-2">
      <CardHeader className="bg-fuchsia-50/40 pb-4 border-b">
        <CardTitle className="flex items-center gap-2 text-lg text-fuchsia-900">
          <Globe className="w-5 h-5 text-fuchsia-600" /> 4. 로컬 파이썬 봇 타겟 관리표 (Scraping Targets DB)
        </CardTitle>
        <CardDescription>매일 새벽 스케줄러가 자동 구동되는 파이썬 매크로가 수집할 타겟 상품 URL 배열을 DB에 저장하고 통제합니다.</CardDescription>
      </CardHeader>
      <CardContent className="p-5 flex flex-col gap-4 bg-white">
        
        <div className="flex flex-col gap-4">
          <div className="flex gap-2 items-center bg-slate-50 p-4 border rounded-xl">
            <Input 
              placeholder="품목 식별 별명 (예: 홈캠 거치대 경쟁사 A)" 
              value={alias} onChange={(e) => setAlias(e.target.value)} 
              className="w-1/3 bg-white"
            />
            <Input 
              placeholder="타겟 URL 전체 입력 (https://coupang...)" 
              value={url} onChange={(e) => setUrl(e.target.value)} 
              className="flex-1 bg-white"
            />
            <Button onClick={handleAdd} disabled={loading || !url || !alias} className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold tracking-wide shrink-0">
              <Plus className="w-4 h-4 mr-1" /> 타겟 DB 등록
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {targets.length === 0 && <div className="py-8 text-center text-slate-400 font-medium">등록된 자동화 타겟이 없습니다. URL을 추가해 주세요.</div>}
          {targets.map(target => (
            <div key={target.id} className={`flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border rounded-xl transition-all ${target.is_active ? 'bg-white border-slate-200 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)]' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
              <div className="flex items-start gap-3 flex-1 overflow-hidden">
                <Button variant={target.is_active ? "default" : "secondary"} size="icon" className={`shrink-0 rounded-xl w-11 h-11 ${target.is_active ? 'bg-emerald-500 hover:bg-emerald-600 shadow' : 'bg-slate-300'}`} onClick={() => handleToggle(target.id, target.is_active)}>
                  {target.is_active ? <Power className="w-5 h-5" /> : <PowerOff className="w-5 h-5" />}
                </Button>
                <div className="flex flex-col overflow-hidden pt-0.5">
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    {target.alias}
                    {target.is_active ? <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50 px-2 py-0 h-5">활성 (Active)</Badge> : <Badge variant="outline" className="border-slate-200 text-slate-500 px-2 py-0 h-5">중지됨 (Paused)</Badge>}
                  </h3>
                  <a href={target.url} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 truncate hover:underline leading-relaxed max-w-xl">
                    {target.url}
                  </a>
                  <p className="text-[11px] font-medium text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
                    <span className="shrink-0">🤖 갱신: <span className="text-slate-500">{target.last_scraped_at ? new Date(target.last_scraped_at).toLocaleString() : '대기 중...'}</span></span>
                    {target.last_price && <span className="text-emerald-700 font-bold bg-emerald-50/80 border border-emerald-100 px-2 py-0.5 rounded">💰 {target.last_price}원</span>}
                    {target.last_review_count && <span className="text-amber-700 font-bold bg-amber-50/80 border border-amber-100 px-2 py-0.5 rounded">⭐ {target.last_review_count}</span>}
                    {target.last_buy_count && <span className="text-fuchsia-700 font-bold bg-fuchsia-50/80 border border-fuchsia-100 px-2 py-0.5 rounded">🔥 {target.last_buy_count}</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="ghost" size="icon" className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 w-9 h-9" onClick={() => handleDelete(target.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

      </CardContent>
    </Card>
  );
}
