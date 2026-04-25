import dotenv from 'dotenv';
import path from 'path';
import qs from 'querystring';
import bcrypt from 'bcrypt';
import { query } from '../src/lib/db';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getNaverKstStr(date: Date) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const iso = kst.toISOString();
  return iso.substring(0, 23) + '+09:00';
}

async function syncNaverSales() {
  console.log("🚀 Starting Naver Sales Sync...");
  try {
    const rawEnv = process.env.SHOPPING_ACCOUNTS || '[]';
    const accounts = JSON.parse(rawEnv.replace(/\\"/g, '"').replace(/^"|"$/g, ''));
    const naverAcc = accounts.find((a: any) => a.platform === 'naver');
    if (!naverAcc) {
      console.log('❌ Naver account credentials not found in SHOPPING_ACCOUNTS');
      process.exit(1);
    }

    const clientId = naverAcc.key1;
    const clientSecret = naverAcc.key2;
    const accountAlias = naverAcc.alias || '네이버 온하인';

    const timestamp = Date.now().toString();
    const hashed = bcrypt.hashSync(`${clientId}_${timestamp}`, clientSecret);
    const clientSecretSign = Buffer.from(hashed, 'utf-8').toString('base64');

    console.log("🔐 Requesting Access Token...");
    const tokenRes = await fetch('https://api.commerce.naver.com/external/v1/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: qs.stringify({ client_id: clientId, timestamp, client_secret_sign: clientSecretSign, grant_type: 'client_credentials', type: 'SELF' })
    });
    const tokenData = await tokenRes.json();
    const token = tokenData.access_token;
    if (!token) {
      console.error('❌ Token issue failed:', tokenData);
      process.exit(1);
    }

    let allOrderIds = new Set<string>();
    const toDate = new Date();
    let currentFrom = new Date(toDate.getTime() - 10 * 24 * 60 * 60 * 1000); // Past 10 days

    console.log(`📅 Polling data from ${currentFrom.toISOString()} to ${toDate.toISOString()} (12-hour windows)`);

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
           console.log('⚠️ HTTP ERR fetching statuses:', res.status, await res.text());
           break;
        }
        
        const statuses = await res.json();
        if (statuses.data && statuses.data.lastChangeStatuses) {
          statuses.data.lastChangeStatuses.forEach((o: any) => allOrderIds.add(o.productOrderId));
          morePoint = statuses.data.morePoint;
          if (!morePoint) break;
        } else {
          break;
        }
        await sleep(500); // avoid 429 Limit
      }
      currentFrom = effectiveTo;
      await sleep(500);
    }

    const idList = Array.from(allOrderIds);
    console.log(`📦 Found ${idList.length} total specific Product Order IDs`);

    if (idList.length === 0) {
      console.log('✅ No orders found. Sync completed.');
      process.exit(0);
    }

    const details: any[] = [];
    for (let i = 0; i < idList.length; i += 50) {
      const chunk = idList.slice(i, i + 50);
      const res = await fetch(`https://api.commerce.naver.com/external/v1/pay-order/seller/product-orders/query`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ productOrderIds: chunk })
      });
      const data = await res.json();
      if (data && data.data) details.push(...data.data);
      await sleep(500);
    }

    console.log(`📊 Processing ${details.length} order details for DB Upsert...`);
    
    let successCount = 0;
    let errorCount = 0;

    for (const d of details) {
      const o = d.productOrder;
      if (!o) continue;
      
      const pOrderId = String(o.productOrderId);
      if (!pOrderId || pOrderId.length < 8) continue;
      
      // ✅ 2026-04-24 트러블슈팅 반영 로직: 서버 paymentDate 이슈 대응
      // 상품주문번호 앞 8자리가 고객의 진짜 결제/주문일
      const yyyy = pOrderId.substring(0,4);
      const mm = pOrderId.substring(4,6);
      const dd = pOrderId.substring(6,8);
      const orderDate = `${yyyy}-${mm}-${dd}`;

      const productId = o.productId || '';
      const optionCode = o.productOptionId || '';
      const productName = o.productName || '';
      const optionName = o.productOptionName || '';
      const orderStatus = o.productOrderStatus || '';
      
      const totalPaymentAmt = Number(o.totalPaymentAmount) || 0;
      const deliveryFeeAmt = Number(o.deliveryFeeAmount) || 0;
      const quantity = Number(o.quantity) || 0;

      try {
        await query(`
          INSERT INTO naver_sales (
            product_order_id, date, account_alias, product_id, option_code,
            product_name, option_name, total_payment_amount, delivery_fee_amount, order_status, quantity
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (product_order_id) DO UPDATE SET
            date = EXCLUDED.date,
            product_id = EXCLUDED.product_id,
            option_code = EXCLUDED.option_code,
            product_name = EXCLUDED.product_name,
            option_name = EXCLUDED.option_name,
            total_payment_amount = EXCLUDED.total_payment_amount,
            delivery_fee_amount = EXCLUDED.delivery_fee_amount,
            order_status = EXCLUDED.order_status,
            quantity = EXCLUDED.quantity,
            updated_at = CURRENT_TIMESTAMP
        `, [
          pOrderId, orderDate, accountAlias, productId, optionCode,
          productName, optionName, totalPaymentAmt, deliveryFeeAmt, orderStatus, quantity
        ]);
        successCount++;
      } catch (err: any) {
        console.error(`❌ DB Upsert Error for Order ${pOrderId}:`, err.message);
        errorCount++;
      }
    }

    console.log(`🎉 Sync Completed! (Success: ${successCount}, Errors: ${errorCount})`);
    process.exit(0);

  } catch (err: any) {
    console.error('❌ Critical Script Error:', err);
    process.exit(1);
  }
}

syncNaverSales();
