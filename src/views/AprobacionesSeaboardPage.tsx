'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Eye,
  FileText,
  Filter,
  RotateCcw,
  Search,
  SearchX,
  X,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { DmsTableToolbar } from '@/components/dms/DmsTableToolbar';
import { EstadoEstimacionBadge } from '@/components/dms/EstadoEstimacionBadge';
import { ComentarioModal } from '@/components/aprobaciones/ComentarioModal';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store';
import { useEstimacionesStore } from '@/store/estimacionesStore';
import { useUiStore } from '@/store/uiStore';
import type { Estimacion } from '@/types/estimacion';
import { paisDe } from '@/lib/pais';
import { cn, formatMoney, toast } from '@/lib/utils';

const PATIOS = ['Todos los Patios', 'RFS 1', 'RFS 3'];
const NAVIERAS = ['Todas las Navieras', 'SEABOARD MARINE LINE'];
const TIPOS = ['Todos los Tipos', "40' REEFER HC CONTAINER"];
const TIPOS_EST = ['Tipo Estimacion', 'MÁQUINA', 'BOX'];
const ESTADOS = ['Estado Estimacion', 'ENVIADO', 'APROBADO', 'RECHAZADO'];

const EXCEL_HEADERS = [
  'CodigoEstimado',
  'Tipo Estimación',
  'Estado',
  'Contenedor',
  'Actividad',
  'Modelo Máquina',
  'Tipo',
  'Buque',
  'Viaje',
  'Fecha Generación',
  'Fecha Envío',
  'Fecha Revisión',
  'Fecha Reparación',
  'Fecha Aprobación',
  'Deposito',
  'Horas',
  'Costo Horas',
  'Costo Materiales',
  'Costo Total',
];

function rowToExcel(e: Estimacion) {
  return [
    e.codigo,
    e.tipoEstimacion,
    e.estado,
    e.contenedor,
    e.actividad,
    e.modeloMaquina,
    e.tipoContenedor,
    e.buque,
    e.viaje,
    e.fechaElaboracion,
    e.fechaEnvio,
    e.fechaRevision,
    e.fechaReparacion,
    e.fechaAprobacion,
    e.lugarEstimacion,
    e.horasHombre,
    e.pvpHorasHombre,
    e.pvpMateriales,
    e.pvpTotal,
  ];
}

type ModalAction = 'rechazar' | 'reversar' | null;

