const XLSX = require('xlsx');
const workbook = XLSX.readFile('downloads/coupang_sales_2026-03-30.xlsx');
const sheetName = workbook.SheetNames[0];
const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
console.log("=== 첫 두 줄의 엑셀 데이터 ===");
console.log(data.slice(0, 2));
