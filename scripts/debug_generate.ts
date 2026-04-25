import { chromium } from 'playwright';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function runTest() {
  const accountsStr = process.env.SHOPPING_ACCOUNTS || '[]';
  const targetAccount = JSON.parse(accountsStr.replace(/\\"/g, '"') || accountsStr).find((a: any) => a.alias === '쿠팡 모딩');
  const sessionPath = path.join(process.cwd(), 'credentials', `wing_session_${targetAccount.loginId}.json`);
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ 
      storageState: sessionPath,
      locale: 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      extraHTTPHeaders: { 'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7' }
  });
  const page = await context.newPage();

  console.log(`🚀 [광고 데이터 생성 디버그] 시작...`);
  await page.goto('https://advertising.coupang.com/marketing-reporting/billboard/custom-report', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(6000); 

  if (page.url().includes('login') || (await page.locator('text=쿠팡 광고센터 로그인').count() > 0) || (await page.locator('text=Coupang Ads Center').count() > 0)) {
    const wingLoginBtn = page.locator('text="로그인하기"').or(page.locator('text="Log in"')).first();
    await wingLoginBtn.click({ force: true, timeout: 15000 }).catch(()=>{});
    await page.waitForTimeout(5000);
    await page.goto('https://advertising.coupang.com/marketing-reporting/billboard/custom-report', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);
  }

  // 기본 세팅
  await page.locator('label').filter({ hasText: '일별' }).locator('input[type="radio"]').click({ force: true }).catch(async ()=>{
    await page.locator('text=일별').last().click({ force: true, timeout: 2000 }).catch(()=>null);
  });
  await page.waitForTimeout(1000);

  const adTypes = ['매출 성장 광고', '신규 구매 고객 확보 광고', '인지도 상승 광고'];
  for (const type of adTypes) {
      await page.locator('label').filter({ hasText: type }).locator('input[type="checkbox"]').first().click({ force: true }).catch(async ()=>{
        await page.locator(`text=${type}`).last().click({ force: true }).catch(()=>null);
      });
  }
  await page.waitForTimeout(1000);

  // 캠페인 전체선택
  await page.locator('text=캠페인을 선택하세요').first().click({ force: true, timeout: 5000 }).catch(()=>null);
  await page.waitForTimeout(3000); 
  const selectAll = page.locator('label').filter({ hasText: '전체선택' }).locator('input[type="checkbox"]').first();
  if (await selectAll.count() > 0) {
    if (!(await selectAll.isChecked())) await selectAll.click({ force: true });
  } else {
    await page.locator('text=전체선택').last().click({ force: true }).catch(()=>null);
  }
  await page.waitForTimeout(1000);
  await page.locator('button').filter({ hasText: '확인' }).last().click({ force: true });
  await page.waitForTimeout(2000);

  console.log(`⏳ 엑셀 생성 전 버튼 리스트 덤프:`);
  let buttons = await page.locator('button').allTextContents();
  console.log(buttons.map(b => b.trim()).filter(Boolean).slice(-5).join(" | "));

  console.log(`\n⏳ 엑셀 생성 요청 (순정 버튼 클릭 시도)...`);
  const generateBtn = page.locator('text="엑셀 생성하기"').first();
  await generateBtn.scrollIntoViewIfNeeded();
  await generateBtn.click({ timeout: 5000 });

  for (let i = 1; i <= 3; i++) {
    console.log(`\n[${i * 10}초 경과] 버튼 텍스트 추출 중...`);
    await page.waitForTimeout(10000);
    const newButtons = await page.locator('button').allTextContents();
    console.log(newButtons.map(b => b.trim()).filter(Boolean).slice(-5).join(" | "));
    
    // 에러 팝업이나 모달이 떴는지 확인
    const modals = await page.locator('.ant-modal-content, .ant-message-notice-content').allTextContents();
    if(modals.length > 0) console.log("알림/모달 텍스트:", modals.map(m => m.trim()).join(" | "));
  }

  await browser.close();
}
runTest().catch(console.error);
