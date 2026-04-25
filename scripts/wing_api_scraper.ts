import { chromium } from 'playwright';
import type { Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// 타임 시프팅 로직: 오후 2시 30분 이전이면 D-2, 이후면 D-1 데이터 조회
function getTargetDate() {
    const now = new Date();
    // KST 시간 기준으로 변환 (UTC+9)
    const kstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    
    const hours = kstNow.getUTCHours();
    const minutes = kstNow.getUTCMinutes();
    
    let daysToSubtract = 1;
    if (hours < 14 || (hours === 14 && minutes < 30)) {
        daysToSubtract = 2;
    }
    
    const targetDate = new Date(kstNow.getTime() - (daysToSubtract * 24 * 60 * 60 * 1000));
    const year = targetDate.getUTCFullYear();
    const month = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getUTCDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

async function main() {
    console.log("🚀 쿠팡 윙 인사이트 API 스크래퍼 시작...");
    const targetDate = getTargetDate();
    console.log(`📅 타겟 데이터 날짜 (Time-shifted): ${targetDate}`);

    const sessionPath = path.join(process.cwd(), 'credentials', 'wing_session_moding95.json');
    if (!fs.existsSync(sessionPath)) {
        console.error(`❌ 세션 파일이 없습니다: ${sessionPath}`);
        return;
    }

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
    const results: any = {};

    // 🕵️ 네트워크 응답 가로채기 (데이터 수집용)
    page.on('response', async (res) => {
        const url = res.url();
        if (url.includes('traffic-insight/distribution/summary')) {
            try { results['traffic_sales'] = await res.json(); console.log("✅ 트래픽 데이터 인터셉트 완료!"); } catch(e) {}
        }
        if (url.includes('category-insight/metric')) {
            try { results['category_metric'] = await res.json(); console.log("✅ 카테고리 메트릭 데이터 인터셉트 완료!"); } catch(e) {}
        }
        if (url.includes('category-insight/keywords')) {
            try { results['keywords'] = await res.json(); console.log("✅ 키워드 데이터 인터셉트 완료!"); } catch(e) {}
        }
    });

    // 🕵️ 네트워크 요청 가로채기 (날짜/조건 조작용)
    await page.route('**/*', (route) => {
        const req = route.request();
        const url = req.url();
        
        if (url.includes('traffic-insight/distribution/summary') && req.method() === 'POST') {
            try {
                const payload = JSON.parse(req.postData() || '{}');
                payload.startDate = targetDate;
                payload.endDate = targetDate;
                route.continue({ postData: JSON.stringify(payload) });
                return;
            } catch(e) {}
        }
        
        if ((url.includes('category-insight/metric') || url.includes('category-insight/keywords')) && req.method() === 'GET') {
            try {
                const urlObj = new URL(url);
                urlObj.searchParams.set('startDate', targetDate);
                urlObj.searchParams.set('endDate', targetDate);
                route.continue({ url: urlObj.toString() });
                return;
            } catch(e) {}
        }
        
        route.continue();
    });

    try {
        console.log("🌐 쿠팡 윙 접속...");
        await page.goto('https://wing.coupang.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(3000);

        if (page.url().includes('login')) {
            console.error("❌ 로그인이 필요합니다.");
            return;
        }
        console.log("✅ 로그인 세션 확인 완료!");

        // 1. 트래픽 및 판매 분석 요약 (Traffic Insight)
        console.log("📊 트래픽 분석 페이지 이동 중...");
        await page.locator('span:has-text("매출")').first().click({ force: true, timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(1000);
        await page.locator('a:has-text("유입경로 분석")').first().click({ force: true, timeout: 5000 });
        await page.waitForTimeout(5000); // UI 렌더링 대기
        
        await page.screenshot({ path: '/home/jinho/erp-dashboard/downloads/debug_traffic_ui.png' });
        console.log("📸 트래픽 페이지 UI 스크린샷 저장 완료: debug_traffic_ui.png");
        
        const domHtml = await page.content();
        fs.writeFileSync('/home/jinho/erp-dashboard/downloads/debug_traffic_dom.html', domHtml, 'utf8');
        console.log("📸 트래픽 페이지 DOM 저장 완료: debug_traffic_dom.html");

        // 검색/조회 버튼을 클릭하여 API 호출 유도
        console.log("👉 트래픽 데이터 '조회' 버튼 클릭 시도...");
        // 여기서 버튼을 클릭하지 않고 일단 종료 (디버그 목적)

        // 결과 저장
        const outDir = '/home/jinho/erp-dashboard/downloads';
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '');
        const outPath = path.join(outDir, `wing_api_results_${targetDate}_${timestamp}.json`);
        fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
        console.log(`🎉 모든 데이터 수집 완료! 파일 저장: ${outPath}`);

    } catch (error) {
        console.error("❌ 실행 중 오류 발생:", error);
    } finally {
        console.log("🧹 브라우저 컨텍스트 정리...");
        await browser.close();
    }
}

main();
