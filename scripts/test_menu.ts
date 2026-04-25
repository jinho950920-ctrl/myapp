import { chromium } from 'playwright';
import * as path from 'path';

async function test() {
    const sessionPath = path.join(process.cwd(), 'credentials', 'wing_session_moding95.json');
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
        storageState: sessionPath,
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    });
    
    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    
    const page = await context.newPage();

    try {
        console.log("🌐 홈 접속...");
        await page.goto('https://wing.coupang.com', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000);
        
        console.log("👉 비즈니스 인사이트 메뉴 클릭...");
        await page.locator('span.cp-menu-text:has-text("비즈니스 인사이트")').first().click({ force: true });
        await page.waitForTimeout(1000);

        console.log("👉 유입경로 분석 메뉴 클릭...");
        await page.locator('span.second-level-node-menu-text:has-text("유입경로 분석")').first().click({ force: true });
        await page.waitForTimeout(5000);
        
        console.log("📍 현재 URL:", page.url());
        const content = await page.content();
        if (content.includes('맞춤 보고서')) {
            console.log("✅ 유입경로 분석 페이지 정상 진입 (맞춤 보고서 발견)");
        } else {
            console.log("❌ 실패");
            await page.screenshot({ path: '/home/jinho/erp-dashboard/downloads/debug_menu_fail.png' });
        }
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}
test();
