import { chromium } from 'playwright';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function runTest() {
  const accountsStr = process.env.SHOPPING_ACCOUNTS || "[]";
  let accounts;
  try {
    const raw = accountsStr.startsWith('"') ? accountsStr.slice(1, -1) : accountsStr;
    accounts = JSON.parse(raw.replace(/\\"/g, '"'));
  } catch(e) {
    accounts = JSON.parse(accountsStr);
  }
  const targetAccount = accounts.find((a: any) => a.alias === '쿠팡 모딩');
  const sessionPath = path.join(process.cwd(), 'credentials', `wing_session_${targetAccount.loginId}.json`);
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--disable-infobars', '--no-sandbox'],
    ignoreDefaultArgs: ['--enable-automation']
  });
  const context = await browser.newContext({ 
      storageState: sessionPath,
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      extraHTTPHeaders: { 'Accept-Language': 'ko-KR,ko' }
  });
  await context.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
  const page = await context.newPage();

  console.log(`🌐 쿠팡 윙 페이지 선제 접속으로 세션(쿠키) 활성화/우회 중...`);
  await page.goto('https://wing.coupang.com', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(()=>null);
  await page.waitForTimeout(3000);

  console.log(`\n🚀 [광고 데이터 SSO 테스트] 광고센터 크롤링 시작...`);
  await page.goto('https://advertising.coupang.com/marketing-reporting/billboard/custom-report', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(6000); 

  if (page.url().includes('login') || (await page.locator('text=쿠팡 광고센터 로그인').count() > 0) || (await page.locator('text=Coupang Ads Center').count() > 0)) {
    console.log(`🔐 광고센터 통합 로그인(SSO) 화면 감지! 'coupang wing 로그인하기' 버튼을 클릭합니다...`);
    
    // a태그, button태그 모두 지원하도록 견고하게 재패치
    const wingCard = page.locator('div').filter({ hasText: /쿠팡 마켓플레이스|Coupang Marketplace/i }).last();
    const wingLoginBtn = wingCard.locator('a, button').filter({ hasText: /로그인하기|Log in/i }).first();
    
    if (await wingLoginBtn.count() > 0) {
      await wingLoginBtn.click({ timeout: 10000 });
    } else {
      await page.locator('text=/로그인하기|Log in/i').first().click({ timeout: 10000 }).catch(() => null);
    }
    
    console.log(`⏳ 윙 SSO 인증 상태를 확인합니다...`);
    // 타겟지점이나 로그인창 중 하나가 뜰 때까지 잠시 대기
    await page.waitForURL(url => url.href.includes('marketing-reporting') || url.href.includes('login') || url.href.includes('sso'), { timeout: 15000 }).catch(()=>null);
    await page.waitForTimeout(1500); // 폼 렌더링용 짧은 대기

    // [전면 자동화 패치] 만약 윙 로그인 폼이 나타났다면 사용자를 대신해 자동 입력 (모든 로그인은 자동으로 해야해)
    const idInput = page.locator('input[name="username"]');
    if (await idInput.count() > 0 && targetAccount) {
        console.log(`🤖 윙 로그인 폼(ID/PW) 감지! 유저를 대신해 자격증명을 자동 입력합니다...`);
        await idInput.first().fill(targetAccount.loginId);
        await page.locator('input[name="password"]').first().fill(targetAccount.loginPw);
        await page.keyboard.press('Enter');
        console.log(`🤖 아이디 제출 완료. 리다이렉트 대기 (2차 인증 시에만 수동 개입)...`);
    }

    console.log(`⏳ 쿠팡 윙 인증 및 리다이렉트 진행 중... (최대 120초 대기)`);
    // 사용자가 로그인/2차인증을 끝내고 정상적으로 광고센터로 자동 복귀할 때까지 진득하게 기다려줍니다.
    try {
      await page.waitForURL(url => url.href.includes('marketing-reporting'), { timeout: 120000 });
    } catch(e) {
      console.error(`❌ 120초 내에 광고센터 로그인이 완료되지 않았습니다. 쿠팡 아이디/비밀번호 수동 재입력이나 2차 인증(문자)이 필요할 수 있습니다.`);
      await browser.close();
      process.exit(1);
    }
  }

  // 만약 120초 이후에도 여전히 로그인 페이지에 머물러 있는지 검증 (최종 방어 로직)
  if (page.url().includes('login') || (await page.locator('text=쿠팡 광고센터 로그인').count() > 0)) {
    console.error(`❌ 광고센터 로그인 단계를 철저히 통과하지 못했습니다. 수동 로그인을 진행하여 세션을 갱신해 주세요.`);
    await browser.close();
    process.exit(1);
  }

  console.log(`📌 보고서 선택: '맞춤 보고서' 클릭 중...`);
  try {
    const customReportLabel = page.locator('label').filter({ hasText: '맞춤 보고서' }).first();
    if (await customReportLabel.count() > 0) {
      const isChecked = await customReportLabel.locator('input[type="radio"]').isChecked().catch(() => false);
      if (!isChecked) {
        await customReportLabel.click({ force: true });
      }
    } else {
      await page.locator('text=맞춤 보고서').last().click({ force: true });
    }
  } catch(e) {
    await page.locator('text=맞춤 보고서').last().click({ force: true, timeout: 2000 }).catch(()=>null);
  }
  await page.waitForTimeout(1000);

  console.log(`📌 기간 구분: '일별' 선택 중...`);
  try {
    const isDailyChecked = await page.locator('label').filter({ hasText: '일별' }).locator('input[type="radio"]').isChecked();
    if (!isDailyChecked) {
      await page.locator('text=일별').last().click({ force: true });
    }
  } catch(e) {
    await page.locator('text=일별').last().click({ force: true, timeout: 2000 }).catch(()=>null);
  }
  await page.waitForTimeout(1000);

  console.log(`📌 캠페인 유형 3가지(매출/신규/인지) 체크박스 상태 확인...`);
  const adTypes = ['매출 성장 광고', '신규 구매 고객 확보 광고', '인지도 상승 광고'];
  for (const type of adTypes) {
    try {
      const typeChk = page.locator('label').filter({ hasText: type }).locator('input[type="checkbox"]').first();
      if (await typeChk.count() > 0 && !(await typeChk.isChecked())) {
        await typeChk.click({ force: true });
      } else if (await typeChk.count() === 0) {
        await page.locator(`text=${type}`).last().click({ force: true });
      }
    } catch (e) { }
  }
  await page.waitForTimeout(1000);

  console.log(`📌 캠페인 전체선택 클릭 진행 (조건 필수)...`);
  try {
    console.log("📌 캠페인 드롭다운 버튼 클릭 시도...");
    try {
      const campaignDropdownBtn = page.locator('text=캠페인을 선택하세요').first();
      await campaignDropdownBtn.click({ force: true, timeout: 5000 });
    } catch(e) {
      await page.locator('input[placeholder="캠페인을 검색하세요"]').first().click({ force: true }).catch(()=>null);
    }
    await page.waitForTimeout(3000); 

    const selectAll = page.locator('label').filter({ hasText: '전체선택' }).locator('input[type="checkbox"]').first();
    if (await selectAll.count() > 0) {
      if (!(await selectAll.isChecked())) await selectAll.click({ force: true });
    } else {
      await page.locator('text=전체선택').last().click({ force: true }).catch(()=>null);
    }
    await page.waitForTimeout(1000);

    await page.locator('button').filter({ hasText: '확인' }).last().click({ force: true });
    await page.waitForTimeout(1000);
    console.log(`✅ 캠페인 전체선택 완료!`);
  } catch(e: any) { console.log(`⚠️ 캠페인 선택 중 에러 발생: ${e.message}`); }

  console.log(`⏳ 엑셀 생성 요청 (순정 버튼 클릭 시도)...`);
  const generateBtn = page.locator('text="엑셀 생성하기"').first();
  await generateBtn.scrollIntoViewIfNeeded();
  await generateBtn.click({ timeout: 15000 });

  console.log(`⏳ 엑셀 자동 생성 대기 중 (최대 2~3분 소요)...`);
  const downloadAdsBtn = page.locator('text="엑셀 다운로드"').first();
  
  await downloadAdsBtn.waitFor({ state: 'visible', timeout: 120000 });
  await page.waitForTimeout(1000);

  console.log(`📥 광고 맞춤보고서 다운로드 시작...`);
  await downloadAdsBtn.scrollIntoViewIfNeeded();
  const [adsDownload] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    downloadAdsBtn.click({ timeout: 10000 })
  ]);
  const adsDownloadPath = path.join(process.cwd(), 'downloads', `coupang_ads_last_week.xlsx`);
  await adsDownload.saveAs(adsDownloadPath);
  console.log(`🎉 광고 맞춤보고서 다운로드 완료! 저장 경로: ${adsDownloadPath}`);
  
  await browser.close();
}
runTest().catch(e => { console.error(e); process.exit(1); });
