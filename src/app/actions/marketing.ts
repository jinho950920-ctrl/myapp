"use server";

import { query } from "@/lib/db";

export async function fetchCampaigns() {
  const sql = `
    SELECT 
      c.id, 
      c.market_name, 
      c.campaign_name, 
      c.daily_budget, 
      c.status, 
      c.target_roas, 
      c.current_roas, 
      c.total_spend, 
      c.total_revenue, 
      c.created_at,
      p.name as product_name
    FROM public.erp_marketing_campaigns c
    LEFT JOIN public.erp_products p ON c.product_id = p.id
    ORDER BY c.created_at DESC
  `;
  return await query(sql);
}

export async function fetchKeywords() {
  const sql = `
    SELECT 
      k.id, 
      k.keyword, 
      k.current_bid, 
      k.clicks, 
      k.conversions, 
      k.cost, 
      k.sales, 
      k.roas, 
      k.status, 
      k.updated_at,
      c.campaign_name, 
      c.market_name
    FROM public.erp_marketing_keywords k
    JOIN public.erp_marketing_campaigns c ON k.campaign_id = c.id
    ORDER BY k.roas DESC NULLS LAST
  `;
  return await query(sql);
}
