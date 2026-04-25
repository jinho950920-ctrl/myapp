"use client";

import { useEffect, useState } from "react";
import { AlertCircle, RefreshCw, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getWingStatus, triggerWingLogin } from "@/app/actions/scraperActions";
import { toast } from "sonner";

export function Wing2faAlert() {
  const [requires2FA, setRequires2FA] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const checkStatus = async () => {
    try {
      const status = await getWingStatus();
      setRequires2FA(status?.requires2FA || false);
      setLastChecked(status?.lastChecked || null);
    } catch (e) {}
  };

  const handleTriggerLogin = async () => {
    setLoading(true);
    toast.info("자동 로그인 인스턴스를 시작합니다. 잠시 후 창이 열리면 인증을 진행해 주세요!");
    try {
      const res = await triggerWingLogin();
      if (!res.success) toast.error("스크립트 실행 실패: " + res.error);
      else setTimeout(checkStatus, 15000);
    } catch (e) {
      toast.error("연결 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (!requires2FA) return null;

  return (
    <div className="mb-6 rounded-lg border p-4 bg-rose-50 border-rose-200 shadow-sm flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-rose-600" />
        <h5 className="text-rose-800 font-bold text-lg">쿠팡 윙 2단계 보안 인증 갱신 필요!</h5>
      </div>
      <div className="text-rose-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <span className="text-sm">
          쿠팡 윙 판매자 센터의 자동 로그인 세션(쿠키)이 만료되었거나 보안 인증을 요구하고 있습니다. 
          정상적인 <strong>일일 매출 데이터 자동 동기화</strong>를 위해 직접 인증을 진행하여 세션을 연장해 주십시오.
          {lastChecked && <span className="block text-xs mt-1.5 font-semibold opacity-70">마지막 감지: {new Date(lastChecked).toLocaleString()}</span>}
        </span>
        <Button 
          onClick={handleTriggerLogin} 
          disabled={loading}
          className="bg-rose-600 hover:bg-rose-700 text-white shrink-0 shadow-sm"
        >
          {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
          직접 보안 인증(2FA) 해결하기
        </Button>
      </div>
    </div>
  );
}
