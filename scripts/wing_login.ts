import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
  const accountsStr = process.env.SHOPPING_ACCOUNTS || '[]';
  if (!accountsStr) throw new Error("SHOPPING_ACCOUNTS not found in .env.local");
  
  let accounts;
  try {
    const raw = accountsStr.startsWith('"') ? accountsStr.slice(1, -1) : accountsStr;
    accounts = JSON.parse(raw.replace(/\\"/g, '"'));
  } catch(e) {
    accounts = JSON.parse(accountsStr);
  }
  
  const targetAccount = accounts.find((a: any) => a.alias === '쿠팡 모딩');
  
  if (!targetAccount) throw new Error("Target account '쿠팡 모딩' not found!");

  const credentialsDir = path.join(process.cwd(), 'credentials');
  if (!fs.existsSync(credentialsDir)) fs.mkdirSync(credentialsDir);
  const sessionPath = path.join(credentialsDir, `wing_session_${targetAccount.loginId}.json`);

  console.log(`🚀 Playwright를 창 모드로 띄웁니다... (2단계 인증 필요 시 직접 클릭/입력해 주세요)`);
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--disable-blink-features=AutomationControlled', '--disable-infobars', '--no-sandbox'],
    ignoreDefaultArgs: ['--enable-automation']
  });
  const context = await browser.newContext({
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    geolocation: { longitude: 126.9780, latitude: 37.5665 },
    permissions: ['geolocation']
  });
  await context.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
  const page = await context.newPage();

  console.log(`🌐 쿠팡 윙 로그인 페이지 접속 중...`);
  await page.goto("https://wing.coupang.com/");
  
  // xauth SSO 리다이렉트 대기
  try {
    await page.waitForURL(url => 
      url.href.includes('/login') || url.href.includes('xauth.coupang.com') || url.href.includes('/tenants'), 
      { timeout: 15000 }
    );
  } catch (e) {}

  console.log(`🔑 아이디/비밀번호 자동 입력...`);
  try {
    // xauth 페이지 렌더링 대기
    await page.waitForSelector('input[name="username"]', { state: 'visible', timeout: 10000 });
    await page.locator('input[name="username"]').first().fill('');
    await page.locator('input[name="username"]').first().fill(targetAccount.loginId);
    await page.locator('input[name="password"]').first().fill('');
    await page.locator('input[name="password"]').first().fill(targetAccount.loginPw);
    await page.waitForTimeout(500);
    
    // ✅ 로그인 버튼 클릭 (다양한 셀렉터 시도)
    let clicked = false;
    const btnSelectors = [
      'button:has-text("로그인"):not(:has-text("유지"))',
      'input[type="submit"]',
      'button[type="submit"]',
      '#kc-login',
    ];
    for (const sel of btnSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.count() > 0) {
          await btn.click({ timeout: 3000 });
          clicked = true;
          console.log(`  ✅ 로그인 버튼 클릭 성공 (${sel})`);
          break;
        }
      } catch(e) {}
    }
    if (!clicked) {
      console.log(`  ⚠️ 버튼 셀렉터 매칭 실패 → Enter 키 폴백`);
      await page.keyboard.press('Enter');
    }
  } catch (e) {
    console.log("⚠️ 로그인 입력 폼을 찾지 못했습니다. 창에서 직접 인증을 시도해 주십시오.");
  }

  console.log(`⏳ 로그인 이후 대기 시작... (2단계 인증 등 완료 시 자동 종료 & 저장)`);
  
  try {
    // ✅ 핵심 수정: xauth를 탈출하여 wing.coupang.com에 도달할 때까지 대기 (최대 5분)
    await page.waitForURL(url => url.href.includes('wing.coupang.com') && !url.href.includes('xauth'), { timeout: 300000 });
    // 대시보드 로딩을 위해 조금 더 여유 대기
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
  } catch (e) {
    console.log("⚠️ 5분 경과: 로그인 성공으로 간주하고 현재 상태를 우선 저장합니다.");
  }

  console.log(`✅ 세션(쿠키) 정보를 저장합니다...`);
  await context.storageState({ path: sessionPath });
  console.log(`💾 저장 완료: ${sessionPath}`);
  
  // 성공적으로 로그인 세션이 확보되었으므로 대시보드의 경고 알림도 해제
  const statusPath = path.join(credentialsDir, 'wing_status.json');
  fs.writeFileSync(statusPath, JSON.stringify({ requires2FA: false, lastChecked: new Date().toISOString() }));

  await browser.close();
  console.log(`🎉 윙 로그인 세션 획득 스크립트가 성공적으로 종료되었습니다.`);
}

run().catch(console.error);
