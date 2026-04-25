"use server";

import { query } from "@/lib/db";

export async function fetchTickets() {
  const sql = `
    SELECT 
      t.id, 
      t.market_name, 
      t.customer_name, 
      t.inquiry_type, 
      t.inquiry_content, 
      t.ai_draft_response, 
      t.status, 
      t.created_at, 
      o.order_number, 
      p.name as product_name
    FROM public.erp_cs_tickets t
    LEFT JOIN public.erp_orders o ON t.order_id = o.id
    LEFT JOIN public.erp_products p ON t.product_id = p.id
    ORDER BY t.created_at DESC
  `;
  return await query(sql);
}
