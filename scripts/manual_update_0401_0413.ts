import { query } from '../src/lib/db.js';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const parseNum = (val: any) => val === '-' || !val ? 0 : Number(String(val).replace(/,/g, ''));

async function parseSalesExcel(filePath: string, accountAlias: string, reportDate: string) {
  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(data.length, 10); i++) {
    const row = data[i] || [];
    if (row.find((c: any) => typeof c === 'string' && (c.replace(/\s+/g, '').includes('옵션ID') || c.replace(/\s+/g, '').includes('옵션명')))) {
      headerRowIndex = i;
      break;
    }
  }
  if (headerRowIndex === -1) throw new Error("'옵션ID' 또는 '옵션명' 컬럼을 찾을 수 없습니다.");

  const headers = data[headerRowIndex].map((h: any) => String(h || '').replace(/\s+/g, ''));
  let colOptId = headers.findIndex((h: string) => h.includes('옵션ID'));
  const colProdName = headers.findIndex((h: string) => h.includes('상품명') && !h.includes('노출'));
  const colOptName = headers.findIndex((h: string) => h.includes('옵션명'));
  const colSellerCode = headers.findIndex((h: string) => h.includes('판매자상품코드') || h.includes('업체옵션코드'));
  const colFulfillment = headers.findIndex((h: string) => h.includes('판매방식'));
  const colOrders = headers.findIndex((h: string) => h.includes('주문'));
  const colSalesQty = headers.findIndex((h: string) => h.includes('판매량') || h.includes('판매수량') || h.includes('총판매수'));
  const colSalesAmt = headers.findIndex((h: string) => h.includes('매출') || h.includes('판매금액'));
  const colViews = headers.findIndex((h: string) => h.includes('조회'));
  const colVisitors = headers.findIndex((h: string) => h.includes('방문자'));

  if (colOptId === -1 && colOptName > 0) colOptId = 0; // 강제 폴백

  if (colOptId === -1) throw new Error("필수 컬럼 '옵션ID' 매핑 실패");

  const rows = data.slice(headerRowIndex + 1).filter((r: any) => r && r[colOptId]);

  await query(`DELETE FROM wing_sales WHERE date = $1 AND account_alias = $2`, [reportDate, accountAlias]);

  let success = 0, fail = 0;
  for (const row of rows) {
    const optId = String(row[colOptId]).trim();
    if (!optId || optId === '합계') continue;
    try {
      await query(`
        INSERT INTO wing_sales (date, account_alias, option_id, product_name, option_name, seller_product_code, orders, sales_qty, sales_amount, views, visitors, fulfillment_type)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT (date, account_alias, option_id) DO UPDATE SET
          product_name=EXCLUDED.product_name, option_name=EXCLUDED.option_name, seller_product_code=EXCLUDED.seller_product_code,
          orders=EXCLUDED.orders, sales_qty=EXCLUDED.sales_qty, sales_amount=EXCLUDED.sales_amount,
          views=EXCLUDED.views, visitors=EXCLUDED.visitors, fulfillment_type=EXCLUDED.fulfillment_type, updated_at=NOW()
      `, [
        reportDate, accountAlias, optId,
        colProdName !== -1 ? String(row[colProdName] || '').trim() : '',
        colOptName !== -1 ? String(row[colOptName] || '').trim() : '',
        colSellerCode !== -1 ? String(row[colSellerCode] || '').trim() : '',
        colOrders !== -1 ? Number(row[colOrders]) || 0 : 0,
        colSalesQty !== -1 ? Number(row[colSalesQty]) || 0 : 0,
        colSalesAmt !== -1 ? parseFloat(String(row[colSalesAmt]).replace(/,/g, '')) || 0 : 0,
        colViews !== -1 ? Number(row[colViews]) || 0 : 0,
        colVisitors !== -1 ? Number(row[colVisitors]) || 0 : 0,
        colFulfillment !== -1 ? String(row[colFulfillment] || '').trim() : '판매자배송',
      ]);
      success++;
    } catch { fail++; }
  }
  return { success, fail, total: rows.length };
}

