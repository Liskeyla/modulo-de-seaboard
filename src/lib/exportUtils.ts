import * as XLSX from 'xlsx';

export function exportToExcel(filename: string, headers: string[], rows: (string | number)[][]) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
  XLSX.writeFile(wb, filename);
}

export async function copyTableToClipboard(headers: string[], rows: (string | number)[][]) {
  const tsv = [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');
  await navigator.clipboard.writeText(tsv);
}
