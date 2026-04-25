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
    
    page.on('console', msg => {
        if (msg.type() === 'error' || msg.text().includes('BLOCK_')) {
            console.log(`[Console] ${msg.text()}`);
        }
    });

    try {
        console.log("🌐 판매 분석 페이지 이동...");
        await page.goto('https://wing.coupang.com/tenants/sfl-portal/insights/dashboard', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(5000);
        
        console.log("📍 현재 URL:", page.url());
        
        const text = await page.evaluate(() => document.body.innerText);
        console.log("TEXT PREVIEW:");
        console.log(text.substring(0, 1000));
        await page.screenshot({ path: '/home/jinho/erp-dashboard/downloads/debug_sales.png' });
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}
test();
