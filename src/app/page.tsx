export default function Home() {
  return (
    <div className="flex flex-col gap-6 h-full w-full">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">홈 대시보드</h1>
        <p className="text-muted-foreground mt-2">
          자동화 ERP 시스템이 성공적으로 초기화되었습니다. 좌측 메뉴에서 원하는 모듈을 선택하세요.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-4">
        <div className="rounded-xl border bg-card text-card-foreground shadow pt-6 pb-4 px-6 flex flex-col gap-2">
          <div className="font-semibold leading-none tracking-tight">오늘의 순수익</div>
          <div className="text-2xl font-bold">₩ 0</div>
          <div className="text-xs text-muted-foreground">데이터 연동 대기중</div>
        </div>
        
        <div className="rounded-xl border bg-card text-card-foreground shadow pt-6 pb-4 px-6 flex flex-col gap-2">
          <div className="font-semibold leading-none tracking-tight">발송 대기 주문</div>
          <div className="text-2xl font-bold">0 건</div>
          <div className="text-xs text-muted-foreground">데이터 연동 대기중</div>
        </div>

        <div className="rounded-xl border bg-card text-card-foreground shadow pt-6 pb-4 px-6 flex flex-col gap-2">
          <div className="font-semibold leading-none tracking-tight">미답변 고객문의</div>
          <div className="text-2xl font-bold">0 건</div>
          <div className="text-xs text-muted-foreground">데이터 연동 대기중</div>
        </div>

        <div className="rounded-xl border bg-card text-card-foreground shadow pt-6 pb-4 px-6 flex flex-col gap-2">
          <div className="font-semibold leading-none tracking-tight">자동화 시스템 봇</div>
          <div className="text-xl font-bold text-green-500">정상 작동중</div>
          <div className="text-xs text-muted-foreground">RPA 봇 연동 대기중</div>
        </div>
      </div>
    </div>
  );
}
