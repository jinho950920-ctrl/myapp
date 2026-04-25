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
    page.on('response', async (res) => {
        const url = res.url();
        if (url.includes('traffic-insight/distribution/summary')) {
            console.log(`📡 [traffic-insight] Response Status: ${res.status()}`);
            try { 
                const data = await res.json(); 
                console.log("✅ 트래픽 데이터 인터셉트 완료:", Object.keys(data)); 
            } catch(e) {
                console.error("❌ JSON 파싱 에러 (Akamai 차단 의심):", e.message);
                const text = await res.text().catch(()=>"");
                console.log("Preview:", text.substring(0, 100));
            }
        }
    });

    try {
        console.log("🌐 트래픽 분석 페이지 이동...");
        await page.goto('https://wing.coupang.com/tenants/sfl-portal/insights/traffic-analysis', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(5000); // 5초 대기
        console.log("👉 클릭 트리거 시도...");
        // 텍스트 기반 클릭 (어제 날짜를 선택하거나, 특정 기간 라디오버튼)
        const customReportRadio = page.locator('label:has-text("맞춤 보고서")');
        if (await customReportRadio.count() > 0) {
            await customReportRadio.click({ force: true });
            console.log("👉 맞춤 보고서 라디오 클릭");
        }
        await page.waitForTimeout(5000);
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}
test();
