"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Settings, Lock, Plus, Save, Trash2, ShieldCheck, EyeOff, Eye, Upload, FileSpreadsheet, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Account {
  id: string;
  alias: string;
  platform: "coupang" | "naver";
  loginId?: string;
  loginPw?: string;
  key1?: string; // Vendor ID / Client ID
  key2?: string; // Access Key / Client Secret
  key3?: string; // Secret Key (Coupang only)
}

interface UploadResult {
  message: string;
  success: number;
  fail: number;
  total: number;
  error?: string;
}

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState<Record<string, boolean>>({});
  // Upload state
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [uploadResults, setUploadResults] = useState<Record<string, UploadResult>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    fetch('/api/settings/accounts')
      .then(r => r.json())
      .then(data => {
        if (data.accounts) setAccounts(data.accounts);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handleAdd = () => {
    const newAccount: Account = {
      id: Date.now().toString(),
      alias: `새 스토어 ${accounts.length + 1}`,
      platform: "coupang",
      loginId: "",
      loginPw: "",
      key1: "",
      key2: "",
      key3: ""
    };
    setAccounts([...accounts, newAccount]);
  };

  const handleRemove = (id: string) => {
    setAccounts(accounts.filter(a => a.id !== id));
  };

  const handleChange = (id: string, field: keyof Account, value: string) => {
    setAccounts(accounts.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accounts })
      });
      if (res.ok) {
        alert("계정 정보가 서버의 .env.local 캐시에 안전하게 암호화되어 동기화되었습니다.");
      } else {
        alert("저장에 실패했습니다.");
      }
    } catch (e) {
      alert("Error saving: " + e);
    }
    setSaving(false);
  };

  const toggleShowPw = (id: string) => {
    setShowPw(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // 수동 업로드 핸들러
  const handleUpload = async (accountAlias: string, type: 'sales' | 'ads', file: File, reportDate: string) => {
    const key = `${accountAlias}_${type}`;
    setUploadingKey(key);
    setUploadResults(prev => { const n = {...prev}; delete n[key]; return n; });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    formData.append('accountAlias', accountAlias);
    formData.append('reportDate', reportDate);

    try {
      const res = await fetch('/api/upload/coupang', { method: 'POST', body: formData });
      const data = await res.json();
      setUploadResults(prev => ({ ...prev, [key]: data }));
    } catch (e: any) {
      setUploadResults(prev => ({ ...prev, [key]: { message: '', success: 0, fail: 0, total: 0, error: e.message } }));
    }
    setUploadingKey(null);
  };

  // KST 기준 어제 날짜
  const getYesterday = () => {
    const now = new Date();
    const kst = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    kst.setDate(kst.getDate() - 1);
    return kst.toISOString().slice(0, 10);
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 max-w-7xl mx-auto h-full animate-in fade-in">
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Settings className="w-8 h-8 text-slate-500" /> 설정 및 전체 연동 관리
          </h1>
          <p className="text-muted-foreground flex items-center gap-2">
            다중 쇼핑몰 계정(본캐/부캐) 및 API 통합 인증 정보를 관리하며 보안 저장소(.env.local)에 즉시 컴파일됩니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleAdd} className="font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50">
            <Plus className="w-4 h-4 mr-2" /> 새 스토어 식별자 추가
          </Button>
          <Button onClick={handleSave} disabled={saving || loading} className="bg-slate-800 hover:bg-slate-900 text-white font-bold shadow-md">
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"/> : <Save className="w-4 h-4 mr-2" />} 
            전체 환경 변수 동기화 
          </Button>
        </div>
      </div>

      <div className="grid gap-6 max-w-5xl">
        
        {loading ? (
          <div className="flex flex-col gap-4">
            <div className="w-full h-40 bg-slate-100 animate-pulse rounded-xl"></div>
          </div>
        ) : accounts.length === 0 ? (
          <div className="p-12 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-slate-400 bg-slate-50">
            <ShieldCheck className="w-12 h-12 mb-3 text-slate-300" />
            <p className="font-medium text-lg text-slate-500">등록된 스토어 연동 정보가 없습니다.</p>
            <p className="text-sm mt-1 mb-4">새 스토어를 추가하여 쇼핑몰 데이터 수집 플러그인을 활성화하세요.</p>
            <Button onClick={handleAdd} className="bg-indigo-600 hover:bg-indigo-700">추가하기</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {accounts.map((acc, index) => (
              <Card key={acc.id} className="shadow-sm border-slate-200 overflow-hidden relative">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
                <CardHeader className="bg-slate-50/50 pb-3 border-b flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-black">{index + 1}</span>
                    <input 
                      type="text" 
                      className="text-lg font-bold bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none transition-colors px-1"
                      value={acc.alias}
                      onChange={(e) => handleChange(acc.id, 'alias', e.target.value)}
                      placeholder="스토어 별칭 (예: 컴퍼니 A 본캐)"
                    />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleRemove(acc.id)} className="text-rose-400 hover:text-rose-600 hover:bg-rose-50">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardHeader>
                <CardContent className="p-5 bg-white grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  
                  {/* Left Column: Platform & Login Profile */}
                  <div className="flex flex-col gap-4">
                    <h3 className="font-bold text-slate-800 border-b pb-2 text-sm flex items-center gap-2">단순 로그인 (Web Macro)</h3>
                    <div className="grid gap-2">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">플랫폼 지정</label>
                      <select 
                        className="px-3 py-2 border rounded-md text-sm bg-slate-50 font-bold text-slate-700 shadow-sm focus:ring-1 focus:ring-indigo-500"
                        value={acc.platform}
                        onChange={(e) => handleChange(acc.id, 'platform', e.target.value as "coupang" | "naver")}
                      >
                        <option value="coupang">쿠팡 (Coupang Wing)</option>
                        <option value="naver">네이버 커머스 (SmartStore)</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-2">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">웹 아이디</label>
                        <input type="text" value={acc.loginId} onChange={(e) => handleChange(acc.id, 'loginId', e.target.value)} className="px-3 py-2 border rounded-md text-sm bg-white shadow-sm" placeholder="ID" />
                      </div>
                      <div className="grid gap-2">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">비밀번호</label>
                        <div className="relative">
                          <input type={showPw[acc.id] ? "text" : "password"} value={acc.loginPw} onChange={(e) => handleChange(acc.id, 'loginPw', e.target.value)} className="px-3 py-2 border rounded-md text-sm bg-white shadow-sm w-full font-mono" placeholder="Password" />
                          <button onClick={() => toggleShowPw(acc.id)} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600">
                            {showPw[acc.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: API Keys */}
                  <div className="flex flex-col gap-4">
                    <h3 className="font-bold text-indigo-900 border-b pb-2 text-sm flex items-center gap-2">공식 {acc.platform === 'coupang' ? '오픈API 연동 패스 (Wing)' : '커머스API 발급 정보'}</h3>
                    {acc.platform === 'coupang' ? (
                      <div className="grid gap-3">
                        <div className="grid gap-2">
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Vendor ID</label>
                          <input type="text" value={acc.key1} onChange={(e) => handleChange(acc.id, 'key1', e.target.value)} className="px-3 py-1.5 border rounded-md text-sm bg-slate-50 font-mono shadow-sm" placeholder="ex. A0012345" />
                        </div>
                        <div className="grid gap-2">
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">OpenAPI Access Key</label>
                          <input type="text" value={acc.key2} onChange={(e) => handleChange(acc.id, 'key2', e.target.value)} className="px-3 py-1.5 border rounded-md text-sm bg-white font-mono shadow-sm" placeholder="Access Key" />
                        </div>
                        <div className="grid gap-2">
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">OpenAPI Secret Key</label>
                          <input type="password" value={acc.key3} onChange={(e) => handleChange(acc.id, 'key3', e.target.value)} className="px-3 py-1.5 border rounded-md text-sm bg-slate-800 text-white font-mono shadow-sm placeholder:text-slate-500" placeholder="Secret Key (HMAC256)" />
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        <div className="grid gap-2">
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Client ID</label>
                          <input type="text" value={acc.key1} onChange={(e) => handleChange(acc.id, 'key1', e.target.value)} className="px-3 py-1.5 border rounded-md text-sm bg-slate-50 font-mono shadow-sm" placeholder="ex. xxxxxxxx_xxxx" />
                        </div>
                        <div className="grid gap-2">
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Client Secret (Bcrypt)</label>
                          <input type="password" value={acc.key2} onChange={(e) => handleChange(acc.id, 'key2', e.target.value)} className="px-3 py-1.5 border border-indigo-200 rounded-md text-sm bg-indigo-50 text-indigo-900 font-mono shadow-sm placeholder:text-indigo-300" placeholder="Client Secret" />
                        </div>
                        <div className="p-2 bg-amber-50 rounded border border-amber-100 text-xs text-amber-700 font-medium">네이버 커머스 API는 보안 서명 발급을 위해 Client ID와 Secret 조합이 필수입니다.</div>
                      </div>
                    )}
                  </div>
                  
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ✅ 수동 업로드 카드 */}
        {!loading && accounts.filter(a => a.platform === 'coupang').length > 0 && (
          <Card className="shadow-sm mt-2 border-blue-200 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-cyan-500 to-emerald-500"></div>
            <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 pb-4 border-b">
              <CardTitle className="text-blue-900 flex items-center gap-2">
                <Upload className="w-5 h-5" /> 쿠팡 엑셀 수동 업로드
              </CardTitle>
              <CardDescription>자동화 봇이 실패했을 때 쿠팡 윙에서 직접 다운로드한 엑셀 파일을 여기에 업로드하여 DB에 반영합니다.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 bg-white space-y-6">
              {accounts.filter(a => a.platform === 'coupang').map(acc => (
                <div key={acc.id} className="border rounded-xl p-5 bg-slate-50/50 space-y-4">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                    {acc.alias}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 매출 엑셀 업로드 */}
                    <UploadBox
                      label="📊 매출 엑셀"
                      description="판매분석 → 엑셀 다운로드"
                      type="sales"
                      accountAlias={acc.alias}
                      uploading={uploadingKey === `${acc.alias}_sales`}
                      result={uploadResults[`${acc.alias}_sales`]}
                      onUpload={handleUpload}
                      fileInputRef={(el) => { fileInputRefs.current[`${acc.alias}_sales`] = el; }}
                    />
                    {/* 광고비 엑셀 업로드 */}
                    <UploadBox
                      label="💰 광고비 엑셀"
                      description="맞춤보고서 → 엑셀 다운로드"
                      type="ads"
                      accountAlias={acc.alias}
                      uploading={uploadingKey === `${acc.alias}_ads`}
                      result={uploadResults[`${acc.alias}_ads`]}
                      onUpload={handleUpload}
                      fileInputRef={(el) => { fileInputRefs.current[`${acc.alias}_ads`] = el; }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className="shadow-sm mt-4 border-emerald-200">
          <CardHeader className="bg-emerald-50/50 pb-4 border-b">
            <CardTitle className="text-emerald-900">데이터베이스 접근 권한</CardTitle>
            <CardDescription>현재 시스템의 마스터 데이터 쓰기 권한이 완전히 해제되었습니다.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 bg-white space-y-4">
            <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-100 rounded-lg">
              <div>
                <h3 className="font-bold text-emerald-800 flex items-center gap-2"><ShieldCheck className="w-4 h-4"/> 자사 상품 쓰기/수정/매핑 권한 활성화됨</h3>
                <p className="text-sm text-emerald-600 mt-1">대시보드 UI를 통해 수동으로 제어하고 데이터를 생성할 수 있습니다.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// UploadBox 컴포넌트
function UploadBox({ label, description, type, accountAlias, uploading, result, onUpload, fileInputRef }: {
  label: string;
  description: string;
  type: 'sales' | 'ads';
  accountAlias: string;
  uploading: boolean;
  result?: UploadResult;
  onUpload: (alias: string, type: 'sales' | 'ads', file: File, date: string) => void;
  fileInputRef: (el: HTMLInputElement | null) => void;
}) {
  const [date, setDate] = useState(() => {
    const now = new Date();
    const kst = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    kst.setDate(kst.getDate() - 1);
    return kst.toISOString().slice(0, 10);
  });
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(accountAlias, type, file, date);
      e.target.value = ''; // 같은 파일 재업로드 허용
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow space-y-3">
      <div>
        <p className="font-bold text-sm text-slate-800">{label}</p>
        <p className="text-xs text-slate-400">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-[11px] font-bold text-slate-500">기준 날짜:</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-2 py-1 border rounded text-xs bg-slate-50 font-mono"
        />
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFileSelect}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="w-full border-blue-200 text-blue-700 hover:bg-blue-50 font-bold"
      >
        {uploading ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 업로드 중...</>
        ) : (
          <><Upload className="w-4 h-4 mr-2" /> 엑셀 파일 선택 및 업로드</>
        )}
      </Button>
      {result && (
        <div className={`p-2.5 rounded-lg text-xs font-medium ${result.error ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {result.error ? (
            <span className="flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> 에러: {result.error}</span>
          ) : (
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {result.message} (성공 {result.success}건 / 실패 {result.fail}건)</span>
          )}
        </div>
      )}
    </div>
  );
}
