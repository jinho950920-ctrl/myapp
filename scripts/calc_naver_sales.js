const fs = require('fs');
const data = JSON.parse(fs.readFileSync('downloads/naver_debug/orders.json', 'utf8'));

const map = new Map();

data.forEach(d => {
  const o = d.productOrder;
  if (!o || !o.placeOrderDate) return;
  const dateStr = o.placeOrderDate.substring(0, 10);
  
  if (!map.has(dateStr)) {
     map.set(dateStr, { count: 0, sum: 0, cancelSum: 0 });
  }
  
  const t = map.get(dateStr);
  const amt = Number(o.totalPaymentAmount) || 0;
  
  t.count++;
  if(o.productOrderStatus === 'CANCELED') {
    t.cancelSum += amt;
  } else {
    t.sum += amt;
  }
});

console.log('=== 네이버 스토어 일 매출 (주문 들어온 날짜 기준) ===');
[...map.keys()].sort().forEach(k => {
  const t = map.get(k);
  console.log(`${k} | 주문건수: ${t.count}건 | 누적매출액 (건당 상품 결제액): ${t.sum.toLocaleString()}원 | 취소액: ${t.cancelSum.toLocaleString()}원`);
});
