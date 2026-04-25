import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';
import dotenv from 'dotenv';
import { logAutomation } from './logger';
import { Pool } from 'pg';
import { createRunId, writeDiagnostic } from './scrape_diagnostics';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const runId = process.env.SCRAPE_RUN_ID || createRunId('parse_ads');

let dbUrl = process.env.DATABASE_URL || '';
if (!dbUrl) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}
let cleanedUrl = dbUrl;
const bracketMatch = dbUrl.match(/\[(.*?)\]/);
if (bracketMatch) {
  cleanedUrl = dbUrl.replace(`[${bracketMatch[1]}]`, encodeURIComponent(bracketMatch[1]));
}

const pool = new Pool({
  connectionString: cleanedUrl,
  ssl: { rejectUnauthorized: false }
});

const scriptStartTime = Date.now();

// 실패한 엑셀을 failed_backup 폴더로 이동
function moveToBackup(filePath: string, file: string) {
  try {
    const backupDir = path.join(process.cwd(), 'downloads', 'failed_backup');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, file);
    fs.renameSync(filePath, backupPath);
    console.log(`📦 DB 실패 파일 안전 보관: failed_backup/${file}`);
  } catch (e) {
    console.error('⚠️ 백업 이동 실패:', e);
  }
}

async function processFile(filePath: string, file: string): Promise<void> {
  let targetAlias = '쿠팡 모딩';
  let reportDate = '';

  // 신형: coupang_ads_{alias}_{YYYY-MM-DD}_{YYYYMMdd_HHmmss}.xlsx
  const tsMatch = file.match(/coupang_ads_(.+?)_(\d{4}-\d{2}-\d{2})_\d{8}_\d{6}\.xlsx$/);
  // 구형: coupang_ads_{alias}_last_week.xlsx
  const legacyMatch = file.match(/coupang_ads_(.*?)_last_week\.xlsx/);

  if (tsMatch) {
    targetAlias = tsMatch[1];
    reportDate = tsMatch[2];
  } else if (legacyMatch) {
    targetAlias = legacyMatch[1];
  }

  console.log(`\n========================================`);
  console.log(`📄 [계정: ${targetAlias}] 광고 엑셀 파일 로드 중... (${file})`);
  writeDiagnostic({
    runId,
    account: targetAlias,
    targetDate: reportDate,
    scrapeType: 'ads',
    phase: 'PARSE_ADS',
    event: 'file_selected',
    status: 'STARTED',
    filePath,
    fileSizeBytes: fs.statSync(filePath).size,
  });

  const workbook = xlsx.readFile(filePath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rawData: any[] = xlsx.utils.sheet_to_json(sheet, { defval: null });
  console.log(`총 ${rawData.length} 행 로딩됨.`);
  writeDiagnostic({
    runId,
    account: targetAlias,
    targetDate: reportDate,
    scrapeType: 'ads',
    phase: 'PARSE_ADS',
    event: 'rows_loaded',
    status: rawData.length > 0 ? 'SUCCESS' : 'EMPTY',
    filePath,
    rowCount: rawData.length,
  });

  if (rawData.length === 0 && reportDate) {
    try {
      await pool.query(`DELETE FROM coupang_ads_performance WHERE date = $1 AND account_alias = $2`, [reportDate, targetAlias]);
      console.log(`🗑️ [${targetAlias}] ${reportDate} 광고 데이터 0건 확인 → 기존 데이터 삭제 완료`);
      writeDiagnostic({
        runId,
        account: targetAlias,
        targetDate: reportDate,
        scrapeType: 'ads',
        phase: 'PARSE_ADS',
        event: 'empty_report_processed',
        status: 'SUCCESS',
        filePath,
        rowCount: 0,
        reason: 'AUTHORITATIVE_EMPTY_REPORT',
      });

      const archiveDir = path.join(process.cwd(), 'downloads', 'archive');
      if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });
      const archivePath = path.join(archiveDir, file);
      fs.renameSync(filePath, archivePath);
      console.log(`📦 0건 광고 보고서 아카이브 완료: downloads/archive/${file}`);
      await logAutomation(targetAlias, 'WING_ADS', 'SUCCESS', '0-row report processed', Date.now() - scriptStartTime).catch(() => {});
      return;
    } catch (err: any) {
      console.error(`❌ 0건 광고 보고서 처리 실패:`, err.message);
      writeDiagnostic({
        runId,
        account: targetAlias,
        targetDate: reportDate,
        scrapeType: 'ads',
        phase: 'PARSE_ADS',
        event: 'empty_report_process_failed',
        status: 'FAILED',
        reason: 'EMPTY_REPORT_DELETE_FAILED',
        filePath,
        error: err,
      });
      moveToBackup(filePath, file);
      await logAutomation(targetAlias, 'WING_ADS', 'FAILURE', err.message, Date.now() - scriptStartTime).catch(() => {});
      return;
    }
  }

  const parseNum = (val: any) => val === '-' || !val ? 0 : Number(val.toString().replace(/,/g, ''));

  // 날짜+캠페인+광고명+옵션ID 기준으로 row 집계
  const aggMap = new Map<string, any>();

  for (const row of rawData) {
    try {
      const rawDate = row['날짜']?.toString();
      if (!rawDate || rawDate.length !== 8 || rawDate === '합계') continue;
      const date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;

      const campaignName = row['캠페인 이름'] || 'None';
      const adObjective = row['광고 목표'] || 'None';  // 광고 목표: '매출 성장', '신규 구매 고객 확보' 등
      const adCreativeName = row['광고명'] || 'None';  // 광고 소재명 (긴 텍스트)
      const targetingProduct = row['광고집행 상품명'];

      // ✅ 실제 엑셀 컬럼명 기준으로 정확히 매핑
      const execOptionId = row['광고 집행 옵션 ID']?.toString()?.trim();  // '광고 집행 옵션 ID' (띄어쓰기 포함)
      const landingOptionId = row['랜딩 페이지 ID']?.toString()?.trim();  // '랜딩 페이지 ID'
      const cvOptionId = row['광고 전환 매출 발생 옵션 ID']?.toString()?.trim();
      const cvProduct = row['광고 전환 매출 발생 상품명'];

      if (!campaignName || campaignName === '-') continue;

      // ✅ 귀속 옵션ID: 광고 집행 옵션 ID → 랜딩 페이지 ID → 광고 전환 옵션 ID 순서로 유효값 선택
      let safeCvOptionId = 'NO_CONVERSION';
      if (execOptionId && execOptionId !== '-' && execOptionId !== '0' && execOptionId !== 'null') {
        safeCvOptionId = execOptionId;
      } else if (landingOptionId && landingOptionId !== '-' && landingOptionId !== '0' && landingOptionId !== 'null') {
        safeCvOptionId = landingOptionId;
      } else if (cvOptionId && cvOptionId !== '-' && cvOptionId !== '0' && cvOptionId !== 'null') {
        safeCvOptionId = cvOptionId;
      }

      const impressions = parseNum(row['노출수']);
      const clicks = parseNum(row['클릭수']);
      const adSpend = parseNum(row['광고비(원)']);
      const orders1d = parseNum(row['총 주문수 (1일)']);
      const sales1d = parseNum(row['총 전환 매출액 (1일)(원)']);
      const orders14d = parseNum(row['총 주문수 (14일)']);
      const sales14d = parseNum(row['총 전환 매출액 (14일)(원)']);

      // ✅ 그룹핑 키: 날짜+캠페인이름+광고목표+귀속옵션ID (광고명 소재는 UI표시용으로만 보존)
      const safeAdObjective = adObjective === '-' ? 'None' : adObjective;
      const safeAdName = adCreativeName === '-' ? 'None' : adCreativeName;
      const key = `${date}|${campaignName}|${safeAdObjective}|${safeCvOptionId}`;

      if (!aggMap.has(key)) {
        aggMap.set(key, {
          date, campaign_name: campaignName,
          ad_name: safeAdObjective,           // DB ad_name 컬럼에는 광고 목표값을 저장 (매출 성장 / 신규 구매 고객 확보 등)
          ad_creative_name: safeAdName,       // 소재명은 별도 보존 (향후 활용)
          targeting_product_name: targetingProduct === '-' ? null : targetingProduct,
          conversion_option_id: safeCvOptionId,
          conversion_product_name: cvProduct === '-' ? null : cvProduct,
          impressions, clicks, ad_spend: adSpend,
          orders_1d: orders1d, sales_1d: sales1d,
          orders_14d: orders14d, sales_14d: sales14d
        });
      } else {
        const existing = aggMap.get(key);
        existing.impressions += impressions;
        existing.clicks += clicks;
        existing.ad_spend += adSpend;
        existing.orders_1d += orders1d;
        existing.sales_1d += sales1d;
        existing.orders_14d += orders14d;
        existing.sales_14d += sales14d;
      }
    } catch (err: any) {
      console.error("❌ 행 파싱 중 에러 발생:", err.message);
    }
  }

  const validRows = Array.from(aggMap.values()).map(r => {
    r.roas_1d = r.ad_spend > 0 ? Number(((r.sales_1d / r.ad_spend) * 100).toFixed(2)) : 0;
    r.roas_14d = r.ad_spend > 0 ? Number(((r.sales_14d / r.ad_spend) * 100).toFixed(2)) : 0;
    return r;
  });

  if (validRows.length === 0) {
    console.log("⚠️ 저장할 유효한 맞춤보고서 지표가 없습니다.");
    writeDiagnostic({
      runId,
      account: targetAlias,
      targetDate: reportDate,
      scrapeType: 'ads',
      phase: 'PARSE_ADS',
      event: 'valid_rows_empty',
      status: 'FAILED',
      reason: 'NO_VALID_AD_ROWS',
      filePath,
      rowCount: rawData.length,
    });
    return;
  }

  // ✅ 핵심: 날짜+계정 기준으로 기존 데이터 삭제 후 재삽입
  // reportDate가 있으면 해당 날짜만, 없으면 집계된 날짜 목록 전체를 삭제
  const datesToDelete = reportDate
    ? [reportDate]
    : [...new Set(validRows.map(r => r.date))];

  try {
    for (const d of datesToDelete) {
      await pool.query(`DELETE FROM coupang_ads_performance WHERE date = $1 AND account_alias = $2`, [d, targetAlias]);
      console.log(`🗑️ [${targetAlias}] 기존 ${d} 광고 데이터 삭제 (재업로드 준비)`);
    }
  } catch (err: any) {
    console.error(`❌ 기존 광고 데이터 삭제 실패:`, err.message);
    moveToBackup(filePath, file);
    return;
  }

  console.log(`📊 전체 ${rawData.length}개 중 추출된 전환 성과 데이터 ${validRows.length}개 DB 삽입(Upsert) 시도...`);

  let successCount = 0;
  let errorCount = 0;

  for (const row of validRows) {
    try {
      await pool.query(`
        INSERT INTO coupang_ads_performance (
          date, account_alias, campaign_name, ad_name, targeting_product_name, conversion_option_id, conversion_product_name,
          impressions, clicks, ad_spend, orders_1d, sales_1d, roas_1d, orders_14d, sales_14d, roas_14d
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (date, account_alias, campaign_name, ad_name, conversion_option_id) DO UPDATE SET
          impressions = EXCLUDED.impressions,
          clicks = EXCLUDED.clicks,
          ad_spend = EXCLUDED.ad_spend,
          orders_1d = EXCLUDED.orders_1d,
          sales_1d = EXCLUDED.sales_1d,
          roas_1d = EXCLUDED.roas_1d,
          orders_14d = EXCLUDED.orders_14d,
          sales_14d = EXCLUDED.sales_14d,
          roas_14d = EXCLUDED.roas_14d
      `, [
        row.date, targetAlias, row.campaign_name, row.ad_name, row.targeting_product_name,
        row.conversion_option_id, row.conversion_product_name,
        row.impressions, row.clicks, row.ad_spend,
        row.orders_1d, row.sales_1d, row.roas_1d,
        row.orders_14d, row.sales_14d, row.roas_14d
      ]);
      successCount++;
    } catch (e: any) {
      console.error(`❌ DB Upsert 에러 (${row.date} - ${row.conversion_option_id}):`, e.message);
      errorCount++;
    }
  }

  // DB 전체 실패 시 엑셀 백업
  if (errorCount > 0 && successCount === 0) {
    console.error(`❌ [${targetAlias}] 전체 광고 DB 저장 실패. 엑셀 원본을 failed_backup 으로 이동합니다.`);
    moveToBackup(filePath, file);
  } else {
    console.log(`\n🎉 [${targetAlias}] DB 반영 완료: ${successCount}건 성공, ${errorCount}건 실패`);
    writeDiagnostic({
      runId,
      account: targetAlias,
      targetDate: reportDate,
      scrapeType: 'ads',
      phase: 'PARSE_ADS',
      event: 'db_save_complete',
      status: successCount > 0 ? 'SUCCESS' : 'FAILED',
      filePath,
      rowCount: validRows.length,
      details: { successCount, errorCount },
    });
    
    // 성공한 파일은 archive 폴더로 격리
    try {
      const archiveDir = path.join(process.cwd(), 'downloads', 'archive');
      if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });
      const archivePath = path.join(archiveDir, file);
      fs.renameSync(filePath, archivePath);
      console.log(`📦 광고 엑셀 파일 안전 격리 완료: downloads/archive/${file}`);
    } catch (e: any) {
      console.error(`⚠️ 아카이브 이동 실패:`, e.message);
    }
  }

  await logAutomation(targetAlias, 'WING_ADS', successCount > 0 ? 'SUCCESS' : 'FAILURE', '', Date.now() - scriptStartTime).catch(() => {});
}

