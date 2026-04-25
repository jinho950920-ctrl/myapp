const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36" });
    const page = await context.newPage();
    try {
        console.log("Fetching detail page...");
        await page.goto("https://www.coupang.com/vp/products/7680012862?itemId=20510687567&vendorItemId=87588403736&q=홈캠+거치대", { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(3000);
        const html = await page.content();
        const match = html.match(/"socialProofNumbers":\s*(\d+)/) || html.match(/socialProofNumUsers["']?\s*:\s*(\d+)/);
        if (match) console.log("✅ 숨겨진 데이터 발견! 구매자 수: " + match[1] + "명"); 
        else console.log("❌ 숨겨진 데이터를 찾을 수 없습니다.");
        
        console.log("Fetching search page...");
        await page.goto("https://www.coupang.com/np/search?component=&q=홈캠+거치대", { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(3000);
        const items = await page.$$eval("ul#productList > li", lis => lis.map(li => ({
            isAd: !!li.querySelector('.ad-badge, .is-ad, .ad-badge-text'),
            href: (li.querySelector('a.search-product-link') || {}).href || ""
        })));
        let rank = 0;
        let found = false;
        for (const item of items) {
            if (item.isAd) continue;
            rank++;
            if (item.href.includes("7680012862") && item.href.includes("20510687567")) {
                console.log("🏆 현재 노출 순위 (오가닉): " + rank + "위");
                found = true;
                break;
            }
        }
        if (!found) console.log("❌ 첫 페이지에서 타겟 상품을 찾지 못했습니다.");
    } catch(e) { console.error(e) }
    await browser.close();
})();
