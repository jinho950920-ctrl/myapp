require('dotenv').config({ path: '.env.local' });
const bcrypt = require('bcrypt');
const qs = require('querystring');
const fs = require('fs');

async function main() {
  try {
    const rawEnv = process.env.SHOPPING_ACCOUNTS || '[]';
    const accounts = JSON.parse(rawEnv.replace(/\\"/g, '"').replace(/^"|"$/g, ''));
    const naverAcc = accounts.find(a => a.platform === 'naver');
    
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
    
    const fetchApi = async (uri) => {
      const res = await fetch(`https://api.commerce.naver.com/external${uri}`, {
        method: 'GET', headers: {'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'}
      });
      return await res.json();
    };

    let allOrderIds = new Set();
    const statusTypes = ['PAY_WAITING', 'PAYED', 'DISPATCHED', 'PURCHASE_DECIDED', 'CANCELED', 'EXCHANGE_OPTION', 'DELIVERY_ADDRESS_CHANGED'];
    
    for (const st of statusTypes) {
       for (let day = 8; day >= 1; day--) {
          const today = new Date(); today.setDate(today.getDate() - day + 1);
          const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - day);
          
          let fromStr = yesterday.toISOString();
          let toStr = today.toISOString();
          
          let morePoint = '';
          while(true) {
            let url = `/v1/pay-order/seller/product-orders/last-changed-statuses?lastChangedFrom=${fromStr}&lastChangedTo=${toStr}&lastChangedType=${st}`;
            if (morePoint) url += `&morePoint=${morePoint}`;
            
            const statuses = await fetchApi(url);
            if (statuses && statuses.data && statuses.data.lastChangeStatuses) {
               statuses.data.lastChangeStatuses.forEach(o => allOrderIds.add(o.productOrderId));
               morePoint = statuses.data.morePoint;
               if (!morePoint) break;
            } else {
               break;
            }
          }
       }
       console.log(`Finished fetching status ${st}`);
    }

    const orderIdsArr = [...allOrderIds];
    console.log(`총 고유 주문건수(productOrderId): ${orderIdsArr.length}개`);
    
    const details = [];
    for(let i=0; i<orderIdsArr.length; i+=50) {
       const chunk = orderIdsArr.slice(i, i+50);
       const res = await fetch(`https://api.commerce.naver.com/external/v1/pay-order/seller/product-orders/query`, {
         method: 'POST', headers: {'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'},
         body: JSON.stringify({ productOrderIds: chunk })
       });
       const data = await res.json();
       if(data && data.data) details.push(...data.data);
    }
    
    fs.writeFileSync('downloads/naver_debug/orders_explicit_statuses.json', JSON.stringify(details, null, 2));
    
    const agg = {};
    details.forEach(d => {
       const o = d.productOrder;
       if (!o) return;
       // 결제완료 기준
       let dateStr = '';
       if (o.paymentDate) dateStr = o.paymentDate.substring(0,10);
       else if (o.placeOrderDate) dateStr = o.placeOrderDate.substring(0,10);
       if (!dateStr) return;
       if (!agg[dateStr]) agg[dateStr] = 0;
       
       const amtWithDelivery = Number(o.totalPaymentAmount) || 0;
       const amtWithoutDelivery = amtWithDelivery - (Number(o.deliveryFeeAmount) || 0);

       // Naver '판매성과' usually excludes canceled if they are fully canceled before deciding.
       // However, to debug, we will show Gross Payment Total excluding delivery
       agg[dateStr] += amtWithoutDelivery;
    });
    
    console.log('--- 각 상태별(결제완료, 배송완료 등) 강제 명시 순차 조회 결과 ---');
    Object.keys(agg).sort().forEach(k => console.log(`${k} | 판매성과예상액: ${agg[k].toLocaleString()}`));
    
  } catch(e) { console.error('Error:', e); }
}
main();
