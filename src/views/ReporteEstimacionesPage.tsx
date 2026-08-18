'use client';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronDown,
  ChevronRight,
  Database,
  Download,
  Eye,
  FileBarChart,
  FileText,
  Info,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  SearchX,
  Send,
  Ship,
  Trash2,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { DmsReportLayout } from '@/components/dms/DmsReportLayout';
import { DmsTableToolbar } from '@/components/dms/DmsTableToolbar';
import { EstadoEstimacionBadge } from '@/components/dms/EstadoEstimacionBadge';
import { ComentarioModal } from '@/components/aprobaciones/ComentarioModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Modal } from '@/components/ui/Modal';
import { InformePreviewModal } from '@/components/estimacion/InformePreviewModal';
import { useAuthStore } from '@/store';
import { useEstimacionesStore } from '@/store/estimacionesStore';
import {
  ACTIVIDADES,
  ESTADOS_ESTIMACION,
  contarComentariosPendientes,
  type Actividad,
  type Estimacion,
} from '@/types/estimacion';
import { descargarDataLog, type VarianteInforme } from '@/lib/descargas';
import { cn, formatMoney, toast } from '@/lib/utils';

/** Encabezados del export, en el mismo orden que el reporte de producción. */
const EXCEL_HEADERS = [
  'Codigo', 'Semana', 'Año', 'Estado', 'Contenedor', 'Modelo Maquina', 'Código RFS', 'Naviera',
  'Actividad', 'Lugar de Estimación', 'Lugar de Asistencia', 'Fecha GateIn', 'Fecha de Elaboración',
  'Fecha de Reparación', 'Tipo de Estimación', 'Técnico de Estimación', 'Horas Hombre',
  'PVP Horas Hombre', 'PVP Materiales', 'PVP Total', 'Estado PTI', 'Fecha Fin PTI',
  'Enviar Aprobacion', 'Fecha Envio', 'Fecha Aprobacion', 'EDI Enviado ONE', 'Fecha Envio EDI ONE',
  'Niveles', 'Dias Estadia', 'Tipo de Daño', 'Análisis de observación', 'Fecha de modificación',
  'Usuario de Modificación',
];

function rowToExcel(e: Estimacion) {
  return [
    e.codigo, e.semana, e.anio, e.estado, e.contenedor, e.modeloMaquina, e.codigoRfs, e.naviera,
    e.actividad, e.lugarEstimacion, e.lugarAsistencia, e.fechaGateIn, e.fechaElaboracion,
    e.fechaReparacion, e.tipoEstimacion, e.tecnico, e.horasHombre, e.pvpHorasHombre,
    e.pvpMateriales, e.pvpTotal, e.estadoPti, e.fechaFinPti, e.enviarAprobacion, e.fechaEnvio,
    e.fechaAprobacion, e.ediEnviadoOne, e.fechaEnvioEdiOne, e.niveles, e.diasEstadia, e.tipoDano,
    e.analisisObservacion, e.fechaModificacion, e.usuarioModificacion,
  ];
}

