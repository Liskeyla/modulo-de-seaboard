'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Eye,
  FilePlus2,
  ListChecks,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { DmsReportLayout } from '@/components/dms/DmsReportLayout';
import { DmsTableToolbar } from '@/components/dms/DmsTableToolbar';
import { EstadoEstimacionBadge } from '@/components/dms/EstadoEstimacionBadge';
import {
  BadgeEstadoItem,
  claseFilaRevisionPendiente,
} from '@/components/dms/IndicadoresRevision';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import {
  APLICA_APROBADO_SBM,
  APLICA_PENDIENTE,
  APLICA_RECHAZADO_SBM,
  APLICA_DANO,
  CARGOS_DANO,
  normalizarAplicaDano,
  normalizarCargoDano,
  type AplicaDano,
  type CargoDano,
  type Estimacion,
} from '@/types/estimacion';
import { useAuthStore } from '@/store';
import { useEstimacionesStore } from '@/store/estimacionesStore';
import { useUiStore } from '@/store/uiStore';
import { paisDe } from '@/lib/pais';
import { esItemPendienteRevision } from '@/lib/revisionPendiente';
import { cn, formatMoney, toast } from '@/lib/utils';

export interface ItemReporteFila {
  key: string;
  estimacionId: string;
  codigo: string;
  contenedor: string;
  naviera: string;
  estadoEstimacion: Estimacion['estado'];
  fechaElaboracion: string;
  linea: number;
  danoId: string;
  comp: string;
  dano: string;
  ubicacion: string;
  cargo: string;
  estadoItem: AplicaDano;
  csTotal: number;
  horasHombre: number;
  /** Observación de la decisión SBM (aprobación o rechazo). */
  observacionDecision: string;
  usuarioDecision: string;
  fechaDecision: string;
  ultimoComentario: string;
  usuarioModificacion: string;
  fechaModificacion: string;
}

