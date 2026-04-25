import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

(async () => {
    try {
        const accountsStr = process.env.SHOPPING_ACCOUNTS || '[]';
        let accounts;
        try {
            const raw = accountsStr.startsWith('"') ? accountsStr.slice(1, -1) : accountsStr;
            accounts = JSON.parse(raw.replace(/\\"/g, '"'));
        } catch(e) {
            accounts = JSON.parse(accountsStr);
        }
        const targetAccount = accounts.find((a: any) => a.alias === '쿠팡 모딩');
        const sessionPath = path.join(process.cwd(), 'credentials', `wing_session_${targetAccount.loginId}.json`);
        
        const browser = await chromium.launch({ headless: false });
        const context = await browser.newContext({ storageState: sessionPath });
        const page = await context.newPage();

        console.log("Navigating to Ads Center...");
        await page.goto('https://advertising.coupang.com/marketing-reporting/billboard/custom-report', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(8000);
        
        const visibleText = await page.textContent('body');
        console.log("VISIBLE TEXT ON PAGE: \\n", visibleText?.substring(0, 500));
        
        const html = await page.content();
        fs.writeFileSync('sso_debug.html', html);
        await page.screenshot({ path: 'sso_debug.png' });
        console.log("Debug files saved to sso_debug.html and sso_debug.png");
        await browser.close();
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
})();