/** Convierte "dd/mm/yyyy hh:mm" a "yyyy-mm-dd" para comparar con los filtros de fecha. */
function aFechaIso(valor: string) {
  const m = valor.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return '';
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

type Dialogo =
  | { tipo: 'NINGUNO' }
  | { tipo: 'INFORME'; id: string; variante: VarianteInforme }
  | { tipo: 'NOTA'; id: string }
  | { tipo: 'INFO'; id: string }
  | { tipo: 'ELIMINAR'; id: string }
  | { tipo: 'REVERSAR'; id: string }
  | { tipo: 'ENVIAR'; id: string };

export default function ReporteEstimacionesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { estimaciones, enviarAprobacion, reversarAprobacion, eliminar, setActividad } =
    useEstimacionesStore();

  const [desde, setDesde] = useState('2026-08-17');
  const [hasta, setHasta] = useState('2026-08-23');
  const [naviera, setNaviera] = useState('Todas');
  const [codigoRfs, setCodigoRfs] = useState('Todos');
  const [patio, setPatio] = useState('Todos');
  const [tipo, setTipo] = useState('Todos');
  const [estado, setEstado] = useState('Todos');
  const [actividad, setActividadFiltro] = useState('Todas');
  const [tecnico, setTecnico] = useState('Todos');
  const [aplica, setAplica] = useState('Todos');
  const [completas, setCompletas] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [parametro, setParametro] = useState('contenedor');
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [filtroActivo, setFiltroActivo] = useState(false);
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  const [dialogo, setDialogo] = useState<Dialogo>({ tipo: 'NINGUNO' });

  const usuario = user?.username ?? 'apptelink';
  const cerrar = () => setDialogo({ tipo: 'NINGUNO' });

  // Las opciones de los filtros salen de los datos reales cargados en el store.
  const opciones = useMemo(() => {
    const unicos = (fn: (e: Estimacion) => string) =>
      Array.from(new Set(estimaciones.map(fn).filter(Boolean))).sort();
    return {
      navieras: ['Todas', ...unicos((e) => e.naviera)],
      codigosRfs: ['Todos', ...unicos((e) => e.codigoRfs)],
      patios: ['Todos', ...unicos((e) => e.lugarEstimacion)],
      tipos: ['Todos', ...unicos((e) => e.tipoEstimacion)],
      tecnicos: ['Todos', ...unicos((e) => e.tecnico)],
    };
  }, [estimaciones]);

  const filtered = useMemo(() => {
    const hayCriterio = filtroActivo || Boolean(busqueda) || Boolean(search);

    return estimaciones.filter((e) => {
      if (patio !== 'Todos' && e.lugarEstimacion !== patio) return false;
      if (estado !== 'Todos' && e.estado !== estado) return false;
      if (!hayCriterio) return true;

      if (filtroActivo) {
        const iso = aFechaIso(e.fechaElaboracion) || aFechaIso(e.fechaGateIn);
        if (desde && iso && iso < desde) return false;
        if (hasta && iso && iso > hasta) return false;
        if (naviera !== 'Todas' && e.naviera !== naviera) return false;
        if (codigoRfs !== 'Todos' && e.codigoRfs !== codigoRfs) return false;
        if (tipo !== 'Todos' && e.tipoEstimacion !== tipo) return false;
        if (actividad !== 'Todas' && e.actividad !== actividad) return false;
        if (tecnico !== 'Todos' && e.tecnico !== tecnico) return false;
        if (aplica !== 'Todos' && e.enviarAprobacion !== aplica) return false;
        if (completas && (e.sinDanos || e.pvpTotal === 0)) return false;
      }

      if (busqueda) {
        const q = busqueda.toLowerCase();
        const campo = parametro === 'contenedor' ? e.contenedor : e.codigo;
        if (!campo.toLowerCase().includes(q)) return false;
      }

      if (search) {
        const q = search.toLowerCase();
        const hay = [e.contenedor, e.codigo, e.tecnico, e.naviera, e.modeloMaquina, e.actividad]
          .join(' ')
          .toLowerCase()
          .includes(q);
        if (!hay) return false;
      }

      return true;
    });
  }, [
    estimaciones, desde, hasta, naviera, codigoRfs, patio, tipo, estado, actividad, tecnico,
    aplica, completas, busqueda, parametro, search, filtroActivo,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginaActual = Math.min(page, totalPages);
  const paginated = filtered.slice((paginaActual - 1) * pageSize, paginaActual * pageSize);
  const from = filtered.length === 0 ? 0 : (paginaActual - 1) * pageSize + 1;
  const to = Math.min(paginaActual * pageSize, filtered.length);

  const totales = filtered.reduce(
    (acc, e) => ({
      hh: acc.hh + e.horasHombre,
      pvpHh: acc.pvpHh + e.pvpHorasHombre,
      pvpMat: acc.pvpMat + e.pvpMateriales,
      pvpTotal: acc.pvpTotal + e.pvpTotal,
    }),
    { hh: 0, pvpHh: 0, pvpMat: 0, pvpTotal: 0 }
  );

  function limpiarFiltros() {
    setDesde('2026-08-17');
    setHasta('2026-08-23');
    setNaviera('Todas');
    setCodigoRfs('Todos');
    setPatio('Todos');
    setTipo('Todos');
    setEstado('Todos');
    setActividadFiltro('Todas');
    setTecnico('Todos');
    setAplica('Todos');
    setCompletas(false);
    setBusqueda('');
    setSearch('');
    setFiltroActivo(false);
    setPage(1);
    toast('Filtros restablecidos.', 'info');
  }

  const seleccionada = (id: string) => estimaciones.find((e) => e.id === id) ?? null;
  const activa =
    dialogo.tipo !== 'NINGUNO' && 'id' in dialogo ? seleccionada(dialogo.id) : null;

  function alternarExpandida(id: string) {
    setExpandidas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function accionesDe(row: Estimacion) {
    const abrir = () => router.push(`/reportes/estimaciones/${row.codigo}`);

    if (row.sinDanos) {
      return (
        <div className="dms-icon-actions">
          <button
            type="button"
            className="dms-icon-action dms-icon-action--ver"
            title="Abrir estimado"
            onClick={abrir}
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="dms-icon-action dms-icon-action--info"
            title="Sin daños registrados"
            onClick={() => setDialogo({ tipo: 'INFO', id: row.id })}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </div>
      );
    }

    return (
      <div className="dms-icon-actions">
        <button
          type="button"
          className="dms-icon-action dms-icon-action--ver"
          title="Abrir estimado"
          onClick={abrir}
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
        {['ENVIADO', 'APROBADO', 'REPARADO', 'RECHAZADO'].includes(row.estado) && (
          <button
            type="button"
            className="dms-icon-action dms-icon-action--pdf"
            title="PDF preliminar"
            onClick={() => setDialogo({ tipo: 'INFORME', id: row.id, variante: 'PRELIMINAR' })}
          >
            <FileText className="h-3.5 w-3.5" />
          </button>
        )}
        {['APROBADO', 'REPARADO', 'RECHAZADO'].includes(row.estado) && (
          <button
            type="button"
            className="dms-icon-action dms-icon-action--nota"
            title="Ver nota de la naviera"
            onClick={() => setDialogo({ tipo: 'NOTA', id: row.id })}
          >
            <Ship className="h-3.5 w-3.5" />
          </button>
        )}
        {(row.analisisObservacion || row.niveles) && (
          <button
            type="button"
            className="dms-icon-action dms-icon-action--info"
            title="Información adicional"
            onClick={() => setDialogo({ tipo: 'INFO', id: row.id })}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        )}
        {['PENDIENTE', 'RECHAZADO', 'REVERSADO'].includes(row.estado) && (
          <button
            type="button"
            className="dms-icon-action dms-icon-action--enviar"
            title="Enviar a aprobación"
            onClick={() => setDialogo({ tipo: 'ENVIAR', id: row.id })}
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        )}
        {['APROBADO', 'REPARADO'].includes(row.estado) && (
          <button
            type="button"
            className="dms-icon-action dms-icon-action--reversar"
            title="Reversar aprobación"
            onClick={() => setDialogo({ tipo: 'REVERSAR', id: row.id })}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
        {row.estadoPti && (
          <button
            type="button"
            className="dms-icon-action dms-icon-action--log"
            title="Descargar data log"
            onClick={() => {
              const n = descargarDataLog(row);
              toast(`Data Log descargado (${n} registros).`, 'success');
            }}
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          className="dms-icon-action dms-icon-action--borrar"
          title="Eliminar estimación"
          onClick={() => setDialogo({ tipo: 'ELIMINAR', id: row.id })}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <>
      <Header
        title="Reporte de Estimaciones"
        subtitle="Consulta operativa DMS · Envío a aprobación Seaboard"
      />
      <main className="px-3 py-4 md:px-5 md:py-6">
        <div className="dms-shell">
          <DmsReportLayout
            title="Reporte de Estimaciones"
            subtitle="Consulta operativa DMS · Envío a aprobación Seaboard"
            heroIcon={<FileBarChart className="h-5 w-5" />}
            filtros={[
              { label: 'Desde', type: 'date', value: desde, onChange: (v) => setDesde(String(v)) },
              { label: 'Hasta', type: 'date', value: hasta, onChange: (v) => setHasta(String(v)) },
              {
                label: 'Naviera',
                type: 'select',
                value: naviera,
                onChange: (v) => setNaviera(String(v)),
                options: opciones.navieras,
              },
              {
                label: 'Código RFS',
                type: 'select',
                value: codigoRfs,
                onChange: (v) => setCodigoRfs(String(v)),
                options: opciones.codigosRfs,
              },
              {
                label: 'Lugar de Estimación',
                type: 'select',
                value: patio,
                onChange: (v) => setPatio(String(v)),
                options: opciones.patios,
              },
              {
                label: 'Tipo de estimación',
                type: 'select',
                value: tipo,
                onChange: (v) => setTipo(String(v)),
                options: opciones.tipos,
              },
              {
                label: 'Estado de estimación',
                type: 'select',
                value: estado,
                onChange: (v) => setEstado(String(v)),
                options: ['Todos', ...ESTADOS_ESTIMACION],
              },
              {
                label: 'Actividad',
                type: 'select',
                value: actividad,
                onChange: (v) => setActividadFiltro(String(v)),
                options: ['Todas', ...ACTIVIDADES],
              },
              {
                label: 'Técnico de estimación',
                type: 'select',
                value: tecnico,
                onChange: (v) => setTecnico(String(v)),
                options: opciones.tecnicos,
              },
              {
                label: 'Aplica',
                type: 'select',
                value: aplica,
                onChange: (v) => setAplica(String(v)),
                options: ['Todos', 'SI', 'NO'],
              },
              {
                label: 'Estimaciones completas',
                type: 'toggle',
                value: completas,
                onChange: (v) => setCompletas(Boolean(v)),
              },
            ]}
            onFiltrar={() => {
              setFiltroActivo(true);
              setPage(1);
              toast('Filtros aplicados.', 'success');
            }}
            onLimpiar={limpiarFiltros}
            buscador={{
              termino: busqueda,
              onTerminoChange: setBusqueda,
              parametro,
              onParametroChange: setParametro,
              onBuscar: () => {
                setPage(1);
                toast(
                  busqueda ? `Buscando "${busqueda}"…` : 'Ingrese un código para buscar.',
                  busqueda ? 'info' : 'error'
                );
              },
            }}
            opcionesRelacionadas={
              <div className="space-y-1">
                <span className="dms-link-option dms-link-option--disabled">
                  <RefreshCw className="h-3 w-3" /> Generar Estimados desde Inspecciones
                </span>
                <span className="dms-link-option dms-link-option--disabled">
                  <FileText className="h-3 w-3" /> Generar Nueva Estimación Box
                </span>
                <span className="dms-link-option dms-link-option--disabled">
                  <FileText className="h-3 w-3" /> Generar Nueva Estimación Máquina
                </span>
                <Link href="/aprobaciones/seaboard" className="dms-link-option">
                  <Send className="h-3 w-3" /> Aprobaciones Estimados Seaboard
                </Link>
              </div>
            }
          >
            <div className="dms-table-legend">
              {(
                [
                  ['Enviado', 'bg-teal-500'],
                  ['Pendiente', 'bg-amber-400'],
                  ['Aprobado', 'bg-blue-500'],
                  ['Reparado', 'bg-emerald-500'],
                  ['Rechazado', 'bg-red-500'],
                ] as const
              ).map(([label, color]) => (
                <span key={label} className="dms-table-legend-item">
                  <span className={cn('dms-table-legend-dot', color)} /> {label}
                </span>
              ))}
              <span className="dms-table-legend-item ml-auto text-gray-400">
                <MessageSquare className="h-3 w-3" /> El punto naranja indica cambios solicitados por
                liquidaciones
              </span>
            </div>

            <div className="dms-resumen-strip">
              <span>
                Mostrando <strong>{filtered.length}</strong> de {estimaciones.length} estimaciones
              </span>
              <span>
                Total filtrado <strong>${formatMoney(totales.pvpTotal)}</strong>
              </span>
              <span className="hidden sm:inline">
                Pase el cursor sobre cada icono de la columna Acciones para ver qué hace.
              </span>
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
              excelFilename="Reporte de Estimaciones RFS - DMS Ecuador.xlsx"
              excelHeaders={EXCEL_HEADERS}
              excelRows={filtered.map(rowToExcel)}
              totalCount={filtered.length}
            />

            {paginated.length === 0 ? (
              <div className="dms-empty-state">
                <div className="dms-empty-icon">
                  <SearchX className="h-7 w-7" />
                </div>
                <p className="text-sm font-semibold text-gray-700">Sin resultados</p>
                <p className="mt-1 max-w-sm text-xs text-gray-500">
                  No hay estimaciones con estos criterios. Limpie los filtros o cambie el depósito.
                </p>
                <button type="button" className="dms-btn-azul mt-3 px-3 py-1.5 text-xs" onClick={limpiarFiltros}>
                  Limpiar filtros
                </button>
              </div>
            ) : (
              <div className="dms-table-scroll">
                <table className="dms-table dms-table--reporte">
                  <thead>
                    <tr>
                      <th className="dms-sticky-col dms-sticky-col--1 w-8">···</th>
                      <th className="dms-sticky-col dms-sticky-col--2">Codigo</th>
                      <th>Semana</th>
                      <th>Año</th>
                      <th>Estado</th>
                      <th>Contenedor</th>
                      <th>Modelo Maquina</th>
                      <th>Código RFS</th>
                      <th>Naviera</th>
                      <th>Actividad</th>
                      <th>Lugar de Estimación</th>
                      <th>Lugar de Asistencia</th>
                      <th>Fecha GateIn</th>
                      <th>Fecha de Elaboración</th>
                      <th>Fecha de Reparación</th>
                      <th>Tipo de Estimación</th>
                      <th>Técnico de Estimación</th>
                      <th>Horas Hombre</th>
                      <th>PVP Horas Hombre</th>
                      <th>PVP Materiales</th>
                      <th>PVP Total</th>
                      <th>Estado PTI</th>
                      <th>Fecha Fin PTI</th>
                      <th>Enviar Aprobacion</th>
                      <th>Fecha Envio</th>
                      <th>Fecha Aprobacion</th>
                      <th>EDI Enviado ONE</th>
                      <th>Fecha Envio EDI ONE</th>
                      <th>Niveles</th>
                      <th>Dias Estadia</th>
                      <th>Tipo de Daño</th>
                      <th>Análisis de observación</th>
                      <th>Fecha de modificación</th>
                      <th>Usuario de Modificacion</th>
                      <th className="dms-sticky-col dms-sticky-col--right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((row) => {
                      const abierta = expandidas.has(row.id);
                      const pendientes = contarComentariosPendientes(row.danos);
                      return (
                        <Fragment key={row.id}>
                          <tr
                            className={cn(abierta && 'dms-row-selected')}
                            onDoubleClick={() =>
                              router.push(`/reportes/estimaciones/${row.codigo}`)
                            }
                          >
                            <td className="dms-sticky-col dms-sticky-col--1 text-center">
                              <button
                                type="button"
                                className="dms-expander"
                                onClick={() => alternarExpandida(row.id)}
                                aria-label={abierta ? 'Ocultar detalle' : 'Ver detalle'}
                              >
                                {abierta ? (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </td>
                            <td className="dms-sticky-col dms-sticky-col--2">
                              <button
                                type="button"
                                className="dms-cell-container-code dms-cell-link"
                                onClick={() => router.push(`/reportes/estimaciones/${row.codigo}`)}
                                title="Abrir el estimado"
                              >
                                {row.codigo}
                              </button>
                              {pendientes > 0 && (
                                <span
                                  className="dms-pendiente-dot"
                                  title={`${pendientes} cambio(s) solicitados por liquidaciones`}
                                />
                              )}
                            </td>
                            <td className="text-center tabular-nums">{row.semana}</td>
                            <td className="text-center tabular-nums">{row.anio}</td>
                            <td>
                              <EstadoEstimacionBadge estado={row.estado} />
                            </td>
                            <td className="font-semibold text-rfs-navy">{row.contenedor}</td>
                            <td className="text-xs">{row.modeloMaquina || '—'}</td>
                            <td className="text-center">{row.codigoRfs || '—'}</td>
                            <td className="dms-cell-wrap text-[10px]">{row.naviera}</td>
                            <td onDoubleClick={(e) => e.stopPropagation()}>
                              <select
                                className="dms-select dms-select-actividad"
                                value={row.actividad}
                                onChange={(e) => {
                                  setActividad(row.id, e.target.value as Actividad, usuario);
                                  toast(
                                    `Actividad de ${row.codigo} cambiada a ${e.target.value}.`,
                                    'success'
                                  );
                                }}
                              >
                                {ACTIVIDADES.map((a) => (
                                  <option key={a} value={a}>
                                    {a}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="text-center">{row.lugarEstimacion}</td>
                            <td className="text-center text-gray-400">
                              {row.lugarAsistencia || '—'}
                            </td>
                            <td className="text-[10px] tabular-nums">{row.fechaGateIn || '—'}</td>
                            <td className="text-[10px] tabular-nums">
                              {row.fechaElaboracion || '—'}
                            </td>
                            <td className="text-[10px] tabular-nums text-gray-500">
                              {row.fechaReparacion || '—'}
                            </td>
                            <td className="text-center">{row.tipoEstimacion}</td>
                            <td className="text-xs">{row.tecnico}</td>
                            <td className="text-right tabular-nums">
                              {row.horasHombre.toFixed(2)}
                            </td>
                            <td className="text-right tabular-nums">
                              {formatMoney(row.pvpHorasHombre)}
                            </td>
                            <td className="text-right tabular-nums">
                              {formatMoney(row.pvpMateriales)}
                            </td>
                            <td className="text-right font-semibold tabular-nums text-rfs-navy">
                              {formatMoney(row.pvpTotal)}
                            </td>
                            <td className="text-center">{row.estadoPti || '—'}</td>
                            <td className="text-[10px] tabular-nums">{row.fechaFinPti || '—'}</td>
                            <td className="text-center">
                              <span
                                className={cn(
                                  'dms-si-no',
                                  row.enviarAprobacion === 'SI' ? 'dms-si-no--si' : 'dms-si-no--no'
                                )}
                              >
                                {row.enviarAprobacion}
                              </span>
                            </td>
                            <td className="text-[10px] tabular-nums">{row.fechaEnvio || '—'}</td>
                            <td className="text-[10px] tabular-nums">
                              {row.fechaAprobacion || '—'}
                            </td>
                            <td className="text-center">
                              <span
                                className={cn(
                                  'dms-si-no',
                                  row.ediEnviadoOne === 'SI' ? 'dms-si-no--si' : 'dms-si-no--no'
                                )}
                              >
                                {row.ediEnviadoOne}
                              </span>
                            </td>
                            <td className="text-[10px] tabular-nums text-gray-400">
                              {row.fechaEnvioEdiOne || '—'}
                            </td>
                            <td className="dms-cell-wrap max-w-[9rem] text-[10px]">
                              {row.niveles || '—'}
                            </td>
                            <td className="text-center tabular-nums">{row.diasEstadia}</td>
                            <td className="text-center text-[10px]">{row.tipoDano || '—'}</td>
                            <td className="dms-cell-wrap max-w-[13rem] text-[10px] text-gray-600">
                              {row.analisisObservacion || '—'}
                            </td>
                            <td className="text-[10px] tabular-nums text-gray-500">
                              {row.fechaModificacion || '—'}
                            </td>
                            <td className="text-xs">{row.usuarioModificacion || 'N/A'}</td>
                            <td
                              className="dms-sticky-col dms-sticky-col--right"
                              onDoubleClick={(e) => e.stopPropagation()}
                            >
                              {accionesDe(row)}
                            </td>
                          </tr>

                          {abierta && (
                            <tr className="dms-row-detalle">
                              <td />
                              <td colSpan={34}>
                                <div className="dms-detalle-inline">
                                  <div>
                                    <span>Buque / Viaje</span>
                                    <strong>
                                      {row.buque} · {row.viaje}
                                    </strong>
                                  </div>
                                  <div>
                                    <span>Tipo contenedor</span>
                                    <strong>{row.tipoContenedor}</strong>
                                  </div>
                                  <div>
                                    <span>Líneas de daño</span>
                                    <strong>{row.danos.length}</strong>
                                  </div>
                                  <div>
                                    <span>Fotos cargadas</span>
                                    <strong>
                                      {row.danos.reduce((a, d) => a + d.fotos.length, 0)}
                                    </strong>
                                  </div>
                                  <div>
                                    <span>Comentarios liquidaciones</span>
                                    <strong
                                      className={pendientes > 0 ? 'text-rfsorange-600' : undefined}
                                    >
                                      {row.danos.reduce((a, d) => a + d.comentarios.length, 0)} (
                                      {pendientes} pendiente
                                      {pendientes === 1 ? '' : 's'})
                                    </strong>
                                  </div>
                                  <div>
                                    <span>Movimientos</span>
                                    <strong>{row.auditoria.length}</strong>
                                  </div>
                                  <div className="dms-detalle-inline-acciones">
                                    <button
                                      type="button"
                                      className="dms-btn-action dms-btn-ver"
                                      onClick={() =>
                                        router.push(`/reportes/estimaciones/${row.codigo}`)
                                      }
                                    >
                                      Abrir estimado
                                    </button>
                                    <button
                                      type="button"
                                      className="dms-btn-action dms-btn-datalog"
                                      onClick={() => {
                                        descargarDataLog(row);
                                        toast('Data Log descargado.', 'success');
                                      }}
                                    >
                                      <Database className="h-3 w-3" /> Data Log
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="dms-danos-total">
                      <td colSpan={17} className="text-right">
                        TOTALES DE {filtered.length} REGISTRO(S) FILTRADO(S)
                      </td>
                      <td className="text-right tabular-nums">{totales.hh.toFixed(2)}</td>
                      <td className="text-right tabular-nums">{formatMoney(totales.pvpHh)}</td>
                      <td className="text-right tabular-nums">{formatMoney(totales.pvpMat)}</td>
                      <td className="text-right tabular-nums">{formatMoney(totales.pvpTotal)}</td>
                      <td colSpan={14} />
                    </tr>
                  </tfoot>
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
          </DmsReportLayout>
        </div>
      </main>

      <InformePreviewModal
        open={dialogo.tipo === 'INFORME'}
        estimacion={activa}
        conValores
        variante={dialogo.tipo === 'INFORME' ? dialogo.variante : 'ESTIMADO'}
        onClose={cerrar}
      />

      <Modal
        open={dialogo.tipo === 'NOTA'}
        onClose={cerrar}
        size="md"
        icon={<Ship className="h-4 w-4" />}
        title={`Nota Naviera · ${activa?.codigo ?? ''}`}
        subtitle={activa ? `${activa.naviera} · ${activa.contenedor}` : undefined}
        footer={
          <button
            type="button"
            className="dms-btn-action border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
            onClick={cerrar}
          >
            Cerrar
          </button>
        }
      >
        {activa && activa.comentariosSeaboard.length > 0 ? (
          <ul className="space-y-2">
            {activa.comentariosSeaboard.map((c) => (
              <li key={c.id} className="dms-nota-item">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="dms-cmt-rol dms-cmt-rol--nav">{c.accion}</span>
                  <span className="dms-chip-user">{c.usuario}</span>
                  <span className="text-[10px] tabular-nums text-gray-400">{c.fecha}</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-gray-700">{c.comentario}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-gray-400">
            La naviera no ha registrado notas para esta estimación.
          </p>
        )}
      </Modal>

      <Modal
        open={dialogo.tipo === 'INFO'}
        onClose={cerrar}
        size="md"
        icon={<Info className="h-4 w-4" />}
        title={`Información · ${activa?.codigo ?? ''}`}
        subtitle={activa ? `${activa.contenedor} · ${activa.tipoEstimacion}` : undefined}
        footer={
          <button
            type="button"
            className="dms-btn-action border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
            onClick={cerrar}
          >
            Cerrar
          </button>
        }
      >
        {activa && (
          <div className="space-y-3">
            <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              {[
                ['Estado', activa.estado],
                ['Niveles', activa.niveles || 'Sin niveles'],
                ['Tipo de daño', activa.tipoDano || 'No clasificado'],
                ['Días de estadía', String(activa.diasEstadia)],
                ['Estado PTI', activa.estadoPti || 'Sin PTI'],
                ['EDI ONE', activa.ediEnviadoOne],
              ].map(([k, v]) => (
                <div key={k} className="dms-mini-dato">
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <div>
              <p className="dms-field-label">Análisis de observación</p>
              <p className="rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-gray-700">
                {activa.analisisObservacion || 'Sin observaciones registradas por el técnico.'}
              </p>
            </div>
            {activa.sinDanos && (
              <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
                Esta estimación se registró <strong>sin daños</strong>: el contenedor no requiere
                reparación y no genera valores.
              </p>
            )}
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={dialogo.tipo === 'ELIMINAR'}
        title="Eliminar estimación"
        subtitle="La estimación se retira del reporte"
        confirmLabel="Eliminar"
        onClose={cerrar}
        onConfirm={() => {
          if (dialogo.tipo !== 'ELIMINAR' || !activa) return;
          eliminar(activa.id, usuario);
          toast(`Estimación ${activa.codigo} eliminada.`, 'success');
        }}
      >
        {activa && (
          <>
            Se eliminará <strong>{activa.codigo}</strong> del contenedor{' '}
            <strong>{activa.contenedor}</strong> con {activa.danos.length} línea(s) de daño por{' '}
            <strong>${formatMoney(activa.pvpTotal)}</strong>.
          </>
        )}
      </ConfirmModal>

      <ConfirmModal
        open={dialogo.tipo === 'ENVIAR'}
        title="Enviar a Aprobación"
        subtitle={activa ? `Destino: ${activa.naviera}` : undefined}
        confirmLabel="Enviar"
        confirmClass="dms-btn-enviar"
        onClose={cerrar}
        onConfirm={() => {
          if (!activa) return;
          enviarAprobacion([activa.id], usuario);
          toast(`Estimación ${activa.codigo} enviada a aprobación.`, 'success');
        }}
      >
        {activa && (
          <>
            <strong>{activa.codigo}</strong> pasará a estado <strong>ENVIADO</strong> por un total de{' '}
            <strong>${formatMoney(activa.pvpTotal)}</strong>.
            {contarComentariosPendientes(activa.danos) > 0 && (
              <p className="mt-2 text-xs text-rfsorange-600">
                Atención: hay {contarComentariosPendientes(activa.danos)} comentario(s) de
                liquidaciones sin resolver.
              </p>
            )}
          </>
        )}
      </ConfirmModal>

      <ComentarioModal
        open={dialogo.tipo === 'REVERSAR'}
        title="Reversar Aprobación"
        subtitle="La estimación volverá a estado PENDIENTE"
        label="Motivo del reverso"
        confirmLabel="Reversar"
        confirmClass="dms-btn-reversar"
        onClose={cerrar}
        onConfirm={(comentario) => {
          if (activa) {
            reversarAprobacion(activa.id, usuario, comentario);
            toast('Aprobación reversada. Estado actualizado a PENDIENTE.', 'success');
          }
          cerrar();
        }}
      />
    </>
  );
}
