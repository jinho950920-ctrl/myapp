"use server";

import { query } from "@/lib/db";

export async function fetchCompetitors() {
  const sql = `
    SELECT 
      c.id, c.competitor_name, c.target_url, c.current_price, c.original_price, 
      c.is_out_of_stock, c.is_catalog_matched, c.last_scraped_at,
      p.name as product_name, p.sku_code
    FROM public.erp_competitor_radar c
    JOIN public.erp_products p ON c.product_id = p.id
    ORDER BY c.last_scraped_at DESC
  `;
  return await query(sql);
}

export async function fetchPricingRules() {
  const sql = `
    SELECT 
      r.id, r.min_price, r.max_price, r.target_margin_percent, r.is_active, r.updated_at,
      p.name as product_name, p.sku_code
    FROM public.erp_dynamic_pricing_rules r
    JOIN public.erp_products p ON r.product_id = p.id
    ORDER BY r.updated_at DESC
  `;
  return await query(sql);
}
