import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import * as XLSX from 'xlsx';

// KST 기준 어제 날짜
function getYesterdayStr(): string {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kst = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + kstOffset);
  kst.setDate(kst.getDate() - 1);
  return `${kst.getFullYear()}-${String(kst.getMonth()+1).padStart(2,'0')}-${String(kst.getDate()).padStart(2,'0')}`;
}

// 숫자 파싱 유틸
const parseNum = (val: any) => val === '-' || !val ? 0 : Number(String(val).replace(/,/g, ''));

// ======== 매출 엑셀 파싱 ========
async function parseSalesExcel(buffer: ArrayBuffer, accountAlias: string, reportDate: string) {
  const workbook = XLSX.read(buffer);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(data.length, 10); i++) {
    const row = data[i] || [];
    if (row.find((c: any) => typeof c === 'string' && c.replace(/\s+/g, '').includes('옵션ID'))) {
      headerRowIndex = i;
      break;
    }
  }
  if (headerRowIndex === -1) throw new Error("'옵션ID' 컬럼을 찾을 수 없습니다.");

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

  if (colOptId === -1) throw new Error("필수 컬럼 '옵션ID' 매핑 실패");

  const rows = data.slice(headerRowIndex + 1).filter((r: any) => r && r[colOptId]);

  // Clean-Insert: 해당 날짜+계정 데이터 삭제 후 재삽입
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

// ======== 광고비 엑셀 파싱 ========
async function parseAdsExcel(buffer: ArrayBuffer, accountAlias: string, reportDate: string) {
  const workbook = XLSX.read(buffer);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

  const aggMap = new Map<string, any>();
  
  for (const row of rawData) {
    try {
      const rawDate = row['날짜']?.toString();
      if (!rawDate || rawDate === '합계') continue;
      
      let date = reportDate;
      if (rawDate.length === 8) {
        date = `${rawDate.slice(0,4)}-${rawDate.slice(4,6)}-${rawDate.slice(6,8)}`;
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

// ======== API Route ========
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as string;  // 'sales' or 'ads'
    const accountAlias = formData.get('accountAlias') as string;
    const reportDate = formData.get('reportDate') as string || getYesterdayStr();

    if (!file || !type || !accountAlias) {
      return NextResponse.json({ error: '파일, 유형(type), 계정(accountAlias) 필수' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    let result;

    if (type === 'sales') {
      result = await parseSalesExcel(buffer, accountAlias, reportDate);
    } else if (type === 'ads') {
      result = await parseAdsExcel(buffer, accountAlias, reportDate);
    } else {
      return NextResponse.json({ error: '유형은 sales 또는 ads만 가능' }, { status: 400 });
    }

    return NextResponse.json({
      message: `[${accountAlias}] ${type === 'sales' ? '매출' : '광고비'} 업로드 완료`,
      ...result
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '파싱 에러 발생' }, { status: 500 });
  }
}
