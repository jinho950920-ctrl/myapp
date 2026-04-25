require('dotenv').config({ path: '.env.local' });
const bcrypt = require('bcrypt'); // from project node_modules
const qs = require('querystring');
const fs = require('fs');

async function main() {
  try {
    // 1. 키 추출 (SHOPPING_ACCOUNTS)
    const rawEnv = process.env.SHOPPING_ACCOUNTS || '[]';
    // .env.local에 저장된 이스케이프 문자 제거
    const cleanEnv = rawEnv.replace(/\\"/g, '"').replace(/^"|"$/g, '');
    const accounts = JSON.parse(cleanEnv);
    const naverAcc = accounts.find(a => a.platform === 'naver');
    if (!naverAcc || !naverAcc.key1 || !naverAcc.key2) {
      console.log('네이버 API 키가 SHOPPING_ACCOUNTS에 없습니다!');
      return;
    }
    
    const clientId = naverAcc.key1;
    const clientSecret = naverAcc.key2;
    console.log('🔑 네이버 API 인증 시도 (Client ID:', clientId, ')');

    // 2. 토큰 생성
    const timestamp = Date.now().toString();
    const password = `${clientId}_${timestamp}`;
    const hashed = bcrypt.hashSync(password, clientSecret);
    const clientSecretSign = Buffer.from(hashed, 'utf-8').toString('base64');
    
    const params = qs.stringify({
      client_id: clientId,
      timestamp: timestamp,
      client_secret_sign: clientSecretSign,
      grant_type: 'client_credentials',
      type: 'SELF'
    });

    const tokenRes = await fetch(`https://api.commerce.naver.com/external/v1/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    if (!tokenRes.ok) {
      console.error('❌ 토큰 발급 실패:', await tokenRes.text());
      return;
    }

    const tokenData = await tokenRes.json();
    const token = tokenData.access_token;
    console.log('✅ 토큰 발급 성공!');

    // API 호출용 함수
    const fetchApi = async (method, path, body) => {
      console.log(`\n⏳ Requesting ${method} ${path}...`);
      const res = await fetch(`https://api.commerce.naver.com/external${path}`, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
      });
      if(!res.ok) {
         console.error(`❌ 실패 (${res.status}):`, await res.text());
         return null;
      }
      return await res.json();
    };

    // 3일 전 날짜 계산
    const d = new Date();
    d.setDate(d.getDate() - 3);
    const lastChangedFrom = d.toISOString(); // yyyy-mm-ddThh:mm:ss.msZ
    const dayDate = d.toISOString().split('T')[0]; // yyyy-mm-dd

    // 테스트 1: 최근 3일 상태 변경 주문 내역
    const ordersStatuses = await fetchApi('GET', `/v1/pay-order/seller/product-orders/last-changed-statuses?lastChangedFrom=${lastChangedFrom}`);
    
    const productOrderIds = [];
    if (ordersStatuses && ordersStatuses.data && ordersStatuses.data.lastChangeStatuses) {
        // 주문 상세 조회용 ID 수집
        productOrderIds.push(...ordersStatuses.data.lastChangeStatuses.map(o => o.productOrderId).slice(0, 50)); 
    }

    // 테스트 2: 상세 주문 내역 조회 (POST /v1/pay-order/seller/product-orders/query)
    let orderDetails = null;
    if (productOrderIds.length > 0) {
      orderDetails = await fetchApi('POST', `/v1/pay-order/seller/product-orders/query`, {
         productOrderIds: productOrderIds
      });
    }

    // 테스트 3: 정산 내역 조회 (3일전)
    const settleDaily = await fetchApi('GET', `/v1/pay-settle/settle/daily?startDate=${dayDate}&endDate=${dayDate}`);

    // 테스트 4: QnA 내역
    // fromDate, toDate (yyyy-MM-ddTHH:mm:ss.msZ)
    const qnas = await fetchApi('GET', `/v1/contents/qnas?page=1&size=10&fromDate=${lastChangedFrom}&toDate=${d.toISOString().replace(d.getDate(), d.getDate() + 3)}`);

    // 엑셀(또는 파일) 저장 대신 JSON 파일로 저장 (대표님이 보기 편하도록)
    const resultData = {
      "주문번호목록(3일치_상태변경)": ordersStatuses,
      "주문상세조회(최대50건)": orderDetails,
      "정산내역(3일전)": settleDaily,
      "최근_고객문의QNA": qnas
    };

    fs.writeFileSync('downloads/naver_api_test_results.json', JSON.stringify(resultData, null, 2));
    console.log('\n🎉 결과 파일 저장 완료: downloads/naver_api_test_results.json');
    console.log('(이 파일을 살펴보면 어떤 데이터를 끌어올 수 있는지 정확히 확인 가능합니다.)');

  } catch (err) {
    console.error('스크립트 에러:', err);
  }
}

main();
