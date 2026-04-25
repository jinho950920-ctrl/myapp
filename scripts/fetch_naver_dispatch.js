require('dotenv').config({ path: '.env.local' });
const bcrypt = require('bcrypt');
const qs = require('querystring');
const fs = require('fs');

async function main() {
  try {
    const rawEnv = process.env.SHOPPING_ACCOUNTS || '[]';
    const accounts = JSON.parse(rawEnv.replace(/\\"/g, '"').replace(/^"|"$/g, ''));
    const naverAcc = accounts.find(a => a.platform === 'naver');
    if (!naverAcc) return console.log('Account not found');

    const clientId = naverAcc.key1;
    const clientSecret = naverAcc.key2;
    const timestamp = Date.now().toString();
    const hashed = bcrypt.hashSync(`${clientId}_${timestamp}`, clientSecret);
    const clientSecretSign = Buffer.from(hashed, 'utf-8').toString('base64');

    const tokenRes = await fetch('https://api.commerce.naver.com/external/v1/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: qs.stringify({ client_id: clientId, timestamp, client_secret_sign: clientSecretSign, grant_type: 'client_credentials', type: 'SELF' })
    });
    const token = (await tokenRes.json()).access_token;
    
    console.log('Fetching dispatch targets (결제완료(발송대기) 상태인 모든 주문 조회)...');
    
    // 발송 대상(결제완료 상태) 주문 내역 조회 (아직 발송처리 안된 모든 건)
    const url = `https://api.commerce.naver.com/external/v1/pay-order/seller/product-orders/dispatch-target`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) return console.log('API Error:', res.status, await res.text());
    
    const data = await res.json();
    let orderIds = [];
    if (data && data.data) {
       orderIds = data.data.map(o => o.productOrderId);
    }
    console.log(`발송 대기중인 전체 주문건수: ${orderIds.length}건`);
    
    const details = [];
    for (let i = 0; i < orderIds.length; i += 50) {
      const chunk = orderIds.slice(i, i + 50);
      const qRes = await fetch(`https://api.commerce.naver.com/external/v1/pay-order/seller/product-orders/query`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ productOrderIds: chunk })
      });
      const qData = await qRes.json();
      if (qData && qData.data) details.push(...qData.data);
    }
    
    fs.writeFileSync('downloads/naver_debug/orders_dispatch_targets.json', JSON.stringify(details, null, 2));
    
    const aggPayment = {};
    details.forEach(d => {
      const o = d.productOrder;
      if (!o) return;
      if (o.productOrderStatus === 'CANCELED') return;
      
      let pDate = '';
      if (o.paymentDate) pDate = o.paymentDate.substring(0, 10);
      else if (o.placeOrderDate) pDate = o.placeOrderDate.substring(0, 10);
      
      if (!pDate) return;
      if (!aggPayment[pDate]) aggPayment[pDate] = 0;

      const amt = (Number(o.totalPaymentAmount) || 0) - (Number(o.deliveryFeeAmount) || 0);
      aggPayment[pDate] += amt;
    });

    console.log('\n--- 발송대기 건들의 결제일 기준 합산 ---');
    Object.keys(aggPayment).sort().forEach(k => console.log(`${k}: ${aggPayment[k].toLocaleString()}원`));
    
  } catch (e) { console.error('Script Error:', e); }
}
main();
