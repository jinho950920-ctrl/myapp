/**
 * 하이브리드 스크래퍼 V1 - 네트워크 스니핑 + Request 다운로드
 * 
 * 전략: 브라우저는 로그인 + 세션 쿠키 확보만 수행
 *       엑셀 다운로드는 fetch/axios 직접 HTTP Request로 수행
 *       → 팝업 닫기, 버튼 클릭, 날짜 선택 등 UI 상호작용 최소화
 */
import { chromium, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import https from 'https';
import xlsx from 'xlsx';
import { logAutomation } from './logger';
import { createRunId, redactSensitiveText, writeDiagnostic, writeDiagnosticSummary } from './scrape_diagnostics';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const originalConsoleLog = console.log.bind(console);
const originalConsoleError = console.error.bind(console);

function safeConsoleArg(value: unknown): unknown {
  if (typeof value === 'string') return redactSensitiveText(value);
  if (value instanceof Error) return redactSensitiveText(value.message);
  return value;
}

console.log = (...args: unknown[]) => originalConsoleLog(...args.map(safeConsoleArg));
console.error = (...args: unknown[]) => originalConsoleError(...args.map(safeConsoleArg));

// --- 유틸리티 ---
function getYesterdayKST(): { yyyy: string; mm: string; dd: string; full: string } {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + kstOffset);
  kstNow.setDate(kstNow.getDate() - 1);
  const yyyy = String(kstNow.getFullYear());
  const mm = String(kstNow.getMonth() + 1).padStart(2, '0');
  const dd = String(kstNow.getDate()).padStart(2, '0');
  return { yyyy, mm, dd, full: `${yyyy}-${mm}-${dd}` };
}

// KST 기준 현재 타임스탬프 생성 (파일명용: YYYYMMdd_HHmmss)
function getNowKSTTimestamp(): string {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kst = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + kstOffset);
  const yyyy = String(kst.getFullYear());
  const MM = String(kst.getMonth() + 1).padStart(2, '0');
  const dd = String(kst.getDate()).padStart(2, '0');
  const HH = String(kst.getHours()).padStart(2, '0');
  const mm = String(kst.getMinutes()).padStart(2, '0');
  const ss = String(kst.getSeconds()).padStart(2, '0');
  return `${yyyy}${MM}${dd}_${HH}${mm}${ss}`;
}

/**
 * 브라우저 컨텍스트에서 쿠키를 추출하여 Cookie 헤더 문자열로 변환
 */
async function extractCookieHeader(context: BrowserContext, domain: string): Promise<string> {
  const cookies = await context.cookies();
  return cookies
    .filter(c => c.domain.includes(domain))
    .map(c => `${c.name}=${c.value}`)
    .join('; ');
}

/**
 * HTTP Request로 직접 파일 다운로드
 */