function aFechaIso(fecha: string) {
  const m = fecha.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return '';
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

function ultimoComentario(e: Estimacion['danos'][number]) {
  if (!e.comentarios.length) return '';
  const c = [...e.comentarios].sort((a, b) => a.fecha.localeCompare(b.fecha, 'es')).at(-1);
  return c ? `${c.usuario}: ${c.mensaje}` : '';
}

/** Observación asociada a la decisión del ítem (prioridad: rechazo, luego aprobación). */
function observacionDeDecision(d: Estimacion['danos'][number]): {
  texto: string;
  usuario: string;
  fecha: string;
} {
  const hist = [...(d.historialAcciones ?? [])].sort((a, b) =>
    b.fecha.localeCompare(a.fecha, 'es')
  );
  const porHist = hist.find(
    (h) =>
      (h.tipo === 'RECHAZO' || h.tipo === 'APROBACION') && Boolean(h.comentario?.trim())
  );
  if (porHist) {
    return {
      texto: porHist.comentario!.trim(),
      usuario: porHist.usuario,
      fecha: porHist.fecha,
    };
  }

  const porCmt = [...d.comentarios]
    .filter((c) => c.tipo === 'RECHAZADO' || c.tipo === 'ACEPTADO')
    .sort((a, b) => b.fecha.localeCompare(a.fecha, 'es'))[0];
  if (porCmt) {
    return {
      texto: porCmt.mensaje.trim(),
      usuario: porCmt.usuario,
      fecha: porCmt.fecha,
    };
  }

  if (d.edicionReciente?.comentarioSbm?.trim()) {
    return {
      texto: d.edicionReciente.comentarioSbm.trim(),
      usuario: d.edicionReciente.usuario,
      fecha: d.edicionReciente.fecha,
    };
  }

  return { texto: '', usuario: '', fecha: '' };
}

function aplanarItems(estimaciones: Estimacion[]): ItemReporteFila[] {
  const filas: ItemReporteFila[] = [];
  estimaciones.forEach((est) => {
    est.danos.forEach((d) => {
      const decision = observacionDeDecision(d);
      filas.push({
        key: `${est.id}-${d.id}`,
        estimacionId: est.id,
        codigo: est.codigo,
        contenedor: est.contenedor,
        naviera: est.naviera,
        estadoEstimacion: est.estado,
        fechaElaboracion: est.fechaElaboracion,
        linea: d.linea,
        danoId: d.id,
        comp: d.comp,
        dano: d.dano,
        ubicacion: d.ubicacion,
        cargo: normalizarCargoDano(d.cargo),
        estadoItem: normalizarAplicaDano(d.aplica),
        csTotal: d.csTotal,
        horasHombre: d.horasHombre,
        observacionDecision: decision.texto,
        usuarioDecision: decision.usuario,
        fechaDecision: decision.fecha,
        ultimoComentario: ultimoComentario(d),
        usuarioModificacion: est.usuarioModificacion || '—',
        fechaModificacion: est.fechaModificacion || '—',
      });
    });
  });
  return filas;
}

const EXCEL_HEADERS = [
  'Código estimado',
  'Contenedor',
  'Naviera',
  'Estado estimado',
  'Línea',
  'Componente',
  'Daño',
  'Ubicación',
  'Cargo',
  'Estado ítem',
  'Observación decisión',
  'Usuario decisión',
  'Fecha decisión',
  'HH',
  'Cs. Total',
  'Último comentario',
  'Usuario modificación',
  'Fecha modificación',
  'Fecha elaboración',
];

export default function ReporteItemsDanoPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { estimaciones, generarEstimadoDesdeItems } = useEstimacionesStore();
  const { pais } = useUiStore();

  const [estadoItem, setEstadoItem] = useState('Todos');
  const [cargo, setCargo] = useState('Todos');
  const [naviera, setNaviera] = useState('Todas');
  const [componente, setComponente] = useState('Todos');
  const [estadoEstimacion, setEstadoEstimacion] = useState('Todos');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [filtroActivo, setFiltroActivo] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [parametro, setParametro] = useState('contenedor');
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(() => new Set());
  const [confirmarGenerar, setConfirmarGenerar] = useState(false);
  const [cargoCobroNuevo, setCargoCobroNuevo] = useState<CargoDano>('Cliente');

  const actor =
    user?.nombre && user.username && user.nombre !== user.username
      ? `${user.nombre} (${user.username})`
      : user?.username ?? user?.nombre ?? 'liquidaciones';

  const porPais = useMemo(
    () => estimaciones.filter((e) => paisDe(e) === pais),
    [estimaciones, pais]
  );

  const itemsBase = useMemo(() => aplanarItems(porPais), [porPais]);

  const opciones = useMemo(() => {
    const unicos = (fn: (r: ItemReporteFila) => string) =>
      Array.from(new Set(itemsBase.map(fn).filter(Boolean))).sort();
    return {
      navieras: ['Todas', ...unicos((r) => r.naviera)],
      componentes: ['Todos', ...unicos((r) => r.comp)],
      estadosEst: ['Todos', ...unicos((r) => r.estadoEstimacion)],
    };
  }, [itemsBase]);

  const filtered = useMemo(() => {
    const hayCriterio = filtroActivo || Boolean(busqueda) || Boolean(search);
    return itemsBase.filter((r) => {
      if (!hayCriterio) return true;
      if (filtroActivo) {
        if (estadoItem !== 'Todos' && r.estadoItem !== estadoItem) return false;
        if (cargo !== 'Todos' && r.cargo !== cargo) return false;
        if (naviera !== 'Todas' && r.naviera !== naviera) return false;
        if (componente !== 'Todos' && r.comp !== componente) return false;
        if (estadoEstimacion !== 'Todos' && r.estadoEstimacion !== estadoEstimacion) {
          return false;
        }
        const iso = aFechaIso(r.fechaElaboracion);
        if (desde && iso && iso < desde) return false;
        if (hasta && iso && iso > hasta) return false;
      }
      if (busqueda) {
        const q = busqueda.toLowerCase();
        if (parametro === 'contenedor') {
          if (!r.contenedor.toLowerCase().includes(q)) return false;
        } else if (!r.codigo.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (search) {
        const q = search.toLowerCase();
        const blob = [
          r.codigo,
          r.contenedor,
          r.naviera,
          r.comp,
          r.dano,
          r.cargo,
          r.estadoItem,
          r.observacionDecision,
          r.ultimoComentario,
        ]
          .join(' ')
          .toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [
    itemsBase,
    filtroActivo,
    estadoItem,
    cargo,
    naviera,
    componente,
    estadoEstimacion,
    desde,
    hasta,
    busqueda,
    parametro,
    search,
  ]);

  const rechazadosVisibles = useMemo(
    () => filtered.filter((r) => r.estadoItem === APLICA_RECHAZADO_SBM),
    [filtered]
  );

  const seleccionDetalle = useMemo(
    () => filtered.filter((r) => seleccionados.has(r.key)),
    [filtered, seleccionados]
  );

  const seleccionRechazada = useMemo(
    () => seleccionDetalle.filter((r) => r.estadoItem === APLICA_RECHAZADO_SBM),
    [seleccionDetalle]
  );

  const contenedoresSeleccion = useMemo(
    () => Array.from(new Set(seleccionRechazada.map((r) => r.contenedor))),
    [seleccionRechazada]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginaActual = Math.min(page, totalPages);
  const paginated = filtered.slice((paginaActual - 1) * pageSize, paginaActual * pageSize);
  const from = filtered.length === 0 ? 0 : (paginaActual - 1) * pageSize + 1;
  const to = Math.min(paginaActual * pageSize, filtered.length);

  const todosRechazadosPagina = paginated.filter((r) => r.estadoItem === APLICA_RECHAZADO_SBM);
  const todosMarcadosEnPagina =
    todosRechazadosPagina.length > 0 &&
    todosRechazadosPagina.every((r) => seleccionados.has(r.key));

  function alternarSeleccion(key: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function alternarTodosPagina() {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (todosMarcadosEnPagina) {
        todosRechazadosPagina.forEach((r) => next.delete(r.key));
      } else {
        todosRechazadosPagina.forEach((r) => next.add(r.key));
      }
      return next;
    });
  }

  function intentarGenerarEstimado() {
    if (seleccionRechazada.length === 0) {
      toast('Marque al menos un ítem rechazado para generar el estimado.', 'info');
      return;
    }
    if (contenedoresSeleccion.length > 1) {
      toast(
        'Seleccione ítems del mismo contenedor. No se puede mezclar contenedores en un solo estimado.',
        'info'
      );
      return;
    }
    setConfirmarGenerar(true);
  }

  function confirmarGenerarEstimado() {
    const creado = generarEstimadoDesdeItems(
      seleccionRechazada.map((r) => ({ estimacionId: r.estimacionId, danoId: r.danoId })),
      actor,
      cargoCobroNuevo
    );
    setConfirmarGenerar(false);
    if (!creado) {
      toast(
        'No se pudo generar el estimado. Verifique que los ítems estén rechazados y del mismo contenedor.',
        'error'
      );
      return;
    }
    setSeleccionados(new Set());
    toast(
      `Estimado ${creado.codigo} generado · cobro ${cargoCobroNuevo} · ${creado.danos.length} ítem(s).`,
      'success'
    );
    router.push(`/reportes/estimaciones/${creado.codigo}`);
  }

  const excelRows = filtered.map((r) => [
    r.codigo,
    r.contenedor,
    r.naviera,
    r.estadoEstimacion,
    r.linea,
    r.comp,
    r.dano,
    r.ubicacion,
    r.cargo,
    r.estadoItem,
    r.observacionDecision,
    r.usuarioDecision,
    r.fechaDecision,
    r.horasHombre,
    r.csTotal,
    r.ultimoComentario,
    r.usuarioModificacion,
    r.fechaModificacion,
    r.fechaElaboracion,
  ]);

  function limpiarFiltros() {
    setEstadoItem('Todos');
    setCargo('Todos');
    setNaviera('Todas');
    setComponente('Todos');
    setEstadoEstimacion('Todos');
    setDesde('');
    setHasta('');
    setBusqueda('');
    setParametro('contenedor');
    setSearch('');
    setFiltroActivo(false);
    setPage(1);
    setSeleccionados(new Set());
    toast('Filtros restablecidos.', 'info');
  }

  return (
    <div className="min-h-screen">
      <Header
        title="Reportería de ítems de daño"
        subtitle="Liquidaciones · seguimiento y auditoría por línea (aprobados, rechazados y pendientes)"
      />
      <main className="mx-auto max-w-[1600px] px-3 py-4 sm:px-4">
        <DmsReportLayout
          title="Reporte de ítems"
          subtitle={`${user?.nombre ?? 'Liquidaciones'} · ${pais} · ${itemsBase.length} línea(s) en el depósito`}
          heroIcon={<ListChecks className="h-5 w-5" />}
          filtros={[
            {
              label: 'Estado del ítem',
              type: 'select',
              value: estadoItem,
              onChange: (v) => setEstadoItem(String(v)),
              options: ['Todos', ...APLICA_DANO],
            },
            {
              label: 'Cargo',
              type: 'select',
              value: cargo,
              onChange: (v) => setCargo(String(v)),
              options: ['Todos', ...CARGOS_DANO],
            },
            {
              label: 'Naviera',
              type: 'select',
              value: naviera,
              onChange: (v) => setNaviera(String(v)),
              options: opciones.navieras,
            },
            {
              label: 'Componente',
              type: 'select',
              value: componente,
              onChange: (v) => setComponente(String(v)),
              options: opciones.componentes,
            },
            {
              label: 'Estado estimado',
              type: 'select',
              value: estadoEstimacion,
              onChange: (v) => setEstadoEstimacion(String(v)),
              options: opciones.estadosEst,
            },
            {
              label: 'Desde',
              type: 'date',
              value: desde,
              onChange: (v) => setDesde(String(v)),
            },
            {
              label: 'Hasta',
              type: 'date',
              value: hasta,
              onChange: (v) => setHasta(String(v)),
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
              setFiltroActivo(true);
              setPage(1);
            },
          }}
        >
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
            excelFilename={`reporte-items-dano-${pais.toLowerCase()}.xlsx`}
            excelHeaders={EXCEL_HEADERS}
            excelRows={excelRows}
          />

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2.5">
            <div className="min-w-0 text-[11px] leading-snug text-amber-950">
              <p className="font-bold">Generar estimado desde ítems rechazados</p>
              <p className="mt-0.5 text-amber-900/90">
                Marque ítems <strong>Rechazados</strong> del mismo contenedor y use «Generar
                estimado». Prototipo sujeto a validación con Sistemas
                {seleccionRechazada.length > 0
                  ? ` · ${seleccionRechazada.length} seleccionado(s)${
                      contenedoresSeleccion.length === 1
                        ? ` · ${contenedoresSeleccion[0]}`
                        : contenedoresSeleccion.length > 1
                          ? ' · ⚠ varios contenedores'
                          : ''
                    }`
                  : rechazadosVisibles.length > 0
                    ? ` · ${rechazadosVisibles.length} rechazado(s) visibles`
                    : ''}
                .
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {seleccionados.size > 0 && (
                <button
                  type="button"
                  className="dms-btn-action border-gray-300 bg-white px-2.5 py-1.5 text-[11px] text-slate-600"
                  onClick={() => setSeleccionados(new Set())}
                >
                  Limpiar selección
                </button>
              )}
              <button
                type="button"
                className="dms-btn-azul inline-flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                disabled={seleccionRechazada.length === 0}
                onClick={intentarGenerarEstimado}
                title="Sujeto a validación con Sistemas"
              >
                <FilePlus2 className="h-3.5 w-3.5" /> Generar estimado
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
              <p className="text-sm text-slate-500">
                No hay ítems con estos criterios. Limpie los filtros o cambie el depósito.
              </p>
              <button
                type="button"
                className="dms-btn-azul mt-3 px-3 py-1.5 text-xs"
                onClick={limpiarFiltros}
              >
                Limpiar filtros
              </button>
            </div>
          ) : (
            <div className="dms-danos-table-wrap">
            <div className="dms-table-scroll">
              <table className="dms-table dms-table--reporte">
                <thead>
                  <tr>
                    <th className="w-10 text-center" title="Seleccionar ítems rechazados">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                        checked={todosMarcadosEnPagina}
                        disabled={todosRechazadosPagina.length === 0}
                        onChange={alternarTodosPagina}
                        aria-label="Seleccionar rechazados de la página"
                      />
                    </th>
                    <th>Acciones</th>
                    <th>Código</th>
                    <th>Contenedor</th>
                    <th>Línea</th>
                    <th>Componente</th>
                    <th>Daño</th>
                    <th title="A quién corresponde el cobro del ítem">Cargo</th>
                    <th>Estado ítem</th>
                    <th title="Observación obligatoria de la decisión Seaboard">
                      Observación decisión
                    </th>
                    <th>Estado estimado</th>
                    <th>Naviera</th>
                    <th>HH</th>
                    <th>Cs. Total</th>
                    <th>Último comentario</th>
                    <th>Usuario / Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((row) => {
                    const esRechazado = row.estadoItem === APLICA_RECHAZADO_SBM;
                    const itemPendiente = esItemPendienteRevision(row.estadoItem);
                    return (
                    <tr
                      key={row.key}
                      className={claseFilaRevisionPendiente({
                        itemPendiente,
                        seleccionada: seleccionados.has(row.key),
                      })}
                    >
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 disabled:opacity-30"
                          checked={seleccionados.has(row.key)}
                          disabled={!esRechazado}
                          title={
                            esRechazado
                              ? 'Incluir en generar estimado'
                              : 'Solo ítems rechazados'
                          }
                          onChange={() => alternarSeleccion(row.key)}
                          aria-label={`Seleccionar ${row.codigo} línea ${row.linea}`}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="dms-icon-action dms-icon-action--ver"
                          title="Abrir estimado"
                          onClick={() =>
                            router.push(`/reportes/estimaciones/${row.codigo}`)
                          }
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="dms-cell-container-code dms-cell-link"
                          onClick={() =>
                            router.push(`/reportes/estimaciones/${row.codigo}`)
                          }
                        >
                          {row.codigo}
                        </button>
                      </td>
                      <td className="font-semibold text-rfs-navy">{row.contenedor}</td>
                      <td className="text-center tabular-nums">
                        {String(row.linea).padStart(2, '0')}
                      </td>
                      <td className="whitespace-nowrap font-semibold text-rfs-navy">
                        {row.comp}
                      </td>
                      <td className="dms-cell-wrap text-[10px] font-semibold">{row.dano}</td>
                      <td className="text-center whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold',
                            row.cargo === 'Cliente' &&
                              'bg-sky-50 text-sky-800 ring-1 ring-sky-200',
                            row.cargo === 'Línea' &&
                              'bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200',
                            row.cargo === 'Transportista' &&
                              'bg-violet-50 text-violet-800 ring-1 ring-violet-200',
                            row.cargo === 'RFS' &&
                              'bg-teal-50 text-teal-800 ring-1 ring-teal-200'
                          )}
                        >
                          {row.cargo}
                        </span>
                      </td>
                      <td className="text-center">
                        <BadgeEstadoItem estado={row.estadoItem} />
                      </td>
                      <td className="dms-cell-wrap min-w-[12rem] max-w-[18rem] text-[10px]">
                        {row.observacionDecision ? (
                          <div>
                            <p
                              className={cn(
                                'leading-snug',
                                row.estadoItem === APLICA_RECHAZADO_SBM
                                  ? 'font-medium text-red-800'
                                  : 'text-slate-700'
                              )}
                              title={row.observacionDecision}
                            >
                              {row.observacionDecision}
                            </p>
                            {(row.usuarioDecision || row.fechaDecision) && (
                              <p className="mt-0.5 text-[9px] text-slate-400">
                                {row.usuarioDecision}
                                {row.fechaDecision ? ` · ${row.fechaDecision}` : ''}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">
                            {row.estadoItem === APLICA_PENDIENTE
                              ? 'Sin decisión aún'
                              : 'Sin observación registrada'}
                          </span>
                        )}
                      </td>
                      <td>
                        <EstadoEstimacionBadge estado={row.estadoEstimacion} />
                      </td>
                      <td className="dms-cell-wrap text-[10px]">{row.naviera}</td>
                      <td className="text-right tabular-nums">{row.horasHombre.toFixed(2)}</td>
                      <td className="text-right font-semibold tabular-nums text-rfs-navy">
                        ${formatMoney(row.csTotal)}
                      </td>
                      <td className="dms-cell-wrap max-w-[14rem] text-[10px] text-slate-600">
                        {row.ultimoComentario || (
                          <span className="text-slate-400">Sin comentarios</span>
                        )}
                      </td>
                      <td className="text-[10px] text-slate-500">
                        <div>{row.usuarioModificacion}</div>
                        <div className="tabular-nums">{row.fechaModificacion}</div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <span>
              Mostrando {from}–{to} de {filtered.length} ítem(s)
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="dms-btn-action border-gray-300 bg-white px-2 py-1 text-[11px] disabled:opacity-40"
                disabled={paginaActual <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </button>
              <span className="px-2 tabular-nums">
                {paginaActual} / {totalPages}
              </span>
              <button
                type="button"
                className="dms-btn-action border-gray-300 bg-white px-2 py-1 text-[11px] disabled:opacity-40"
                disabled={paginaActual >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Siguiente
              </button>
            </div>
          </div>
        </DmsReportLayout>
      </main>

      <ConfirmModal
        open={confirmarGenerar}
        title="Generar estimado"
        subtitle={
          seleccionRechazada.length
            ? `${seleccionRechazada.length} ítem(s) · ${contenedoresSeleccion[0] ?? ''}`
            : undefined
        }
        confirmLabel="Generar estimado"
        confirmClass="dms-btn-azul"
        onClose={() => setConfirmarGenerar(false)}
        onConfirm={confirmarGenerarEstimado}
      >
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            Se creará un <strong>nuevo registro</strong> con <strong>código distinto</strong> (no se
            reutiliza el del estimado origen). El estimado original queda como{' '}
            <strong>histórico</strong> sin alterar. Se copian el mismo contenedor y movimiento
            (buque, viaje, GateIn, naviera, código RFS).
          </p>

          <div>
            <label className="dms-field-label">Responsable del cobro (obligatorio)</label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {CARGOS_DANO.map((c) => (
                <label
                  key={c}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-[12px] font-semibold transition-colors',
                    cargoCobroNuevo === c
                      ? 'border-rfs-400 bg-rfs-50 text-rfs-navy ring-1 ring-rfs-200'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  )}
                >
                  <input
                    type="radio"
                    name="cargo-cobro-nuevo"
                    className="accent-[#152483]"
                    checked={cargoCobroNuevo === c}
                    onChange={() => setCargoCobroNuevo(c)}
                  />
                  {c}
                </label>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-slate-500">
              Se aplicará a todas las líneas del nuevo estimado · Cliente · Línea · Transportista ·
              RFS
            </p>
          </div>

          <ul className="max-h-36 list-disc space-y-1 overflow-y-auto rounded-md border border-slate-100 bg-slate-50 px-4 py-2 text-[11px]">
            {seleccionRechazada.map((r) => (
              <li key={r.key}>
                {r.codigo} · L{String(r.linea).padStart(2, '0')} · {r.comp}
                {r.observacionDecision
                  ? ` · «${r.observacionDecision.slice(0, 80)}${r.observacionDecision.length > 80 ? '…' : ''}»`
                  : ''}
              </li>
            ))}
          </ul>
          <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-950">
            <AlertTriangle className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />
            Funcionalidad prototipo sujeta a validación con Sistemas. No reemplaza aún el flujo
            productivo de alta de estimados.
          </p>
        </div>
      </ConfirmModal>
    </div>
  );
}
