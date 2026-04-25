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
    
    page.on('console', msg => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
    page.on('pageerror', error => console.error(`[Browser Error] ${error.message}`));

    try {
        console.log("🌐 트래픽 분석 페이지 이동...");
        await page.goto('https://wing.coupang.com/tenants/business-insight/traffic-analysis', { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(5000);
        
        console.log("📍 현재 URL:", page.url());
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}
test();
