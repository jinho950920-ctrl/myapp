require('dotenv').config({ path: '.env.local' });
const bcrypt = require('bcrypt');
const qs = require('querystring');
const fs = require('fs');

function getNaverKstStr(d) {
   const kst = new Date(d.getTime() + 9*60*60*1000);
   const iso = kst.toISOString();
   return iso.substring(0, 23) + '+09:00';
}

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
    
    // Scan by strict KST calendar days
    for (let dayOffset = 15; dayOffset >= 0; dayOffset--) {
       const targetDate = new Date();
       targetDate.setHours(0,0,0,0);
       targetDate.setDate(targetDate.getDate() - dayOffset);
       
       const startOfKstDay = new Date(targetDate.getTime() - 9*60*60*1000); // 00:00 KST
       const endOfKstDay = new Date(targetDate.getTime() - 9*60*60*1000 + 24*60*60*1000 - 1); // 23:59:59.999 KST
       
       let fromStr = encodeURIComponent(getNaverKstStr(startOfKstDay));
       let toStr = encodeURIComponent(getNaverKstStr(endOfKstDay));
       
       let morePoint = '';
       let count = 0;
       while(true) {
         let url = `https://api.commerce.naver.com/external/v1/pay-order/seller/product-orders/last-changed-statuses?lastChangedFrom=${fromStr}&lastChangedTo=${toStr}`;
         if (morePoint) url += `&morePoint=${morePoint}`;
         
         const res = await fetch(url, { headers: {'Authorization': `Bearer ${token}`} });
         const statuses = await res.json();
         if (statuses && statuses.data && statuses.data.lastChangeStatuses) {
            statuses.data.lastChangeStatuses.forEach(o => { allOrderIds.add(o.productOrderId); count++; });
            morePoint = statuses.data.morePoint;
            if (!morePoint) break;
         } else {
            break;
         }
       }
       console.log(`[${getNaverKstStr(startOfKstDay)}] 변경건수: ${count}`);
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
    }
    
    fs.writeFileSync('downloads/naver_debug/orders_strict_kst.json', JSON.stringify(details, null, 2));
    
    console.log('\n--- 결제일 기준 결제총액 (배송비 제외) ---');
    const agg = {};
    details.forEach(d => {
       const o = d.productOrder;
       if (!o || o.productOrderStatus === 'CANCELED') return;
       let dateStr = '';
       if (o.paymentDate) dateStr = o.paymentDate.substring(0,10);
       else if (o.placeOrderDate) dateStr = o.placeOrderDate.substring(0,10);
       if (!dateStr) return;
       
       if (!agg[dateStr]) agg[dateStr] = 0;
       const amt = (Number(o.totalPaymentAmount) || 0) - (Number(o.deliveryFeeAmount) || 0);
       agg[dateStr] += amt;
    });
    
    Object.keys(agg).sort().forEach(k => console.log(`${k} | 판매성과액: ${agg[k].toLocaleString()}`));
    
  } catch(e) { console.error('Error:', e); }
}
main();
