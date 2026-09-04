'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Download,
  Eye,
  FileBarChart,
  FileText,
  Info,
  Mail,
  MessageSquare,
  RefreshCw,
  SearchX,
  Send,
  Ship,
  Trash2,
  Undo2,
  Upload,
  Users,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { DmsReportLayout } from '@/components/dms/DmsReportLayout';
import { DmsTableToolbar } from '@/components/dms/DmsTableToolbar';
import { EstadoEstimacionBadge } from '@/components/dms/EstadoEstimacionBadge';
import {
  claseFilaRevisionPendiente,
  IconoAlertaRevisionEstimado,
} from '@/components/dms/IndicadoresRevision';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ComentarioModal } from '@/components/aprobaciones/ComentarioModal';
import { InformePreviewModal } from '@/components/estimacion/InformePreviewModal';
import { PreviewListadoDanosModal } from '@/components/estimacion/PreviewListadoDanosModal';
import { ChipsRetornoSeaboard } from '@/components/estimacion/RespuestaSeaboardBanner';
import { AlertasLiquidacionesCell } from '@/components/estimacion/AlertasLiquidacionesCell';
import {
  ConfirmacionEstimacionModal,
  notificarEnvioALiquidaciones,
  notificarSolicitudReversoALiquidaciones,
} from '@/components/estimacion/ConfirmacionEstimacionModal';
import { NuevoEstimadoModal } from '@/components/estimacion/NuevoEstimadoModal';
import { useAuthStore } from '@/store';
import { useEstimacionesStore } from '@/store/estimacionesStore';
import { useUiStore } from '@/store/uiStore';
import { metaPais, paisDe } from '@/lib/pais';
import {
  esNavieraSeaboard,
  enBandejaSeaboard,
  visibleEnReporteSeaboard,
  puedePushASbm,
  resolverEstadoEnvioALiquidaciones,
  estadoVisibleLiquidaciones,
  esRetornoRechazadoALiquidaciones,
} from '@/lib/seaboardFlow';
import { useCatalogoCargoStore } from '@/store/catalogoCargoStore';
import {
  ACTIVIDADES,
  ESTADOS_ESTIMACION,
  contarComentariosPendientes,
  itemsSinRevisionSbm,
  inferirTipoCobro,
  mensajeRevisionItemsPendientes,
  MSG_ITEMS_SIN_APROBAR,
  type Actividad,
  type Estimacion,
} from '@/types/estimacion';
import { descargarDataLog, type VarianteInforme } from '@/lib/descargas';
import { estimadoRequiereRevisionItems } from '@/lib/revisionPendiente';
import { cn, formatMoney, toast } from '@/lib/utils';

/**
 * Fechas del flujo (mismo dato, etiquetas distintas por rol):
 * - fechaEnvio       → Liquidaciones: cuándo envió a Línea/SBM · Seaboard: cuándo recibió
 * - fechaAprobacion  → cuándo Seaboard aprobó (ambos reportes)
 * - fechaRevision    → cuándo Seaboard revisó / decidió
 * - fechaModificacion→ última modificación (ambos reportes)
 */
function etiquetasFechasReporte(rol: 'liquidaciones' | 'seaboard' | 'dms' | string | undefined) {
  if (rol === 'liquidaciones') {
    return {
      envio: 'Fecha Envío a Línea',
      envioTitle:
        'Fecha en que Liquidaciones envió el estimado a aprobar (reporte Seaboard)',
      revision: 'Fecha respuesta Línea',
      revisionTitle: 'Fecha en que Seaboard respondió (revisión / decisión)',
      aprobacion: 'Fecha Aprobación Línea',
      aprobacionTitle: 'Fecha en que Seaboard aprobó el estimado',
      modificacion: 'Fecha de modificación',
      modificacionTitle: 'Última modificación del estimado',
    };
  }
  if (rol === 'seaboard') {
    return {
      envio: 'Fecha Envío a Línea',
      envioTitle:
        'Fecha en que Liquidaciones envió el estimado; fecha de recepción en Seaboard',
      revision: 'Fecha revisión',
      revisionTitle: 'Fecha en que Seaboard revisó el estimado',
      aprobacion: 'Fecha Aprobación',
      aprobacionTitle: 'Fecha en que Seaboard aprobó el estimado',
      modificacion: 'Fecha de modificación',
      modificacionTitle: 'Última modificación del estimado (ítems / comentarios)',
    };
  }
  return {
    envio: 'Fecha Envío a Línea',
    envioTitle: 'Fecha de envío a Seaboard Marine',
    revision: 'Fecha revisión',
    revisionTitle: 'Fecha de revisión',
    aprobacion: 'Fecha Aprobación',
    aprobacionTitle: 'Fecha de aprobación Seaboard',
    modificacion: 'Fecha de modificación',
    modificacionTitle: 'Última modificación',
  };
}

