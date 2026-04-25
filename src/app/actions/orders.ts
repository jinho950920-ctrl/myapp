"use server";

import { query } from "@/lib/db";

export async function fetchOrders() {
  const sql = `
    SELECT 
      o.id,
      o.order_date,
      o.market_name,
      o.order_number,
      o.customer_name,
      o.status,
      o.total_amount,
      o.courier_name,
      o.tracking_number,
      b.name as business_name,
      (
        SELECT count(*) 
        FROM public.erp_order_items i 
        WHERE i.order_id = o.id
      ) as items_count
    FROM public.erp_orders o
    LEFT JOIN public.erp_business_entities b ON o.business_id = b.id
    ORDER BY o.order_date DESC
  `;
  return await query(sql);
}

export async function updateOrderStatus(orderId: string, newStatus: string) {
  const sql = `
    UPDATE public.erp_orders
    SET status = $1
    WHERE id = $2
    RETURNING id;
  `;
  return await query(sql, [newStatus, orderId]);
}
