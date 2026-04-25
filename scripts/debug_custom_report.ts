import { chromium } from 'playwright';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function debugReportUI() {
  const accountsStr = process.env.SHOPPING_ACCOUNTS || '[]';
  const targetAccount = JSON.parse(accountsStr.replace(/\\"/g, '"')).find((a: any) => a.alias === '쿠팡 모딩');
  const sessionPath = path.join(process.cwd(), 'credentials', `wing_session_${targetAccount.loginId}.json`);
  
  const browser = await chromium.launch({ headless: false });
  // Add robust Korean language headers and locale!
  const context = await browser.newContext({ 
      storageState: sessionPath,
      locale: 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      extraHTTPHeaders: { 'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7' }
  });
  const page = await context.newPage();

  console.log("Navigating to Custom Report...");
  await page.goto('https://advertising.coupang.com/marketing-reporting/billboard/custom-report', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);

  if (page.url().includes('login') || (await page.locator('text=Coupang Ads Center').count() > 0) || (await page.locator('text=쿠팡 광고센터').count() > 0)) {
    console.log("SSO Gateway. Clicking Login...");
    const wingLoginBtn = page.locator('text="로그인하기"').or(page.locator('text="Log in"')).first();
    await wingLoginBtn.click({ force: true, timeout: 5000 });
    await page.waitForTimeout(6000);
    await page.goto('https://advertising.coupang.com/marketing-reporting/billboard/custom-report', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);
  }

  console.log("📌 캠페인 드롭다운 버튼 클릭 시도...");
  try {
    const campaignDropdownBtn = page.locator('text=캠페인을 선택하세요').first();
    await campaignDropdownBtn.click({ force: true, timeout: 5000 });
    console.log("✅ 드롭다운 클릭 성공, 리스트 전개 중...");
  } catch(e) {
    console.log("❌ 드롭다운 텍스트 클릭 실패, placeholder 클릭 시도...");
    await page.locator('input[placeholder="캠페인을 검색하세요"]').first().click({ force: true }).catch(()=>null);
  }
  await page.waitForTimeout(3000);

  const html = await page.content();
  const fs = require('fs');
  fs.writeFileSync('dropdown_debug.html', html);
  await page.screenshot({ path: 'dropdown_debug.png' });
  console.log("✅ 드롭다운 상태를 dropdown_debug.html, png 로 저장했습니다.");
  const buttons = await page.locator('button').allTextContents();
  buttons.forEach(b => console.log(b.trim()));

  await browser.close();
}
debugReportUI().catch(e => { console.error(e); process.exit(1); });
