const fs = require('fs');
const data = JSON.parse(fs.readFileSync('downloads/naver_debug/orders_10days.json', 'utf8'));

const agg = {};
data.forEach(d => {
  const o = d.productOrder;
  if (!o) return;
  
  let dateStr = '';
  if (o.paymentDate) dateStr = o.paymentDate.substring(0,10);
  else if (o.placeOrderDate) dateStr = o.placeOrderDate.substring(0,10);
  
  if (!dateStr) return;
  
  if (!agg[dateStr]) agg[dateStr] = { payment: 0, cancels: 0, gross: 0 };
  
  // To match typical 'Sales Performance' without refund deduction yet:
  // In Naver, if an order is paid, it counts as Sales.
  // The refund counts against the day the refund happens.
  const amt = (Number(o.totalProductAmount)||0) - (Number(o.productImediateDiscountAmount)||0) - (Number(o.sellerBurdenDiscountAmount)||0);
  // Wait, does '판매성과금액' include delivery fee?
  // Let's print different variants
  const amtWithDelivery = Number(o.totalPaymentAmount) || 0;
  const amtWithoutDelivery = amtWithDelivery - (Number(o.deliveryFeeAmount) || 0);

  agg[dateStr].gross += amtWithoutDelivery; // Assuming Sales Performance doesn't include shipping
});

console.log('--- 취소건 포함 전체 결제내역 산출 ---');
Object.keys(agg).sort().forEach(k => {
   console.log(`${k} | 판매성과예상(배송비제외): ${agg[k].gross.toLocaleString()} | 결제총합(배송비포함): ${agg[k].payment}`);
});
