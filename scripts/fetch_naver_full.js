require('dotenv').config({ path: '.env.local' });
const bcrypt = require('bcrypt');
const qs = require('querystring');
const fs = require('fs');

async function main() {
  try {
    const rawEnv = process.env.SHOPPING_ACCOUNTS || '[]';
    const cleanEnv = rawEnv.replace(/\\"/g, '"').replace(/^"|"$/g, '');
    const accounts = JSON.parse(cleanEnv);
    const naverAcc = accounts.find(a => a.platform === 'naver');
    
    if (!naverAcc || !naverAcc.key1 || !naverAcc.key2) {
      console.log('네이버 API 키가 없습니다.'); return;
    }
    
    const clientId = naverAcc.key1;
    const clientSecret = naverAcc.key2;
    const timestamp = Date.now().toString();
    const password = `${clientId}_${timestamp}`;
    const hashed = bcrypt.hashSync(password, clientSecret);
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
    
    // We will query day by day for the last 10 days to avoid any undocumented interval limits
    // and we will handle morePoint for pagination.
    for (let day = 10; day >= 1; day--) {
       const today = new Date(); today.setDate(today.getDate() - day + 1);
       const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - day);
       
       let fromStr = yesterday.toISOString();
       let toStr = today.toISOString();
       
       let morePoint = '';
       let dayCount = 0;
       
       while(true) {
         let url = `/v1/pay-order/seller/product-orders/last-changed-statuses?lastChangedFrom=${fromStr}&lastChangedTo=${toStr}`;
         if (morePoint) url += `&morePoint=${morePoint}`;
         
         const statuses = await fetchApi(url);
         if (statuses && statuses.data && statuses.data.lastChangeStatuses) {
            statuses.data.lastChangeStatuses.forEach(o => {
               allOrderIds.add(o.productOrderId);
               dayCount++;
            });
            morePoint = statuses.data.morePoint;
            if (!morePoint) break;
         } else {
            console.log('Error or no data:', statuses);
            break;
         }
         // 천천히 호출
         await new Promise(r => setTimeout(r, 600));
       }
       console.log(`[${fromStr}] ~ [${toStr}] 상태가 변경된 주문 ${dayCount}개 발견.`);
       await new Promise(r => setTimeout(r, 600));
    }

    const orderIdsArr = [...allOrderIds];
    console.log(`\n총 고유 주문건수(productOrderId): ${orderIdsArr.length}개`);
    
    const details = [];
    for(let i=0; i<orderIdsArr.length; i+=50) {
       const chunk = orderIdsArr.slice(i, i+50);
       const res = await fetch(`https://api.commerce.naver.com/external/v1/pay-order/seller/product-orders/query`, {
         method: 'POST', headers: {'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'},
         body: JSON.stringify({ productOrderIds: chunk })
       });
       const data = await res.json();
       if(data && data.data) details.push(...data.data);
       await new Promise(r => setTimeout(r, 600));
    }
    
    fs.writeFileSync('downloads/naver_debug/orders_10days.json', JSON.stringify(details, null, 2));
    
    console.log('\n--- 실제 결제 발생일(주문결제일) 기준 매출 집계 (취소건 제외) ---');
    const totals = {};
    details.forEach(d => {
       const o = d.productOrder;
       if (!o || !o.placeOrderDate) return;
       // We only count orders that are not fully canceled or if we want gross, maybe include all?
       // user says "일별 판매성과금액", often this excludes cancellations or operates on '결제금액'
       if (o.productOrderStatus === 'CANCELED') return;
       
       const dStr = o.placeOrderDate.substring(0, 10);
       if(!totals[dStr]) totals[dStr] = 0;
       totals[dStr] += Number(o.totalPaymentAmount) || 0;
    });
    
    Object.keys(totals).sort().forEach(date => {
       console.log(`${date} | 일매출: ${totals[date].toLocaleString()}`);
    });
    
  } catch(e) { console.error('Error:', e); }
}
main();