async function parseAdsExcel(filePath: string, accountAlias: string, reportDate: string) {
  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

  const aggMap = new Map<string, any>();
  
  for (const row of rawData) {
    try {
      const rawDate = row['날짜']?.toString();
      if (!rawDate || rawDate === '합계') continue;
      
      let date = reportDate; // fallback
      if (rawDate.length === 8) {
        date = `${rawDate.slice(0,4)}-${rawDate.slice(4,6)}-${rawDate.slice(6,8)}`;
      } else if (rawDate.includes('-')) {
        date = rawDate.slice(0, 10);
      }

      const campaignName = row['캠페인 이름'] || 'None';
      const adObjective = row['광고 목표'] || 'None';
      const execOptionId = row['광고 집행 옵션 ID']?.toString()?.trim();
      const landingOptionId = row['랜딩 페이지 ID']?.toString()?.trim();
      const cvOptionId = row['광고 전환 매출 발생 옵션 ID']?.toString()?.trim();
      const cvProduct = row['광고 전환 매출 발생 상품명'];
      const targetingProduct = row['광고집행 상품명'];

      if (!campaignName || campaignName === '-') continue;

      let safeCvOptionId = 'NO_CONVERSION';
      if (execOptionId && execOptionId !== '-' && execOptionId !== '0' && execOptionId !== 'null') safeCvOptionId = execOptionId;
      else if (landingOptionId && landingOptionId !== '-' && landingOptionId !== '0' && landingOptionId !== 'null') safeCvOptionId = landingOptionId;
      else if (cvOptionId && cvOptionId !== '-' && cvOptionId !== '0' && cvOptionId !== 'null') safeCvOptionId = cvOptionId;

      const safeAdObjective = adObjective === '-' ? 'None' : adObjective;
      const key = `${date}|${campaignName}|${safeAdObjective}|${safeCvOptionId}`;

      if (!aggMap.has(key)) {
        aggMap.set(key, {
          date, campaign_name: campaignName, ad_name: safeAdObjective,
          targeting_product_name: targetingProduct === '-' ? null : targetingProduct,
          conversion_option_id: safeCvOptionId,
          conversion_product_name: cvProduct === '-' ? null : cvProduct,
          impressions: parseNum(row['노출수']), clicks: parseNum(row['클릭수']),
          ad_spend: parseNum(row['광고비(원)']),
          orders_1d: parseNum(row['총 주문수 (1일)']), sales_1d: parseNum(row['총 전환 매출액 (1일)(원)']),
          orders_14d: parseNum(row['총 주문수 (14일)']), sales_14d: parseNum(row['총 전환 매출액 (14일)(원)']),
        });
      } else {
        const e = aggMap.get(key);
        e.impressions += parseNum(row['노출수']); e.clicks += parseNum(row['클릭수']);
        e.ad_spend += parseNum(row['광고비(원)']);
        e.orders_1d += parseNum(row['총 주문수 (1일)']); e.sales_1d += parseNum(row['총 전환 매출액 (1일)(원)']);
        e.orders_14d += parseNum(row['총 주문수 (14일)']); e.sales_14d += parseNum(row['총 전환 매출액 (14일)(원)']);
      }
    } catch {}
  }

  const validRows = Array.from(aggMap.values()).map(r => {
    r.roas_1d = r.ad_spend > 0 ? Number(((r.sales_1d / r.ad_spend) * 100).toFixed(2)) : 0;
    r.roas_14d = r.ad_spend > 0 ? Number(((r.sales_14d / r.ad_spend) * 100).toFixed(2)) : 0;
    return r;
  });

  if (validRows.length === 0) return { success: 0, fail: 0, total: rawData.length };

  const datesToDelete = [...new Set(validRows.map(r => r.date))];
  for (const d of datesToDelete) {
    await query(`DELETE FROM coupang_ads_performance WHERE date = $1 AND account_alias = $2`, [d, accountAlias]);
  }

  let success = 0, fail = 0;
  for (const row of validRows) {
    try {
      await query(`
        INSERT INTO coupang_ads_performance (date, account_alias, campaign_name, ad_name, targeting_product_name, conversion_option_id, conversion_product_name, impressions, clicks, ad_spend, orders_1d, sales_1d, roas_1d, orders_14d, sales_14d, roas_14d)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        ON CONFLICT (date, account_alias, campaign_name, ad_name, conversion_option_id) DO UPDATE SET
          impressions=EXCLUDED.impressions, clicks=EXCLUDED.clicks, ad_spend=EXCLUDED.ad_spend,
          orders_1d=EXCLUDED.orders_1d, sales_1d=EXCLUDED.sales_1d, roas_1d=EXCLUDED.roas_1d,
          orders_14d=EXCLUDED.orders_14d, sales_14d=EXCLUDED.sales_14d, roas_14d=EXCLUDED.roas_14d
      `, [row.date, accountAlias, row.campaign_name, row.ad_name, row.targeting_product_name,
          row.conversion_option_id, row.conversion_product_name,
          row.impressions, row.clicks, row.ad_spend,
          row.orders_1d, row.sales_1d, row.roas_1d,
          row.orders_14d, row.sales_14d, row.roas_14d]);
      success++;
    } catch { fail++; }
  }
  return { success, fail, total: rawData.length };
}

async function run() {
  const accountAlias = '쿠팡 온하인';
  const downloadsDir = path.join(process.cwd(), 'downloads', 's0401');
  
  console.log('--- 쿠팡 온하인 4/1~4/13 매출 업데이트 시작 ---');
  for (let i = 1; i <= 13; i++) {
    const mmdd = `04${i.toString().padStart(2, '0')}`;
    const dateStr = `2026-04-${i.toString().padStart(2, '0')}`;
    const file = `s${mmdd}.xlsx`;
    const fullPath = path.join(downloadsDir, file);
    if (!fs.existsSync(fullPath)) {
        console.error(`[매출] ${dateStr} 파일 없음: ${fullPath}`);
        continue;
    }
    try {
      const res = await parseSalesExcel(fullPath, accountAlias, dateStr);
      console.log(`[매출] ${dateStr} 성공: ${res.success}, 실패: ${res.fail}`);
    } catch (e: any) {
      console.error(`[매출] ${dateStr} 파일 에러: ${e.message}`);
    }
  }

  console.log('\\n--- 쿠팡 온하인 4/1~4/13 광고비 업데이트 시작 ---');
  const adsFile = '2620260420_A00755614_custom_report.xlsx';
  const fullAdsPath = path.join(downloadsDir, adsFile);
  try {
      const res = await parseAdsExcel(fullAdsPath, accountAlias, '2026-04-01'); // fallback is generic, row uses valid parsed date
      console.log(`[광고비] 전체 파싱 성공: ${res.success}, 실패: ${res.fail}`);
  } catch(e: any) {
      console.error(`[광고비] 파일 에러:`, e);
  }

  console.log('\\n--- 완료 ---');
  process.exit(0);
}

run();