function downloadFile(url: string, cookieHeader: string, savePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'Cookie': cookieHeader,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream, */*',
        'Referer': `https://${parsedUrl.hostname}/`,
      },
    };

    const req = https.request(options, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        console.log(`  ↪️ 리다이렉트: ${res.headers.location}`);
        downloadFile(res.headers.location, cookieHeader, savePath).then(resolve);
        return;
      }
      if (res.statusCode !== 200) {
        console.log(`  ❌ HTTP ${res.statusCode}`);
        resolve(false);
        return;
      }
      const file = fs.createWriteStream(savePath);
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(true); });
      file.on('error', () => resolve(false));
    });
    req.on('error', (e) => { console.log(`  ❌ Request 에러: ${e.message}`); resolve(false); });
    req.end();
  });
}

function getExcelDataRowCount(filePath: string): number {
  const workbook = xlsx.readFile(filePath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return xlsx.utils.sheet_to_json(sheet, { defval: null }).length;
}

function moveEmptyAdsReport(filePath: string): void {
  const failedDir = path.join(process.cwd(), 'downloads', 'failed_backup');
  if (!fs.existsSync(failedDir)) fs.mkdirSync(failedDir, { recursive: true });
  const failedPath = path.join(failedDir, path.basename(filePath));
  fs.renameSync(filePath, failedPath);
  console.log(`⚠️ 빈 광고 보고서 격리: ${failedPath}`);
}

function classifyFailure(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes('xauth') || normalized.includes('login') || normalized.includes('로그인')) return 'LOGIN_EXPIRED_OR_FAILED';
  if (normalized.includes('page crashed') || normalized.includes('crashed')) return 'PAGE_CRASH';
  if (normalized.includes('timeout') || normalized.includes('waiting for selector')) return 'PAGE_TIMEOUT';
  if (normalized.includes('download')) return 'NO_DOWNLOAD';
  if (normalized.includes('empty') || normalized.includes('빈 광고')) return 'EMPTY_EXCEL';
  if (normalized.includes('http')) return 'HTTP_ERROR';
  if (normalized.includes('requested scrape phase failed')) return 'PHASE_FAILED';
  return 'UNKNOWN_ERROR';
}

function getSafeUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return `${parsedUrl.origin}${parsedUrl.pathname}`;
  } catch {
    return redactSensitiveText(url);
  }
}

async function getPageDiagnostic(page: Page): Promise<{ url: string; title: string }> {
  return {
    url: getSafeUrl(page.url()),
    title: await page.title().catch(() => ''),
  };
}

async function saveFailureScreenshot(page: Page, name: string): Promise<string | undefined> {
  const screenshotPath = path.join(process.cwd(), 'logs', `${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => null);
  return fs.existsSync(screenshotPath) ? screenshotPath : undefined;
}

type AdsReportRow = Record<string, any>;

type AdsReportPayload = {
  id?: string;
  reportColumns: string[];
  rows: AdsReportRow[];
};

const ADS_EXCEL_HEADERS = [
  '날짜',
  '과금 방식',
  '판매방식',
  '캠페인 이름',
  '캠페인 시작일',
  '캠페인 종료일',
  '광고 목표',
  '운영 방식',
  '광고그룹',
  '광고명',
  '노출 영역',
  '카테고리',
  '광고 유형',
  '랜딩 페이지 유형',
  '랜딩 페이지명',
  '랜딩 페이지 ID',
  '소재 ID',
  '광고 집행 옵션 ID',
  '광고집행 상품명',
  '광고 전환 매출 발생 옵션 ID',
  '광고 전환 매출 발생 상품명',
  '노출수',
  '클릭수',
  '클릭률',
  '광고비(원)',
  '참여수',
  '참여율',
  '동영상 3초 조회',
  '동영상 3초 조회당 비용(원)',
  '평균 재생 시간(초)',
  '25% 재생수',
  '50% 재생수',
  '75% 재생수',
  '100% 재생수',
  '총 주문수 (1일)',
  '직접 주문수 (1일)',
  '간접 주문수 (1일)',
  '총 전환 매출액 (1일)(원)',
  '직접 전환 매출액 (1일)(원)',
  '간접 전환 매출액 (1일)(원)',
  '총 광고 수익률 (1일)',
  '직접 광고 수익률 (1일)',
  '간접 광고 수익률 (1일)',
  '총 판매 수량 (1일)',
  '직접 판매 수량 (1일)',
  '간접 판매 수량 (1일)',
  '총 주문수 (14일)',
  '직접 주문수 (14일)',
  '간접 주문수 (14일)',
  '총 전환 매출액 (14일)(원)',
  '직접 전환 매출액 (14일)(원)',
  '간접 전환 매출액 (14일)(원)',
  '총 광고 수익률 (14일)',
  '직접 광고 수익률 (14일)',
  '간접 광고 수익률 (14일)',
  '총 판매 수량 (14일)',
  '직접 판매 수량 (14일)',
  '간접 판매 수량 (14일)',
  '도달수',
  '신규 고객 도달수',
  '기존 고객 도달수',
  '노출 빈도',
  '도달당 비용(원)',
  '신규 구매 고객 광고 전환 매출(원)',
  '신규 구매 고객 광고 전환 매출 비율',
  '신규 구매 고객 수',
  '신규 구매고객 비율',
  '신규 구매 고객당 비용(원)',
  '연간 기대 가능 매출(원)',
  '연간 기대 가능 광고 수익률',
];

function dashIfEmpty(value: any): any {
  return value === null || value === undefined || value === '' ? '-' : value;
}

function formatAdsDate(value: any): any {
  if (!value) return '-';
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10).replace(/-/g, '.');
  if (/^\d{8}$/.test(text)) return `${text.slice(0, 4)}.${text.slice(4, 6)}.${text.slice(6, 8)}`;
  return text;
}

function formatPercent(value: any): any {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  return `${(num * 100).toFixed(2)}%`;
}

function normalizeAdsReportRow(row: AdsReportRow): Record<string, any> {
  return {
    '날짜': dashIfEmpty(row.dt),
    '과금 방식': dashIfEmpty(row.price_type),
    '판매방식': dashIfEmpty(row.vendor_type),
    '캠페인 이름': dashIfEmpty(row.campaign_name),
    '캠페인 시작일': formatAdsDate(row.campaign_start_datetime),
    '캠페인 종료일': formatAdsDate(row.campaign_end_datetime),
    '광고 목표': dashIfEmpty(row.goal_type),
    '운영 방식': dashIfEmpty(row.bid_type),
    '광고그룹': dashIfEmpty(row.ad_group_name),
    '광고명': dashIfEmpty(row.ad_name),
    '노출 영역': dashIfEmpty(row.placement),
    '카테고리': dashIfEmpty(row.category),
    '광고 유형': dashIfEmpty(row.bpa_ad_type ?? row.ad_type),
    '랜딩 페이지 유형': dashIfEmpty(row.landing_page_type),
    '랜딩 페이지명': dashIfEmpty(row.landing_page_name),
    '랜딩 페이지 ID': dashIfEmpty(row.landing_page_id),
    '소재 ID': dashIfEmpty(row.creative_id),
    '광고 집행 옵션 ID': dashIfEmpty(row.advertised_vendor_item_id),
    '광고집행 상품명': dashIfEmpty(row.advertised_vendor_item_name),
    '광고 전환 매출 발생 옵션 ID': dashIfEmpty(row.vendor_item_id),
    '광고 전환 매출 발생 상품명': dashIfEmpty(row.vendor_item_name),
    '노출수': row.impressions_count ?? 0,
    '클릭수': row.clicks_count ?? 0,
    '클릭률': formatPercent(row.ctr ?? 0),
    '광고비(원)': row.ad_cost_sum ?? 0,
    '참여수': row.billable_event_count ?? 0,
    '참여율': row.engagement_through_rate === null || row.engagement_through_rate === undefined ? '-' : formatPercent(row.engagement_through_rate),
    '동영상 3초 조회': row.video_watch_3s_count ?? 0,
    '동영상 3초 조회당 비용(원)': row.cost_per_video_watch_3s_count ?? 0,
    '평균 재생 시간(초)': row.avg_watch_time === null || row.avg_watch_time === undefined ? '0.00' : Number(row.avg_watch_time).toFixed(2),
    '25% 재생수': row.video_first_quartile ?? 0,
    '50% 재생수': row.video_midpoint ?? 0,
    '75% 재생수': row.video_third_quartile ?? 0,
    '100% 재생수': row.video_complete ?? 0,
    '총 주문수 (1일)': row.total_order_24_hours ?? 0,
    '직접 주문수 (1일)': row.direct_order_24_hours ?? 0,
    '간접 주문수 (1일)': row.halo_order_24_hours ?? 0,
    '총 전환 매출액 (1일)(원)': row.total_sale_24_hours ?? 0,
    '직접 전환 매출액 (1일)(원)': row.direct_sale_24_hours ?? 0,
    '간접 전환 매출액 (1일)(원)': row.halo_sale_24_hours ?? 0,
    '총 광고 수익률 (1일)': formatPercent(row.total_roas_24_hours ?? 0),
    '직접 광고 수익률 (1일)': formatPercent(row.direct_roas_24_hours ?? 0),
    '간접 광고 수익률 (1일)': formatPercent(row.halo_roas_24_hours ?? 0),
    '총 판매 수량 (1일)': row.total_unit_24_hours ?? 0,
    '직접 판매 수량 (1일)': row.direct_unit_24_hours ?? 0,
    '간접 판매 수량 (1일)': row.halo_unit_24_hours ?? 0,
    '총 주문수 (14일)': row.total_order_14_days ?? 0,
    '직접 주문수 (14일)': row.direct_order_14_days ?? 0,
    '간접 주문수 (14일)': row.halo_order_14_days ?? 0,
    '총 전환 매출액 (14일)(원)': row.total_sale_14_days ?? 0,
    '직접 전환 매출액 (14일)(원)': row.direct_sale_14_days ?? 0,
    '간접 전환 매출액 (14일)(원)': row.halo_sale_14_days ?? 0,
    '총 광고 수익률 (14일)': formatPercent(row.total_roas_14_days ?? 0),
    '직접 광고 수익률 (14일)': formatPercent(row.direct_roas_14_days ?? 0),
    '간접 광고 수익률 (14일)': formatPercent(row.halo_roas_14_days ?? 0),
    '총 판매 수량 (14일)': row.total_unit_14_days ?? 0,
    '직접 판매 수량 (14일)': row.direct_unit_14_days ?? 0,
    '간접 판매 수량 (14일)': row.halo_unit_14_days ?? 0,
    '도달수': row.reach ?? 0,
    '신규 고객 도달수': row.reach_new_customer ?? 0,
    '기존 고객 도달수': row.reach_old_customer ?? 0,
    '노출 빈도': row.frequency ?? 0,
    '도달당 비용(원)': row.cost_per_reach ?? 0,
    '신규 구매 고객 광고 전환 매출(원)': row.new_to_brand_sales_12mo ?? 0,
    '신규 구매 고객 광고 전환 매출 비율': formatPercent(row.new_to_brand_sales_rate_12mo ?? 0),
    '신규 구매 고객 수': row.new_to_brand_users_12mo ?? 0,
    '신규 구매고객 비율': formatPercent(row.new_to_brand_users_rate_12mo ?? 0),
    '신규 구매 고객당 비용(원)': dashIfEmpty(row.cost_per_new_to_brand_customer_12mo),
    '연간 기대 가능 매출(원)': dashIfEmpty(row.ltv_gmv),
    '연간 기대 가능 광고 수익률': row.ltv_roas === null || row.ltv_roas === undefined ? '-' : formatPercent(row.ltv_roas),
  };
}

function saveAdsReportRowsAsXlsx(rows: AdsReportRow[], savePath: string): void {
  const workbook = xlsx.utils.book_new();
  const normalizedRows = rows.map(normalizeAdsReportRow);
  const worksheet = xlsx.utils.json_to_sheet(normalizedRows, {
    header: ADS_EXCEL_HEADERS,
    skipHeader: false,
  });
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  xlsx.writeFile(workbook, savePath);
}

// --- 메인 ---
async function run() {
  const scriptStartTime = Date.now();
  const runId = process.env.SCRAPE_RUN_ID || createRunId('wing_scrape');
  const accountsStr = process.env.SHOPPING_ACCOUNTS || '[]';
  if (!accountsStr) throw new Error("SHOPPING_ACCOUNTS not found in .env.local");
  
  let accounts;
  try {
    const raw = accountsStr.startsWith('"') ? accountsStr.slice(1, -1) : accountsStr;
    accounts = JSON.parse(raw.replace(/\\"/g, '"'));
  } catch(e) {
    accounts = JSON.parse(accountsStr);
  }
  
  const overrideAlias = process.env.OVERRIDE_ALIAS;
  const filteredAccounts = overrideAlias
    ? accounts.filter((a: any) => a.alias === overrideAlias)
    : accounts;
  const scrapeType = process.env.SCRAPE_TYPE || 'both';
  if (!['both', 'sales', 'ads'].includes(scrapeType)) {
    throw new Error(`Invalid SCRAPE_TYPE: ${scrapeType}`);
  }
  const shouldScrapeSales = scrapeType === 'both' || scrapeType === 'sales';
  const shouldScrapeAds = scrapeType === 'both' || scrapeType === 'ads';

  let yesterday;
  if (process.env.SCRAPE_DATE) {
    const d = process.env.SCRAPE_DATE; // e.g. "2026-05-23"
    const parts = d.split('-');
    yesterday = {
      yyyy: parts[0],
      mm: parts[1],
      dd: parts[2],
      full: d
    };
    console.log(`💡 [날짜 오버라이드] 수동 수집 날짜로 실행: ${yesterday.full}`);
  } else {
    yesterday = getYesterdayKST();
  }

  writeDiagnostic({
    runId,
    targetDate: yesterday.full,
    scrapeType,
    phase: 'SCRAPER',
    event: 'script_start',
    status: 'STARTED',
    details: {
      overrideAlias: overrideAlias || null,
      accountCount: filteredAccounts.filter((account: any) => account?.platform === 'coupang').length,
      shouldScrapeSales,
      shouldScrapeAds,
    },
  });

  let overallRunSuccess = true;

  for (const targetAccount of filteredAccounts) {
    if (!targetAccount || !targetAccount.loginId) continue;
    if (targetAccount.platform !== 'coupang') continue;
    
    let attempts = 0;
    const MAX_RETRY = 3;
    let success = false;

    while (attempts < MAX_RETRY && !success) {
      attempts++;
      const sessionPath = path.join(process.cwd(), 'credentials', `wing_session_${targetAccount.loginId}.json`);
      const sessionExists = fs.existsSync(sessionPath);
      const accountContext = {
        runId,
        account: targetAccount.alias,
        targetDate: yesterday.full,
        scrapeType,
        attempt: attempts,
        maxAttempts: MAX_RETRY,
      };
      
      console.log('\n======================================================');
      console.log(`🔎 [${targetAccount.alias}] 하이브리드 스크래핑 시작 (시도 ${attempts}/${MAX_RETRY})`);
      console.log('======================================================');
      writeDiagnostic({
        ...accountContext,
        phase: 'ACCOUNT',
        event: 'account_attempt_start',
        status: 'STARTED',
        details: {
          sessionExists,
          sessionFileName: path.basename(sessionPath),
          requestedPhases: { sales: shouldScrapeSales, ads: shouldScrapeAds },
        },
      });

      const browser = await chromium.launch({ 
        headless: false,
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-zygote',
        ],
      });
      
      // Keep Playwright's default browser fingerprint; Wing BI can stall when UA/webdriver are spoofed.
      const context = await browser.newContext({ 
        storageState: sessionExists ? sessionPath : undefined,
        locale: 'ko-KR',
        timezoneId: 'Asia/Seoul',
      });
      
      let page = await context.newPage();

      // === 네트워크 도청: 엑셀 다운로드 URL 캡처 ===
      let capturedSalesExcelUrl = '';
      let capturedAdsExcelUrl = '';
      let latestAdsReportPayload: AdsReportPayload | null = null;
      
      const attachDownloadCapture = (targetPage: Page) => {
        targetPage.on('crash', () => {
          console.log(`⚠️ 브라우저 page crash 감지: ${targetAccount.alias}`);
          writeDiagnostic({
            ...accountContext,
            level: 'error',
            phase: 'BROWSER',
            event: 'page_crash',
            status: 'FAILED',
            reason: 'PAGE_CRASH',
          });
        });

        targetPage.on('response', async (response) => {
        const url = response.url();
        if (shouldScrapeAds && url.includes('/marketing-reporting/v2/graphql')) {
          const contentType = response.headers()['content-type'] || '';
          if (contentType.includes('json')) {
            try {
              const body = await response.json();
              const payloads = Array.isArray(body) ? body : [body];
              for (const payload of payloads) {
                const report = payload?.data?.report;
                if (report && Array.isArray(report.rows) && Array.isArray(report.reportColumns)) {
                  latestAdsReportPayload = {
                    id: report.id,
                    reportColumns: report.reportColumns,
                    rows: report.rows,
                  };
                  console.log(`  📡 [광고 GraphQL] report.rows 포착: ${report.rows.length}행`);
                  writeDiagnostic({
                    ...accountContext,
                    phase: 'ADS_DOWNLOAD',
                    event: 'ads_report_rows_detected',
                    status: 'DETECTED',
                    url: getSafeUrl(url),
                    rowCount: report.rows.length,
                    details: {
                      reportId: report.id || null,
                      columnCount: report.reportColumns.length,
                    },
                  });
                }
              }
            } catch (e: any) {
              writeDiagnostic({
                ...accountContext,
                level: 'warn',
                phase: 'ADS_DOWNLOAD',
                event: 'ads_report_rows_parse_failed',
                status: 'FAILED',
                reason: classifyFailure(e.message || String(e)),
                url: getSafeUrl(url),
              });
            }
          }
        }
        // 쿠팡 윙 매출 엑셀 다운로드 URL 패턴 감지
        if (url.includes('excel') || url.includes('download') || url.includes('export')) {
          const contentType = response.headers()['content-type'] || '';
          if (contentType.includes('spreadsheet') || contentType.includes('octet-stream') || contentType.includes('excel')) {
            console.log(`  📡 [도청 성공] 엑셀 URL 감지: ${getSafeUrl(url)}`);
            writeDiagnostic({
              ...accountContext,
              phase: 'NETWORK',
              event: 'excel_response_detected',
              status: 'DETECTED',
              url: getSafeUrl(url),
              details: {
                status: response.status(),
                contentType,
              },
            });
            if (url.includes('advertising') || url.includes('ads') || url.includes('custom-report')) {
              capturedAdsExcelUrl = url;
            } else {
              capturedSalesExcelUrl = url;
            }
          }
        }
        });
      };

      const waitForAdsReportPayload = async (targetDate: string, timeoutMs: number): Promise<AdsReportPayload | null> => {
        const deadline = Date.now() + timeoutMs;
        const dateCompact = targetDate.replace(/-/g, '');
        while (Date.now() < deadline) {
          if (latestAdsReportPayload) {
            const rows = latestAdsReportPayload.rows || [];
            const dateMatched = rows.length === 0 || rows.every(row => String(row.dt || '') === dateCompact);
            if (dateMatched) return latestAdsReportPayload;
          }
          await page.waitForTimeout(1000);
        }
        return null;
      };

      const recreatePage = async (reason: string) => {
        console.log(`♻️ page 재생성: ${reason}`);
        await page.close().catch(() => null);
        page = await context.newPage();
        attachDownloadCapture(page);
        return page;
      };

      attachDownloadCapture(page);

      const ensureWingLogin = async (reason: string) => {
        const loginInput = page.locator('input[name="username"]').first();
        const isLoginPage = page.url().includes('/login') ||
                            page.url().includes('xauth.coupang.com') ||
                            await loginInput.isVisible({ timeout: 3000 }).catch(() => false);

        if (!isLoginPage) return false;

        console.log(`🤖 로그인 화면 재감지 (${reason}) → 계정 재로그인 시도`);
        writeDiagnostic({
          ...accountContext,
          phase: 'LOGIN',
          event: 'relogin_start',
          status: 'STARTED',
          reason,
          url: getSafeUrl(page.url()),
        });
        await loginInput.waitFor({ state: 'visible', timeout: 15000 });
        await loginInput.fill('');
        await loginInput.pressSequentially(targetAccount.loginId, { delay: 80 });

        const pwInput = page.locator('input[name="password"]').first();
        await pwInput.waitFor({ state: 'visible', timeout: 15000 });
        await pwInput.fill('');
        await pwInput.pressSequentially(targetAccount.loginPw, { delay: 80 });

        const submitBtn = page.locator('button[type="submit"], input[type="submit"], #kc-login').first();
        if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await submitBtn.click({ timeout: 5000 }).catch(() => page.keyboard.press('Enter'));
        } else {
          await page.keyboard.press('Enter');
        }

        await page.waitForURL(url =>
          url.href.includes('wing.coupang.com') && !url.href.includes('xauth'),
          { timeout: 120000 }
        );
        await context.storageState({ path: sessionPath });
        console.log(`✅ 재로그인 성공 및 세션 갱신 완료`);
        writeDiagnostic({
          ...accountContext,
          phase: 'LOGIN',
          event: 'relogin_success',
          status: 'SUCCESS',
          reason,
          url: getSafeUrl(page.url()),
          details: { sessionFileName: path.basename(sessionPath) },
        });
        return true;
      };

      try {
        // ================================================
        // PHASE 1: 브라우저 로그인 (기존 로직 유지)
        // ================================================
        console.log(`🌐 Phase 1: 쿠팡 윙 로그인 및 세션 확보...`);
        writeDiagnostic({
          ...accountContext,
          phase: 'LOGIN',
          event: 'wing_home_goto_start',
          status: 'STARTED',
        });
        await page.goto("https://wing.coupang.com/", { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        // 리다이렉트 대기: xauth SSO 또는 기존 /login 또는 대시보드(/tenants) 중 하나에 도달할 때까지
        try {
          await page.waitForURL(url => 
            url.href.includes('/login') || 
            url.href.includes('xauth.coupang.com') || 
            url.href.includes('/tenants'), 
            { timeout: 15000 }
          );
        } catch (e) {}

        // ✅ 로그인 페이지 감지: xauth SSO 도메인 또는 기존 /login 경로 또는 username 입력 폼 존재
        const currentUrl = page.url();
        const isLoginPage = currentUrl.includes('/login') || 
                           currentUrl.includes('xauth.coupang.com') || 
                           await page.locator('input[name="username"]').count() > 0;
        writeDiagnostic({
          ...accountContext,
          phase: 'LOGIN',
          event: 'login_state_detected',
          status: isLoginPage ? 'LOGIN_REQUIRED' : 'SESSION_VALID',
          url: getSafeUrl(currentUrl),
          details: { sessionExists },
        });

        if (isLoginPage) {
          console.log(`🤖 세션 만료! 자동 로그인 시도... (${currentUrl.includes('xauth') ? 'xauth SSO' : 'legacy'} 감지)`);
          try {
            // xauth 페이지 렌더링 대기
            await page.waitForSelector('input[name="username"]', { state: 'visible', timeout: 10000 });
            const idInput = page.locator('input[name="username"]');
            if (await idInput.count() > 0) {
              await idInput.first().click();
              await page.waitForTimeout(300);
              await idInput.first().fill('');  // 기존 값 초기화
              await idInput.first().pressSequentially(targetAccount.loginId, { delay: 150 });
              const pwInput = page.locator('input[name="password"]');
              await pwInput.first().click();
              await page.waitForTimeout(300);
              await pwInput.first().fill('');  // 기존 값 초기화
              await pwInput.first().pressSequentially(targetAccount.loginPw, { delay: 150 });
              await page.waitForTimeout(500);
              
              // ✅ 로그인 버튼 클릭 (다양한 셀렉터 시도)
              let clicked = false;
              const btnSelectors = [
                'button:has-text("로그인"):not(:has-text("유지"))',
                'input[type="submit"]',
                'button[type="submit"]',
                '#kc-login',  // Keycloak 기본 ID
              ];
              for (const sel of btnSelectors) {
                try {
                  const btn = page.locator(sel).first();
                  if (await btn.count() > 0) {
                    await btn.click({ timeout: 3000 });
                    clicked = true;
                    console.log(`  ✅ 로그인 버튼 클릭 성공 (${sel})`);
                    break;
                  }
                } catch(e) {}
              }
              if (!clicked) {
                console.log(`  ⚠️ 버튼 셀렉터 매칭 실패 → Enter 키 폴백`);
                await page.keyboard.press('Enter');
              }
              
              console.log(`⚠️ 2단계 인증(문자 등) 필요시 2분 내 수동 처리 필요!`);
            }
            // ✅ 핵심 수정: xauth를 탈출하여 wing.coupang.com에 도달했는지 확인
            await page.waitForURL(url => 
              url.href.includes('wing.coupang.com') && !url.href.includes('xauth'), 
              { timeout: 120000 }
            );
            await context.storageState({ path: sessionPath });
            console.log(`✅ 로그인 성공! 세션 저장 완료.`);
            writeDiagnostic({
              ...accountContext,
              phase: 'LOGIN',
              event: 'login_success',
              status: 'SUCCESS',
              url: getSafeUrl(page.url()),
              details: { sessionFileName: path.basename(sessionPath) },
            });
          } catch (e) {
            console.log("⚠️ 로그인 실패 (2차 인증 만료 등)");
            const screenshotPath = await saveFailureScreenshot(page, `login_fail_debug_${targetAccount.alias}_${getNowKSTTimestamp()}`);
            writeDiagnostic({
              ...accountContext,
              level: 'error',
              phase: 'LOGIN',
              event: 'login_failed',
              status: 'FAILED',
              reason: classifyFailure(e instanceof Error ? e.message : String(e)),
              ...(await getPageDiagnostic(page)),
              filePath: screenshotPath,
              error: e,
            });
            await browser.close();
            continue;
          }
        } else {
          console.log(`✅ 기존 세션으로 자동 인증 통과!`);
        }

        let phase2Success = !shouldScrapeSales;
        let phase3Success = !shouldScrapeAds;

        if (shouldScrapeSales) {
        // ================================================
        // PHASE 2: 매출 엑셀 - 네트워크 스니핑으로 URL 확보 후 Request 다운로드
        // ================================================
        console.log(`\n📊 Phase 2: 매출 데이터 엑셀 다운로드 (하이브리드)...`);
        writeDiagnostic({
          ...accountContext,
          phase: 'SALES_DOWNLOAD',
          event: 'phase_start',
          status: 'STARTED',
        });
        
        // 팝업 정리 (최소화)
        await page.waitForTimeout(3000);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        await page.keyboard.press('Escape');
        
        // 판매분석 페이지 이동 복구 루프
        phase2Success = false;
        for (let retry = 0; retry < 3; retry++) {
           try {
              writeDiagnostic({
                ...accountContext,
                phase: 'SALES_DOWNLOAD',
                event: 'phase_attempt_start',
                status: 'STARTED',
                attempt: retry + 1,
                maxAttempts: 3,
              });
              if (retry === 1) {
                 console.log(`🚨 [Phase 2] 1단계 실패! 새로고침(F5) 시도...`);
                 await recreatePage('Phase 2 로딩 정지 후 1차 복구');
                 await page.goto('https://wing.coupang.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
                 await ensureWingLogin('Phase 2 복구 홈 진입');
                 await page.waitForTimeout(5000);
                 const salesUrl = `https://wing.coupang.com/tenants/business-insight/sales-analysis?start_date=${yesterday.full}&end_date=${yesterday.full}`;
                 await page.goto(salesUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                 await ensureWingLogin('Phase 2 복구 판매분석 진입');
              } else if (retry === 2) {
                 await recreatePage('Phase 2 loading stuck recovery 2');
                 console.log(`🚨 [Phase 2] 2단계 실패! 메인 대시보드 경유 진입 시도...`);
                 await page.goto('https://wing.coupang.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
                 await ensureWingLogin('Phase 2 대시보드 경유 홈 진입');
                 await page.waitForTimeout(5000);
                 const salesUrl = `https://wing.coupang.com/tenants/business-insight/sales-analysis?start_date=${yesterday.full}&end_date=${yesterday.full}`;
                 await page.goto(salesUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                 await ensureWingLogin('Phase 2 대시보드 경유 판매분석 진입');
              } else {
                 const salesUrl = `https://wing.coupang.com/tenants/business-insight/sales-analysis?start_date=${yesterday.full}&end_date=${yesterday.full}`;
                 console.log(`📌 판매분석 페이지 이동 (어제: ${yesterday.full})...`);
                 await page.goto(salesUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                 await ensureWingLogin('Phase 2 최초 판매분석 진입');
              }
              writeDiagnostic({
                ...accountContext,
                phase: 'SALES_DOWNLOAD',
                event: 'sales_page_loaded',
                status: 'LOADED',
                attempt: retry + 1,
                url: getSafeUrl(page.url()),
                title: await page.title().catch(() => ''),
              });

              // 버튼 노출 시까지 최대 60초 동적 이벤트 대기
              const excelBtn = page.locator('button, a, span, div').filter({ hasText: /엑셀\s*다운로드/ }).last();
              await excelBtn.waitFor({ state: 'visible', timeout: 60000 });
              console.log(`  ✅ 엑셀 다운로드 버튼 노출(렌더링) 확인`);
              writeDiagnostic({
                ...accountContext,
                phase: 'SALES_DOWNLOAD',
                event: 'excel_button_visible',
                status: 'VISIBLE',
                attempt: retry + 1,
                locator: 'button,a,span,div hasText=/엑셀\\s*다운로드/',
              });

              // 데이터 안정화 대기
              await page.waitForTimeout(5000);

              // 다운로드 로직
              console.log(`📥 매출 엑셀 다운로드 시작...`);
              const downloadPromise = page.waitForEvent('download', { timeout: 120000 });
              await excelBtn.click({ force: true, timeout: 5000 }).catch(() => excelBtn.dispatchEvent('click'));
              await page.waitForTimeout(2000);
              
              const productExcelBtn = page.locator('button, div, span, a, li').filter({ hasText: /상품별\s*엑셀\s*다운로드|항목별|옵션별|상품별/ }).last();
              if (await productExcelBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
                console.log(`  📋 상품별 엑셀 다운로드 옵션 감지 → 클릭`);
                await productExcelBtn.click({ force: true, timeout: 5000 }).catch(() => productExcelBtn.dispatchEvent('click'));
              } else {
                console.log(`  ⚠️ 상품별 다운로드 옵션 미감지. 드롭다운 직후 다운로드 이벤트 대기 계속.`);
              }
              
              const download = await downloadPromise;
              const kstTs = getNowKSTTimestamp();
              const downloadPath = path.join(process.cwd(), 'downloads', `coupang_sales_${targetAccount.alias}_${yesterday.full}_${kstTs}.xlsx`);
              await download.saveAs(downloadPath);
              console.log(`🎉 매출 엑셀 다운로드 성공! → ${downloadPath}`);
              const salesFileSize = fs.statSync(downloadPath).size;
              writeDiagnostic({
                ...accountContext,
                phase: 'SALES_DOWNLOAD',
                event: 'download_saved',
                status: 'SUCCESS',
                attempt: retry + 1,
                filePath: downloadPath,
                fileSizeBytes: salesFileSize,
              });
              
              // 다운로드 성공 후 예약 작업들
              const wingCookies = await extractCookieHeader(context, 'wing.coupang.com');
              console.log(`🍪 윙 세션 쿠키 추출 완료 (${wingCookies.length}자)`);
              
              if (capturedSalesExcelUrl) {
                console.log(`📡 매출 엑셀 API URL 캡처 성공: ${getSafeUrl(capturedSalesExcelUrl)}`);
                fs.writeFileSync(
                  path.join(process.cwd(), 'credentials', 'captured_sales_api.json'),
                  JSON.stringify({ url: capturedSalesExcelUrl, captured_at: new Date().toISOString() }, null, 2)
                );
              }
              
              phase2Success = true;
              break; 
           } catch(e: any) {
              console.log(`⚠️ Phase 2 에러 (시도 ${retry+1}/3): ${e.message.split('\n')[0]}`);
              const screenshotPath = await saveFailureScreenshot(page, `phase2_fail_${targetAccount.alias}_${yesterday.full}_try${retry+1}`);
              writeDiagnostic({
                ...accountContext,
                level: 'error',
                phase: 'SALES_DOWNLOAD',
                event: 'phase_attempt_failed',
                status: 'FAILED',
                attempt: retry + 1,
                maxAttempts: 3,
                reason: classifyFailure(e.message || String(e)),
                ...(await getPageDiagnostic(page)),
                filePath: screenshotPath,
                error: e,
              });
           }
        }
        
        if (!phase2Success) {
           fs.rmSync(sessionPath, { force: true });
           console.log(`🧹 매출 수집 실패로 Wing 세션 파일 삭제. 다음 계정 재시도에서 재로그인합니다.`);
           writeDiagnostic({
             ...accountContext,
             level: 'error',
             phase: 'SALES_DOWNLOAD',
             event: 'phase_failed',
             status: 'FAILED',
             reason: 'SALES_EXCEL_DOWNLOAD_FAILED',
             details: { sessionFileRemoved: true, sessionFileName: path.basename(sessionPath) },
           });
           await recreatePage('Phase 2 final failure before ads isolation');
           console.log(`❌ Phase 2 엑셀 다운로드 최종 실패`);
        }
        } else {
          console.log(`⏭️ Phase 2 매출 데이터 수집 스킵 (SCRAPE_TYPE=${scrapeType})`);
        }

        if (shouldScrapeAds) {
        // ================================================
        // PHASE 3: 광고 데이터 엑셀 (기존 Two-Step 방식 유지 + URL 캡처)
        // ================================================
        writeDiagnostic({
          ...accountContext,
          phase: 'ADS_DOWNLOAD',
          event: 'phase_start',
          status: 'STARTED',
        });
        // ✅ 광고센터 접속 (HTTP2 에러 대응: 최대 3회 재시도)
        let adsPageLoaded = false;
        for (let adsRetry = 0; adsRetry < 3; adsRetry++) {
          try {
            writeDiagnostic({
              ...accountContext,
              phase: 'ADS_DOWNLOAD',
              event: 'ads_home_goto_start',
              status: 'STARTED',
              attempt: adsRetry + 1,
              maxAttempts: 3,
              url: 'https://advertising.coupang.com/',
            });
            await page.goto('https://advertising.coupang.com/', { waitUntil: 'commit', timeout: 60000 });
            await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => null);
            adsPageLoaded = true;
            writeDiagnostic({
              ...accountContext,
              phase: 'ADS_DOWNLOAD',
              event: 'ads_home_loaded',
              status: 'LOADED',
              attempt: adsRetry + 1,
              ...(await getPageDiagnostic(page)),
            });
            break;
          } catch (e: any) {
            console.log(`  ⚠️ 광고센터 접속 실패 (시도 ${adsRetry+1}/3): ${e.message.substring(0, 80)}`);
            writeDiagnostic({
              ...accountContext,
              level: 'error',
              phase: 'ADS_DOWNLOAD',
              event: 'ads_home_goto_failed',
              status: 'FAILED',
              attempt: adsRetry + 1,
              maxAttempts: 3,
              reason: classifyFailure(e.message || String(e)),
              error: e,
            });
            if (adsRetry < 2) {
              await page.waitForTimeout(5000);
            }
          }
        }
        
        if (!adsPageLoaded) {
          console.log(`❌ 광고센터 접속 3회 연속 실패. 광고 데이터 스킵.`);
          writeDiagnostic({
            ...accountContext,
            level: 'error',
            phase: 'ADS_DOWNLOAD',
            event: 'phase_failed',
            status: 'FAILED',
            reason: 'ADS_HOME_UNAVAILABLE',
          });
          throw new Error('광고센터 접속 불가');
        }
        
        // 페이지 로드 안정 대기
        await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => null);
        await page.waitForTimeout(3000);

        page.on('dialog', async dialog => {
          await dialog.accept().catch(() => null);
        });

        // SSO 로그인 게이트웨이
        if (page.url().includes('login') || (await page.locator('text=쿠팡 광고센터 로그인').count() > 0)) {
          console.log(`🔐 광고센터 SSO 통과 시도...`);
          const wingLoginBtn = page.locator('text="로그인하기"').or(page.locator('text="Log in"')).first();
          await wingLoginBtn.click({ timeout: 15000 }).catch(() => null);
          await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
          await page.waitForTimeout(3000);
          await page.goto('https://advertising.coupang.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
          await page.waitForTimeout(3000);
        }

        // 보고서 메뉴
        const reportMenu = page.locator('a').filter({ hasText: /광고보고서/ }).first();
        if (await reportMenu.isVisible({ timeout: 10000 }).catch(() => false)) {
          await reportMenu.click().catch(() => null);
          await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
          await page.waitForTimeout(2000);
        }

        // SSO 다중 레이어
        for (let i = 0; i < 3; i++) {
          const loginGateBtn = page.locator('text="로그인하기"').or(page.locator('text="판매자 또는 광고대행사로 로그인"')).first();
          if (await loginGateBtn.isVisible().catch(() => false)) {
            await loginGateBtn.click({ force: true }).catch(() => null);
            await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => null);
            await page.waitForTimeout(3000);
          } else break;
        }

        if (!page.url().includes('custom-report')) {
          await page.goto('https://advertising.coupang.com/marketing-reporting/billboard/custom-report', { waitUntil: 'domcontentloaded', timeout: 60000 });
          await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => null);
          await page.waitForTimeout(3000);
        }


        // ================================================
        // 맞춤 보고서 생성 & 다운로드 (3단계 재시도 루프)
        // ================================================
        phase3Success = false;
        
        for (let formRetry = 0; formRetry < 3; formRetry++) {
          try {
             writeDiagnostic({
               ...accountContext,
               phase: 'ADS_DOWNLOAD',
               event: 'report_form_attempt_start',
               status: 'STARTED',
               attempt: formRetry + 1,
               maxAttempts: 3,
             });
             if (formRetry === 1) {
                console.log(`⚠️ Phase 3 생성 오류! 새로고침(F5) 시도...`);
                await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
                await page.waitForTimeout(10000);
             } else if (formRetry === 2) {
                console.log(`⚠️ Phase 3 (2단계 실패)! 광고 홈 경유 재진입...`);
                await page.goto('https://advertising.coupang.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
                await page.waitForTimeout(5000);
                await page.goto('https://advertising.coupang.com/marketing-reporting/billboard/custom-report', { waitUntil: 'domcontentloaded', timeout: 60000 });
                await page.waitForTimeout(10000);
             }

             // 맞춤 보고서 라벨 렌더링 대기 (최대 60초)
             const layoutVerifier = page.locator('label').filter({ hasText: '맞춤 보고서' }).first();
             await layoutVerifier.waitFor({ state: 'visible', timeout: 60000 });
             console.log(`✅ [시도 ${formRetry + 1}/3] 맞춤 보고서 화면 정상 렌더링 확인됨`);
             writeDiagnostic({
               ...accountContext,
               phase: 'ADS_DOWNLOAD',
               event: 'custom_report_visible',
               status: 'VISIBLE',
               attempt: formRetry + 1,
               locator: 'label hasText=맞춤 보고서',
               ...(await getPageDiagnostic(page)),
             });

             // 맞춤 보고서 선택
             console.log(`📌 '맞춤 보고서' 라디오 버튼 선택...`);
             const customReportLabel = page.locator('label').filter({ hasText: '맞춤 보고서' }).first();
             await customReportLabel.click({ force: true }).catch(() => null);
             await page.waitForTimeout(1500);

             // 특정 기간 + 어제 날짜
             console.log(`📌 '특정 기간' → 어제 날짜 선택...`);
             const customPeriodRadio = page.locator('label').filter({ hasText: '특정 기간' }).first();
             await customPeriodRadio.click({ force: true }).catch(() => null);
             await page.waitForTimeout(1500);

             const datePickerBox = page.locator('.ant-picker, input[placeholder*="2"]').first();
             if (await datePickerBox.isVisible().catch(()=>false)) {
               await datePickerBox.click({ force: true }).catch(() => null);
               await page.waitForTimeout(1500);
               const yesterdayCell = page.locator(`td[title="${yesterday.full}"]`).first();
               if (await yesterdayCell.count() > 0) {
                 await yesterdayCell.click({ force: true });
                 await page.waitForTimeout(1000);
                 await yesterdayCell.click({ force: true });
                 await page.waitForTimeout(1500);
               }
             }

             // 일별 선택
             const dailyBtn = page.locator('label').filter({ hasText: '일별' }).first();
             if (await dailyBtn.isVisible().catch(()=>false)) {
               await dailyBtn.click({ force: true }).catch(() => null);
             }

             // 캠페인 유형 체크 (토글 방지: 미체크 상태인 경우에만 클릭)
             for (const t of ['매출 성장 광고', '신규 구매 고객 확보 광고', '인지도 상승 광고']) {
               const chkLabel = page.locator('label').filter({ hasText: t }).first();
               if (await chkLabel.isVisible({ timeout: 3000 }).catch(() => false)) {
                 const checkbox = chkLabel.locator('input[type="checkbox"]').first();
                 const isAlreadyChecked = await checkbox.isChecked().catch(() => false);
                 if (!isAlreadyChecked) {
                   await chkLabel.click().catch(() => null);
                   console.log(`  ✅ 캠페인 유형 [${t}] 체크 ON`);
                 } else {
                   console.log(`  ℹ️ 캠페인 유형 [${t}] 이미 체크됨 → 스킵`);
                 }
                 await page.waitForTimeout(500);
               }
             }
             await page.waitForTimeout(2000);
             latestAdsReportPayload = null;

             // ✅ 캠페인 전체선택 V3 (드롭다운 열림 검증 + DOM 디버깅)
             let campaignSelected = false;
             
             for (let selRetry = 0; selRetry < 3; selRetry++) {
               try {
                 // 이미 선택되어 있는지 확인
                 const alreadySelected = page.locator('.ant-select-selection-overflow-item, .ant-select-selection-item');
                 if (await alreadySelected.count() > 0) {
                   console.log(`  ✅ 캠페인이 이미 선택되어 있습니다.`);
                   campaignSelected = true;
                   break;
                 }

                 console.log(`  📦 [시도 ${selRetry+1}/3] 캠페인 콤보박스 열기 시도...`);
                 let dropdownOpened = false;
                 
                 // 전략 A: 텍스트 직접 클릭
                 const textTargets = [
                   page.locator('text="캠페인을 선택하세요"').first(),
                   page.locator('*:has-text("캠페인을 선택하세요")').last(),
                   page.locator('[placeholder="캠페인을 선택하세요"]').first(),
                 ];
                 for (const target of textTargets) {
                   try {
                     if (await target.isVisible({ timeout: 3000 }).catch(() => false)) {
                       await target.click({ force: true });
                       await page.waitForTimeout(2000);
                       const dropdown = page.locator('.ant-select-dropdown, [class*="dropdown"], [role="listbox"]').first();
                       if (await dropdown.isVisible({ timeout: 3000 }).catch(() => false)) {
                         console.log(`    ✅ 드롭다운 열림 확인!`);
                         dropdownOpened = true;
                         break;
                       }
                     }
                   } catch(e) {}
                 }
                 
                 // 전략 B: 화살표 아이콘 클릭
                 if (!dropdownOpened) {
                   const arrowTargets = [
                     page.locator('.ant-select-arrow, [class*="select-arrow"]').last(),
                     page.locator('.anticon-down, [class*="suffix"]').last(),
                   ];
                   for (const arrow of arrowTargets) {
                     try {
                       if (await arrow.isVisible({ timeout: 2000 }).catch(() => false)) {
                         await arrow.click({ force: true });
                         await page.waitForTimeout(2000);
                         const dropdown = page.locator('.ant-select-dropdown, [class*="dropdown"], [role="listbox"]').first();
                         if (await dropdown.isVisible({ timeout: 3000 }).catch(() => false)) {
                           console.log(`    ✅ 화살표 클릭으로 드롭다운 열림!`);
                           dropdownOpened = true;
                           break;
                         }
                       }
                     } catch(e) {}
                   }
                 }
                 
                 // 전략 C: JS DOM 직접 조작
                 if (!dropdownOpened) {
                   console.log(`    ⚠️ 클릭 실패. JS DOM 직접 조작 시도...`);
                   await page.evaluate(() => {
                     const selectors = document.querySelectorAll('.ant-select, [class*="select"]');
                     for (const sel of selectors) {
                       const text = sel.textContent || '';
                       if (text.includes('캠페인') || text.includes('선택하세요')) {
                         const input = sel.querySelector('input') || sel;
                         input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                         input.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                         (input as HTMLElement).focus?.();
                         break;
                       }
                     }
                   });
                   await page.waitForTimeout(2000);
                   const dropdown = page.locator('.ant-select-dropdown, [class*="dropdown"], [role="listbox"]').first();
                   if (await dropdown.isVisible({ timeout: 3000 }).catch(() => false)) {
                     console.log(`    ✅ JS 이벤트 주입으로 드롭다운 열림!`);
                     dropdownOpened = true;
                   }
                 }
                 
                 // 드롭다운 미오픈 시 DOM 디버깅
                 if (!dropdownOpened) {
                   const domInfo = await page.evaluate(() => {
                     const els = document.querySelectorAll('[class*="select"], [class*="campaign"]');
                     return Array.from(els).slice(0, 10).map(el => ({
                       tag: el.tagName,
                       cls: el.className.toString().substring(0, 100),
                       text: (el.textContent || '').substring(0, 50),
                     }));
                   });
                   console.log(`    🔍 DOM 디버깅 (select 관련 요소 ${domInfo.length}개):`);
                   domInfo.forEach((d: any, i: number) => console.log(`      [${i}] <${d.tag}> class="${d.cls}" text="${d.text}"`));
                   await page.screenshot({ path: path.join(process.cwd(), 'logs', `campaign_box_fail_${formRetry}_${selRetry}.png`) }).catch(()=>{});
                   await page.waitForTimeout(3000);
                   continue;
                 }
                 
                 // 드롭다운 열림 → 전체선택 시도
                 console.log(`  🎯 드롭다운 열림 → 전체선택 시도...`);
                 
                 // DOM 덤프 (디버깅)
                 const dropdownHTML = await page.evaluate(() => {
                   const allEls = document.querySelectorAll('*');
                   const found: string[] = [];
                   allEls.forEach(el => {
                     const text = el.textContent || '';
                     if ((text.includes('전체선택') || text.includes('전체 선택')) && el.children.length < 5) {
                       found.push(`<${el.tagName} class="${el.className.toString().substring(0,100)}" text="${text.substring(0,40)}" childCount=${el.children.length}>`);
                       if (el.parentElement) {
                         found.push(`  PARENT: <${el.parentElement.tagName} class="${el.parentElement.className.toString().substring(0,100)}">`);
                       }
                     }
                   });
                   return found.join('\n') || 'NO_전체선택_FOUND';
                 });
                 console.log(`  📋 '전체선택' DOM:`);
                 dropdownHTML.split('\n').forEach(line => console.log(`    ${line}`));
                 
                 await page.screenshot({ path: path.join(process.cwd(), 'logs', `dropdown_open_${formRetry}_${selRetry}.png`) }).catch(()=>{});
                 
                 let clickedSelectAll = false;
                 
                 // 방법 1: Playwright locator로 label 직접 클릭 (React 이벤트 정상 트리거)
                 const selectAllLabel = page.locator('label.ant-checkbox-wrapper').filter({ hasText: /전체\s*선택/ }).first();
                 if (await selectAllLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
                   await selectAllLabel.click({ force: true });
                   await page.waitForTimeout(2000);
                   
                   // 체크 상태 확인
                   const isChecked = await selectAllLabel.locator('input[type="checkbox"]').isChecked().catch(() => false);
                   console.log(`    → Playwright '전체선택' label 클릭 성공. 체크 상태: ${isChecked}`);
                   if (isChecked) {
                     clickedSelectAll = true;
                   }
                 }
                 
                 // 방법 2: Span 텍스트 클릭
                 if (!clickedSelectAll) {
                   console.log(`    ⚠️ Label 클릭 실패(또는 미체크). Span 텍스트 직접 클릭 시도...`);
                   const selectAllSpan = page.locator('span').filter({ hasText: /^전체\s*선택$/ }).first();
                   if (await selectAllSpan.isVisible({ timeout: 2000 }).catch(() => false)) {
                     await selectAllSpan.click({ force: true });
                     await page.waitForTimeout(2000);
                     clickedSelectAll = true;
                   }
                 }
                 
                 // 방법 3: 개별 캠페인 label 모두 클릭
                 if (!clickedSelectAll) {
                   console.log(`    ⚠️ 전체선택 실패. 개별 캠페인 라벨 전부 클릭 시도...`);
                   const itemLabels = page.locator('label.ant-checkbox-wrapper:not(:has-text("전체선택"))');
                   const cbCount = await itemLabels.count();
                   if (cbCount > 0) {
                     for (let i = 0; i < Math.min(cbCount, 50); i++) {
                       const itemLabel = itemLabels.nth(i);
                       const isChecked = await itemLabel.locator('input[type="checkbox"]').isChecked().catch(() => true);
                       if (!isChecked) {
                         await itemLabel.click({ force: true }).catch(() => null);
                         await page.waitForTimeout(200);
                       }
                     }
                     clickedSelectAll = true;
                     console.log(`    ✅ 개별 라벨 최대 50개 Playwright 클릭 완료`);
                   }
                 }
                 
                 // 확인/적용/완료 버튼 클릭
                 console.log(`    🔍 드롭다운 내 '적용/확인/완료' 버튼 탐색...`);
                 const confirmBtnPattern = page.locator('.ant-dropdown, [class*="dropdown"], .campaign-picker-menu-list-buttons').locator('button, [role="button"], a').filter({ hasText: /적용|확인|완료/ }).first();
                 
                 if (await confirmBtnPattern.isVisible({ timeout: 2000 }).catch(() => false)) {
                   await confirmBtnPattern.click({ force: true });
                   console.log(`    ✅ '적용/확인/완료' 버튼 클릭 성공!`);
                   await page.waitForTimeout(2000);
                 } else {
                   console.log(`    ⚠️ '적용/확인/완료' 버튼 없음. 바탕 클릭으로 닫기 시도...`);
                   await page.mouse.click(10, 10);
                   await page.waitForTimeout(2000);
                 }
                 
                 // 검증: 이미 드롭다운 내에서 체크박스 상태를 확인했으므로 신뢰
                 if (clickedSelectAll) {
                   console.log(`  ✅ 캠페인 전체선택 완료!`);
                   campaignSelected = true;
                   break;
                 }
               } catch(e: any) {
                 console.log(`  ⚠️ [시도 ${selRetry+1}/3] 캠페인 선택 에러: ${e.message.split('\n')[0]}`);
                 await page.screenshot({ path: path.join(process.cwd(), 'logs', `campaign_fail_${formRetry}_${selRetry}.png`) }).catch(()=>{});
                 await page.mouse.click(0, 0);
                 await page.waitForTimeout(3000);
               }
             }
             
             if (!campaignSelected) {
                console.log(`❌ 캠페인 콤보박스 에러. 다음 재시도 회차로 넘깁니다.`);
                continue;
             }

             console.log(`📡 광고 GraphQL report.rows 수신 대기...`);
             const adsReportPayload = await waitForAdsReportPayload(yesterday.full, 30000);
             if (adsReportPayload) {
               const adsKstTs = getNowKSTTimestamp();
               const adsDownloadPath = path.join(process.cwd(), 'downloads', `coupang_ads_${targetAccount.alias}_${yesterday.full}_${adsKstTs}.xlsx`);
               saveAdsReportRowsAsXlsx(adsReportPayload.rows, adsDownloadPath);
               const adsRowCount = getExcelDataRowCount(adsDownloadPath);
               const adsFileSize = fs.statSync(adsDownloadPath).size;
               console.log(`🎉 광고 GraphQL 수집 완료! → ${adsDownloadPath} (${adsRowCount}행)`);
               writeDiagnostic({
                 ...accountContext,
                 phase: 'ADS_DOWNLOAD',
                 event: 'graphql_rows_saved_as_xlsx',
                 status: 'SUCCESS',
                 attempt: formRetry + 1,
                 filePath: adsDownloadPath,
                 fileSizeBytes: adsFileSize,
                 rowCount: adsRowCount,
                 details: {
                   reportId: adsReportPayload.id || null,
                   columnCount: adsReportPayload.reportColumns.length,
                   source: 'marketing-reporting/v2/graphql report.rows',
                 },
               });

               phase3Success = true;
               writeDiagnostic({
                 ...accountContext,
                 phase: 'ADS_DOWNLOAD',
                 event: 'phase_success',
                 status: 'SUCCESS',
                 attempt: formRetry + 1,
                 rowCount: adsRowCount,
                 details: { source: 'GRAPHQL_REPORT_ROWS' },
               });
               break;
             }

             console.log(`⚠️ 광고 GraphQL 응답 미포착 → 기존 엑셀 생성/다운로드 방식으로 폴백합니다.`);
             writeDiagnostic({
               ...accountContext,
               level: 'warn',
               phase: 'ADS_DOWNLOAD',
               event: 'graphql_rows_missing_fallback',
               status: 'FAILED',
               reason: 'GRAPHQL_REPORT_ROWS_MISSING',
               attempt: formRetry + 1,
             });

             // Two-Step 다운로드
             console.log(`🔫 [Two-Step] 1단계: 엑셀 생성하기 버튼 대기(최대 1분)...`);
             const exportResponsePromise = page.waitForResponse(response => 
               response.url().includes('generate') || response.url().includes('export') || (response.url().includes('download') && 
               response.status() === 200), { timeout: 60000 }).catch(() => null);

             const genBtn = page.locator('button').filter({ hasText: '엑셀 생성하기' }).first();
             await genBtn.waitFor({ state: 'visible', timeout: 60000 });
             await page.waitForTimeout(1500); 
             
             const isDisabled = await genBtn.evaluate((el: HTMLElement) => {
                if (el instanceof HTMLButtonElement && el.disabled) return true;
                return el.hasAttribute('disabled') || el.classList.contains('disabled') || el.getAttribute('aria-disabled') === 'true';
             });
             
             if (isDisabled) {
                // 디버깅: 비활성화 시점의 폼 상태를 스크린샷으로 캡처
                await page.screenshot({ path: path.join(process.cwd(), 'logs', `gen_disabled_${targetAccount.alias}_${formRetry}.png`), fullPage: true }).catch(()=>{});
                console.log(`  ⚠️ '엑셀 생성하기' 버튼 비활성화. 3초 추가 대기 후 재확인...`);
                await page.waitForTimeout(3000);
                
                // 재확인: 혹시 캠페인 선택 직후 렌더링 딜레이로 비활성화된 경우
                const stillDisabled = await genBtn.evaluate((el: HTMLElement) => {
                   if (el instanceof HTMLButtonElement && el.disabled) return true;
                   return el.hasAttribute('disabled') || el.classList.contains('disabled') || el.getAttribute('aria-disabled') === 'true';
                });
                
                if (stillDisabled) {
                   console.log(`  ⚠️ 재확인 후에도 비활성화 → 캠페인 선택/데이터 로딩 실패로 보고 재시도.`);
                   continue;
                } else {
                   console.log(`  ✅ 재확인 결과 활성화됨! 클릭 진행.`);
                }
             }
             
             await genBtn.click({ timeout: 10000 }).catch(() => genBtn.evaluate(b => (b as HTMLButtonElement).click()));
             console.log(`  ✅ '엑셀 생성하기' 통과!`);
             
             const exportRes = await exportResponsePromise;
             if (exportRes) console.log(`  [통신 포착] 생성 요청 전송 완료.`);
             
             console.log(`⏳ 엑셀 백엔드 컴파일 대기 (최대 120초)...`);
             
             let downloadReady = false;
             for (let i = 0; i < 24; i++) {
               downloadReady = await page.evaluate(() => {
                  const btns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('엑셀 다운로드'));
                  return btns.length > 0;
               });
               if (downloadReady) break;
               if (i % 6 === 5) console.log(`  ... 아직 생성 대기 중 (${(i + 1) * 5}초 경과)`);
               await page.waitForTimeout(5000);
             }

             if (downloadReady) {
               console.log(`🔫 [Two-Step] 2단계: 엑셀 다운로드 버튼 감지! 클릭...`);
               const adsDownloadPromise = page.waitForEvent('download', { timeout: 90000 }).catch(() => null);
               await page.evaluate(() => {
                  const dBtn = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('엑셀 다운로드')).pop();
                  if (dBtn) dBtn.click();
               });
               const adsDownloadObj = await adsDownloadPromise;

               if (adsDownloadObj) {
                 const adsKstTs = getNowKSTTimestamp();
                 const adsDownloadPath = path.join(process.cwd(), 'downloads', `coupang_ads_${targetAccount.alias}_${yesterday.full}_${adsKstTs}.xlsx`);
                 await adsDownloadObj.saveAs(adsDownloadPath);
                 console.log(`🎉 광고 엑셀 다운로드 완료! → ${adsDownloadPath}`);

                 const adsRowCount = getExcelDataRowCount(adsDownloadPath);
                 const adsFileSize = fs.statSync(adsDownloadPath).size;
                 writeDiagnostic({
                   ...accountContext,
                   phase: 'ADS_DOWNLOAD',
                   event: 'download_saved',
                   status: adsRowCount > 0 ? 'SUCCESS' : 'EMPTY',
                   attempt: formRetry + 1,
                   filePath: adsDownloadPath,
                   fileSizeBytes: adsFileSize,
                   rowCount: adsRowCount,
                 });
                 if (adsRowCount === 0) {
                   console.log(`⚠️ 광고 엑셀에 데이터 행이 없습니다. 성공 처리하지 않고 재시도합니다.`);
                   moveEmptyAdsReport(adsDownloadPath);
                   writeDiagnostic({
                     ...accountContext,
                     level: 'warn',
                     phase: 'ADS_DOWNLOAD',
                     event: 'empty_excel_quarantined',
                     status: 'FAILED',
                     reason: 'EMPTY_EXCEL',
                     filePath: adsDownloadPath,
                     rowCount: adsRowCount,
                   });
                   continue;
                 }
                 
                 if (capturedAdsExcelUrl) {
                   fs.writeFileSync(
                     path.join(process.cwd(), 'credentials', 'captured_ads_api.json'),
                     JSON.stringify({ url: capturedAdsExcelUrl, captured_at: new Date().toISOString() }, null, 2)
                   );
                 }

                 phase3Success = true;
                 writeDiagnostic({
                   ...accountContext,
                   phase: 'ADS_DOWNLOAD',
                   event: 'phase_success',
                   status: 'SUCCESS',
                   attempt: formRetry + 1,
                   rowCount: adsRowCount,
                 });
                 break;
               } else {
                 console.log(`❌ 광고 엑셀 다운로드 이벤트 미수신`);
                 writeDiagnostic({
                   ...accountContext,
                   level: 'warn',
                   phase: 'ADS_DOWNLOAD',
                   event: 'download_event_missing',
                   status: 'FAILED',
                   reason: 'NO_DOWNLOAD',
                   attempt: formRetry + 1,
                 });
               }
             } else {
               const tsPath = path.join(process.cwd(), 'downloads', `ERROR_timeout_${targetAccount.alias}_${getNowKSTTimestamp()}.png`);
               await page.screenshot({ path: tsPath, fullPage: true }).catch(() => null);
               console.log(`❌ 120초 내 '엑셀 다운로드' 버튼 미출현.`);
               writeDiagnostic({
                 ...accountContext,
                 level: 'error',
                 phase: 'ADS_DOWNLOAD',
                 event: 'download_button_timeout',
                 status: 'FAILED',
                 reason: 'PAGE_TIMEOUT',
                 attempt: formRetry + 1,
                 filePath: tsPath,
                 ...(await getPageDiagnostic(page)),
               });
             }
          } catch(e: any) {
             console.log(`❌ Phase 3 에러 (시도 ${formRetry+1}/3): ${e.message.split('\n')[0]}`);
             const screenshotPath = await saveFailureScreenshot(page, `phase3_fail_${targetAccount.alias}_${yesterday.full}_try${formRetry+1}`);
             writeDiagnostic({
               ...accountContext,
               level: 'error',
               phase: 'ADS_DOWNLOAD',
               event: 'report_form_attempt_failed',
               status: 'FAILED',
               attempt: formRetry + 1,
               maxAttempts: 3,
               reason: classifyFailure(e.message || String(e)),
               ...(await getPageDiagnostic(page)),
               filePath: screenshotPath,
               error: e,
             });
          }
        } // end of formRetry loop
        
        if (!phase3Success) {
           console.log(`🚨 Phase 3 광고 다운로드 최종 실패. 최대 재시도(3회) 초과.`);
           writeDiagnostic({
             ...accountContext,
             level: 'error',
             phase: 'ADS_DOWNLOAD',
             event: 'phase_failed',
             status: 'FAILED',
             reason: 'ADS_EXCEL_DOWNLOAD_FAILED',
           });
        }
        } else {
          console.log(`⏭️ Phase 3 광고 데이터 수집 스킵 (SCRAPE_TYPE=${scrapeType})`);
        }

        // 세션 저장 & 종료
        try { await context.storageState({ path: sessionPath }); } catch(e) {}
        await browser.close();
        console.log(`\n✅ [${targetAccount.alias}] 하이브리드 스크래핑 완료!`);
        if (shouldScrapeSales) {
          await logAutomation(
            targetAccount?.alias || 'unknown',
            'WING_SALES',
            phase2Success ? 'SUCCESS' : 'FAILED',
            phase2Success ? '' : `Sales Excel download failed for ${yesterday.full}`,
            Date.now() - scriptStartTime
          );
        }

        if (!phase2Success || !phase3Success) {
          throw new Error(`Requested scrape phase failed: sales=${phase2Success}, ads=${phase3Success}`);
        }

        success = true;
        writeDiagnostic({
          ...accountContext,
          phase: 'ACCOUNT',
          event: 'account_attempt_complete',
          status: 'SUCCESS',
          durationMs: Date.now() - scriptStartTime,
          details: { phase2Success, phase3Success },
        });
        writeDiagnosticSummary(runId, yesterday.full, {
          account: targetAccount.alias,
          targetDate: yesterday.full,
          scrapeType,
          success: true,
          phase2Success,
          phase3Success,
          durationMs: Date.now() - scriptStartTime,
        });
        break;

      } catch(error: any) {
        console.error(`\n❌ [${targetAccount?.alias}] 에러: ${error.message}`);
        const isRetryable = ['Timeout', 'closed', 'crashed', 'waiting for selector', 'Navigation failed', 'Requested scrape phase failed'].some(k => error.message.includes(k));
        writeDiagnostic({
          ...accountContext,
          level: 'error',
          phase: 'ACCOUNT',
          event: isRetryable && attempts < MAX_RETRY ? 'account_attempt_retrying' : 'account_attempt_failed',
          status: isRetryable && attempts < MAX_RETRY ? 'RETRYING' : 'FAILED',
          reason: classifyFailure(error.message || String(error)),
          durationMs: Date.now() - scriptStartTime,
          error,
        });
        
        if (isRetryable && attempts < MAX_RETRY) {
          const backoffMs = attempts === 1 ? 60000 : 180000;
          console.log(`🔄 [시도 ${attempts}/${MAX_RETRY}] ${backoffMs/1000}초 후 재시도...`);
          await logAutomation(targetAccount?.alias || 'unknown', 'WING_SALES', `RETRYING (${attempts}/${MAX_RETRY})`, error.message, Date.now() - scriptStartTime);
          try { await browser.close(); } catch(e) {}
          await new Promise(r => setTimeout(r, backoffMs));
          continue;
        } else {
          console.error(`⛔ 재시도 한도 초과. 실패 처리.`);
          await logAutomation(targetAccount?.alias || 'unknown', 'WING_SALES', 'FAILED', error.message, Date.now() - scriptStartTime);
          writeDiagnosticSummary(runId, yesterday.full, {
            account: targetAccount.alias,
            targetDate: yesterday.full,
            scrapeType,
            success: false,
            reason: classifyFailure(error.message || String(error)),
            durationMs: Date.now() - scriptStartTime,
          });
          break;
        }
      } finally {
        try { await browser.close(); } catch(e) {}
      }
    }
    if (!success) overallRunSuccess = false;
  }
  console.log('✅ 모든 계정 하이브리드 스크래핑 완료!');
  writeDiagnostic({
    runId,
    targetDate: yesterday.full,
    scrapeType,
    phase: 'SCRAPER',
    event: 'script_complete',
    status: overallRunSuccess ? 'SUCCESS' : 'FAILED',
    durationMs: Date.now() - scriptStartTime,
  });
  if (!overallRunSuccess) process.exit(1);
}

run().catch((error) => {
  console.error(error);
  writeDiagnostic({
    runId: process.env.SCRAPE_RUN_ID || 'unknown_run',
    phase: 'SCRAPER',
    level: 'error',
    event: 'script_exception',
    status: 'FAILED',
    reason: classifyFailure(error.message || String(error)),
    error,
  });
  process.exit(1);
});
