import * as XLSX from 'xlsx';
const wb = XLSX.readFile('downloads/coupang_sales_2026-03-24.xlsx');
const sheet = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
for(let i=0; i<Math.min(data.length, 10); i++) {
  console.log(`Row ${i}:`, data[i]);
}
