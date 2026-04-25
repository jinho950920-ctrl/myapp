"use server";

import { query } from "@/lib/db";

export async function fetchProducts() {
  const sql = `
    SELECT 
      id, sku_code, name, status, stock_quantity, safe_days_to_stockout, created_at
    FROM public.erp_products
    ORDER BY created_at DESC
  `;
  return await query(sql);
}

export async function fetchImportBatches() {
  const sql = `
    SELECT 
      b.id, b.import_date, b.quantity, b.factory_cost, b.shipping_cost, 
      b.tax_cost, b.domestic_freight, b.total_cost, b.unit_cost, b.card_expense_id,
      p.sku_code, p.name as product_name
    FROM public.erp_import_batches b
    JOIN public.erp_products p ON b.product_id = p.id
    ORDER BY b.import_date DESC
  `;
  return await query(sql);
}
