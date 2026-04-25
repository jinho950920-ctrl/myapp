import { chromium } from 'playwright';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { logAutomation } from './logger';

// .env 셋업
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

let dbUrl = process.env.DATABASE_URL;
if (dbUrl) {
  const bracketMatch = dbUrl.match(/\[(.*?)\]/);
  if (bracketMatch) {
    const rawPw = bracketMatch[1];
    dbUrl = dbUrl.replace(`[${rawPw}]`, encodeURIComponent(rawPw));
  }
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

// 난수 생성 함수
const randomElement = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 최신 크롬 UA 로테이션 풀 (Akamai 고정값 감지 우회)
const UA_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.122 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.112 Safari/537.36',
];

async function run() {
  console.log("\\n--- 🤖 경쟁사 크롤링 매크로 (Playwright TypeScript V1.0) ---");
  console.log(">> 🕵️ 완전 무결점 시크릿 모드(Incognito) 기반 스텔스 봇을 시작합니다. Akamai 쿠키 추적을 무력화합니다!");

  let targets: any[] = [];
  try {
    const res = await pool.query("SELECT id, url, alias FROM scraping_targets WHERE is_active = true");
    targets = res.rows;
  } catch (error) {
    console.error("❌ DB 연결 실패:", error);
    process.exit(1);
  }

  if (targets.length === 0) {
    console.log(">> 활성화된 크롤링 타겟이 없습니다.");
    process.exit(0);
  }

  console.log(`>> 총 ${targets.length}개의 타겟 장전 완료!`);

  // Xvfb 등 환경에서 Headless 모드로 동작
  const browser = await chromium.launch({ 
    headless: process.env.HEADLESS_MODE !== 'false', // 백그라운드 구동 기본값
    channel: 'chrome', // [핵심 방어막 우회] 플레이라이트용 크로미움이 아닌, 윈도우에 깔린 실제 '구글 크롬'을 구동합니다!
    args: [
      '--disable-blink-features=AutomationControlled', 
      '--disable-infobars', 
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--window-size=1920,1080',
      '--disable-features=IsolateOrigins,site-per-process' // 추가 우회 플래그
    ],
    ignoreDefaultArgs: ['--enable-automation']
  });

  for (const target of targets) {
    const loopStartTime = Date.now();
    console.log(`\n[타겟: ${target.alias}] 스텔스 우회 이동 중...`);
    
    // 매 루프마다 랜덤 UA 선택
    const selectedUA = randomElement(UA_POOL);
    // UA 버전 번호 추출 (sec-ch-ua 헤더 구성용)
    const chromeVersionMatch = selectedUA.match(/Chrome\/(\d+)/);
    const chromeVersion = chromeVersionMatch ? chromeVersionMatch[1] : '124';

    // 매 루프마다 완전 새로운 Incognito 컨텍스트 생성
    const context = await browser.newContext({
      viewport: { width: randomInt(1800, 1920), height: randomInt(900, 1080) },
      userAgent: selectedUA,
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
      javaScriptEnabled: true,
      extraHTTPHeaders: {
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'sec-ch-ua': `"Chromium";v="${chromeVersion}", "Google Chrome";v="${chromeVersion}", "Not-A.Brand";v="99"`,
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1',
      }
    });

    // 강화된 Webdriver 무력화 + Chrome 지문 완성
    await context.addInitScript(() => { 
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['ko-KR', 'ko', 'en-US', 'en'] });
      (window as any).chrome = { 
        runtime: {},
        loadTimes: () => {},
        csi: () => {},
        app: {}
      };
    });

    const page = await context.newPage();
    
    // Quantity-info 응답 탈취 변수
    let interceptedSocialProof = '0';

    page.on('response', async (response) => {
      if (response.url().includes('quantity-info') && response.status() === 200) {
        try {
          const text = await response.text();
          const data = JSON.parse(text);
          if (Array.isArray(data) && data.length > 0) {
            const modules = data[0].moduleData || [];
            for (const mod of modules) {
              if (mod.viewType === 'PRODUCT_DETAIL_SOCIAL_PROOF_NUDGE' || mod.socialProofNumUsers) {
                interceptedSocialProof = String(mod.socialProofNumUsers || '0');
              }
            }
          }
        } catch (e) {}
      }
    });

    // Access Denied 시 1회 재시도를 위한 헬퍼
    const goToTarget = async () => {
      // 1단계: 쿠팡 메인 (리퍼러 생성)
      try {
        await page.goto('https://www.coupang.com', { waitUntil: 'domcontentloaded', timeout: 15000 });
        await sleep(randomInt(2000, 3500));
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
      } catch (e) {}

      // 2단계: 쿠팡 검색 경유 (직접 상품 URL 접근 대신 자연스러운 유입 경로)
      try {
        const searchKeyword = encodeURIComponent(target.alias.replace(/[내 ]/, '').trim());
        await page.goto(`https://www.coupang.com/np/search?q=${searchKeyword}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await sleep(randomInt(2000, 4000));
        // 마우스 노이즈
        for (let i = 0; i < randomInt(2, 4); i++) {
          await page.mouse.move(randomInt(100, 800), randomInt(100, 600));
          await page.mouse.wheel(0, randomInt(200, 600));
          await sleep(randomInt(500, 1200));
        }
      } catch (e) {}

      // 3단계: 타겟 상품 페이지
      await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await sleep(randomInt(3000, 6000));
    };

    try {
      await goToTarget();

      // Access Denied 감지 → 1회 재시도
      const pageTitle = await page.title().catch(() => '');
      const pageContent = await page.content().catch(() => '');
      if (pageTitle.includes('Access Denied') || pageContent.includes('Access Denied') || pageContent.includes('액세스가 거부')) {
        console.log(`⚠️ [${target.alias}] Access Denied 감지. 3분 대기 후 새 컨텍스트로 1회 재시도...`);
        await context.close();
        await sleep(180000);
        // 재시도는 finally에서 context.close() 방어용으로 throw
        throw new Error('ACCESS_DENIED_RETRY');
      }

      // 3. 허공 스크롤 및 마우스 이동 노이즈 발생시킴 (봇 탐지 회피)
      for (let i = 0; i < randomInt(4, 7); i++) {
        await page.mouse.move(randomInt(100, 800), randomInt(100, 800));
        await page.mouse.wheel(0, randomInt(300, 900));
        await sleep(randomInt(1000, 2500));
      }

      // 데이터 렌더링 및 통신 대기
      await sleep(randomInt(4000, 6000));

      // 4. 정보 추출 (가격)
      let price = "0";
      const metaPrice = await page.evaluate(() => document.querySelector('meta[itemprop="price"]')?.getAttribute('content'));
      if (metaPrice && !isNaN(Number(metaPrice))) {
        price = metaPrice;
      } else {
        const priceSelectors = [
          ".total-price > strong", ".price-value", "em.price-value", 
          "span.price-value", ".prod-price .total-price > strong", ".price-amount.final-price-amount"
        ];
        for (const sel of priceSelectors) {
          const el = await page.locator(sel).first();
          if (await el.count() > 0) {
            const txt = await el.textContent();
            const nums = txt?.replace(/,/g, '').match(/\\d+/);
            if (nums && nums[0]) {
              price = nums[0];
              break;
            }
          }
        }
      }

      // 5. 정보 추출 (리뷰)
      let reviewStr = "0";
      const pageSrc = await page.content();
      const jsonLdMatch = pageSrc.match(/"ratingCount"\\s*:\\s*"?(\\d+)"?/i);
      if (jsonLdMatch && jsonLdMatch[1]) {
        reviewStr = jsonLdMatch[1];
      } else {
        const reviewSelectors = [
          ".rating-total-count", ".prod-buy-header__review-count", 
          "a[data-log='top_review'] span.count", "a[href*='#btfReview'] span.count",
          "div.prod-author-and-rating span.count", ".prod-review-nav-link > span.count"
        ];
        for (const sel of reviewSelectors) {
          const el = await page.locator(sel).first();
          if (await el.count() > 0) {
            const txt = await el.textContent();
            const nums = txt?.replace(/,/g, '').match(/\\d+/);
            if (nums && nums[0]) {
              reviewStr = nums[0];
              break;
            }
          }
        }
      }

      console.log(`✅ [${target.alias}] 추출 완료! 가격: ${price}원, 리뷰: ${reviewStr}건, 성과(사회적증거): ${interceptedSocialProof}건`);
      
      // DB 업서트 로직
      // 봇이 수집한 데이터를 DB에 어떻게 넣을지 (sales_data 부분 등)
      // 이전 파이썬 봇의 로직이나 경쟁사 테이블 스키마에 맞춰서 삽입
      await pool.query(
        "UPDATE scraping_targets SET last_price = $1, last_review_count = $2, last_sales_metric = $3, updated_at = NOW() WHERE id = $4",
        [price, reviewStr, interceptedSocialProof, target.id]
      );
      await logAutomation(target.alias, 'COMPETITOR_TRACKING', 'SUCCESS', '', Date.now() - loopStartTime);

    } catch (e: any) {
      console.log(`❌ [${target.alias}] 접근 실패 (Access Denied 방어막 혹은 타임아웃): ${e.message}`);
      await logAutomation(target.alias, 'COMPETITOR_TRACKING', 'FAILED', e.message, Date.now() - loopStartTime);
      // Access Denied가 뜨더라도, context.close() 후 다음 타겟은 새로운 시크릿 컨텍스트로 열림!
    } finally {
      await context.close(); // 세션 완전 폐기!! (쿠키/캐시 영구 석방)
    }
  }

  await browser.close();
  await pool.end();
  console.log("\\n🎉 크롤링 파이프라인 무사 종료!");
}

run().catch(console.error);
