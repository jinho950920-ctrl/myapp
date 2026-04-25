const fs = require('fs');
let code = fs.readFileSync('src/app/actions/finance.ts', 'utf8');

// Update wRes queries
code = code.replace(
  /'SELECT option_id, MAX\(sales_amount\) as total_sales, MAX\(sales_qty\) as total_qty FROM wing_sales GROUP BY option_id'/g,
  "'SELECT option_id, fulfillment_type, SUM(sales_amount) as total_sales, SUM(sales_qty) as total_qty FROM wing_sales GROUP BY option_id, fulfillment_type'"
);

code = code.replace(
  /'SELECT date, account_alias, option_id, SUM\(sales_amount\) as total_sales, SUM\(sales_qty\) as total_qty FROM wing_sales GROUP BY date, account_alias, option_id'/g,
  "'SELECT date, account_alias, option_id, fulfillment_type, SUM(sales_amount) as total_sales, SUM(sales_qty) as total_qty FROM wing_sales GROUP BY date, account_alias, option_id, fulfillment_type'"
);

// Replace fetchMasterProfitability loop
const masterLoopOld = `
    const salesMappings = mappings.filter((m: any) => m.master_code === p.code && m.mapping_type === 'ordersCoupang');
    let productSalesAmount = 0, productSalesQty = 0;
    for (const mapping of salesMappings) {
      const match = wingSales.find((w: any) => w.option_id === mapping.raw_key);
      if (match) {
        productSalesAmount += Number(match.total_sales || 0);
        productSalesQty += Number(match.total_qty || 0);
      }
    }

    let productAdCost = 0;
    const processedCampaigns = new Set();

    for (const mapping of salesMappings) {
      const match = adsSales.filter((a: any) => a.conversion_option_id === mapping.raw_key);
      for (const m of match) {
        const uniqueKey = m.account_alias + '_' + m.campaign_name + '_' + m.conversion_option_id;
        if (!processedCampaigns.has(uniqueKey)) {
           productAdCost += Number(m.total_cost || 0);
           processedCampaigns.add(uniqueKey);
        }
      }
    }

    const implicitMatch = adsSales.filter((a: any) => a.campaign_name && a.campaign_name.includes(p.code));
    for (const m of implicitMatch) {
      const uniqueKey = m.account_alias + '_' + m.campaign_name + '_' + m.conversion_option_id;
      if (!processedCampaigns.has(uniqueKey)) {
         productAdCost += Number(m.total_cost || 0);
         processedCampaigns.add(uniqueKey);
      }
    }

    const pCost = platformCosts.find((c: any) => c.master_code === p.code && c.platform_type.includes('coupang'));
    const shippingFee = pCost ? Number(pCost.shipping_fee_krw || 0) : 0;
    const commissionPct = pCost ? Number(pCost.commission_percent || 10) / 100 : 0.1;
    const platformFee = (productSalesAmount * commissionPct) + (shippingFee * productSalesQty);

    const netProfit = productSalesAmount - (avgUnitCogs * productSalesQty) - productAdCost - platformFee;
`;

const masterLoopNew = `
    const salesMappings = mappings.filter((m: any) => m.master_code === p.code && m.mapping_type === 'ordersCoupang');
    let productSalesAmount = 0, productSalesQty = 0, platformFee = 0;

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
          const discountedGross = Math.max(0, rev - totalPromo);
          const commission = discountedGross * commRate;
          
          platformFee += commission + (ship * qty) + (pack * qty) + (growthLogis * qty);
        } else {
          platformFee += (rev * 0.11);
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

    const netProfit = productSalesAmount - (avgUnitCogs * productSalesQty) - productAdCost - platformFee;
`;
if (code.includes(masterLoopOld.trim().substring(0, 50))) { code = code.replace(masterLoopOld, masterLoopNew); }

// Replace fetchDailyProfitability loop bounds
const strStart = `    const pCost = platformCosts.find((c: any) => c.master_code === p.code && c.platform_type.includes('coupang'));`;
const strEnd = `      if (productSalesQty > 0 || productAdCost > 0 || productSalesAmount > 0) {`;

const dailyRegex = new RegExp(strStart.replace(/[.*+?^$\\{\\}()|[\\]\\\\]/g, '\\\\$&') + '[\\\\s\\\\S]*?' + strEnd.replace(/[.*+?^$\\{\\}()|[\\]\\\\]/g, '\\\\$&'));

const newDailyInner = `
    for (const d of dates) {
      const salesMappings = mappings.filter((m: any) => m.master_code === p.code && m.mapping_type === 'ordersCoupang');
      
      let productSalesAmount = 0;
      let productSalesQty = 0;
      let platformFee = 0;

      for (const mapping of salesMappings) {
        const match = wingSales.filter((w: any) => w.option_id === mapping.raw_key && new Date(new Date(w.date).getTime() + 9*60*60*1000).toISOString().split('T')[0] === d);
        
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
            const discountedGross = Math.max(0, rev - totalPromo);
            const commission = discountedGross * commRate;
            
            platformFee += commission + (ship * qty) + (pack * qty) + (growthLogis * qty);
          } else {
            platformFee += (rev * 0.11);
          }
        }
      }

      let productAdCost = 0;
      const processedCampaigns = new Set();
      
      for (const mapping of salesMappings) {
        const match = adsSales.filter((a: any) => 
          a.conversion_option_id === mapping.raw_key && 
          new Date(new Date(a.date).getTime() + 9*60*60*1000).toISOString().split('T')[0] === d
        );
        for (const m of match) {
          const uniqueKey = m.account_alias + '_' + m.campaign_name + '_' + m.conversion_option_id;
          if (!processedCampaigns.has(uniqueKey)) {
             productAdCost += Number(m.total_cost || 0) * 1.1; // 10% VAT
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
        if (!processedCampaigns.has(uniqueKey)) {
           productAdCost += Number(m.total_cost || 0) * 1.1; // 10% VAT
           processedCampaigns.add(uniqueKey);
        }
      }

      const cogsAgg = avgUnitCogs * productSalesQty;
      const netProfit = productSalesAmount - cogsAgg - productAdCost - platformFee;

      if (productSalesQty > 0 || productAdCost > 0 || productSalesAmount > 0) {
`;

code = code.replace(dailyRegex, newDailyInner);

fs.writeFileSync('src/app/actions/finance.ts', code);
console.log('Update complete!');
