"use server";

import { getDb } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function fetchProductsWithData() {
  const db = getDb();
  
  // Fetch master products
  const pRes = await db.query(`SELECT * FROM products_dim ORDER BY code ASC`);
  const products = pRes.rows;

  // Fetch product mappings
  const mRes = await db.query(`SELECT * FROM product_mappings`);
  const mappings = mRes.rows;

  // Fetch receipts (logs)
  const rRes = await db.query(`SELECT * FROM trade_receipts ORDER BY supplier_date DESC`);
  const receipts = rRes.rows;

  // Fetch costs (latest valid_from per platform)
  const costRes = await db.query(`
    SELECT DISTINCT ON (master_code, platform_type) * 
    FROM product_platform_costs 
    ORDER BY master_code, platform_type, valid_from DESC
  `);
  const allCosts = costRes.rows;

  // Fetch sold quantities from mapped data
  let salesMap = new Map();
  try {
    const soldRes = await db.query(`
      SELECT pm.master_code, COALESCE(SUM(ws.sales_qty), 0) as total_sold
      FROM product_mappings pm
      JOIN wing_sales ws ON pm.raw_key = ws.option_id
      WHERE pm.mapping_type = 'ordersCoupang'
      GROUP BY pm.master_code
    `);
    soldRes.rows.forEach((r: any) => salesMap.set(r.master_code, Number(r.total_sold)));
  } catch (err) {
    console.error("wing_sales 테이블 조회 실패 (크롤링 데이터 미비 등):", err);
  }

  // Assembly
  return products.map(p => {
    const pMappings = mappings.filter(m => m.master_code === p.code);
    const pReceipts = receipts.filter(r => r.master_code === p.code);

    let totalCogs = 0;
    let totalQty = 0;
    const importLogs = pReceipts.map(r => {
      const cogs = Number(r.cogs_krw) || 0;
      const qty = Number(r.qty) || 0;
      totalCogs += (cogs * qty);
      totalQty += qty;
      return {
        id: r.receipt_id,
        date: r.supplier_date ? r.supplier_date.toISOString().split('T')[0] : 'N/A',
        supplier: r.delivery_method || '직수입',
        qty,
        cogs,
        shippingFee: Number(r.shipping_fee) || 0,
        tariff: Number(r.tariff) || 0,
        blNumber: r.bl_number || '',
        domesticShipping: Number(r.domestic_shipping) || 0,
        supplierDate: r.supplier_pay_date ? r.supplier_pay_date.toISOString().split('T')[0] : '',
        agencyDate: r.agency_pay_date ? r.agency_pay_date.toISOString().split('T')[0] : '',
        tariffDate: r.tariff_pay_date ? r.tariff_pay_date.toISOString().split('T')[0] : '',
        state: '입고'
      };
    });
    const avgCogs = totalQty > 0 ? Math.round(totalCogs / totalQty) : 0;

    const pCosts = allCosts.filter(c => c.master_code === p.code).reduce((acc, curr) => {
      acc[curr.platform_type] = {
        shippingFee: Number(curr.shipping_fee_krw),
        packagingFee: Number(curr.packaging_fee_krw),
        commissionPercent: Number(curr.commission_percent),
        promoDiscount: Number(curr.promotion_discount_krw),
        growthLogistics: Number(curr.growth_logistics_fee_krw)
      };
      return acc;
    }, {} as any);

    const totalSold = salesMap.get(p.code) || 0;

    return {
      code: p.code,
      name: p.name,
      totalIn: p.stock,
      totalSold: totalSold,
      calculatedStock: p.stock - totalSold,
      dailyOut: p.daily_out,
      runway: p.runway,
      isDirect: p.is_direct,
      directFee: p.direct_fee,
      is3PL: p.is_3pl,
      fee3PL: p.fee_3pl,
      avgCogs,
      platformCosts: pCosts,
      importLogs,
      mappings: {
        coupangVendorIds: pMappings.filter(m => m.mapping_type === 'ordersCoupang').map(m => m.raw_key).join('\n'),
        naverProductId: pMappings.find(m => m.mapping_type === 'ordersNaver')?.raw_key || '',
        coupangAdCampaigns: pMappings.filter(m => m.mapping_type === 'adsCoupang').map(m => m.raw_key).join('\n'),
        scrapingKeywords: pMappings.filter(m => m.mapping_type === 'scrapingKeywords').map(m => m.raw_key).join('\n'),
        scrapingUrl: pMappings.find(m => m.mapping_type === 'scrapingUrl')?.target_url || ''
      }
    };
  });
}

