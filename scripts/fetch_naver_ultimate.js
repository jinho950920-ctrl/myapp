require('dotenv').config({ path: '.env.local' });
const qs = require('querystring');
const bcrypt = require('bcrypt');
const fs = require('fs');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function getNaverKstStr(date) {
  // Convert UTC date to KST date string: 'YYYY-MM-DDTHH:mm:ss.SSS+09:00'
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const iso = kst.toISOString();
  return iso.substring(0, 23) + '+09:00';
}

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
    const tokenData = await tokenRes.json();
    const token = tokenData.access_token;
    if (!token) return console.log('Token failed', tokenData);

    let allOrderIds = new Set();
    const toDate = new Date(); // now
    let currentFrom = new Date(toDate.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

    console.log(`fetching from ${currentFrom.toISOString()} to ${toDate.toISOString()}`);

    // Loop exactly 12 hours apart to safely cover everything without dropping data
    while (currentFrom < toDate) {
      const currentTo = new Date(currentFrom.getTime() + 12 * 60 * 60 * 1000);
      const effectiveTo = currentTo > toDate ? toDate : currentTo;

      const fromStr = encodeURIComponent(getNaverKstStr(currentFrom));
      const toStr = encodeURIComponent(getNaverKstStr(effectiveTo));

      let morePoint = '';
      while (true) {
        let url = `https://api.commerce.naver.com/external/v1/pay-order/seller/product-orders/last-changed-statuses?lastChangedFrom=${fromStr}&lastChangedTo=${toStr}`;
        if (morePoint) url += `&morePoint=${morePoint}`;

        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) {
           console.log('HTTP ERR', res.status, await res.text());
           break;
        }
        
        const statuses = await res.json();
        if (statuses.data && statuses.data.lastChangeStatuses) {
          statuses.data.lastChangeStatuses.forEach(o => allOrderIds.add(o.productOrderId));
          morePoint = statuses.data.morePoint;
          if (!morePoint) break;
        } else {
          break;
        }
        await sleep(1000); // Super slow to avoid 429
      }
      currentFrom = effectiveTo;
      await sleep(1000);
    }

    const idList = [...allOrderIds];
    console.log('Total specific Order IDs:', idList.length);

    const details = [];
    for (let i = 0; i < idList.length; i += 50) {
      const chunk = idList.slice(i, i + 50);
      const res = await fetch(`https://api.commerce.naver.com/external/v1/pay-order/seller/product-orders/query`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ productOrderIds: chunk })
      });
      const data = await res.json();
      if (data && data.data) details.push(...data.data);
      await sleep(1000);
    }

    fs.writeFileSync('downloads/naver_debug/orders_ultimate.json', JSON.stringify(details, null, 2));

    const aggPayment = {};
    details.forEach(d => {
      const o = d.productOrder;
      if (!o) return;
      if (o.productOrderStatus === 'CANCELED') return; // To match gross
      
      let pDate = '';
      if (o.paymentDate) pDate = o.paymentDate.substring(0, 10);
      else if (o.placeOrderDate) pDate = o.placeOrderDate.substring(0, 10);
      
      if (!pDate) return;
      if (!aggPayment[pDate]) aggPayment[pDate] = 0;

      // Net Sales (결제금액 - 배송비)
      const amt = (Number(o.totalPaymentAmount) || 0) - (Number(o.deliveryFeeAmount) || 0);
      aggPayment[pDate] += amt;
    });

    console.log('--- 결제일 기준 (취소 제외, 순상품결제액) ---');
    Object.keys(aggPayment).sort().forEach(k => console.log(`${k}: ${aggPayment[k]}`));
    
    // Also try checking Order Statuses that were NEVER retrieved!
    console.log('Verification Complete.');

  } catch (e) { console.error('Script Error:', e); }
}
main();
