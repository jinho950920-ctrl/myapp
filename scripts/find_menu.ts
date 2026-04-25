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
    
    const page = await context.newPage();

    try {
        console.log("🌐 접속...");
        await page.goto('https://wing.coupang.com', { waitUntil: 'networkidle' });
        
        // 매출 메뉴 요소의 HTML 구조 파악
        const menuHtml = await page.evaluate(() => {
            const el = Array.from(document.querySelectorAll('*')).find(e => e.textContent === '매출');
            if (el) {
                return el.closest('ul')?.outerHTML || el.parentElement?.innerHTML;
            }
            return 'Not found';
        });
        console.log("메뉴 HTML:", menuHtml);

        const aTags = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a')).filter(a => a.textContent?.includes('유입')).map(a => a.href);
        });
        console.log("유입 관련 링크:", aTags);

        const aTags2 = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a')).filter(a => a.textContent?.includes('인사이트')).map(a => a.href);
        });
        console.log("인사이트 관련 링크:", aTags2);
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}
test();
