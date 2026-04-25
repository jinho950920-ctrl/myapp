import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { query } from '../src/lib/db.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// KST 기준 어제 날짜 문자열
function getYesterdayStr(): string {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + kstOffset);
  kstNow.setDate(kstNow.getDate() - 1);
  const yyyy = kstNow.getFullYear();
  const mm = String(kstNow.getMonth() + 1).padStart(2, '0');
  const dd = String(kstNow.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

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

async function processFile(filePath: string, file: string): Promise<boolean> {
  // 파일명 파싱: coupang_sales_{계정명}_{날짜}_{타임스탬프}.xlsx 또는 구형 coupang_sales_{계정명}_{날짜}.xlsx
  let accountAlias = '쿠팡 모딩';
  let targetDateStr = getYesterdayStr();

  // 타임스탬프 포함 형식: coupang_sales_{alias}_{YYYY-MM-DD}_{YYYYMMdd_HHmmss}.xlsx
  const tsMatch = file.match(/coupang_sales_(.+?)_(\d{4}-\d{2}-\d{2})_\d{8}_\d{6}\.xlsx$/);
  // 구형 형식: coupang_sales_{alias}_{YYYY-MM-DD}.xlsx
  const legacyMatch = file.match(/coupang_sales_(.+?)_(\d{4}-\d{2}-\d{2})\.xlsx$/);

  const m = tsMatch || legacyMatch;
  if (m) {
    accountAlias = m[1];
    targetDateStr = m[2];
  }

  console.log(`\n========================================`);
  console.log(`📄 [계정: ${accountAlias}] 엑셀 읽는 중... (${file})`);

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(data.length, 10); i++) {
    const row = data[i] || [];
    if (row.find((c: any) => typeof c === 'string' && c.replace(/\s+/g, '').includes('옵션ID'))) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    console.error("❌ '옵션ID' 컬럼을 찾을 수 없습니다. 파일을 건너뜁니다.");
    return false;
  }

  const headers = data[headerRowIndex].map((h: any) => String(h || '').replace(/\s+/g, ''));
  const colOptId = headers.findIndex((h: string) => h.includes('옵션ID'));
  const colProdName = headers.findIndex((h: string) => h.includes('상품명') && !h.includes('노출'));
  const colOptName = headers.findIndex((h: string) => h.includes('옵션명'));
  const colSellerCode = headers.findIndex((h: string) => h.includes('판매자상품코드') || h.includes('업체옵션코드'));
  const colFulfillment = headers.findIndex((h: string) => h.includes('판매방식'));
  const colOrders = headers.findIndex((h: string) => h.includes('주문'));
  const colSalesQty = headers.findIndex((h: string) => h.includes('판매량') || h.includes('판매수량') || h.includes('총판매수'));
  const colSalesAmt = headers.findIndex((h: string) => h.includes('매출') || h.includes('판매금액'));
  const colViews = headers.findIndex((h: string) => h.includes('조회'));
  const colVisitors = headers.findIndex((h: string) => h.includes('방문자'));

  if (colOptId === -1) {
    console.error("❌ 필수 컬럼인 옵션ID 매핑 실패");
    return false;
  }

  const rows = data.slice(headerRowIndex + 1).filter((r: any) => r && r[colOptId]);
  console.log(`총 ${rows.length}개의 데이터 행을 찾았습니다.`);

  // ✅ 핵심: 해당 날짜+계정 데이터를 먼저 DELETE 후 재삽입 (하루 여러번 실행시 최신 데이터 보장)
  try {
    await query(`DELETE FROM wing_sales WHERE date = $1 AND account_alias = $2`, [targetDateStr, accountAlias]);
    console.log(`🗑️ [${accountAlias}] 기존 ${targetDateStr} 데이터 삭제 완료 (재업로드 준비)`);
  } catch (err: any) {
    console.error(`❌ 기존 데이터 삭제 실패:`, err.message);
    moveToBackup(filePath, file);
    return false;
  }

  let successCount = 0;
  let errorCount = 0;

  for (const row of rows) {
    const optId = String(row[colOptId]).trim();
    if (!optId || optId === '합계') continue;

    const prodName = colProdName !== -1 ? String(row[colProdName] || '').trim() : '';
    const optName = colOptName !== -1 ? String(row[colOptName] || '').trim() : '';
    const sellerCode = colSellerCode !== -1 ? String(row[colSellerCode] || '').trim() : '';
    const fulfillmentType = colFulfillment !== -1 ? String(row[colFulfillment] || '').trim() : '판매자배송';
    const orders = colOrders !== -1 ? Number(row[colOrders]) || 0 : 0;
    const salesQty = colSalesQty !== -1 ? Number(row[colSalesQty]) || 0 : 0;
    const salesAmt = colSalesAmt !== -1 ? parseFloat(String(row[colSalesAmt]).replace(/,/g, '')) || 0 : 0;
    const views = colViews !== -1 ? Number(row[colViews]) || 0 : 0;
    const visitors = colVisitors !== -1 ? Number(row[colVisitors]) || 0 : 0;

    try {
      await query(`
        INSERT INTO wing_sales (
          date, account_alias, option_id, product_name, option_name, seller_product_code,
          orders, sales_qty, sales_amount, views, visitors, fulfillment_type
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (date, account_alias, option_id) DO UPDATE SET
          product_name = EXCLUDED.product_name,
          option_name = EXCLUDED.option_name,
          seller_product_code = EXCLUDED.seller_product_code,
          orders = EXCLUDED.orders,
          sales_qty = EXCLUDED.sales_qty,
          sales_amount = EXCLUDED.sales_amount,
          views = EXCLUDED.views,
          visitors = EXCLUDED.visitors,
          fulfillment_type = EXCLUDED.fulfillment_type,
          updated_at = NOW()
      `, [targetDateStr, accountAlias, optId, prodName, optName, sellerCode,
          orders, salesQty, salesAmt, views, visitors, fulfillmentType]);
      successCount++;
    } catch (err: any) {
      console.error(`❌ 행 삽입 에러(옵션ID: ${optId}):`, err.message);
      errorCount++;
    }
  }

  // DB 실패 행이 있으면 failed_backup으로 이동 (재처리 비상구)  
  if (errorCount > 0 && successCount === 0) {
    console.error(`❌ [${accountAlias}] 전체 DB 저장 실패. 엑셀 원본을 failed_backup 으로 이동합니다.`);
    moveToBackup(filePath, file);
    return false;
  }

  console.log(`🎉 [${accountAlias}] DB 저장 완료! (성공 ${successCount}건 / 실패 ${errorCount}건)`);
  
  // 성공한 파일은 archive 폴더로 격리
  try {
    const archiveDir = path.join(process.cwd(), 'downloads', 'archive');
    if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });
    const archivePath = path.join(archiveDir, file);
    fs.renameSync(filePath, archivePath);
    console.log(`📦 엑셀 파일 안전 격리 완료: downloads/archive/${file}`);
  } catch (e: any) {
    console.error(`⚠️ 아카이브 이동 실패:`, e.message);
  }
  
  return true;
}

