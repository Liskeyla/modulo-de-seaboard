'use client';

import { ClipboardCopy, FileSpreadsheet, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { copyTableToClipboard, exportToExcel } from '@/lib/exportUtils';
import { toast } from '@/lib/utils';

interface DmsTableToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  pageSize: number;
  onPageSizeChange: (n: number) => void;
  excelFilename?: string;
  excelHeaders?: string[];
  excelRows?: (string | number)[][];
}

export function DmsTableToolbar({
  search,
  onSearchChange,
  pageSize,
  onPageSizeChange,
  excelFilename = 'reporte.xlsx',
  excelHeaders = [],
  excelRows = [],
}: DmsTableToolbarProps) {
  return (
    <div className="dms-table-toolbar">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="dms-btn-excel"
          onClick={() => {
            if (!excelHeaders.length) return;
            exportToExcel(excelFilename, excelHeaders, excelRows);
            toast('Archivo Excel descargado.', 'success');
          }}
        >
          <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
        </button>
        <button
          type="button"
          className="dms-btn-copy"
          onClick={async () => {
            if (!excelHeaders.length) return;
            await copyTableToClipboard(excelHeaders, excelRows);
            toast('Datos copiados al portapapeles.', 'success');
          }}
        >
          <ClipboardCopy className="h-3.5 w-3.5" /> Portapapeles
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600 shadow-sm">
          <span className="font-medium text-gray-500">Filas</span>
          <select
            className="dms-select w-16 border-0 bg-transparent py-0 text-xs font-semibold"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex min-w-[200px] flex-1 items-center gap-2 sm:max-w-xs sm:justify-end lg:ml-auto">
        <Search className="h-4 w-4 shrink-0 text-gray-400" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Filtrar tabla…"
          className="h-9 w-full rounded-lg border-gray-200 bg-white text-sm shadow-sm"
        />
      </div>
    </div>
  );
}