export default function AprobacionesSeaboardPage() {
  const { user } = useAuthStore();
  const { estimaciones, aprobar, rechazar, reversar } = useEstimacionesStore();
  const { pais } = useUiStore();

  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [pais]);

  const [desde, setDesde] = useState('2026-07-06');
  const [hasta, setHasta] = useState('2026-07-12');
  const [patio, setPatio] = useState('Todos los Patios');
  const [naviera, setNaviera] = useState('Todas las Navieras');
  const [tipo, setTipo] = useState('Todos los Tipos');
  const [tipoEst, setTipoEst] = useState('Tipo Estimacion');
  const [estado, setEstado] = useState('Estado Estimacion');
  const [codigoContenedor, setCodigoContenedor] = useState('');
  const [codigoEstimacion, setCodigoEstimacion] = useState('');
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modalAction, setModalAction] = useState<ModalAction>(null);
  const [modoRevision, setModoRevision] = useState(false);
  const [filtroActivo, setFiltroActivo] = useState(false);

  const baseData = useMemo(
    () =>
      estimaciones.filter(
        (e) =>
          paisDe(e) === pais &&
          e.naviera.toUpperCase().includes('SEABOARD') &&
          (modoRevision ? e.estado === 'PENDIENTE' : e.estado === 'ENVIADO')
      ),
    [estimaciones, modoRevision, pais]
  );

  const filtered = useMemo(() => {
    return baseData.filter((e) => {
      if (filtroActivo) {
        if (patio !== 'Todos los Patios' && e.lugarEstimacion !== patio.replace('Todos los ', ''))
          return false;
        if (naviera !== 'Todas las Navieras' && e.naviera !== naviera) return false;
        if (tipo !== 'Todos los Tipos' && e.tipoContenedor !== tipo) return false;
        if (tipoEst !== 'Tipo Estimacion' && e.tipoEstimacion !== tipoEst) return false;
        if (estado !== 'Estado Estimacion' && e.estado !== estado) return false;
      }
      if (codigoContenedor && !e.contenedor.toLowerCase().includes(codigoContenedor.toLowerCase()))
        return false;
      if (codigoEstimacion && !e.codigo.toLowerCase().includes(codigoEstimacion.toLowerCase()))
        return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !e.codigo.toLowerCase().includes(q) &&
          !e.contenedor.toLowerCase().includes(q) &&
          !e.buque.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [
    baseData,
    patio,
    naviera,
    tipo,
    tipoEst,
    estado,
    codigoContenedor,
    codigoEstimacion,
    search,
    filtroActivo,
  ]);

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const excelRows = filtered.map(rowToExcel);
  const from = filtered.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, filtered.length);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === paginated.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(paginated.map((e) => e.id)));
    }
  };

  const selectedIds = Array.from(selected);
  const usuario = user?.username ?? 'seaboard';

  const handleAprobar = () => {
    if (!selectedIds.length) {
      toast('Seleccione al menos una estimación.', 'error');
      return;
    }
    aprobar(selectedIds, usuario);
    setSelected(new Set());
    toast(
      `${selectedIds.length} estimación(es) aprobada(s). Estado actualizado en Reporte de Estimaciones.`,
      'success'
    );
  };

  const handleModalConfirm = (comentario: string) => {
    if (!selectedIds.length) return;
    if (modalAction === 'rechazar') {
      rechazar(selectedIds, usuario, comentario);
      toast(`${selectedIds.length} estimación(es) rechazada(s).`, 'success');
    } else if (modalAction === 'reversar') {
      reversar(selectedIds, usuario, comentario);
      toast(`${selectedIds.length} estimación(es) reversada(s) a estado REVERSADO.`, 'success');
    }
    setSelected(new Set());
    setModalAction(null);
  };

  return (
    <>
      <Header
        title="Aprobación de Estimaciones Seaboard"
        subtitle={
          modoRevision
            ? 'Modo revisión · Estimaciones incompletas / pendientes'
            : 'Solo estimaciones ENVIADAS listas para decidir'
        }
      />
      <main className="px-3 py-4 md:px-5 md:py-6">
        <div className="dms-shell">
      <div className="space-y-3">
        <div className="dms-info-box">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-200/60 text-xs font-bold">
            i
          </span>
          <div>
            <p className="font-bold">Cómo usar esta pantalla</p>
            <ul className="mt-1 text-sm">
              <li>Solo se listan estimaciones Seaboard completas y enviadas a aprobación.</li>
              <li>Para incompletas, active Modo Revisión.</li>
              <li>Seleccione filas y use Aprobar / Rechazar / Reversar.</li>
            </ul>
          </div>
        </div>

        <div className="dms-main-panel overflow-visible">
          <div className="space-y-3 border-b border-gray-100 p-4">
            <div className="dms-filters-row border-0 p-0 shadow-none">
              <button
                type="button"
                className={cn(
                  'dms-btn-modo-revision',
                  modoRevision && 'ring-2 ring-amber-300 ring-offset-1'
                )}
                onClick={() => {
                  setModoRevision((v) => !v);
                  setSelected(new Set());
                  setPage(1);
                  toast(
                    !modoRevision ? 'Modo revisión activado.' : 'Modo revisión desactivado.',
                    'info'
                  );
                }}
              >
                <Search className="h-3.5 w-3.5" /> Modo Revisión
              </button>

              <div>
                <label className="dms-field-label">Desde</label>
                <Input
                  type="date"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                  className="dms-filter-control w-36"
                />
              </div>
              <div>
                <label className="dms-field-label">Hasta</label>
                <Input
                  type="date"
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                  className="dms-filter-control w-36"
                />
              </div>
            </div>

            <div className="dms-filters-row border-0 p-0 shadow-none">
              <select className="dms-select w-40" value={patio} onChange={(e) => setPatio(e.target.value)}>
                {PATIOS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
              <select
                className="dms-select w-48"
                value={naviera}
                onChange={(e) => setNaviera(e.target.value)}
              >
                {NAVIERAS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
              <select className="dms-select w-48" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {TIPOS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
              <select
                className="dms-select w-40"
                value={tipoEst}
                onChange={(e) => setTipoEst(e.target.value)}
              >
                {TIPOS_EST.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
              <select
                className="dms-select w-44"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
              >
                {ESTADOS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
              <button
                type="button"
                className="dms-btn-filter !w-auto px-4"
                onClick={() => {
                  setFiltroActivo(true);
                  setPage(1);
                  toast('Filtros aplicados.', 'success');
                }}
              >
                <Filter className="h-3.5 w-3.5" /> Filtrar
              </button>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[200px] flex-1">
                <label className="dms-field-label">Código contenedor</label>
                <Input
                  placeholder="Ej. SMLU…"
                  value={codigoContenedor}
                  onChange={(e) => setCodigoContenedor(e.target.value)}
                  className="dms-filter-control"
                />
              </div>
              <div className="min-w-[200px] flex-1">
                <label className="dms-field-label">Código estimación</label>
                <Input
                  placeholder="Ej. EST…"
                  value={codigoEstimacion}
                  onChange={(e) => setCodigoEstimacion(e.target.value)}
                  className="dms-filter-control"
                />
              </div>
              <button
                type="button"
                className="dms-btn-search !w-auto px-4"
                onClick={() => {
                  setPage(1);
                  toast('Búsqueda actualizada.', 'info');
                }}
              >
                Buscar
              </button>
            </div>

            {!modoRevision && (
              <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                {selectedIds.length > 0 && (
                  <span className="rounded-full bg-[#152483]/8 px-3 py-1 text-xs font-semibold text-[#152483]">
                    {selectedIds.length} seleccionada(s)
                  </span>
                )}
                <button type="button" className="dms-btn-aprobar" onClick={handleAprobar}>
                  <Check className="h-4 w-4" /> Aprobar
                </button>
                <button
                  type="button"
                  className="dms-btn-rechazar"
                  onClick={() => {
                    if (!selectedIds.length) {
                      toast('Seleccione al menos una estimación.', 'error');
                      return;
                    }
                    setModalAction('rechazar');
                  }}
                >
                  <X className="h-4 w-4" /> Rechazar
                </button>
                <button
                  type="button"
                  className="dms-btn-reversar"
                  onClick={() => {
                    if (!selectedIds.length) {
                      toast('Seleccione al menos una estimación.', 'error');
                      return;
                    }
                    setModalAction('reversar');
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reversar
                </button>
              </div>
            )}
          </div>

          <DmsTableToolbar
            search={search}
            onSearchChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            pageSize={pageSize}
            onPageSizeChange={(n) => {
              setPageSize(n);
              setPage(1);
            }}
            excelFilename="Aprobaciones Estimados Seaboard.xlsx"
            excelHeaders={EXCEL_HEADERS}
            excelRows={excelRows}
          />

          {paginated.length === 0 ? (
            <div className="dms-empty-state">
              <div className="dms-empty-icon">
                <SearchX className="h-7 w-7" />
              </div>
              <p className="text-sm font-semibold text-gray-700">No hay estimaciones para mostrar</p>
              <p className="mt-1 max-w-md text-xs text-gray-500">
                {modoRevision
                  ? 'No hay pendientes incompletos en modo revisión.'
                  : 'Envíe estimaciones Seaboard desde el Reporte de Estimaciones para que aparezcan aquí.'}
              </p>
            </div>
          ) : (
            <div className="dms-table-scroll">
              <table className="dms-table">
                <thead>
                  <tr>
                    <th className="w-10">
                      <input
                        type="checkbox"
                        checked={paginated.length > 0 && selected.size === paginated.length}
                        onChange={toggleAll}
                        className="rounded border-gray-300"
                        aria-label="Seleccionar todo"
                      />
                    </th>
                    <th>Acciones</th>
                    <th>Código</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th>Contenedor</th>
                    <th>Actividad</th>
                    <th>Modelo</th>
                    <th>Tipo contenedor</th>
                    <th>Buque</th>
                    <th>Viaje</th>
                    <th>Fecha gen.</th>
                    <th>Fecha envío</th>
                    <th>Fecha revisión</th>
                    <th>Fecha repar.</th>
                    <th>Fecha aprob.</th>
                    <th>Depósito</th>
                    <th>Horas</th>
                    <th>Costo HH</th>
                    <th>Costo Mat.</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((row) => (
                    <tr key={row.id} className={cn(selected.has(row.id) && 'dms-row-selected')}>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          checked={selected.has(row.id)}
                          onChange={() => toggleSelect(row.id)}
                          className="rounded border-gray-300"
                          aria-label={`Seleccionar ${row.codigo}`}
                        />
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="dms-btn-action dms-btn-ver"
                            title="Ver detalle"
                            onClick={() =>
                              toast(
                                `Detalle ${row.codigo}\n\nComentarios:\n${
                                  row.comentariosSeaboard
                                    .map((c) => `[${c.accion}] ${c.comentario}`)
                                    .join('\n') || 'Sin comentarios'
                                }`,
                                'info'
                              )
                            }
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="dms-btn-action dms-btn-pdf"
                            title="Documento"
                            onClick={() => toast('Abriendo documento de estimación…', 'info')}
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                      <td>
                        <span className="dms-cell-container-code">{row.codigo}</span>
                      </td>
                      <td>{row.tipoEstimacion}</td>
                      <td>
                        <EstadoEstimacionBadge estado={row.estado} />
                      </td>
                      <td className="font-semibold text-rfs-navy">{row.contenedor}</td>
                      <td>{row.actividad}</td>
                      <td className="text-xs">{row.modeloMaquina}</td>
                      <td className="text-[11px]">{row.tipoContenedor}</td>
                      <td className="text-[11px]">{row.buque}</td>
                      <td>{row.viaje}</td>
                      <td className="whitespace-nowrap text-[11px] tabular-nums">
                        {row.fechaElaboracion}
                      </td>
                      <td className="whitespace-nowrap text-[11px] tabular-nums text-gray-500">
                        {row.fechaEnvio || '—'}
                      </td>
                      <td className="whitespace-nowrap text-[11px] tabular-nums text-gray-500">
                        {row.fechaRevision || '—'}
                      </td>
                      <td className="whitespace-nowrap text-[11px] tabular-nums text-gray-500">
                        {row.fechaReparacion || '—'}
                      </td>
                      <td className="whitespace-nowrap text-[11px] tabular-nums text-gray-500">
                        {row.fechaAprobacion || '—'}
                      </td>
                      <td>{row.lugarEstimacion}</td>
                      <td className="text-right tabular-nums">{formatMoney(row.horasHombre)}</td>
                      <td className="text-right tabular-nums">{formatMoney(row.pvpHorasHombre)}</td>
                      <td className="text-right tabular-nums">{formatMoney(row.pvpMateriales)}</td>
                      <td className="text-right font-semibold tabular-nums text-rfs-navy">
                        {formatMoney(row.pvpTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="dms-pagination">
            <span className="dms-pagination-info">
              Mostrando {from} a {to} de {filtered.length.toLocaleString('es-EC')} registros
            </span>
            <div className="dms-pagination-nav">
              <button
                type="button"
                className="dms-pagination-btn dms-pagination-btn--nav"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </button>
              <button
                type="button"
                className="dms-pagination-btn dms-pagination-btn--nav dms-pagination-btn--last"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      </div>
        </div>
      </main>

      <ComentarioModal
        open={modalAction === 'rechazar'}
        title="Rechazar Estimación"
        subtitle={`${selectedIds.length} estimación(es) seleccionada(s)`}
        label="Comentario de rechazo (obligatorio)"
        confirmLabel="Rechazar"
        confirmClass="dms-btn-rechazar"
        onClose={() => setModalAction(null)}
        onConfirm={handleModalConfirm}
      />

      <ComentarioModal
        open={modalAction === 'reversar'}
        title="Reversar Estimación"
        subtitle={`${selectedIds.length} estimación(es) seleccionada(s)`}
        label="Comentario de reverso (obligatorio)"
        confirmLabel="Reversar"
        confirmClass="dms-btn-reversar"
        onClose={() => setModalAction(null)}
        onConfirm={handleModalConfirm}
      />
    </>
  );
}