async function processAll() {
  const downloadsDir = path.join(process.cwd(), 'downloads');
  const expectedAlias = process.env.SCRAPE_ACCOUNT || process.env.OVERRIDE_ALIAS || '';
  const expectedDate = process.env.SCRAPE_DATE || '';
  if (!fs.existsSync(downloadsDir)) {
    if (expectedAlias || expectedDate) {
      console.error(`❌ [광고] 다운로드 폴더 없음: account=${expectedAlias || 'any'}, date=${expectedDate || 'any'}`);
      await pool.end();
      process.exit(1);
    }
    return;
  }

  const allFiles = fs.readdirSync(downloadsDir).filter(f => f.startsWith('coupang_ads_') && f.endsWith('.xlsx'));

  if (allFiles.length === 0) {
    console.log(`ℹ️ [광고] 다운로드 폴더에 처리할 엑셀 파일이 없습니다.`);
    await pool.end();
    if (expectedAlias || expectedDate) {
      console.error(`❌ [광고] 기대 파일 없음: account=${expectedAlias || 'any'}, date=${expectedDate || 'any'}`);
      process.exit(1);
      return;
    }
    process.exit(0);
    return;
  }

  // ✅ 계정+날짜 기준으로 최신 타임스탬프 파일 1개씩만 처리
  const fileMap = new Map<string, string>(); // key: "alias_date", value: 파일명

  for (const file of allFiles) {
    // 신형: coupang_ads_{alias}_{YYYY-MM-DD}_{timestamp}.xlsx
    const tsMatch = file.match(/coupang_ads_(.+?)_(\d{4}-\d{2}-\d{2})_(\d{8}_\d{6})\.xlsx$/);
    // 구형: coupang_ads_{alias}_last_week.xlsx
    const legacyMatch = file.match(/coupang_ads_(.*?)_last_week\.xlsx/);

    if (tsMatch) {
      const alias = tsMatch[1];
      const date = tsMatch[2];
      const ts = tsMatch[3];
      const groupKey = `${alias}_${date}`;
      const existing = fileMap.get(groupKey);
      if (!existing) {
        fileMap.set(groupKey, file);
      } else {
        const existingTs = existing.match(/_(\d{8}_\d{6})\.xlsx$/)?.[1] || '00000000_000000';
        if (ts > existingTs) {
          console.log(`🔄 [${alias}] 더 최신 광고 파일 감지: ${file}`);
          fileMap.set(groupKey, file);
        }
      }
    } else if (legacyMatch) {
      // 구형 파일은 타임스탬프 없음 → 그냥 추가
      const alias = legacyMatch[1];
      const groupKey = `${alias}_legacy`;
      fileMap.set(groupKey, file);
    }
  }

  console.log(`\n📋 처리 대상 광고 파일 목록 (계정+날짜 기준 최신 1개씩):`);
  for (const [key, file] of fileMap) {
    console.log(`  - [${key}] → ${file}`);
  }

  if (expectedAlias && expectedDate && !fileMap.has(`${expectedAlias}_${expectedDate}`)) {
    console.error(`❌ [광고] 기대 파일 누락: ${expectedAlias}_${expectedDate}`);
    writeDiagnostic({
      runId,
      account: expectedAlias,
      targetDate: expectedDate,
      scrapeType: 'ads',
      phase: 'PARSE_ADS',
      event: 'expected_file_missing',
      status: 'FAILED',
      reason: 'EXPECTED_FILE_MISSING',
      details: { availableFiles: allFiles.length },
    });
    await pool.end();
    process.exit(1);
    return;
  }

  for (const [, file] of fileMap) {
    const filePath = path.join(downloadsDir, file);
    await processFile(filePath, file);
  }

  await pool.end();
  process.exit(0);
}

processAll().catch(async (err) => {
  console.error(err);
  writeDiagnostic({
    runId,
    account: process.env.SCRAPE_ACCOUNT || process.env.OVERRIDE_ALIAS || '',
    targetDate: process.env.SCRAPE_DATE || '',
    scrapeType: 'ads',
    phase: 'PARSE_ADS',
    level: 'error',
    event: 'parser_exception',
    status: 'FAILED',
    error: err,
  });
  await pool.end();
  process.exit(1);
});