export async function fetchUnmatchedQueue() {
  const db = getDb();
  const res = await db.query(`SELECT * FROM unmatched_queue ORDER BY created_at DESC`);
  const queue = res.rows.map(r => ({
    id: r.queue_id,
    platform: r.platform,
    type: r.data_type,
    title: r.title,
    rawId: r.raw_id_or_text
  }));

  // 쿠팡 Wing 매출 옵션 중 매핑되지 않은 고아(Orphan) 데이터 실시간 검출
  const wingRes = await db.query(`
    SELECT COALESCE(option_id, '') as option_id, product_name, option_name 
    FROM wing_sales 
    WHERE COALESCE(NULLIF(option_id, ''), 'NAME::' || COALESCE(product_name, '') || '::' || COALESCE(option_name, '')) NOT IN (
      SELECT raw_key FROM product_mappings WHERE mapping_type IN ('ordersCoupang', 'adsCoupang', 'scrapingKeywords')
    )
    GROUP BY COALESCE(option_id, ''), product_name, option_name
  `);

  const wingOrphans = wingRes.rows.map((r: any) => {
    const rawId = r.option_id || `NAME::${r.product_name || ''}::${r.option_name || ''}`;
    return {
      id: `wing_auto_${rawId}_${Math.random().toString(36).substring(7)}`,
      platform: 'Coupang',
      type: '주문 Log',
      title: `[매출 연동] ${r.product_name || '이름없음'} - ${r.option_name || '기본'}`,
      rawId
    };
  });

  // 네이버 스마트스토어 매출 옵션 중 매핑되지 않은 고아(Orphan) 데이터 실시간 검출
  const naverRes = await db.query(`
    SELECT COALESCE(option_code, '') as option_code, product_name, option_name 
    FROM naver_sales 
    WHERE COALESCE(NULLIF(option_code, ''), 'NAME::' || COALESCE(product_name, '') || '::' || COALESCE(option_name, '')) NOT IN (
      SELECT raw_key FROM product_mappings WHERE mapping_type IN ('ordersNaver')
    )
    GROUP BY COALESCE(option_code, ''), product_name, option_name
  `);

  const naverOrphans = naverRes.rows.map((r: any) => {
    const rawId = r.option_code || `NAME::${r.product_name || ''}::${r.option_name || ''}`;
    return {
      id: `naver_auto_${rawId}_${Math.random().toString(36).substring(7)}`,
      platform: 'Naver',
      type: '주문 Log',
      title: `[매출 연동] ${r.product_name || '이름없음'} - ${r.option_name || '기본'}`,
      rawId
    };
  });

  return [...queue, ...wingOrphans, ...naverOrphans];
}

export async function createMasterProduct(data: { code: string, name: string, stock: number }) {
  const db = getDb();
  await db.query(`
    INSERT INTO products_dim (code, name, stock, daily_out, runway)
    VALUES ($1, $2, $3, 0, 999)
  `, [data.code, data.name, data.stock]);
  revalidatePath('/products');
}

export async function createTradeReceipt(data: { sku: string, qty: number, date: string, deliveryMethod: string, totalPrice: number, shippingFee: number, tariff: number, blNumber: string, domesticShipping: number, supplierDate: string, agencyDate: string, tariffDate: string }) {
  const db = getDb();
  // Automatically calculate true unit logical COGS
  const totalCostAggr = data.totalPrice + data.shippingFee + data.tariff + data.domesticShipping;
  const cogsKrw = data.qty > 0 ? Math.round(totalCostAggr / data.qty) : 0;

  // 1. Insert receipt
  await db.query(`
    INSERT INTO trade_receipts (
      master_code, qty, supplier_date, delivery_method, shipping_fee, tariff, cogs_krw,
      bl_number, domestic_shipping, supplier_pay_date, agency_pay_date, tariff_pay_date
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULLIF($10, '')::DATE, NULLIF($11, '')::DATE, NULLIF($12, '')::DATE)
  `, [
    data.sku, data.qty, data.date || new Date(), data.deliveryMethod, data.shippingFee, data.tariff, cogsKrw,
    data.blNumber, data.domesticShipping, data.supplierDate, data.agencyDate, data.tariffDate
  ]);

  // 2. Update Master stock
  await db.query(`
    UPDATE products_dim SET stock = stock + $1 WHERE code = $2
  `, [data.qty, data.sku]);

  revalidatePath('/products');
}

// Map Unmatched Items
export async function assignMappingFromQueue(queueId: string, sku: string, rawKey: string, typeDesc: string) {
  const db = getDb();
  
  let mappingType = 'scrapingKeywords';
  if (typeDesc === '주문 Log') {
    if (queueId.startsWith('naver_auto_')) {
      mappingType = 'ordersNaver';
    } else {
      mappingType = 'ordersCoupang';
    }
  }
  if (typeDesc === '캠페인') mappingType = 'adsCoupang';

  await db.query(`
    INSERT INTO product_mappings (master_code, platform, mapping_type, raw_key)
    VALUES ($1, 'System', $2, $3)
  `, [sku, mappingType, rawKey]);

  // 동적 검출 데이터는 unmatched_queue DB에 없으므로 삭제 스킵
  if (!queueId.startsWith('wing_auto_') && !queueId.startsWith('naver_auto_')) {
    await db.query(`DELETE FROM unmatched_queue WHERE queue_id = $1`, [queueId]);
  }
  
  revalidatePath('/products');
}

