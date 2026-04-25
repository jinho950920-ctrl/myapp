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
        console.log("🌐 트래픽 분석 페이지 이동...");
        await page.goto('https://wing.coupang.com/tenants/sfl-portal/insights/traffic-analysis', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(5000); // 5초 대기
        
        console.log("📍 현재 URL:", page.url());
        
        const content = await page.content();
        if (content.includes('유입경로 분석')) {
            console.log("✅ 유입경로 분석 텍스트가 페이지에 있습니다.");
        } else {
            console.log("❌ 유입경로 분석 텍스트가 페이지에 없습니다.");
        }
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}
test();
