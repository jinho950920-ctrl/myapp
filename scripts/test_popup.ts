import { chromium } from 'playwright';
import path from 'path';

async function testClick() {
  const sessionPath = path.join(process.cwd(), 'credentials', 'wing_session_moding95.json');
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
  });
  const context = await browser.newContext({ storageState: sessionPath });
  const page = await context.newPage();
  
  console.log("Navigating to Wing Home...");
  await page.goto('https://wing.coupang.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  
  console.log("Waiting 5s for late popups...");
  await page.waitForTimeout(5000);
  
  console.log("Aggressive popup closing...");
  
  // Dump all frames to see if it's an iframe popup
  const frames = page.frames();
  console.log(`Found ${frames.length} frames.`);
  for(const f of frames) {
     const elements = f.locator('text="닫기"');
     const count = await elements.count();
     console.log(`Frame ${f.name() || f.url()} has ${count} '닫기' elements.`);
     if (count > 0) {
        for(let i=0; i<count; i++) {
           console.log(`Clicking in frame ${f.url()}...`);
           await elements.nth(i).click({ force: true, timeout: 2000 }).catch(e => console.log('Fail:', e.message));
        }
     }
  }

  // Also try main page text match
  const closeElements = page.locator('text="닫기"');
  const count = await closeElements.count();
  console.log(`Main page '닫기' count: ${count}`);
  for(let i=0; i<count; i++) {
     console.log(`Clicking target ${i} on main page...`);
     await closeElements.nth(i).click({ force: true, timeout: 2000 }).catch(e => console.log('Failed to click:', e.message));
  }

  // Handle "오늘 하루 보지 않기" (Do not show today) checkbox / button
  const todayClose = page.getByText('오늘 하루 보지 않기');
  if (await todayClose.count() > 0) {
      console.log("Clicking 오늘 하루 보지 않기");
      await todayClose.first().click({ force: true, timeout: 2000 }).catch(()=>null);
  }
  
  await page.waitForTimeout(1000);

  // Click Biz Insight
  console.log("Clicking 비즈니스 인사이트...");
  const biz = page.locator('nav').locator('text="비즈니스 인사이트"').first();
  await biz.click({ force: true });
  await page.waitForTimeout(2000);
  
  // Click Sales Analysis
  console.log("Clicking 판매분석...");
  const sales = page.locator('nav').locator('text="판매분석"').first();
  await sales.click({ force: true });
  
  await page.waitForTimeout(5000);
  console.log("Current URL:", page.url());
  
  const excelBtn = page.getByText('엑셀 다운로드').last();
  console.log("Excel Btn Count:", await excelBtn.count());
  
  await browser.close();
}
testClick().catch(console.error);