export async function saveMasterMappings(sku: string, mappings: any) {
  const db = getDb();
  await db.query(`DELETE FROM product_mappings WHERE master_code = $1`, [sku]);
  
  const insertQuery = `INSERT INTO product_mappings (master_code, platform, mapping_type, raw_key) VALUES ($1, $2, $3, $4)`;
  
  if (mappings.coupangVendorIds) {
    for (const id of mappings.coupangVendorIds.split('\\n')) {
      if(id.trim()) await db.query(insertQuery, [sku, 'System', 'ordersCoupang', id.trim()]);
    }
  }
  if (mappings.naverProductId) {
    if(mappings.naverProductId.trim()) await db.query(insertQuery, [sku, 'System', 'ordersNaver', mappings.naverProductId.trim()]);
  }
  if (mappings.coupangAdCampaigns) {
    for (const id of mappings.coupangAdCampaigns.split('\\n')) {
      if(id.trim()) await db.query(insertQuery, [sku, 'System', 'adsCoupang', id.trim()]);
    }
  }
  if (mappings.scrapingKeywords) {
    for (const kw of mappings.scrapingKeywords.split('\\n')) {
      if(kw.trim()) await db.query(insertQuery, [sku, 'System', 'scrapingKeywords', kw.trim()]);
    }
  }
  if (mappings.scrapingUrl) {
    if(mappings.scrapingUrl.trim()) await db.query(`INSERT INTO product_mappings (master_code, platform, mapping_type, raw_key, target_url) VALUES ($1, $2, $3, $4, $5)`, [sku, 'System', 'scrapingUrl', 'URL', mappings.scrapingUrl.trim()]);
  }
  
  revalidatePath('/products');
}

export async function savePlatformCost(
  masterCode: string, 
  platformType: string, 
  costData: { shippingFee: number, packagingFee: number, commissionPercent: number, promoDiscount: number, growthLogistics: number }
) {
  const db = getDb();
  await db.query(`
    INSERT INTO product_platform_costs 
    (master_code, platform_type, shipping_fee_krw, packaging_fee_krw, commission_percent, promotion_discount_krw, growth_logistics_fee_krw, valid_from)
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
  `, [
    masterCode, platformType, 
    costData.shippingFee || 0, 
    costData.packagingFee || 0, 
    costData.commissionPercent || 0, 
    costData.promoDiscount || 0, 
    costData.growthLogistics || 0
  ]);
  revalidatePath('/products');
}

export async function deleteTradeReceipt(receiptId: string) {
  const db = getDb();
  const res = await db.query(`SELECT master_code, qty FROM trade_receipts WHERE receipt_id = $1`, [receiptId]);
  if (res.rows.length === 0) return;
  const { master_code, qty } = res.rows[0];

  await db.query(`DELETE FROM trade_receipts WHERE receipt_id = $1`, [receiptId]);
  await db.query(`UPDATE products_dim SET stock = stock - $1 WHERE code = $2`, [qty, master_code]);
  revalidatePath('/products');
}

export async function updateTradeReceipt(
  receiptId: string, 
  data: { qty: number, date: string, deliveryMethod: string, totalPrice: number, shippingFee: number, tariff: number, blNumber: string, domesticShipping: number, supplierDate: string, agencyDate: string, tariffDate: string }
) {
  const db = getDb();
  const res = await db.query(`SELECT master_code, qty FROM trade_receipts WHERE receipt_id = $1`, [receiptId]);
  if (res.rows.length === 0) return;
  const { master_code, qty: oldQty } = res.rows[0];

  const deltaQty = data.qty - oldQty;
  
  const totalCostAggr = data.totalPrice + data.shippingFee + data.tariff + data.domesticShipping;
  const newUnitCogs = data.qty > 0 ? Math.round(totalCostAggr / data.qty) : 0;

  await db.query(`
    UPDATE trade_receipts 
    SET qty = $1, cogs_krw = $2, supplier_date = $3, delivery_method = $4, shipping_fee = $5, tariff = $6,
        bl_number = $8, domestic_shipping = $9, supplier_pay_date = NULLIF($10, '')::DATE, agency_pay_date = NULLIF($11, '')::DATE, tariff_pay_date = NULLIF($12, '')::DATE
    WHERE receipt_id = $7
  `, [data.qty, newUnitCogs, data.date, data.deliveryMethod, data.shippingFee, data.tariff, receiptId, data.blNumber, data.domesticShipping, data.supplierDate, data.agencyDate, data.tariffDate]);

  await db.query(`UPDATE products_dim SET stock = stock + $1 WHERE code = $2`, [deltaQty, master_code]);
  revalidatePath('/products');
}
