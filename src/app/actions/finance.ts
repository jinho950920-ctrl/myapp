"use server";

import { query } from "@/lib/db";

export async function fetchTransactions() {
  const sql = `
    SELECT 
      t.id, 
      t.transaction_date, 
      t.category, 
      t.amount, 
      t.description, 
      t.bank_account_name, 
      t.market_name, 
      t.is_reconciled, 
      t.created_at,
      b.name as business_name, 
      o.order_number
    FROM public.erp_financial_transactions t
    LEFT JOIN public.erp_business_entities b ON t.business_id = b.id
    LEFT JOIN public.erp_orders o ON t.order_id = o.id
    ORDER BY t.transaction_date DESC, t.created_at DESC
  `;
  return await query(sql);
}

export async function fetchMasterProfitability() {
  let products = [];
  try {
    const pRes = await query('SELECT * FROM products_dim ORDER BY name ASC');
    products = pRes.rows;
  } catch (e) { return []; }

  const mRes = await query('SELECT * FROM product_mappings').catch(() => ({ rows: [] }));
  const mappings = mRes.rows;

  const wRes = await query('SELECT option_id, fulfillment_type, SUM(sales_amount) as total_sales, SUM(sales_qty) as total_qty FROM wing_sales GROUP BY option_id, fulfillment_type').catch(() => ({ rows: [] }));
  const wingSales = wRes.rows;

  const nRes = await query(`
    SELECT option_code, product_name, option_name,
           SUM(total_payment_amount) as total_sales, SUM(quantity) as total_qty 
    FROM naver_sales 
    WHERE order_status != 'CANCELED' 
    GROUP BY option_code, product_name, option_name
  `).catch(() => ({ rows: [] }));
  const naverSales = nRes.rows;

  const aRes = await query('SELECT account_alias, campaign_name, conversion_option_id, SUM(ad_spend) as total_cost FROM coupang_ads_performance GROUP BY account_alias, campaign_name, conversion_option_id').catch(() => ({ rows: [] }));
  const adsSales = aRes.rows;

  const rRes = await query('SELECT master_code, qty, cogs_krw FROM trade_receipts').catch(() => ({ rows: [] }));
  const receipts = rRes.rows;

  const cRes = await query('SELECT DISTINCT ON (master_code, platform_type) * FROM product_platform_costs ORDER BY master_code, platform_type, valid_from DESC').catch(() => ({ rows: [] }));
  const platformCosts = cRes.rows;

  const results = products.map((p: any) => {
    const pReceipts = receipts.filter((r: any) => r.master_code === p.code);
    let totalCogs = 0, totalRQty = 0;
    for (const r of pReceipts) {
      totalCogs += (Number(r.cogs_krw) || 0) * (Number(r.qty) || 0);
      totalRQty += (Number(r.qty) || 0);
    }
    const avgUnitCogs = totalRQty > 0 ? totalCogs / totalRQty : 0;

    const salesMappings = mappings.filter((m: any) => m.master_code === p.code && m.mapping_type === 'ordersCoupang');
    let productSalesAmount = 0, productSalesQty = 0, platformFee = 0, productPromoDiscount = 0;

    for (const mapping of salesMappings) {
      const match = wingSales.filter((w: any) => w.option_id === mapping.raw_key);
      for (const m of match) {
        const rev = Number(m.total_sales || 0);
        const qty = Number(m.total_qty || 0);
        const fType = m.fulfillment_type;
        productSalesAmount += rev;
        productSalesQty += qty;

        const expectedPlatform = fType === '로켓그로스' ? 'coupang_growth' : 'coupang_general';
        let validPolicy = platformCosts.find(c => c.master_code === p.code && c.platform_type === expectedPlatform);
        if (!validPolicy) validPolicy = platformCosts.find(c => c.master_code === p.code && c.platform_type.includes('coupang'));

        if (validPolicy) {
          const promo = Number(validPolicy.promotion_discount_krw) || 0;
          const commRate = (Number(validPolicy.commission_percent) || 10) / 100;
          const ship = fType === '로켓그로스' ? 0 : Number(validPolicy.shipping_fee_krw) || 0;
          const pack = fType === '로켓그로스' ? 0 : Number(validPolicy.packaging_fee_krw) || 0;
          const growthLogis = fType === '로켓그로스' ? Number(validPolicy.growth_logistics_fee_krw) || 0 : 0;
          
          const totalPromo = promo * qty;
          productPromoDiscount += totalPromo;
          const discountedGross = Math.max(0, rev - totalPromo);
          const commission = discountedGross * commRate;
          
          platformFee += commission + (ship * qty) + (pack * qty) + (growthLogis * qty);
        } else {
          platformFee += (rev * 0.11);
        }
      }
    }

    const naverMappings = mappings.filter((m: any) => m.master_code === p.code && m.mapping_type === 'ordersNaver');
    for (const mapping of naverMappings) {
      const match = naverSales.filter((n: any) => {
        const nKey = n.option_code || `NAME::${n.product_name || ''}::${n.option_name || ''}`;
        return nKey === mapping.raw_key;
      });
      for (const m of match) {
        const rev = Number(m.total_sales || 0);
        const qty = Number(m.total_qty || 0);
        
        productSalesAmount += rev;
        productSalesQty += qty;

        let validPolicy = platformCosts.find(c => c.master_code === p.code && c.platform_type === 'naver_general');
        
        if (validPolicy) {
          const promo = Number(validPolicy.promotion_discount_krw) || 0;
          const commRate = (Number(validPolicy.commission_percent) || 3) / 100;
          const ship = Number(validPolicy.shipping_fee_krw) || 0;
          const pack = Number(validPolicy.packaging_fee_krw) || 0;
          
          const totalPromo = promo * qty;
          productPromoDiscount += totalPromo;
          const discountedGross = Math.max(0, rev - totalPromo);
          const commission = discountedGross * commRate;
          
          platformFee += commission + (ship * qty) + (pack * qty);
        } else {
          // Default Naver fee ~3%
          platformFee += (rev * 0.03);
        }
      }
    }

    let productAdCost = 0;
    const processedCampaigns = new Set();

    for (const mapping of salesMappings) {
      const match = adsSales.filter((a: any) => a.conversion_option_id === mapping.raw_key);
      for (const m of match) {
        const uniqueKey = m.account_alias + '_' + m.campaign_name + '_' + m.conversion_option_id;
        if (!processedCampaigns.has(uniqueKey)) {
           productAdCost += Number(m.total_cost || 0) * 1.1; // 10% VAT
           processedCampaigns.add(uniqueKey);
        }
      }
    }

    const implicitMatch = adsSales.filter((a: any) => a.campaign_name && a.campaign_name.includes(p.code));
    for (const m of implicitMatch) {
      const uniqueKey = m.account_alias + '_' + m.campaign_name + '_' + m.conversion_option_id;
      if (!processedCampaigns.has(uniqueKey)) {
         productAdCost += Number(m.total_cost || 0) * 1.1; // 10% VAT
         processedCampaigns.add(uniqueKey);
      }
    }

    const netProfit = productSalesAmount - (avgUnitCogs * productSalesQty) - productAdCost - platformFee - productPromoDiscount;

    return {
      name: p.name || p.code,
      grossSales: Math.round(productSalesAmount),
      qty: Math.round(productSalesQty),
      cogsAgg: Math.round(avgUnitCogs * productSalesQty),
      ads: Math.round(productAdCost),
      promoAgg: Math.round(productPromoDiscount),
      fees: Math.round(platformFee),
      netProfit: Math.round(netProfit)
    };
  });

  return results.filter((r: any) => r.qty > 0 || r.grossSales > 0);
}