async function parseAndSaveAll() {
  const downloadsDir = path.join(process.cwd(), 'downloads');
  if (!fs.existsSync(downloadsDir)) return;

  const allFiles = fs.readdirSync(downloadsDir).filter(f => f.startsWith('coupang_sales_') && f.endsWith('.xlsx'));

  if (allFiles.length === 0) {
    console.log(`ℹ️ [매출] 다운로드 폴더에 처리할 엑셀 파일이 없습니다.`);
    process.exit(0);
    return;
  }

  // ✅ 핵심: 계정+날짜 기준으로 그룹핑 → 타임스탬프 가장 최신 파일 1개만 처리
  const fileMap = new Map<string, string>(); // key: "alias_date", value: 파일명(최신)

  for (const file of allFiles) {
    const tsMatch = file.match(/coupang_sales_(.+?)_(\d{4}-\d{2}-\d{2})_(\d{8}_\d{6})\.xlsx$/);
    const legacyMatch = file.match(/coupang_sales_(.+?)_(\d{4}-\d{2}-\d{2})\.xlsx$/);
    const m = tsMatch || legacyMatch;
    if (!m) continue;

    const alias = m[1];
    const date = m[2];
    const ts = tsMatch ? m[3] : '00000000_000000'; // 구형 파일은 타임스탬프 0으로 취급
    const groupKey = `${alias}_${date}`;

    const existing = fileMap.get(groupKey);
    if (!existing) {
      fileMap.set(groupKey, file);
    } else {
      // 타임스탬프 기준 최신 파일 선택
      const existingTs = existing.match(/_(\d{8}_\d{6})\.xlsx$/)?.[1] || '00000000_000000';
      if (ts > existingTs) {
        console.log(`🔄 [${alias}] 더 최신 파일 감지: ${file} (기존: ${existing})`);
        fileMap.set(groupKey, file);
      }
    }
  }

  console.log(`\n📋 처리 대상 파일 목록 (계정+날짜 기준 최신 1개씩):`);
  for (const [key, file] of fileMap) {
    console.log(`  - [${key}] → ${file}`);
  }

  for (const [, file] of fileMap) {
    const filePath = path.join(downloadsDir, file);
    await processFile(filePath, file);
  }

  process.exit(0);
}

parseAndSaveAll().catch(e => {
  console.error(e);
  process.exit(1);
});
