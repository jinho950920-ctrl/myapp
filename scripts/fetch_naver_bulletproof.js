require('dotenv').config({ path: '.env.local' });
const bcrypt = require('bcrypt');
const qs = require('querystring');
const fs = require('fs');

async function main() {
  try {
    const rawEnv = process.env.SHOPPING_ACCOUNTS || '[]';
    const accounts = JSON.parse(rawEnv.replace(/\\"/g, '"').replace(/^"|"$/g, ''));
    const naverAcc = accounts.find(a => a.platform === 'naver');
    
    if (!naverAcc || !naverAcc.key1 || !naverAcc.key2) return;
    
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
    
    let allOrderIds = new Set();
    
    // We will do exact KST formatting: YYYY-MM-DDTHH:mm:ss.SSS+09:00
    // And loop by 6 hours instead of 24h to avoid hitting inner limits implicitly
    for (let hOffset = 0; hOffset < 15 * 24; hOffset += 12) {
       const endTime = new Date(Date.now() - hOffset * 60 * 60 * 1000);
       const startTime = new Date(endTime.getTime() - 12 * 60 * 60 * 1000); // 12 hours window loop
       
       const getKstStr = (d) => {
          const kst = new Date(d.getTime() + 9*3600*1000);
          return kst.toISOString().substring(0, 23) + '+09:00';
       };
       
       const fromStr = encodeURIComponent(getKstStr(startTime));
       const toStr = encodeURIComponent(getKstStr(endTime));
       
       let morePoint = '';
       while(true) {
         let url = `https://api.commerce.naver.com/external/v1/pay-order/seller/product-orders/last-changed-statuses?lastChangedFrom=${fromStr}&lastChangedTo=${toStr}`;
         if (morePoint) url += `&morePoint=${morePoint}`;
         
         const res = await fetch(url, { headers: {'Authorization': `Bearer ${token}`} });
         if(!res.ok) {
            console.log(`Error calling Naver API: ${res.status}`);
            break;
         }
         const statuses = await res.json();
         if (statuses && statuses.data && statuses.data.lastChangeStatuses) {
            statuses.data.lastChangeStatuses.forEach(o => allOrderIds.add(o.productOrderId));
            morePoint = statuses.data.morePoint;
            if (!morePoint) break;
         } else {
            break; // no data or error
         }
         await new Promise(r => setTimeout(r, 400));
       }
       await new Promise(r => setTimeout(r, 400));
    }

    const orderIdsArr = [...allOrderIds];
    
    const details = [];
    for(let i=0; i<orderIdsArr.length; i+=50) {
       const chunk = orderIdsArr.slice(i, i+50);
       const res = await fetch(`https://api.commerce.naver.com/external/v1/pay-order/seller/product-orders/query`, {
         method: 'POST', headers: {'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'},
         body: JSON.stringify({ productOrderIds: chunk })
       });
       const data = await res.json();
       if(data && data.data) details.push(...data.data);
       await new Promise(r => setTimeout(r, 300));
    }
    
    const agg = {};
    details.forEach(d => {
       const o = d.productOrder;
       if (!o || o.productOrderStatus === 'CANCELED') return;
       // 결제일기준
       let dateStr = '';
       if (o.paymentDate) dateStr = o.paymentDate.substring(0,10);
       else if (o.placeOrderDate) dateStr = o.placeOrderDate.substring(0,10);
       else return;
       
       if (!agg[dateStr]) agg[dateStr] = 0;
       
       // 판매분석 - 일별 판매성과금액은 대체로 '결제금액 - 배송비' 또는 '원가 - 즉시할인'.
       // 네이버 공식: 기본적으로 "결제금액" 기준에서 배송비는 제외된 상품결제액을 판매성과로 봄.
       const netAmt = (Number(o.totalPaymentAmount) || 0) - (Number(o.deliveryFeeAmount) || 0);
       agg[dateStr] += netAmt;
    });
    
    console.log('--- 네이버 총 결제일 기준 판매성과 통합 덤프 ---');
    console.log(`총 수집 주문건수: ${details.length} 개 (최근 15일 이내 상태변경건 전부 조회)`);
    Object.keys(agg).sort().forEach(k => {
       if (k >= '2026-04-17') console.log(`${k} | 판매금액산출: ${agg[k].toLocaleString()}`);
    });
    
  } catch(e) { console.error('Error:', e); }
}
main();
