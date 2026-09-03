'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BadgeDollarSign,
  Filter,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { DmsTableToolbar } from '@/components/dms/DmsTableToolbar';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { CargaMasivaModal } from '@/components/tarifario/CargaMasivaModal';
import { useTarifarioStore } from '@/store/tarifarioStore';
import {
  asignacionMateriales,
  costoHorasHombre,
  costoTotal,
  filaExcel,
  formatUsd,
  headersTabla,
} from '@/lib/tarifario';
import { cn, toast } from '@/lib/utils';
import {
  LABELS_TIPO,
  NAVIERAS_EC,
  TIPOS_CONTENEDOR,
  type TipoTarifa,
} from '@/types/tarifario';

const TIPOS: TipoTarifa[] = ['BOX', 'MAQUINA', 'ASISTENCIA'];

export default function TarifarioPage() {
  const router = useRouter();
  const tarifas = useTarifarioStore((s) => s.tarifas);
  const eliminar = useTarifarioStore((s) => s.eliminar);

  const [tipo, setTipo] = useState<TipoTarifa>('BOX');
  const [naviera, setNaviera] = useState('ONE');
  const [tipoCont, setTipoCont] = useState('REEFER');
  const [metodo, setMetodo] = useState('Todos');
  const [componente, setComponente] = useState('Todos');
  const [desc, setDesc] = useState('');
  const [buscar, setBuscar] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [cargaOpen, setCargaOpen] = useState(false);
  const [eliminarId, setEliminarId] = useState<string | null>(null);

  const delTipo = tarifas.filter((t) => t.tipo === tipo);
  const metodos = useMemo(
    () => ['Todos', ...Array.from(new Set(delTipo.map((t) => t.metodoReparacion).filter(Boolean))).sort()],
    [delTipo]
  );
  const componentes = useMemo(
    () => ['Todos', ...Array.from(new Set(delTipo.map((t) => t.componente).filter(Boolean))).sort()],
    [delTipo]
  );

  const filtradas = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    const d = desc.trim().toLowerCase();
    return delTipo.filter((t) => {
      if (naviera !== 'Todas' && t.naviera !== naviera) return false;
      if (tipoCont !== 'Todos' && t.tipoContenedor !== tipoCont) return false;
      if (metodo !== 'Todos' && t.metodoReparacion !== metodo) return false;
      if (componente !== 'Todos' && t.componente !== componente) return false;
      if (d && !t.descripcion.toLowerCase().includes(d) && !t.descripcionComponente.toLowerCase().includes(d)) {
        return false;
      }
      if (!q) return true;
      const hay = [
        t.componente,
        t.descripcionComponente,
        t.descripcion,
        t.metodoReparacion,
        t.naviera,
        t.partNumber,
        t.codigoSap,
        t.marca,
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [delTipo, naviera, tipoCont, metodo, componente, desc, buscar]);

  const totalPages = Math.max(1, Math.ceil(filtradas.length / pageSize));
  const paginaActual = Math.min(page, totalPages);
  const from = filtradas.length === 0 ? 0 : (paginaActual - 1) * pageSize + 1;
  const to = Math.min(paginaActual * pageSize, filtradas.length);
  const pageRows = filtradas.slice((paginaActual - 1) * pageSize, paginaActual * pageSize);

  const aEliminar = tarifas.find((t) => t.id === eliminarId);

  return (
    <div className="min-h-screen">
      <Header
        title="Tarifario de Reparaciones IICL"
        subtitle="DMS Ecuador · Box / Máquina / Asistencia técnica · carga masiva de precios"
      />
      <main className="space-y-3 px-3 py-4 md:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="dms-btn-action border-slate-300 bg-white px-3 py-2 text-xs text-slate-800"
            onClick={() => router.push('/catalogos/tarifario/nuevo?tipo=MAQUINA')}
          >
            <Plus className="h-3.5 w-3.5" /> Registrar Nueva Tarifa Máquina
          </button>
          <button
            type="button"
            className="dms-btn-action border-slate-300 bg-white px-3 py-2 text-xs text-slate-800"
            onClick={() => router.push('/catalogos/tarifario/nuevo?tipo=BOX')}
          >
            <Plus className="h-3.5 w-3.5" /> Registrar Nueva Tarifa Box
          </button>
          <button
            type="button"
            className="dms-btn-action border-slate-300 bg-white px-3 py-2 text-xs text-slate-800"
            onClick={() => router.push('/catalogos/tarifario/nuevo?tipo=ASISTENCIA')}
          >
            <Plus className="h-3.5 w-3.5" /> Registrar Nueva Asistencia Técnica
          </button>
          <button
            type="button"
            className="dms-btn-primary px-3 py-2 text-xs"
            onClick={() => setCargaOpen(true)}
          >
            <Upload className="h-3.5 w-3.5" /> Carga masiva de tarifarios
          </button>
        </div>

        <div className="dms-filters-row items-center">
          <div className="flex flex-wrap items-center gap-2">
            {TIPOS.map((t) => (
              <label key={t} className={cn('dms-radio-option', tipo === t && 'border-[#008080]')}>
                <input
                  type="radio"
                  name="tipo-tarifa"
                  checked={tipo === t}
                  onChange={() => {
                    setTipo(t);
                    setPage(1);
                    setMetodo('Todos');
                    setComponente('Todos');
                  }}
                />
                {LABELS_TIPO[t]}
              </label>
            ))}
          </div>
          <div>
            <label className="dms-field-label">Naviera</label>
            <select
              className="dms-select min-w-[9rem]"
              value={naviera}
              onChange={(e) => {
                setNaviera(e.target.value);
                setPage(1);
              }}
            >
              <option>Todas</option>
              {NAVIERAS_EC.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="dms-field-label">Tipo contenedor</label>
            <select
              className="dms-select min-w-[8rem]"
              value={tipoCont}
              onChange={(e) => {
                setTipoCont(e.target.value);
                setPage(1);
              }}
            >
              <option>Todos</option>
              {TIPOS_CONTENEDOR.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="dms-field-label">Método</label>
            <select
              className="dms-select min-w-[8rem]"
              value={metodo}
              onChange={(e) => {
                setMetodo(e.target.value);
                setPage(1);
              }}
            >
              {metodos.map((n) => (
                <option key={n} value={n}>
                  {n === 'Todos' ? 'Todos los Métodos' : n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="dms-field-label">Componente</label>
            <select
              className="dms-select min-w-[8rem]"
              value={componente}
              onChange={(e) => {
                setComponente(e.target.value);
                setPage(1);
              }}
            >
              {componentes.map((n) => (
                <option key={n} value={n}>
                  {n === 'Todos' ? 'Todos los Componentes' : n}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#1689D8] px-4 text-[11px] font-bold text-white shadow-sm hover:bg-[#1277bd]"
            onClick={() => setPage(1)}
          >
            <Filter className="h-3.5 w-3.5" /> Filtrar
          </button>
          <div className="flex min-w-[16rem] flex-1 items-end gap-2">
            <div className="flex-1">
              <label className="dms-field-label">Descripción</label>
              <input
                className="dms-input-sm"
                placeholder="Ingrese la Descripción"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setPage(1);
                }}
              />
            </div>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#1689D8] px-3 text-[11px] font-bold text-white"
              onClick={() => setPage(1)}
            >
              <Search className="h-3.5 w-3.5" /> Buscar
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            <BadgeDollarSign className="h-4 w-4 text-rfsorange-600" />
            <h2 className="text-sm font-bold text-rfs-700">{LABELS_TIPO[tipo]}</h2>
            <span className="text-[11px] text-slate-500">
              {filtradas.length} registro(s) · tarifa HH Ecuador $10.00
            </span>
          </div>

          <DmsTableToolbar
            search={buscar}
            onSearchChange={(v) => {
              setBuscar(v);
              setPage(1);
            }}
            pageSize={pageSize}
            onPageSizeChange={(n) => {
              setPageSize(n);
              setPage(1);
            }}
            excelFilename={`tarifario-iicl-ecuador-${tipo.toLowerCase()}.xlsx`}
            excelHeaders={headersTabla(tipo)}
            excelRows={filtradas.map(filaExcel)}
          />

          <div className="dms-table-scroll dms-table-scroll--reporte">
            <table className="dms-table dms-table--reporte text-[10px]">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 min-w-[8.5rem]">Acciones</th>
                  {headersTabla(tipo).map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={headersTabla(tipo).length + 1} className="dms-table-empty">
                      No hay tarifas para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row) => (
                    <tr key={row.id}>
                      <td className="sticky left-0 z-[1] bg-white">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="inline-flex h-6 items-center gap-1 rounded bg-[#173B78] px-2 text-[9px] font-bold text-white"
                            onClick={() => router.push(`/catalogos/tarifario/${row.id}`)}
                          >
                            <Pencil className="h-3 w-3" /> Editar
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-6 items-center gap-1 rounded bg-[#E53935] px-2 text-[9px] font-bold text-white"
                            onClick={() => setEliminarId(row.id)}
                          >
                            <Trash2 className="h-3 w-3" /> Eliminar
                          </button>
                        </div>
                      </td>
                      <CeldasTarifa tipo={tipo} row={row} />
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="dms-pagination">
            <span className="dms-pagination-info">
              Mostrando {from} a {to} de {filtradas.length} registros
            </span>
            <div className="dms-pagination-nav">
              <button
                type="button"
                className="dms-pagination-btn dms-pagination-btn--nav"
                disabled={paginaActual <= 1}
                onClick={() => setPage(paginaActual - 1)}
              >
                Anterior
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={cn(
                    'dms-pagination-btn dms-pagination-btn--page',
                    paginaActual === n && 'dms-pagination-btn--active'
                  )}
                  onClick={() => setPage(n)}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                className="dms-pagination-btn dms-pagination-btn--nav dms-pagination-btn--last"
                disabled={paginaActual >= totalPages}
                onClick={() => setPage(paginaActual + 1)}
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      </main>

      <CargaMasivaModal open={cargaOpen} tipo={tipo} onClose={() => setCargaOpen(false)} />

      <ConfirmModal
        open={Boolean(eliminarId)}
        title="Eliminar tarifa"
        subtitle={aEliminar ? `${aEliminar.componente} · ${aEliminar.naviera}` : undefined}
        confirmLabel="Eliminar"
        onClose={() => setEliminarId(null)}
        onConfirm={() => {
          if (!eliminarId) return;
          eliminar(eliminarId);
          toast('Tarifa eliminada del tarifario IICL Ecuador.', 'success');
          setEliminarId(null);
        }}
      >
        Esta acción quita la tarifa del catálogo local del prototipo. Puede volver a cargarla con
        la carga masiva.
      </ConfirmModal>
    </div>
  );
}

function CeldasTarifa({
  tipo,
  row,
}: {
  tipo: TipoTarifa;
  row: import('@/types/tarifario').TarifaIicl;
}) {
  const hh = formatUsd(costoHorasHombre(row));
  const tot = formatUsd(costoTotal(row));
  const mat = formatUsd(row.costoMaterial);
  const asig = asignacionMateriales(row);

  if (tipo === 'BOX') {
    return (
      <>
        <td className="font-bold text-rfs-navy">{row.componente}</td>
        <td className="dms-cell-wrap">{row.descripcionComponente}</td>
        <td>{row.largoMinimo}</td>
        <td>{row.largoMaximo}</td>
        <td>{row.areaMinima}</td>
        <td>{row.areaMaxima}</td>
        <td>{row.unidad}</td>
        <td>{row.tipoContenedor}</td>
        <td>{row.naviera}</td>
        <td className="dms-cell-wrap">{row.descripcionHl || '—'}</td>
        <td className="dms-cell-wrap">{row.descripcion}</td>
        <td>{row.metodoReparacion}</td>
        <td className="text-right whitespace-nowrap">{mat}</td>
        <td>{row.horasHombre.toFixed(2)}</td>
        <td className="text-right whitespace-nowrap">{hh}</td>
        <td className="text-right font-semibold whitespace-nowrap">{tot}</td>
        <td>{asig}</td>
      </>
    );
  }

  if (tipo === 'MAQUINA') {
    return (
      <>
        <td className="font-bold text-rfs-navy">{row.componente}</td>
        <td className="dms-cell-wrap">{row.descripcionComponente || 'NULL'}</td>
        <td>{row.codigoSap || '—'}</td>
        <td>{row.codigoSap || '—'}</td>
        <td>{row.partNumber}</td>
        <td>{row.nombreUbicacion || 'NULL'}</td>
        <td>{row.marca}</td>
        <td>{row.naviera}</td>
        <td className="dms-cell-wrap">{row.descripcion}</td>
        <td>{row.metodoReparacion || 'NULL'}</td>
        <td className="text-right whitespace-nowrap">{mat}</td>
        <td>{row.horasHombre.toFixed(2)}</td>
        <td className="text-right whitespace-nowrap">{hh}</td>
        <td className="text-right font-semibold whitespace-nowrap">{tot}</td>
        <td>{asig}</td>
      </>
    );
  }

  return (
    <>
      <td className="font-bold text-rfs-navy">{row.componente}</td>
      <td className="dms-cell-wrap">{row.descripcionComponente}</td>
      <td>{row.naviera}</td>
      <td>{row.tipoContenedor}</td>
      <td className="dms-cell-wrap">{row.descripcion}</td>
      <td>{row.metodoReparacion}</td>
      <td className="text-right whitespace-nowrap">{mat}</td>
      <td>{row.horasHombre.toFixed(2)}</td>
      <td className="text-right whitespace-nowrap">{hh}</td>
      <td className="text-right font-semibold whitespace-nowrap">{tot}</td>
      <td>{asig}</td>
    </>
  );
}