export async function fetchDailyProfitability() {
  let products = [];
  try {
    const pRes = await query('SELECT * FROM products_dim ORDER BY name ASC');
    products = pRes.rows;
  } catch (e) { return []; }

  const mRes = await query('SELECT * FROM product_mappings').catch(() => ({ rows: [] }));
  const mappings = mRes.rows;

  const wRes = await query('SELECT date, account_alias, option_id, fulfillment_type, SUM(sales_amount) as total_sales, SUM(sales_qty) as total_qty FROM wing_sales GROUP BY date, account_alias, option_id, fulfillment_type').catch(() => ({ rows: [] }));
  const wingSales = wRes.rows;

  const nRes = await query(`
    SELECT date, account_alias, option_code, product_name, option_name,
           SUM(total_payment_amount) as total_sales, SUM(quantity) as total_qty 
    FROM naver_sales 
    WHERE order_status != 'CANCELED' 
    GROUP BY date, account_alias, option_code, product_name, option_name
  `).catch(() => ({ rows: [] }));
  const naverSales = nRes.rows;

  const aRes = await query('SELECT date, account_alias, campaign_name, conversion_option_id, SUM(ad_spend) as total_cost FROM coupang_ads_performance GROUP BY date, account_alias, campaign_name, conversion_option_id').catch(() => ({ rows: [] }));
  const adsSales = aRes.rows;

  const rRes = await query('SELECT master_code, qty, cogs_krw FROM trade_receipts').catch(() => ({ rows: [] }));
  const receipts = rRes.rows;

  const cRes = await query('SELECT DISTINCT ON (master_code, platform_type) * FROM product_platform_costs ORDER BY master_code, platform_type, valid_from DESC').catch(() => ({ rows: [] }));
  const platformCosts = cRes.rows;

  const results: any[] = [];
  const processedSalesKeys = new Set<string>();
  const processedAdsKeys = new Set<string>();

  const dateSet = new Set<string>();
  
  wingSales.forEach((w: any) => { if (w.date) {
    try { dateSet.add(new Date(new Date(w.date).getTime() + 9*60*60*1000).toISOString().split('T')[0]); } catch(e){}
  }});
  naverSales.forEach((n: any) => { if (n.date) {
    try { dateSet.add(new Date(new Date(n.date).getTime() + 9*60*60*1000).toISOString().split('T')[0]); } catch(e){}
  }});
  adsSales.forEach((a: any) => { if (a.date) {
    try { dateSet.add(new Date(new Date(a.date).getTime() + 9*60*60*1000).toISOString().split('T')[0]); } catch(e){}
  }});

  const dates = Array.from(dateSet).sort();

  for (const p of products) {
    const pReceipts = receipts.filter((r: any) => r.master_code === p.code);
    let totalCogs = 0, totalRQty = 0;
    for (const r of pReceipts) {
      totalCogs += (Number(r.cogs_krw) || 0) * (Number(r.qty) || 0);
      totalRQty += (Number(r.qty) || 0);
    }
    const avgUnitCogs = totalRQty > 0 ? totalCogs / totalRQty : 0;

    const pCost = platformCosts.find((c: any) => c.master_code === p.code && c.platform_type.includes('coupang'));
    const shippingFee = pCost ? Number(pCost.shipping_fee_krw || 0) : 0;
    const commissionPct = pCost ? Number(pCost.commission_percent || 10) / 100 : 0.1;

    for (const d of dates) {
      const dailyStats: Record<string, any> = {};

      const salesMappings = mappings.filter((m: any) => m.master_code === p.code && m.mapping_type === 'ordersCoupang');
      for (const mapping of salesMappings) {
        const match = wingSales.filter((w: any) => {
          const wKey = w.option_id || `NAME::${w.product_name || ''}::${w.option_name || ''}`;
          return wKey === mapping.raw_key && new Date(new Date(w.date).getTime() + 9*60*60*1000).toISOString().split('T')[0] === d;
        });
        for (const m of match) {
          const sKey = `${m.date}_${m.account_alias}_${m.option_id || m.product_name}_${m.fulfillment_type}`;
          processedSalesKeys.add(sKey);
          
          const platform = 'coupang';
          const accountAlias = m.account_alias || '쿠팡 모딩';
          const key = `${platform}_${accountAlias}`;
          if (!dailyStats[key]) dailyStats[key] = { platform, accountAlias, grossSales: 0, qty: 0, ads: 0, promoAgg: 0, fees: 0, deliveryPackagingFee: 0 };
          
          const rev = Number(m.total_sales || 0);
          const qty = Number(m.total_qty || 0);
          const fType = m.fulfillment_type;
          
          dailyStats[key].grossSales += rev;
          dailyStats[key].qty += qty;
          
          const expectedPlatform = fType === '로켓그로스' ? 'coupang_growth' : 'coupang_general';
          let validPolicy = platformCosts.find(c => c.master_code === p.code && c.platform_type === expectedPlatform);
          if (!validPolicy) validPolicy = platformCosts.find(c => c.master_code === p.code && c.platform_type.includes('coupang'));
          
          if (validPolicy) {
            const promo = Number(validPolicy.promotion_discount_krw) || 0;
            const commRate = (Number(validPolicy.commission_percent) || 10) / 100;
            const ship = fType === '로켓그로스' ? 0 : Number(validPolicy.shipping_fee_krw) || 0;
            const pack = fType === '로켓그로스' ? 0 : Number(validPolicy.packaging_fee_krw) || 0;
            const growthLogis = fType === '로켓그로스' ? Number(validPolicy.growth_logistics_fee_krw) || 0 : 0;
            
            const totalPromo = promo * qty;
            dailyStats[key].promoAgg += totalPromo;
            const discountedGross = Math.max(0, rev - totalPromo);
            const commission = discountedGross * commRate;
            
            dailyStats[key].fees += commission + (growthLogis * qty);
            dailyStats[key].deliveryPackagingFee += (ship * qty) + (pack * qty);
          } else {
            dailyStats[key].fees += (rev * 0.11);
          }
        }
      }

      const naverMappings = mappings.filter((m: any) => m.master_code === p.code && m.mapping_type === 'ordersNaver');
      for (const mapping of naverMappings) {
        const match = naverSales.filter((n: any) => {
          const nKey = n.option_code || `NAME::${n.product_name || ''}::${n.option_name || ''}`;
          return nKey === mapping.raw_key && new Date(new Date(n.date).getTime() + 9*60*60*1000).toISOString().split('T')[0] === d;
        });
        for (const m of match) {
          const sKey = `naver_${m.date}_${m.account_alias}_${m.option_code || m.product_name}`;
          processedSalesKeys.add(sKey);
          
          const platform = 'naver';
          const accountAlias = m.account_alias || '네이버 온하인';
          const key = `${platform}_${accountAlias}`;
          if (!dailyStats[key]) dailyStats[key] = { platform, accountAlias, grossSales: 0, qty: 0, ads: 0, promoAgg: 0, fees: 0, deliveryPackagingFee: 0 };
          
          const rev = Number(m.total_sales || 0);
          const qty = Number(m.total_qty || 0);
          
          dailyStats[key].grossSales += rev;
          dailyStats[key].qty += qty;

          let validPolicy = platformCosts.find(c => c.master_code === p.code && c.platform_type === 'naver_general');
          
          if (validPolicy) {
            const promo = Number(validPolicy.promotion_discount_krw) || 0;
            const commRate = (Number(validPolicy.commission_percent) || 3) / 100;
            const ship = Number(validPolicy.shipping_fee_krw) || 0;
            const pack = Number(validPolicy.packaging_fee_krw) || 0;
            
            const totalPromo = promo * qty;
            dailyStats[key].promoAgg += totalPromo;
            const discountedGross = Math.max(0, rev - totalPromo);
            const commission = discountedGross * commRate;
            
            dailyStats[key].fees += commission;
            dailyStats[key].deliveryPackagingFee += (ship * qty) + (pack * qty);
          } else {
            dailyStats[key].fees += (rev * 0.03); // 기본 3% 수수료
          }
        }
      }

      const processedCampaigns = new Set();
      
      for (const mapping of salesMappings) {
        const match = adsSales.filter((a: any) => 
          a.conversion_option_id === mapping.raw_key && 
          new Date(new Date(a.date).getTime() + 9*60*60*1000).toISOString().split('T')[0] === d
        );
        for (const m of match) {
          const uniqueKey = m.account_alias + '_' + m.campaign_name + '_' + m.conversion_option_id;
          const aKey = `${m.date}_${m.account_alias}_${m.campaign_name}_${m.conversion_option_id}`;
          processedAdsKeys.add(aKey);

          if (!processedCampaigns.has(uniqueKey)) {
             const platform = 'coupang';
             const accountAlias = m.account_alias || '쿠팡 모딩';
             const key = `${platform}_${accountAlias}`;
             if (!dailyStats[key]) dailyStats[key] = { platform, accountAlias, grossSales: 0, qty: 0, ads: 0, promoAgg: 0, fees: 0, deliveryPackagingFee: 0 };
             
             dailyStats[key].ads += Number(m.total_cost || 0) * 1.1;
             processedCampaigns.add(uniqueKey);
          }
        }
      }

      const implicitMatch = adsSales.filter((a: any) => 
          a.campaign_name && 
          a.campaign_name.includes(p.code) && 
          new Date(new Date(a.date).getTime() + 9*60*60*1000).toISOString().split('T')[0] === d
      );
      for (const m of implicitMatch) {
        const uniqueKey = m.account_alias + '_' + m.campaign_name + '_' + m.conversion_option_id;
        const aKey = `${m.date}_${m.account_alias}_${m.campaign_name}_${m.conversion_option_id}`;
        processedAdsKeys.add(aKey);

        if (!processedCampaigns.has(uniqueKey)) {
           const platform = 'coupang';
           const accountAlias = m.account_alias || '쿠팡 모딩';
           const key = `${platform}_${accountAlias}`;
           if (!dailyStats[key]) dailyStats[key] = { platform, accountAlias, grossSales: 0, qty: 0, ads: 0, promoAgg: 0, fees: 0, deliveryPackagingFee: 0 };
           
           dailyStats[key].ads += Number(m.total_cost || 0) * 1.1;
           processedCampaigns.add(uniqueKey);
        }
      }

      for (const key of Object.keys(dailyStats)) {
        const stat = dailyStats[key];
        const cogsAgg = avgUnitCogs * stat.qty;
        const netProfit = stat.grossSales - cogsAgg - stat.deliveryPackagingFee - stat.fees - stat.ads - stat.promoAgg;

        if (stat.qty > 0 || stat.ads > 0 || stat.grossSales > 0) {
          results.push({
            date: d,
            masterCode: p.code,
            name: p.name || p.code,
            platform: stat.platform,
            accountAlias: stat.accountAlias,
            grossSales: Math.round(stat.grossSales),
            qty: Math.round(stat.qty),
            cogsAgg: Math.round(cogsAgg),
            ads: Math.round(stat.ads),
            promoAgg: Math.round(stat.promoAgg),
            fees: Math.round(stat.fees + stat.deliveryPackagingFee), // 배송/포장비 포함
            netProfit: Math.round(netProfit)
          });
        }
      }
    }
  }

  // --- UNMAPPED 데이터 수집 ---
  for (const d of dates) {
    let unmappedSalesAmt = 0;
    let unmappedSalesQty = 0;
    let unmappedPlatformFee = 0;
    let unmappedAdCost = 0;

    const dailySales = wingSales.filter((w: any) => new Date(new Date(w.date).getTime() + 9*60*60*1000).toISOString().split('T')[0] === d);
    for (const s of dailySales) {
      const sKey = `${s.date}_${s.account_alias}_${s.option_id}_${s.fulfillment_type}`;
      if (!processedSalesKeys.has(sKey)) {
        unmappedSalesAmt += Number(s.total_sales || 0);
        unmappedSalesQty += Number(s.total_qty || 0);
        unmappedPlatformFee += Number(s.total_sales || 0) * 0.11; // 기본 수수료 11% 징수
      }
    }

    const dailyNaverSales = naverSales.filter((n: any) => new Date(new Date(n.date).getTime() + 9*60*60*1000).toISOString().split('T')[0] === d);
    for (const s of dailyNaverSales) {
      const sKey = `naver_${s.date}_${s.account_alias}_${s.option_code || s.product_name}`;
      if (!processedSalesKeys.has(sKey)) {
        unmappedSalesAmt += Number(s.total_sales || 0);
        unmappedSalesQty += Number(s.total_qty || 0);
        unmappedPlatformFee += Number(s.total_sales || 0) * 0.03; // 네이버 기본 수수료 3%
      }
    }

    const dailyAds = adsSales.filter((a: any) => new Date(new Date(a.date).getTime() + 9*60*60*1000).toISOString().split('T')[0] === d);
    for (const a of dailyAds) {
      const aKey = `${a.date}_${a.account_alias}_${a.campaign_name}_${a.conversion_option_id}`;
      // Campaign name 기반의 implicit match 등에서 catch된 내역 추적 방지용 Set
      if (!processedAdsKeys.has(aKey)) {
        unmappedAdCost += Number(a.total_cost || 0) * 1.1; // VAT 포함
      }
    }

    const netProfit = unmappedSalesAmt - unmappedPlatformFee - unmappedAdCost; // 원가(COGS) 등은 미상

    if (unmappedSalesAmt > 0 || unmappedAdCost > 0 || unmappedSalesQty > 0) {
      // For unmapped, we don't know the exact platform, but we can separate Naver vs Coupang roughly if we tracked them separately. 
      // For now, keep it simple.
      results.push({
        date: d,
        masterCode: "UNMAPPED",
        name: "미매핑 (기타 수익/광고비)",
        platform: "unmapped",
        accountAlias: "unknown",
        grossSales: Math.round(unmappedSalesAmt),
        qty: Math.round(unmappedSalesQty),
        cogsAgg: 0,
        ads: Math.round(unmappedAdCost),
        promoAgg: 0,
        fees: Math.round(unmappedPlatformFee),
        netProfit: Math.round(netProfit)
      });
    }
  }

  return results.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

