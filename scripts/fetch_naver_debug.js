require('dotenv').config({ path: '.env.local' });
const bcrypt = require('bcrypt');
const qs = require('querystring');
const fs = require('fs');
const path = require('path');

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
    
    const fetchApi = async (method, uri, body) => {
      const res = await fetch(`https://api.commerce.naver.com/external${uri}`, {
        method, headers: {'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json'},
        body: body ? JSON.stringify(body) : undefined
      });
      return await res.json();
    };

    // 7일 전부터 지금까지
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const fromStr = d.toISOString();
    
    console.log(`fetching changed orders from ${fromStr}...`);
    const statuses = await fetchApi('GET', `/v1/pay-order/seller/product-orders/last-changed-statuses?lastChangedFrom=${fromStr}`);
    
    let productOrderIds = [];
    if (statuses && statuses.data && statuses.data.lastChangeStatuses) {
        productOrderIds = statuses.data.lastChangeStatuses.map(o => o.productOrderId);
    }
    console.log(`Found ${productOrderIds.length} orders changed in the last 7 days.`);
    
    const details = [];
    for(let i=0; i<productOrderIds.length; i+=50) {
       const chunk = productOrderIds.slice(i, i+50);
       const res = await fetchApi('POST', '/v1/pay-order/seller/product-orders/query', { productOrderIds: chunk });
       if(res && res.data) {
          details.push(...res.data);
       }
    }
    
    const outDir = path.join(process.cwd(), 'downloads', 'naver_debug');
    if(!fs.existsSync(outDir)) fs.mkdirSync(outDir, {recursive: true});
    fs.writeFileSync(path.join(outDir, 'orders.json'), JSON.stringify(details, null, 2));
    console.log(`Saved ${details.length} order details to downloads/naver_debug/orders.json`);

    console.log('\n--- 유니크 값 군집 분석 시작 ---');
    const items = details.map(d => d.productOrder).filter(x => x);
    
    const testKeys = ['productId', 'productOptionId', 'optionCode', 'sellerProductCode'];
    const results = {};
    
    // Helper to calculate variance inside cluster
    for (const key of testKeys) {
        const groups = {};
        for(const item of items) {
           const val = item[key] || 'EMPTY';
           if(!groups[val]) groups[val] = [];
           groups[val].push(item);
        }
        
        // Measure grouping quality
        let exactMatchCount = 0; // Number of groups that perfectly bind same product+price
        let mismatchedGroups = [];
        let summary = [];
        
        for(const [val, group] of Object.entries(groups)) {
           const distinctNames = [...new Set(group.map(i => i.productName))];
           const distinctPrices = [...new Set(group.map(i => i.totalPaymentAmount))];
           const distinctOptions = [...new Set(group.map(i => i.productOption||''))];
           
           if(distinctNames.length === 1 && Math.abs(Math.max(...distinctPrices) - Math.min(...distinctPrices)) < 50000) {
               exactMatchCount++;
           } else {
               mismatchedGroups.push({ val, distinctNames, distinctPrices });
           }
           
           summary.push({
               UniqueValue: val,
               Count: group.length,
               ProductNameSample: distinctNames[0].substring(0, 30),
               OptionsPresent: distinctOptions.length > 0 ? distinctOptions[0] : 'None'
           });
        }
        
        results[key] = {
           TotalGroups: Object.keys(groups).length,
           PerfectClusters: exactMatchCount,
           Mismatched: mismatchedGroups.length,
           SampleGroups: summary.slice(0, 3)
        };
    }
    
    // Check Two-Key aggregations (combination)
    const comboKey = 'productId + (productOptionId or optionCode)';
    const comboGroups = {};
    for(const item of items) {
        const pId = item.productId || 'NO_PID';
        const oId = item.productOptionId || item.optionCode || 'NO_OID';
        const val = pId + '_' + oId;
        if(!comboGroups[val]) comboGroups[val] = [];
        comboGroups[val].push(item);
    }
    results[comboKey] = {
        TotalGroups: Object.keys(comboGroups).length,
        SampleGroups: Object.entries(comboGroups).map(e => ({
            ComboValue: e[0], 
            ProductName: e[1][0].productName.substring(0, 30),
            OptionName: e[1][0].productOption
        })).slice(0, 3)
    };
    
    console.log(JSON.stringify(results, null, 2));
    
  } catch(e) { console.error('Error:', e); }
}
main();
