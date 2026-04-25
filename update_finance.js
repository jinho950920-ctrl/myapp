const fs = require('fs');

let code = fs.readFileSync('src/app/actions/finance.ts', 'utf8');

// 1. Update SQL queries to fetch fulfillment_type
code = code.replace(
  /'SELECT option_id, MAX\(sales_amount\) as total_sales, MAX\(sales_qty\) as total_qty FROM wing_sales GROUP BY option_id'/g,
  "'SELECT option_id, fulfillment_type, SUM(sales_amount) as total_sales, SUM(sales_qty) as total_qty FROM wing_sales GROUP BY option_id, fulfillment_type'"
);

code = code.replace(
  /'SELECT date, account_alias, option_id, SUM\(sales_amount\) as total_sales, SUM\(sales_qty\) as total_qty FROM wing_sales GROUP BY date, account_alias, option_id'/g,
  "'SELECT date, account_alias, option_id, fulfillment_type, SUM(sales_amount) as total_sales, SUM(sales_qty) as total_qty FROM wing_sales GROUP BY date, account_alias, option_id, fulfillment_type'"
);

fs.writeFileSync('src/app/actions/finance.ts', code);