function excelHeadersParaRol(rol: string | undefined) {
  const f = etiquetasFechasReporte(rol);
  const headers = [
    'Codigo',
    'Semana',
    'Año',
    'Estado',
    'Contenedor',
    'Modelo Maquina',
    'Código RFS',
    'Naviera',
    'Buque',
    'Viaje',
    'Actividad',
    'Lugar de Estimación',
    'Lugar de Asistencia',
    'Fecha GateIn',
    'Fecha de Elaboración',
    'Fecha de Reparación',
    'Tipo de Estimación',
    'Horas Hombre',
    'PVP Horas Hombre',
    'PVP Materiales',
    'PVP Total',
    'Estado PTI',
    'Fecha Fin PTI',
    'Enviar Aprobacion',
    f.envio,
    f.revision,
    f.aprobacion,
    ...(rol === 'seaboard' ? [] : ['Niveles']),
    'Dias Estadia',
    'Tipo de Daño',
    'Análisis de observación',
    f.modificacion,
    'Usuario de Modificación',
  ];
  return headers;
}

function rowToExcel(e: Estimacion, rol?: string) {
  const base = [
    e.codigo,
    e.semana,
    e.anio,
    e.estado,
    e.contenedor,
    e.modeloMaquina,
    e.codigoRfs,
    e.naviera,
    e.buque,
    e.viaje,
    e.actividad,
    e.lugarEstimacion,
    e.lugarAsistencia,
    e.fechaGateIn,
    e.fechaElaboracion,
    e.fechaReparacion,
    e.tipoEstimacion,
    e.horasHombre,
    e.pvpHorasHombre,
    e.pvpMateriales,
    e.pvpTotal,
    e.estadoPti,
    e.fechaFinPti,
    e.enviarAprobacion,
    e.fechaEnvio,
    e.fechaRevision || '',
    e.fechaAprobacion,
  ];
  const cola = [
    e.diasEstadia,
    e.tipoDano,
    e.analisisObservacion,
    e.fechaModificacion,
    e.usuarioModificacion,
  ];
  if (rol === 'seaboard') return [...base, ...cola];
  return [...base, e.niveles, ...cola];
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
  | { tipo: 'ENVIAR'; id: string }
  | { tipo: 'ELIMINAR'; id: string }
  | { tipo: 'REVERSAR_APROB'; id: string }
  | { tipo: 'SOLICITAR_REVERSO'; id: string }
  | { tipo: 'PUSH_SBM'; id: string }
  | { tipo: 'PREVIEW_DANOS'; id: string }
  | { tipo: 'NUEVO_ESTIMADO'; variante: 'Máquina' | 'Box' }
  | { tipo: 'REINICIAR_DEMO' };

export default function ReporteEstimacionesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    estimaciones,
    enviarAprobacion,
    enviarALiquidaciones,
    reversarAprobacion,
    solicitarReversoAprobacion,
    eliminar,
    setActividad,
    crearEstimado,
    reset,
  } = useEstimacionesStore();
  const { pais } = useUiStore();

  useEffect(() => {
    setPage(1);
  }, [pais]);

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
  const [dialogo, setDialogo] = useState<Dialogo>({ tipo: 'NINGUNO' });

  const usuario = user?.username ?? 'seaboard';
  const actor =
    user?.nombre && user.nombre !== usuario
      ? `${user.nombre} (${usuario})`
      : usuario;
  const esLiquidaciones = user?.rol === 'liquidaciones';
  const esSeaboard = user?.rol === 'seaboard';
  const esCoordinador = user?.rol === 'coordinador';
  /** Alertas: Liquidaciones y Coordinador. Cobro: solo Liquidaciones. */
  const verAlertas = esLiquidaciones || esCoordinador;
  const verCobro = esLiquidaciones;
  const puedeEditarActividad = esSeaboard || esCoordinador || user?.rol === 'dms';
  const etiquetasFecha = etiquetasFechasReporte(user?.rol);
  const cerrar = () => setDialogo({ tipo: 'NINGUNO' });

  /**
   * Liquidaciones / Coordinador: todas las navieras del país.
   * Seaboard: solo estimados que Liquidaciones ya envió (enviarAprobacion = SI).
   * Mientras Liquidaciones no envíe, NO cae en el reporte/bandeja Seaboard.
   */
  const porPais = useMemo(() => {
    return estimaciones.filter((e) => {
      if (paisDe(e) !== pais) return false;
      if (esSeaboard) return visibleEnReporteSeaboard(e);
      return true;
    });
  }, [estimaciones, pais, esSeaboard]);

  // Las opciones de los filtros salen de los datos reales cargados en el store.
  const opciones = useMemo(() => {
    const unicos = (fn: (e: Estimacion) => string) =>
      Array.from(new Set(porPais.map(fn).filter(Boolean))).sort();
    return {
      navieras: ['Todas', ...unicos((e) => e.naviera)],
      codigosRfs: ['Todos', ...unicos((e) => e.codigoRfs)],
      patios: ['Todos', ...unicos((e) => e.lugarEstimacion)],
      tipos: ['Todos', ...unicos((e) => e.tipoEstimacion)],
      tecnicos: ['Todos', ...unicos((e) => e.tecnico)],
    };
  }, [porPais]);

  const filtered = useMemo(() => {
    const hayCriterio = filtroActivo || Boolean(busqueda) || Boolean(search);

    return porPais.filter((e) => {
      if (patio !== 'Todos' && e.lugarEstimacion !== patio) return false;
      if (estado !== 'Todos') {
        if (esLiquidaciones) {
          if (estadoVisibleLiquidaciones(e) !== estado) return false;
        } else if (e.estado !== estado) {
          return false;
        }
      }
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
    porPais, desde, hasta, naviera, codigoRfs, patio, tipo, estado, actividad, tecnico,
    aplica, completas, busqueda, parametro, search, filtroActivo, esLiquidaciones,
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
            onClick={() =>
              setDialogo({ tipo: 'INFORME', id: row.id, variante: 'PRELIMINAR' })
            }
          >
            <FileText className="h-3.5 w-3.5" />
          </button>
        )}
        {['APROBADO', 'REPARADO', 'RECHAZADO'].includes(row.estado) && (
          <button
            type="button"
            className="dms-icon-action dms-icon-action--nota"
            title={esSeaboard ? 'Ver nota RFS' : 'Ver nota Seaboard'}
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
        {(user?.rol === 'dms' &&
          ['PENDIENTE', 'RECHAZADO', 'REVERSADO'].includes(row.estado) &&
          esNavieraSeaboard(row.naviera) &&
          String(row.enviarAprobacion || '').toUpperCase() !== 'SI') ||
        (esLiquidaciones && puedePushASbm(row)) ? (
          <button
            type="button"
            className="dms-icon-action dms-icon-action--enviar"
            title={
              esLiquidaciones
                ? 'Enviar a SBM · solo naviera Seaboard · queda ENVIADO'
                : 'Enviar a Seaboard Marine'
            }
            onClick={() => {
              setDialogo({ tipo: esLiquidaciones ? 'PUSH_SBM' : 'ENVIAR', id: row.id });
            }}
          >
            {esLiquidaciones ? (
              <Upload className="h-3.5 w-3.5" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </button>
        ) : null}
        {esLiquidaciones && row.estado === 'APROBADO' && (
          <button
            type="button"
            className="dms-icon-action dms-icon-action--reversar"
            title="Reversar aprobación"
            onClick={() => setDialogo({ tipo: 'REVERSAR_APROB', id: row.id })}
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
        )}
        {(esSeaboard || esCoordinador) && row.estado === 'APROBADO' && (
          <button
            type="button"
            className="dms-icon-action dms-icon-action--enviar"
            title="Solicitar reverso a liquidaciones (mensaje + correo)"
            onClick={() => setDialogo({ tipo: 'SOLICITAR_REVERSO', id: row.id })}
          >
            <Mail className="h-3.5 w-3.5" />
          </button>
        )}
        {esLiquidaciones &&
          !enBandejaSeaboard(row) &&
          ['PENDIENTE', 'RECHAZADO', 'REVERSADO'].includes(row.estado) && (
            <button
              type="button"
              className="dms-icon-action dms-icon-action--borrar"
              title="Eliminar estimado"
              onClick={() => setDialogo({ tipo: 'ELIMINAR', id: row.id })}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        {['ENVIADO', 'PENDIENTE', 'RECHAZADO', 'REVERSADO'].includes(row.estado) &&
          user?.rol === 'seaboard' && (
            <button
              type="button"
              className="dms-icon-action dms-icon-action--enviar"
              title="Enviar"
              onClick={() => {
                if (itemsSinRevisionSbm(row.danos).length > 0) {
                  toast(
                    mensajeRevisionItemsPendientes(row.danos) ?? MSG_ITEMS_SIN_APROBAR,
                    'info'
                  );
                  return;
                }
                setDialogo({ tipo: 'ENVIAR', id: row.id });
              }}
            >
              <Send className="h-3.5 w-3.5" />
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
      </div>
    );
  }

  const tituloReporte = esLiquidaciones
    ? `Aprobaciones de Estimados · ${metaPais(pais).label}`
    : esCoordinador
      ? `Estimaciones · Coordinador · ${metaPais(pais).label}`
      : 'Reporte de Estimaciones Seaboard Marine';

  const subtituloReporte = esLiquidaciones
    ? user?.pais === 'PERU'
      ? 'Prueba desde cero · Enviar a SBM · reversar · eliminar'
      : 'Prueba desde cero · Enviar a SBM · reversar · eliminar'
    : esCoordinador
      ? 'Crear y modificar estimados · Liquidaciones envía a la línea'
      : 'Prueba desde cero · Revisar ENVIADO · aprobar/rechazar ítems · Enviar a liquidaciones';

  return (
    <>
      <Header title={tituloReporte} subtitle={subtituloReporte} />
      <main className="px-3 py-4 md:px-5 md:py-6">
        <div className="dms-shell">
          <DmsReportLayout
            title={tituloReporte}
            subtitle={subtituloReporte}
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
                <button
                  type="button"
                  className="dms-link-option"
                  title="Vuelve al escenario inicial: Liquidaciones envía a SBM y Seaboard responde"
                  onClick={() => setDialogo({ tipo: 'REINICIAR_DEMO' })}
                >
                  <RefreshCw className="h-3 w-3" /> Reiniciar datos de prueba
                </button>
                <span className="dms-link-option dms-link-option--disabled">
                  <RefreshCw className="h-3 w-3" /> Generar Estimados desde Inspecciones
                </span>
                {esCoordinador ? (
                  <>
                    <button
                      type="button"
                      className="dms-link-option"
                      onClick={() =>
                        setDialogo({ tipo: 'NUEVO_ESTIMADO', variante: 'Box' })
                      }
                    >
                      <FileText className="h-3 w-3" /> Generar Nueva Estimación Box
                    </button>
                    <button
                      type="button"
                      className="dms-link-option"
                      onClick={() =>
                        setDialogo({ tipo: 'NUEVO_ESTIMADO', variante: 'Máquina' })
                      }
                    >
                      <FileText className="h-3 w-3" /> Generar Nueva Estimación Máquina
                    </button>
                  </>
                ) : (
                  <>
                    <span className="dms-link-option dms-link-option--disabled">
                      <FileText className="h-3 w-3" /> Generar Nueva Estimación Box
                    </span>
                    <span className="dms-link-option dms-link-option--disabled">
                      <FileText className="h-3 w-3" /> Generar Nueva Estimación Máquina
                    </span>
                  </>
                )}
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
              excelFilename="Reporte de Estimaciones Seaboard Marine.xlsx"
              excelHeaders={excelHeadersParaRol(user?.rol)}
              excelRows={filtered.map((e) => rowToExcel(e, user?.rol))}
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
              <div className="dms-danos-table-wrap mx-4 mb-4">
              <div className="dms-table-scroll dms-table-scroll--reporte">
                <table className="dms-table dms-table--reporte">
                  <thead>
                    <tr>
                      {verAlertas && (
                        <th
                          className="dms-reporte-sticky dms-reporte-sticky--alertas w-14 text-center"
                          title="Alertas: sin tarifa · modificado · rechazo · cambio pendiente (pase el mouse sobre el icono)"
                        >
                          Alertas
                        </th>
                      )}
                      <th
                        className={cn(
                          'dms-reporte-sticky dms-reporte-sticky--acciones',
                          verAlertas && 'has-alertas'
                        )}
                      >
                        Acciones
                      </th>
                      <th
                        className={cn(
                          'dms-reporte-sticky dms-reporte-sticky--codigo',
                          verAlertas && 'has-alertas'
                        )}
                      >
                        Codigo
                      </th>
                      <th>Semana</th>
                      <th>Año</th>
                      <th>Estado</th>
                      {verCobro && (
                        <th title="Cobro del estimado (solo lectura; se define dentro del estimado)">Cobro</th>
                      )}
                      <th>Contenedor</th>
                      <th>Modelo Maquina</th>
                      <th>Código RFS</th>
                      <th>Naviera</th>
                      <th>Buque</th>
                      <th>Viaje</th>
                      <th>Actividad</th>
                      <th>Lugar de Estimación</th>
                      <th>Lugar de Asistencia</th>
                      <th>Fecha GateIn</th>
                      <th>Fecha de Elaboración</th>
                      <th>Fecha de Reparación</th>
                      <th>Tipo de Estimación</th>
                      <th>Horas Hombre</th>
                      <th>PVP Horas Hombre</th>
                      <th>PVP Materiales</th>
                      <th>PVP Total</th>
                      <th>Estado PTI</th>
                      <th>Fecha Fin PTI</th>
                      <th>Enviar Aprobacion</th>
                      <th title={etiquetasFecha.envioTitle}>{etiquetasFecha.envio}</th>
                      <th title={etiquetasFecha.revisionTitle}>{etiquetasFecha.revision}</th>
                      <th title={etiquetasFecha.aprobacionTitle}>{etiquetasFecha.aprobacion}</th>
                      {!esSeaboard && <th>Niveles</th>}
                      <th>Dias Estadia</th>
                      <th>Tipo de Daño</th>
                      <th>Análisis de observación</th>
                      <th title={etiquetasFecha.modificacionTitle}>
                        {etiquetasFecha.modificacion}
                      </th>
                      <th>Usuario de Modificacion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((row) => {
                      const pendientes = contarComentariosPendientes(row.danos);
                      const requiereRevision = estimadoRequiereRevisionItems(row);
                      return (
                          <tr
                            key={row.id}
                            className={claseFilaRevisionPendiente({
                              estimacion: row,
                            })}
                            onDoubleClick={() =>
                              router.push(`/reportes/estimaciones/${row.codigo}`)
                            }
                          >
                            {verAlertas && (
                              <td className="dms-reporte-sticky dms-reporte-sticky--alertas align-middle">
                                <AlertasLiquidacionesCell estimacion={row} />
                              </td>
                            )}
                            <td
                              className={cn(
                                'dms-reporte-sticky dms-reporte-sticky--acciones align-top',
                                verAlertas && 'has-alertas'
                              )}
                              onDoubleClick={(e) => e.stopPropagation()}
                            >
                              {accionesDe(row)}
                            </td>
                              <td
                              className={cn(
                                'dms-reporte-sticky dms-reporte-sticky--codigo',
                                verAlertas && 'has-alertas'
                              )}
                            >
                              <div className="flex flex-wrap items-center gap-1">
                                {requiereRevision && (
                                  <IconoAlertaRevisionEstimado estimacion={row} />
                                )}
                                <button
                                  type="button"
                                  className="dms-cell-container-code dms-cell-link"
                                  onClick={() => setDialogo({ tipo: 'PREVIEW_DANOS', id: row.id })}
                                  title="Previsualizar listado de daños"
                                >
                                  {row.codigo}
                                </button>
                                {pendientes > 0 && (
                                  <span
                                    className="dms-pendiente-dot"
                                    title={`${pendientes} cambio(s) solicitados por liquidaciones`}
                                  />
                                )}
                              </div>
                              {esLiquidaciones && <ChipsRetornoSeaboard estimacion={row} />}
                              {esLiquidaciones &&
                                row.auditoria.some(
                                  (a) =>
                                    a.accion.includes('COORDINADOR') ||
                                    /coord/i.test(a.usuario)
                                ) && (
                                  <span
                                    className="mt-1 block rounded bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-sky-800"
                                    title="Creado o modificado por Coordinador · revise historial antes de enviar a la línea"
                                  >
                                    Coordinador · ver historial
                                  </span>
                                )}
                              {esLiquidaciones && enBandejaSeaboard(row) && (
                                <span className="mt-1 block rounded bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-sky-800">
                                  En SBM · {row.estado === 'ENVIADO' ? 'enviado' : 'pendiente'}
                                </span>
                              )}
                            </td>
                            <td className="text-center tabular-nums">{row.semana}</td>
                            <td className="text-center tabular-nums">{row.anio}</td>
                            <td>
                              <EstadoEstimacionBadge
                                estado={
                                  esLiquidaciones
                                    ? estadoVisibleLiquidaciones(row)
                                    : row.estado
                                }
                              />
                              {esLiquidaciones &&
                                esRetornoRechazadoALiquidaciones(row) &&
                                row.estado === 'ENVIADO' && (
                                  <span
                                    className="mt-0.5 block text-[9px] font-medium text-slate-500"
                                    title="Cabecera Seaboard: ENVIADO · Liquidaciones recibe RECHAZADO"
                                  >
                                    (retorno SBM)
                                  </span>
                                )}
                            </td>
                            {verCobro && (
                              <td className="align-middle">
                                {(['PENDIENTE', 'RECHAZADO', 'REVERSADO', 'APROBADO', 'REPARADO'].includes(
                                  row.estado
                                ) && !row.sinDanos) ? (
                                  <span
                                    className={cn(
                                      'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide',
                                      inferirTipoCobro(row) === 'CLIENTE'
                                        ? 'bg-orange-100 text-orange-800 ring-1 ring-orange-300'
                                        : 'bg-indigo-100 text-indigo-900 ring-1 ring-indigo-300'
                                    )}
                                    title="Cobro definido dentro del estimado (solo lectura en el reporte)"
                                  >
                                    {inferirTipoCobro(row) === 'CLIENTE' ? (
                                      <>
                                        <Users className="h-3 w-3" /> Cliente
                                      </>
                                    ) : (
                                      <>
                                        <Ship className="h-3 w-3" /> Línea
                                      </>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400">—</span>
                                )}
                              </td>
                            )}
                            <td className="font-semibold text-rfs-navy">{row.contenedor}</td>
                            <td className="text-xs">{row.modeloMaquina || '—'}</td>
                            <td className="text-center">{row.codigoRfs || '—'}</td>
                            <td className="dms-cell-wrap text-[10px]">{row.naviera}</td>
                            <td className="text-[11px]">{row.buque || '—'}</td>
                            <td className="text-center tabular-nums">{row.viaje || '—'}</td>
                            <td onDoubleClick={(e) => e.stopPropagation()}>
                              {puedeEditarActividad ? (
                                <select
                                  className="dms-select dms-select-actividad"
                                  value={row.actividad}
                                  onChange={(e) => {
                                    setActividad(row.id, e.target.value as Actividad, actor);
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
                              ) : (
                                <span className="text-xs font-semibold text-slate-700">
                                  {row.actividad}
                                </span>
                              )}
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
                            <td
                              className="text-[10px] tabular-nums"
                              title={
                                row.fechaEnvio ? etiquetasFecha.envioTitle : undefined
                              }
                            >
                              {row.fechaEnvio || '—'}
                            </td>
                            <td
                              className="text-[10px] tabular-nums text-gray-500"
                              title={
                                row.fechaRevision ? etiquetasFecha.revisionTitle : undefined
                              }
                            >
                              {row.fechaRevision || '—'}
                            </td>
                            <td
                              className="text-[10px] tabular-nums"
                              title={
                                row.fechaAprobacion
                                  ? etiquetasFecha.aprobacionTitle
                                  : undefined
                              }
                            >
                              {row.fechaAprobacion || '—'}
                            </td>
                            {!esSeaboard && (
                              <td className="dms-cell-wrap max-w-[9rem] text-[10px]">
                                {row.niveles || '—'}
                              </td>
                            )}
                            <td className="text-center tabular-nums">{row.diasEstadia}</td>
                            <td className="text-center text-[10px]">{row.tipoDano || '—'}</td>
                            <td className="dms-cell-wrap max-w-[13rem] text-[10px] text-gray-600">
                              {row.analisisObservacion || '—'}
                            </td>
                            <td
                              className="text-[10px] tabular-nums text-gray-500"
                              title={
                                row.fechaModificacion
                                  ? etiquetasFecha.modificacionTitle
                                  : undefined
                              }
                            >
                              {row.fechaModificacion || '—'}
                            </td>
                            <td className="text-xs">{row.usuarioModificacion || 'N/A'}</td>
                          </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="dms-danos-total">
                      <td colSpan={20} className="text-right">
                        TOTALES DE {filtered.length} REGISTRO(S) FILTRADO(S)
                      </td>
                      <td className="text-right tabular-nums">{totales.hh.toFixed(2)}</td>
                      <td className="text-right tabular-nums">{formatMoney(totales.pvpHh)}</td>
                      <td className="text-right tabular-nums">{formatMoney(totales.pvpMat)}</td>
                      <td className="text-right tabular-nums">{formatMoney(totales.pvpTotal)}</td>
                      <td colSpan={12} />
                    </tr>
                  </tfoot>
                </table>
              </div>
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

      <PreviewListadoDanosModal
        open={dialogo.tipo === 'PREVIEW_DANOS'}
        estimacion={activa}
        onClose={cerrar}
        onAbrirEstimado={(codigo) => {
          cerrar();
          router.push(`/reportes/estimaciones/${codigo}`);
        }}
      />

      <Modal
        open={dialogo.tipo === 'NOTA'}
        onClose={cerrar}
        size="md"
        icon={<Ship className="h-4 w-4" />}
        title={`${esSeaboard ? 'Nota RFS' : 'Nota Seaboard'} · ${activa?.codigo ?? ''}`}
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
            Seaboard Marine no ha registrado notas para esta estimación.
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

      <ConfirmacionEstimacionModal
        open={dialogo.tipo === 'ENVIAR' && user?.rol === 'seaboard'}
        modo="DECISION"
        estimacion={activa}
        onClose={cerrar}
        onEnviar={(comentario) => {
          if (!activa) return;
          if (itemsSinRevisionSbm(activa.danos).length > 0) {
            toast(
              mensajeRevisionItemsPendientes(activa.danos) ?? MSG_ITEMS_SIN_APROBAR,
              'info'
            );
            return;
          }
          enviarALiquidaciones(activa.id, actor, comentario);
          const catalogo = useCatalogoCargoStore.getState().cargos;
          const { paraLiquidaciones, soloRechazosNoBloqueantes, estado } =
            resolverEstadoEnvioALiquidaciones(activa.danos, catalogo);
          notificarEnvioALiquidaciones(activa, comentario, actor, paraLiquidaciones);
          toast(
            soloRechazosNoBloqueantes
              ? `Estimación ${activa.codigo} enviada como APROBADO (cargos no bloqueantes del catálogo).`
              : paraLiquidaciones === 'RECHAZADO'
                ? `Estimación ${activa.codigo} queda ${estado}; liquidaciones la recibe como RECHAZADO.`
                : `Estimación ${activa.codigo} enviada a liquidaciones RFS en estado APROBADO.`,
            'success'
          );
          cerrar();
        }}
      />

      <ConfirmModal
        open={
          (dialogo.tipo === 'ENVIAR' && user?.rol === 'dms') ||
          dialogo.tipo === 'PUSH_SBM'
        }
        title="Enviar a Seaboard Marine"
        subtitle={activa ? `${activa.codigo} · ${activa.contenedor}` : undefined}
        confirmLabel="Confirmar envío a SBM"
        confirmClass="dms-btn-enviar"
        onClose={cerrar}
        onConfirm={() => {
          if (!activa) return;
          if (esLiquidaciones && !puedePushASbm(activa)) {
            toast(
              'Enviar a SBM solo aplica a naviera Seaboard y estimados no enviados (PENDIENTE / RECHAZADO / REVERSADO).',
              'info'
            );
            return;
          }
          enviarAprobacion([activa.id], actor);
          toast(
            `Estimación ${activa.codigo} enviada a Seaboard (estado ENVIADO).`,
            'success'
          );
          cerrar();
        }}
      >
        <p className="text-sm leading-relaxed text-gray-600">
          El estimado se envía al reporte Seaboard en estado <strong>ENVIADO</strong>.
          Cuando el gestor lo apruebe o rechace (con comentarios y cambios), volverá visible aquí
          con el detalle de ítems modificados / rechazados.
        </p>
      </ConfirmModal>

      <ConfirmModal
        open={dialogo.tipo === 'ELIMINAR'}
        title="Eliminar estimación"
        subtitle={activa?.codigo}
        confirmLabel="Eliminar"
        confirmClass="dms-btn-eliminar"
        onClose={cerrar}
        onConfirm={() => {
          if (!activa) return;
          eliminar(activa.id, actor);
          toast(`Estimación ${activa.codigo} eliminada.`, 'success');
          cerrar();
        }}
      >
        <p className="text-sm text-gray-600">
          Se eliminará el estimado del reporte de liquidaciones (prototipo).
        </p>
      </ConfirmModal>

      <ConfirmModal
        open={dialogo.tipo === 'REINICIAR_DEMO'}
        title="Reiniciar datos de prueba"
        subtitle="Escenario desde cero · Línea ↔ Liquidaciones"
        confirmLabel="Reiniciar ahora"
        confirmClass="dms-btn-azul"
        onClose={cerrar}
        onConfirm={() => {
          reset();
          setFiltroActivo(false);
          setPage(1);
          cerrar();
          toast(
            'Datos reiniciados. Liquidaciones: PENDIENTE → Enviar a SBM. Seaboard: ENVIADO → revisar ítems y Enviar.',
            'success'
          );
        }}
      >
        <div className="space-y-2 text-sm text-gray-600">
          <p>
            Se restaurará el escenario inicial de pruebas. Se perderán aprobaciones, rechazos y
            comentarios hechos en esta sesión del navegador.
          </p>
          <ul className="list-disc space-y-1 pl-4 text-[12px]">
            <li>
              <strong>Liquidaciones:</strong> estimados Seaboard en <strong>PENDIENTE</strong> listos
              para <em>Enviar a SBM</em>.
            </li>
            <li>
              <strong>Seaboard (Línea):</strong> estimados en <strong>ENVIADO</strong> con ítems
              pendientes de revisión, listos para aprobar/rechazar y devolver.
            </li>
          </ul>
        </div>
      </ConfirmModal>

      <ComentarioModal
        open={dialogo.tipo === 'REVERSAR_APROB'}
        title="Reversar aprobación"
        subtitle={activa ? `${activa.codigo} · queda REVERSADO` : undefined}
        label="Motivo del reverso"
        confirmLabel="Confirmar reverso"
        confirmClass="dms-btn-reversar"
        onClose={cerrar}
        onConfirm={(comentario) => {
          if (!activa) return;
          reversarAprobacion(activa.id, actor, comentario);
          if (esNavieraSeaboard(activa.naviera)) {
            toast(
              `${activa.codigo} reversado. Puede aperturar y volver a Enviar a SBM.`,
              'success'
            );
          } else {
            toast(`${activa.codigo} reversado. Puede aperturar y modificar.`, 'success');
          }
          cerrar();
        }}
      />

      <ComentarioModal
        open={dialogo.tipo === 'SOLICITAR_REVERSO'}
        title="Solicitar reverso a liquidaciones"
        subtitle={
          activa
            ? `${activa.codigo} · ${activa.contenedor} · mensaje + correo`
            : undefined
        }
        label="Motivo de la solicitud (obligatorio)"
        placeholder="Indique por qué liquidaciones debe reversar este estimado y qué ítems deben modificarse…"
        confirmLabel="Enviar solicitud"
        confirmClass="dms-btn-azul"
        onClose={cerrar}
        onConfirm={(comentario) => {
          if (!activa) return;
          solicitarReversoAprobacion(activa.id, actor, comentario);
          notificarSolicitudReversoALiquidaciones(
            activa,
            comentario,
            actor,
            esCoordinador ? 'Coordinador RFS' : 'Seaboard Marine'
          );
          toast(
            'Solicitud registrada. Se preparó el correo a liquidaciones con el motivo.',
            'success'
          );
          cerrar();
        }}
      />

      <NuevoEstimadoModal
        open={dialogo.tipo === 'NUEVO_ESTIMADO'}
        tipoInicial={dialogo.tipo === 'NUEVO_ESTIMADO' ? dialogo.variante : 'Máquina'}
        navierasSugeridas={opciones.navieras.filter((n) => n !== 'Todas')}
        patiosSugeridos={opciones.patios.filter((p) => p !== 'Todos')}
        onClose={cerrar}
        onCrear={(datos) => {
          const creado = crearEstimado(
            {
              ...datos,
              pais: pais === 'PERU' ? 'PERU' : 'ECUADOR',
            },
            actor
          );
          toast(
            `Estimado ${creado.codigo} creado. Agregue daños y deje el historial para Liquidaciones.`,
            'success'
          );
          cerrar();
          router.push(`/reportes/estimaciones/${creado.codigo}`);
        }}
      />
    </>
  );
}
