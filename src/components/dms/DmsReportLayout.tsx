'use client';

import { ReactNode } from 'react';
import { Filter, Link2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface FilterField {
  label: string;
  type: 'date' | 'select' | 'text' | 'toggle';
  value: string | boolean;
  onChange: (v: string | boolean) => void;
  options?: string[];
}

interface DmsReportLayoutProps {
  title: string;
  subtitle?: string;
  heroIcon?: ReactNode;
  infoMessage?: ReactNode;
  filtros: FilterField[];
  onFiltrar: () => void;
  onLimpiar?: () => void;
  buscador?: {
    termino: string;
    onTerminoChange: (v: string) => void;
    parametro: string;
    onParametroChange: (v: string) => void;
    onBuscar: () => void;
  };
  opcionesRelacionadas?: ReactNode;
  children: ReactNode;
}

function FilterFields({ fields }: { fields: FilterField[] }) {
  return (
    <>
      {fields.map((f) => (
        <div key={f.label} className="min-w-0">
          {f.type === 'toggle' ? (
            <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md border border-[#c6c6c6] bg-white px-2 py-1.5 text-[11px]">
              <input
                type="checkbox"
                checked={Boolean(f.value)}
                onChange={(e) => f.onChange(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="font-medium text-gray-700">{f.label}</span>
            </label>
          ) : (
            <>
              <label className="dms-field-label">{f.label}</label>
              {f.type === 'select' ? (
                <select
                  className="dms-select"
                  value={String(f.value)}
                  onChange={(e) => f.onChange(e.target.value)}
                >
                  {(f.options ?? []).map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : f.type === 'date' ? (
                <Input
                  type="date"
                  value={String(f.value)}
                  onChange={(e) => f.onChange(e.target.value)}
                  className="dms-filter-control"
                />
              ) : (
                <Input
                  value={String(f.value)}
                  onChange={(e) => f.onChange(e.target.value)}
                  className="dms-filter-control"
                />
              )}
            </>
          )}
        </div>
      ))}
    </>
  );
}

export function DmsReportLayout({
  title: _title,
  subtitle: _subtitle,
  heroIcon: _heroIcon,
  infoMessage,
  filtros,
  onFiltrar,
  onLimpiar,
  buscador,
  opcionesRelacionadas,
  children,
}: DmsReportLayoutProps) {
  return (
    <div>
      <div className="dms-report-layout">
        <aside className="dms-sidebar-panel">
          <div className="dms-sidebar-box">
            <div className="dms-sidebar-header dms-sidebar-header--filtros">
              <Filter className="h-3 w-3" /> Filtros
            </div>
            <div className="dms-sidebar-body">
              <FilterFields fields={filtros} />
              <button type="button" className="dms-btn-filter" onClick={onFiltrar}>
                Filtrar
              </button>
              {onLimpiar && (
                <button type="button" className="dms-btn-limpiar" onClick={onLimpiar}>
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>

          {buscador && (
            <div className="dms-sidebar-box">
              <div className="dms-sidebar-header dms-sidebar-header--buscador">
                <Search className="h-3 w-3" /> Buscador
              </div>
              <div className="dms-sidebar-body">
                <div>
                  <label className="dms-field-label">Código / Contenedor</label>
                  <Input
                    value={buscador.termino}
                    onChange={(e) => buscador.onTerminoChange(e.target.value)}
                    className="dms-filter-control"
                    placeholder="Ingrese código…"
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    className={cn(
                      'dms-radio-option',
                      buscador.parametro === 'contenedor' && 'border-[#008080]'
                    )}
                  >
                    <input
                      type="radio"
                      checked={buscador.parametro === 'contenedor'}
                      onChange={() => buscador.onParametroChange('contenedor')}
                    />
                    Código de Contenedor
                  </label>
                  <label className="dms-radio-option">
                    <input
                      type="radio"
                      checked={buscador.parametro === 'estimacion'}
                      onChange={() => buscador.onParametroChange('estimacion')}
                    />
                    Código de Estimación
                  </label>
                </div>
                <button type="button" className="dms-btn-search" onClick={buscador.onBuscar}>
                  Buscar
                </button>
              </div>
            </div>
          )}

          {opcionesRelacionadas && (
            <div className="dms-sidebar-box">
              <div className="dms-sidebar-header dms-sidebar-header--opciones">
                <Link2 className="h-3 w-3" /> Opciones
              </div>
              <div className="dms-sidebar-body">{opcionesRelacionadas}</div>
            </div>
          )}
        </aside>

        <div className="dms-main-panel">
          {infoMessage && (
            <div className="border-b border-sky-100 px-4 pt-3">
              <div className="dms-info-box mb-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-200/60 text-xs font-bold">
                  i
                </span>
                <div className="min-w-0">{infoMessage}</div>
              </div>
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
