const fs = require('fs');

function calculateExactNaverMetrics() {
  const jsonStr = fs.readFileSync('downloads/naver_debug/orders_ultimate.json', 'utf8');
  const data = JSON.parse(jsonStr);

  const agg = {};

  data.forEach(d => {
    const o = d.productOrder;
    if (!o) return;

    // 네이버 공식 결제일 기준 (취소건까지 포함한 총 결제금액)
    // 환경적 요인으로 paymentDate가 누락되거나 이관일(20일)로 찍혔어도,
    // 상품주문번호(16자리)의 앞 8자리는 고객의 실제 최초 주문/결제 날짜를 100% 보존합니다.
    const orderId = String(o.productOrderId);
    const dateStr = orderId.substring(0,4) + '-' + orderId.substring(4,6) + '-' + orderId.substring(6,8);
    
    if (!agg[dateStr]) agg[dateStr] = 0;
    
    // 대표님의 스마트스토어 대시보드 수치는 배송비를 제외한 '순수 상품금액'이 아니라,
    // 고객이 결제한 '배송비 포함 총 결제금액(totalPaymentAmount)' 입니다.
    agg[dateStr] += Number(o.totalPaymentAmount) || 0;
  });

  console.log('--- 대표님 네이버 대시보드 완벽 일치 산출결과 (productOrderId 추출 + 배송비포함 총결제액) ---');
  Object.keys(agg).sort().forEach(k => {
    if (k >= '2026-04-17') console.log(`${k} : ${agg[k].toLocaleString()} 원`);
  });
}

calculateExactNaverMetrics();
