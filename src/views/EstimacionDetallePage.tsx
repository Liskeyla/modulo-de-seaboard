'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Database,
  FileStack,
  ListChecks,
  Lock,
  MessageSquare,
  RefreshCw,
  Save,
  Send,
  StickyNote,
  Unlock,
  Upload,
  Users,
  Wrench,
  XCircle,
  Pencil,
  Ship,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { EstadoEstimacionBadge } from '@/components/dms/EstadoEstimacionBadge';
import { ComentarioModal } from '@/components/aprobaciones/ComentarioModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Modal } from '@/components/ui/Modal';
import { rolDeUsuario } from '@/components/estimacion/ComentariosDanoModal';
import { DescargasMenu } from '@/components/estimacion/DescargasMenu';
import { EditarDanoModal } from '@/components/estimacion/EditarDanoModal';
import { GaleriaFotosModal } from '@/components/estimacion/GaleriaFotosModal';
import { HistorialActividadModal } from '@/components/estimacion/HistorialActividadModal';
import { InfoDanoPanel } from '@/components/estimacion/InfoDanoPanel';
import { InfoLateralCards } from '@/components/estimacion/InfoLateralCards';
import { InformePreviewModal } from '@/components/estimacion/InformePreviewModal';
import {
  ConfirmacionEstimacionModal,
  notificarAprobacionALiquidaciones,
  notificarRechazoALiquidaciones,
} from '@/components/estimacion/ConfirmacionEstimacionModal';
import { ListadoDanosTable } from '@/components/estimacion/ListadoDanosTable';
import { AgregarDanoCard } from '@/components/estimacion/AgregarDanoCard';
import { VideoDanoModal } from '@/components/estimacion/VideoDanoModal';
import {
  esNavieraSeaboard,
  puedeValidarLiquidaciones,
} from '@/lib/seaboardFlow';
import { useAuthStore } from '@/store';
import { useEstimacionesStore } from '@/store/estimacionesStore';
import { useUiStore } from '@/store/uiStore';
import {
  contarComentariosPendientes,
  itemsSinRevisionSbm,
  aLineaHistorial,
  snapshotDesdeDano,
  inferirTipoCobro,
  type CampoSnapshotLinea,
  type DanoEstimacion,
  type Estimacion,
  type TipoCobro,
} from '@/types/estimacion';
import { textoComentariosRfs } from '@/components/estimacion/EditarDanoModal';
import { cn, formatMoney, toast } from '@/lib/utils';
import { fotosRealesDano } from '@/lib/fotosDano';

/** Estados en los que el gestor Seaboard puede revisar, modificar y decidir. */
const ESTADOS_SEABOARD = ['ENVIADO', 'PENDIENTE', 'RECHAZADO', 'REVERSADO'];
/** Operador RFS: solo envía estimados a la bandeja Seaboard. */
const ESTADOS_DMS_ENVIO = ['PENDIENTE', 'RECHAZADO', 'REVERSADO'];

type SnapshotApertura = {
  notasCount: number;
  danos: DanoEstimacion[];
};

function capturarSnapshot(est: Estimacion): SnapshotApertura {
  return {
    notasCount: est.notas.length,
    danos: structuredClone(est.danos),
  };
}

function resumirCambiosApertura(snap: SnapshotApertura, est: Estimacion): string[] {
  const items: string[] = [];
  const notasNuevas = est.notas.length - snap.notasCount;
  if (notasNuevas > 0) {
    items.push(`${notasNuevas} nota(s) de estimación agregada(s)`);
  }

  const idsAntes = new Set(snap.danos.map((d) => d.id));
  const idsAhora = new Set(est.danos.map((d) => d.id));
  est.danos.forEach((d) => {
    if (!idsAntes.has(d.id)) items.push(`Línea agregada: ${d.comp} · ${d.dano}`);
  });
  snap.danos.forEach((d) => {
    if (!idsAhora.has(d.id)) items.push(`Línea eliminada: ${d.comp} · ${d.dano}`);
  });

  const campos: (keyof DanoEstimacion)[] = [
    'comp',
    'partNumber',
    'ubicacion',
    'dano',
    'obsAnalisis',
    'newMetRep',
    'serieAnterior',
    'serieEntregado',
    'largo',
    'ancho',
    'cantidad',
    'horasHombre',
    'csHoraHombre',
    'csMaterial',
    'csTotal',
    'cargo',
    'aplica',
    'medida',
    'remark',
    'contenedorDonante',
  ];

  est.danos.forEach((d) => {
    const antes = snap.danos.find((x) => x.id === d.id);
    if (!antes) return;
    const difs: string[] = [];
    campos.forEach((k) => {
      if (String(antes[k] ?? '') !== String(d[k] ?? '')) {
        difs.push(`${String(k)}: «${antes[k] ?? ''}» → «${d[k] ?? ''}»`);
      }
    });
    if (difs.length) {
      items.push(`Línea ${d.linea} (${d.comp}): ${difs.slice(0, 4).join('; ')}${difs.length > 4 ? `… (+${difs.length - 4})` : ''}`);
    }
  });

  return items;
}

type Dialogo =
  | { tipo: 'NINGUNO' }
  | { tipo: 'ENVIAR_SEABOARD' }
  | { tipo: 'ENVIAR_LIQUIDACIONES' }
  | { tipo: 'RECHAZAR_ITEMS' }
  | { tipo: 'RECHAZAR_ITEM'; dano: DanoEstimacion }
  | { tipo: 'EDITAR_DANO'; dano: DanoEstimacion }
  | { tipo: 'FOTOS'; danoId: string | 'TODAS' }
  | { tipo: 'VIDEO'; dano: DanoEstimacion }
  | { tipo: 'HISTORIAL' }
  | { tipo: 'INFORME'; conValores: boolean }
  | { tipo: 'CERRAR_APERTURA'; resumen: string[] }
  | { tipo: 'SALIR_BLOQUEADO' }
  | { tipo: 'SALIR_SIN_ACCION' }
  | { tipo: 'REVERSAR_APROB' }
  | { tipo: 'ELIMINAR_DANO'; danoId: string; linea: number }
  | { tipo: 'PUSH_SBM' };

export default function EstimacionDetallePage({ codigo }: { codigo: string }) {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    estimaciones,
    getByCodigo,
    revalidarTarifas,
    enviarAprobacion,
    validarLiquidaciones,
    aprobar,
    rechazar,
    reversarAprobacion,
    eliminarDano,
    actualizarDano,
    agregarDano,
    setSap,
    setTipoCobro,
    marcarReparado,
    resolverItemsMasivo,
    agregarComentarioDano,
    agregarNota,
    registrarActividad,
  } = useEstimacionesStore();
  const setGuardiaSesion = useUiStore((s) => s.setGuardiaSesion);
  const setAvisoVisualizacion = useUiStore((s) => s.setAvisoVisualizacion);

  const estimacion = useMemo(() => getByCodigo(codigo), [codigo, estimaciones, getByCodigo]);

  const [dialogo, setDialogo] = useState<Dialogo>({ tipo: 'NINGUNO' });
  const [danoSelId, setDanoSelId] = useState<string | null>(null);
  const [nota, setNota] = useState('');
  const [aperturada, setAperturada] = useState(false);
  const [snapshotApertura, setSnapshotApertura] = useState<SnapshotApertura | null>(null);
  const [marcadosIds, setMarcadosIds] = useState<string[]>([]);
  const [itinerarioSap, setItinerarioSapLocal] = useState('');
  const [almacenSap, setAlmacenSapLocal] = useState('');
  const snapshotRef = useRef<SnapshotApertura | null>(null);
  const vistaRegistradaRef = useRef<string | null>(null);

  useEffect(() => {
    snapshotRef.current = snapshotApertura;
  }, [snapshotApertura]);

  useEffect(() => {
    if (!estimacion) return;
    setItinerarioSapLocal(estimacion.itinerarioSap || '');
    setAlmacenSapLocal(estimacion.almacenSap || '');
  }, [estimacion?.id, estimacion?.itinerarioSap, estimacion?.almacenSap]);

  useEffect(() => {
    if (!estimacion) return;
    if (vistaRegistradaRef.current === estimacion.id) return;
    vistaRegistradaRef.current = estimacion.id;
    const u = useAuthStore.getState().user;
    const usuarioVista =
      u?.nombre && u.username && u.nombre !== u.username
        ? `${u.nombre} (${u.username})`
        : (u?.username ?? 'seaboard');
    registrarActividad(
      estimacion.id,
      usuarioVista,
      'Visualización Estimación',
      `${usuarioVista} visualizó la estimación`,
      estimacion.danos.map(aLineaHistorial)
    );
  }, [estimacion, registrarActividad]);

  useEffect(() => {
    if (!estimacion) return;
    setDanoSelId((prev) =>
      prev && estimacion.danos.some((d) => d.id === prev) ? prev : (estimacion.danos[0]?.id ?? null)
    );
  }, [estimacion]);

  useEffect(() => {
    if (!aperturada) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [aperturada]);

  useEffect(() => {
    if (!aperturada || !estimacion) {
      setGuardiaSesion(null);
      return;
    }
    const idEst = estimacion.id;
    const codigoEst = estimacion.codigo;
    setAvisoVisualizacion(null);
    setGuardiaSesion({
      codigo: codigoEst,
      getResumen: () => {
        const snap = snapshotRef.current;
        const est = useEstimacionesStore.getState().getByCodigo(codigoEst);
        if (!snap || !est) return [];
        return resumirCambiosApertura(snap, est);
      },
      guardarYLiberar: () => {
        setAperturada(false);
        setSnapshotApertura(null);
        setMarcadosIds([]);
        setGuardiaSesion(null);
      },
      descartarYLiberar: () => {
        const snap = snapshotRef.current;
        if (snap) {
          useEstimacionesStore.getState().restaurarDesdeApertura(idEst, snap);
        }
        setAperturada(false);
        setSnapshotApertura(null);
        setMarcadosIds([]);
        setGuardiaSesion(null);
      },
    });
    return () => setGuardiaSesion(null);
  }, [aperturada, estimacion?.id, estimacion?.codigo, setGuardiaSesion, setAvisoVisualizacion]);

  const usuario = user?.username ?? 'seaboard';
  /** Etiqueta visible en historial / comentarios (nombre + login). */
  const actor =
    user?.nombre && user.nombre !== usuario
      ? `${user.nombre} (${usuario})`
      : usuario;
  const rolComentario = rolDeUsuario(user?.rol, user?.username);
  const cerrar = () => setDialogo({ tipo: 'NINGUNO' });

  if (!estimacion) {
    return (
      <>
        <Header title="Estimación no encontrada" subtitle="Detalle de estimado" />
        <main className="px-3 py-4 md:px-5 md:py-6">
          <div className="dms-shell">
            <div className="dms-empty-state">
              <div className="dms-empty-icon">
                <AlertTriangle className="h-7 w-7" />
              </div>
              <p className="text-sm font-semibold text-gray-700">
                No existe la estimación {codigo}
              </p>
              <p className="mt-1 max-w-sm text-xs text-gray-500">
                Puede que haya sido eliminada del prototipo. Vuelva al reporte para elegir otra.
              </p>
              <button
                type="button"
                className="dms-btn-primary mt-4 px-4 py-2 text-sm"
                onClick={() => router.push('/reportes/estimaciones')}
              >
                <ArrowLeft className="h-4 w-4" /> Volver al reporte
              </button>
            </div>
          </div>
        </main>
      </>
    );
  }

  const esOperadorDms = user?.rol === 'dms';
  const esSeaboard = user?.rol === 'seaboard';
  const esLiquidaciones = user?.rol === 'liquidaciones';
  const esSeaboardNav = esNavieraSeaboard(estimacion.naviera);
  /**
   * Gestor Seaboard: aperturar · modificar · aprobar/rechazar ítems y estimado.
   * Liquidaciones: validar · enviar a SBM (Seaboard) · reversar aprobación · eliminar · ítems.
   */
  const puedeRevisarItems =
    esSeaboard && ESTADOS_SEABOARD.includes(estimacion.estado);
  const puedeEditarLiquidaciones =
    esLiquidaciones &&
    ['PENDIENTE', 'RECHAZADO', 'REVERSADO', 'APROBADO', 'REPARADO'].includes(
      estimacion.estado
    );
  /** Vista post-aprobación Liquidaciones (como DMS). */
  const vistaAprobadoLiq =
    esLiquidaciones && estimacion.estado === 'APROBADO';
  const vistaReparadoLiq =
    esLiquidaciones && estimacion.estado === 'REPARADO';
  const vistaCerradaLiq = vistaAprobadoLiq || vistaReparadoLiq;
  const puedeAperturar =
    (puedeRevisarItems || puedeEditarLiquidaciones) && !vistaCerradaLiq;
  const editable = aperturada && (esSeaboard || esLiquidaciones);
  /** Liquidaciones puede cargar evidencias (fotos, PDF, video, data log) al aperturar. */
  const puedeCargarEvidencias =
    (editable && (esLiquidaciones || esSeaboard)) || vistaCerradaLiq;
  const puedeEnviarLiquidaciones =
    esSeaboard && ESTADOS_SEABOARD.includes(estimacion.estado);
  const puedeEnviarASeaboard =
    esSeaboardNav &&
    estimacion.enviarAprobacion !== 'SI' &&
    ESTADOS_DMS_ENVIO.includes(estimacion.estado) &&
    (esOperadorDms || (esLiquidaciones && !!estimacion.validadoLiquidaciones));
  const puedeValidarLiq =
    esLiquidaciones && puedeValidarLiquidaciones(estimacion);
  /** Solo APROBADO: se puede reparar o reversar. REPARADO ya no. */
  const puedeReversarAprobLiq = vistaAprobadoLiq;
  const puedeRepararLiq = vistaAprobadoLiq;
  /** APROBADO y REPARADO: Actualizar Información Contenedor. */
  const puedeActualizarContenedorLiq = vistaCerradaLiq;
  const puedeDefinirCobroLiq =
    esLiquidaciones &&
    ['PENDIENTE', 'RECHAZADO', 'REVERSADO', 'APROBADO', 'REPARADO'].includes(
      estimacion.estado
    );
  const tipoCobroActual = inferirTipoCobro(estimacion);
  const puedeComentar = esSeaboard || esLiquidaciones;
  /** Pendiente: SAP + Agregar daño + notas (inhabilitados hasta aperturar). */
  const mostrarAgregarDanoLiq =
    esLiquidaciones &&
    ['PENDIENTE', 'RECHAZADO', 'REVERSADO'].includes(estimacion.estado);
  /** APROBADO/REPARADO/PENDIENTE: SAP y notas visibles. */
  const mostrarSapNotasLiq = mostrarAgregarDanoLiq || vistaCerradaLiq;
  /** En APROBADO/REPARADO los campos van habilitados (sin aperturar). */
  const formulariosLiqActivos = vistaCerradaLiq || aperturada;
  const puedeEditarNotas = editable || mostrarSapNotasLiq;
  const puedeRevalidar = editable && (esSeaboard || esLiquidaciones);
  const danoSeleccionado = estimacion.danos.find((d) => d.id === danoSelId) ?? null;
  const pendientes = contarComentariosPendientes(estimacion.danos);
  const itemsPendientesRevision = itemsSinRevisionSbm(estimacion.danos);

  // Mientras visualiza un estimado accionable (sin aperturar), avisar al cambiar país.
  useEffect(() => {
    if (aperturada) return;
    const seaboardPendiente =
      esSeaboard && ESTADOS_SEABOARD.includes(estimacion.estado);
    if (!seaboardPendiente) {
      setAvisoVisualizacion(null);
      return;
    }
    const codigoEst = estimacion.codigo;
    const idEst = estimacion.id;
    setAvisoVisualizacion({
      codigo: codigoEst,
      itemsPendientes: itemsPendientesRevision.length,
      confirmarSoloVisualizacion: () => {
        const u = useAuthStore.getState().user;
        const quien =
          u?.nombre && u.username && u.nombre !== u.username
            ? `${u.nombre} (${u.username})`
            : (u?.username ?? 'seaboard');
        useEstimacionesStore.getState().registrarActividad(
          idEst,
          quien,
          'Salió sin decisión (solo visualización)',
          `${quien} confirmó salida del estimado ${codigoEst} sin aprobar/rechazar`
        );
        setAvisoVisualizacion(null);
      },
    });
    return () => setAvisoVisualizacion(null);
  }, [
    aperturada,
    esSeaboard,
    estimacion.estado,
    estimacion.codigo,
    estimacion.id,
    itemsPendientesRevision.length,
    setAvisoVisualizacion,
  ]);

  const fotosDialogo =
    dialogo.tipo === 'FOTOS'
      ? dialogo.danoId === 'TODAS'
        ? estimacion.danos.flatMap((d) => fotosRealesDano(d.fotos))
        : fotosRealesDano(
            estimacion.danos.find((d) => d.id === dialogo.danoId)?.fotos ?? []
          )
      : [];

  function exigirApertura(): boolean {
    if (!puedeAperturar || aperturada) return false;
    toast('Aperture la estimación para modificar ítems.', 'info');
    return true;
  }

  function aperturarEstimacion() {
    setSnapshotApertura(capturarSnapshot(estimacion!));
    setAperturada(true);
    setMarcadosIds([]);
    registrarActividad(
      estimacion!.id,
      actor,
      'Aperturó estimado en el aplicativo',
      `${actor} aperturó ${estimacion!.codigo} para modificación de ítems`,
      estimacion!.danos.map(aLineaHistorial)
    );
    toast('Estimación aperturada. Ya puede modificar ítems.', 'success');
  }

  function solicitarCerrarApertura() {
    const resumen = snapshotApertura
      ? resumirCambiosApertura(snapshotApertura, estimacion!)
      : [];
    setDialogo({ tipo: 'CERRAR_APERTURA', resumen });
  }

  function confirmarCerrarApertura() {
    const resumen = snapshotApertura
      ? resumirCambiosApertura(snapshotApertura, estimacion!)
      : [];
    const detalle =
      resumen.length > 0
        ? resumen.join(' | ')
        : 'Cierre sin cambios detectados respecto a la apertura';
    registrarActividad(
      estimacion!.id,
      actor,
      'Cerró estimado en el aplicativo',
      `${actor}: ${detalle}`,
      estimacion!.danos.map(aLineaHistorial)
    );
    setAperturada(false);
    setSnapshotApertura(null);
    setMarcadosIds([]);
    toast('Estimación cerrada. Cambios guardados.', 'success');
  }

  function aprobarItemsMarcados() {
    if (!aperturada) {
      toast('Aperture la estimación para modificar ítems.', 'info');
      return;
    }
    if (marcadosIds.length === 0) {
      toast('Marque al menos un ítem del listado de daños.', 'info');
      return;
    }
    resolverItemsMasivo(estimacion!.id, marcadosIds, 'APROBAR', actor);
    toast(`${marcadosIds.length} ítem(s) aprobado(s).`, 'success');
    setMarcadosIds([]);
  }

  function rechazarItemsMarcados() {
    if (!aperturada) {
      toast('Aperture la estimación para modificar ítems.', 'info');
      return;
    }
    if (marcadosIds.length === 0) {
      toast('Marque al menos un ítem del listado de daños.', 'info');
      return;
    }
    setDialogo({ tipo: 'RECHAZAR_ITEMS' });
  }

  function confirmarRechazoItems(comentario: string, danoIds: string[]) {
    resolverItemsMasivo(estimacion!.id, danoIds, 'RECHAZAR', actor, comentario);
    toast(`${danoIds.length} ítem(s) rechazado(s) con motivo registrado.`, 'success');
    setMarcadosIds([]);
    cerrar();
  }

  function intentarRegresar() {
    if (aperturada) {
      setDialogo({ tipo: 'SALIR_BLOQUEADO' });
      return;
    }
    // Gestor Seaboard: recordar que debe decidir o confirmar solo visualización.
    if (puedeEnviarLiquidaciones) {
      setDialogo({ tipo: 'SALIR_SIN_ACCION' });
      return;
    }
    router.push('/reportes/estimaciones');
  }

  function salirSoloVisualizacion() {
    useUiStore.getState().avisoVisualizacion?.confirmarSoloVisualizacion();
    setAvisoVisualizacion(null);
    cerrar();
    router.push('/reportes/estimaciones');
  }

  function continuarRevision() {
    cerrar();
    if (itemsPendientesRevision.length > 0) {
      toast(
        'Aperture la estimación, apruebe o rechace los ítems y luego envíe a liquidaciones RFS.',
        'info'
      );
      return;
    }
    if (puedeEnviarLiquidaciones) {
      setDialogo({ tipo: 'ENVIAR_LIQUIDACIONES' });
    }
  }

  function marcarEdicionDano(
    dano: DanoEstimacion,
    cambios: Partial<DanoEstimacion>,
    resumen: string,
    comentarioSbm?: string
  ) {
    if (exigirApertura()) return;
    const ahora = new Date().toLocaleString('es-EC', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const mezclado: DanoEstimacion = {
      ...dano,
      ...cambios,
      csTotal:
        Number(cambios.csHoraHombre ?? dano.csHoraHombre) +
        Number(cambios.csMaterial ?? dano.csMaterial),
    };
    const snapshot = snapshotDesdeDano(mezclado);
    const antes = snapshotDesdeDano(dano);
    const camposCambiados = (Object.keys(snapshot) as CampoSnapshotLinea[]).filter(
      (k) => String(antes[k] ?? '') !== String(snapshot[k] ?? '')
    );
    const rfsExistente = textoComentariosRfs(dano);
    const sbm = comentarioSbm?.trim();

    actualizarDano(
      estimacion!.id,
      dano.id,
      {
        ...cambios,
        edicionReciente: {
          fecha: ahora,
          usuario: actor,
          resumenCambios: resumen,
          snapshot,
          snapshotAnterior: antes,
          camposCambiados,
          ...(sbm ? { comentarioSbm: sbm } : {}),
          comentarioRfs: rfsExistente.startsWith('Sin comentarios')
            ? undefined
            : rfsExistente,
        },
      },
      actor,
      `Línea ${dano.linea} · ${resumen}`
    );

    if (sbm) {
      agregarComentarioDano(estimacion!.id, dano.id, {
        usuario: actor,
        rol: 'SEABOARD',
        tipo: 'INFORMATIVO',
        mensaje: sbm,
        campoAfectado: 'Motivo del cambio',
      });
    }
  }

  function cambiarDano(dano: DanoEstimacion, cambios: Partial<DanoEstimacion>, resumen: string) {
    marcarEdicionDano(dano, cambios, resumen);
  }

  function guardarEdicionDano(
    dano: DanoEstimacion,
    cambios: Partial<DanoEstimacion>,
    resumen: string,
    comentarios: { sbm: string; rfs: string }
  ) {
    marcarEdicionDano(dano, cambios, resumen, comentarios.sbm);
  }

  return (
    <>
      <Header
        title="Detalle de estimado"
        subtitle="Reportes · Estimaciones"
      />

      <main className="px-3 py-4 md:px-5 md:py-6">
        <div className="dms-shell space-y-3">
          <div className="dms-detalle-hero">
            <div className="min-w-0">
              <h1>Estimación {estimacion.codigo}</h1>
              <p>
                {estimacion.contenedor} - {estimacion.codigoRfs} {estimacion.tipoContenedor} -{' '}
                {estimacion.naviera}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <EstadoEstimacionBadge estado={estimacion.estado} />
              <span className="dms-hero-chip">
                {estimacion.danos.length} línea(s) de daño
              </span>
              <span className="dms-hero-chip dms-hero-chip--money">
                Total ${formatMoney(estimacion.pvpTotal)}
              </span>
              {estimacion.fechaEnvio && (esSeaboard || esLiquidaciones) && (
                <span
                  className="dms-hero-chip"
                  title={
                    esLiquidaciones
                      ? 'Fecha en que envió el estimado a aprobar (reporte Seaboard)'
                      : 'Fecha de recepción · envío desde Liquidaciones a Línea'
                  }
                >
                  {esLiquidaciones ? 'Envío a Línea' : 'Recepción Línea'} ·{' '}
                  {estimacion.fechaEnvio}
                </span>
              )}
              {estimacion.fechaAprobacion && (esSeaboard || esLiquidaciones) && (
                <span
                  className="dms-hero-chip"
                  title="Fecha en que Seaboard aprobó el estimado"
                >
                  Aprobación SBM · {estimacion.fechaAprobacion}
                </span>
              )}
              {estimacion.fechaModificacion && (esSeaboard || esLiquidaciones) && (
                <span
                  className="dms-hero-chip"
                  title="Última modificación del estimado"
                >
                  Modificación · {estimacion.fechaModificacion}
                </span>
              )}
              {pendientes > 0 && (
                <span className="dms-hero-chip dms-hero-chip--alerta">
                  <MessageSquare className="h-3 w-3" /> {pendientes} cambio(s) solicitados
                </span>
              )}
            </div>
          </div>

          <div className="dms-detalle-toolbar">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="dms-btn-regresar"
                onClick={intentarRegresar}
              >
                <ArrowLeft className="h-4 w-4" /> Regresar
              </button>
              {puedeAperturar && !aperturada && (
                <button
                  type="button"
                  className="dms-btn-aperturar"
                  onClick={aperturarEstimacion}
                >
                  <Unlock className="h-4 w-4" /> Aperturar estimación
                </button>
              )}
              {aperturada && (
                <button
                  type="button"
                  className="dms-btn-cerrar-est"
                  onClick={solicitarCerrarApertura}
                >
                  <Lock className="h-4 w-4" /> Cerrar estimación
                </button>
              )}
              {aperturada && (
                <span className="dms-hero-chip dms-hero-chip--alerta">
                  <Unlock className="h-3 w-3" /> Estimación aperturada
                </span>
              )}
              {puedeRepararLiq && (
                <button
                  type="button"
                  className="dms-btn-reparar"
                  onClick={() => {
                    marcarReparado(estimacion.id, actor);
                    toast(
                      `Estimación ${estimacion.codigo} marcada como REPARADO.`,
                      'success'
                    );
                  }}
                >
                  <Wrench className="h-4 w-4" /> Reparar
                </button>
              )}
              {puedeActualizarContenedorLiq && (
                <button
                  type="button"
                  className="dms-btn-azul"
                  onClick={() => {
                    registrarActividad(
                      estimacion.id,
                      actor,
                      'Actualizó información del contenedor',
                      `${actor} actualizó información del contenedor ${estimacion.contenedor}`
                    );
                    toast(
                      'Información del contenedor actualizada (prototipo).',
                      'success'
                    );
                  }}
                >
                  <Pencil className="h-4 w-4" /> Actualizar Información Contenedor
                </button>
              )}
              {puedeDefinirCobroLiq && (
                <div
                  className="dms-cobro-toggle"
                  title="Define si el cobro del estimado es al Cliente o a la Línea"
                >
                  <span className="dms-cobro-toggle__label">Cobro</span>
                  <button
                    type="button"
                    className={cn(
                      'dms-cobro-btn',
                      tipoCobroActual === 'CLIENTE' && 'dms-cobro-btn--on-cliente'
                    )}
                    onClick={() => {
                      const tipo: TipoCobro = 'CLIENTE';
                      if (tipoCobroActual === tipo) return;
                      setTipoCobro(estimacion.id, tipo, actor);
                      toast('Cobro marcado al Cliente.', 'success');
                    }}
                  >
                    <Users className="h-3.5 w-3.5" /> Cliente
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'dms-cobro-btn',
                      tipoCobroActual === 'LINEA' && 'dms-cobro-btn--on-linea'
                    )}
                    onClick={() => {
                      const tipo: TipoCobro = 'LINEA';
                      if (tipoCobroActual === tipo) return;
                      setTipoCobro(estimacion.id, tipo, actor);
                      toast('Cobro marcado a la Línea.', 'success');
                    }}
                  >
                    <Ship className="h-3.5 w-3.5" /> Línea
                  </button>
                </div>
              )}
              {puedeRevalidar && (
                <button
                  type="button"
                  className="dms-btn-azul"
                  onClick={() => {
                    if (exigirApertura()) return;
                    revalidarTarifas(estimacion.id, actor);
                    toast(
                      `Tarifas revalidadas sobre ${estimacion.danos.length} línea(s).`,
                      'success'
                    );
                  }}
                >
                  <RefreshCw className="h-4 w-4" /> Revalidar Tarifas
                </button>
              )}
              {!vistaCerradaLiq && (
                <button
                  type="button"
                  className="dms-btn-azul"
                  onClick={() => setDialogo({ tipo: 'FOTOS', danoId: 'TODAS' })}
                >
                  <FileStack className="h-4 w-4" /> Ver evidencias
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
              {puedeValidarLiq && (
                <button
                  type="button"
                  className="dms-btn-aprobar"
                  onClick={() => {
                    validarLiquidaciones(estimacion.id, actor);
                    toast('Estimado validado por liquidaciones.', 'success');
                  }}
                >
                  <CheckCircle2 className="h-4 w-4" /> Validar liquidaciones
                </button>
              )}
              {puedeReversarAprobLiq && (
                <button
                  type="button"
                  className="dms-btn-reversar"
                  onClick={() => setDialogo({ tipo: 'REVERSAR_APROB' })}
                >
                  Reversar aprobación
                </button>
              )}
              {puedeEnviarLiquidaciones && (
                <button
                  type="button"
                  className="dms-btn-enviar"
                  disabled={estimacion.danos.length === 0 || aperturada}
                  title={
                    aperturada
                      ? 'Cierre la estimación antes de aprobar o rechazar'
                      : 'Aprobar o rechazar el estimado hacia liquidaciones RFS'
                  }
                  onClick={() => {
                    if (aperturada) {
                      toast(
                        'Cierre la estimación antes de aprobar o rechazar el estimado.',
                        'info'
                      );
                      return;
                    }
                    if (itemsPendientesRevision.length > 0) {
                      toast(
                        'Primero apruebe o rechace cada ítem de daño.\nAperture la estimación y use «Aprobar ítems» / «Rechazar ítems».',
                        'info'
                      );
                      return;
                    }
                    setDialogo({ tipo: 'ENVIAR_LIQUIDACIONES' });
                  }}
                >
                  <Send className="h-4 w-4" /> Aprobar / Rechazar
                </button>
              )}
              {puedeEnviarASeaboard && (
                <button
                  type="button"
                  className="dms-btn-enviar"
                  disabled={estimacion.danos.length === 0 || aperturada}
                  title={
                    aperturada
                      ? 'Cierre la estimación antes del enviar a SBM'
                      : esLiquidaciones
                        ? 'Enviar a SBM · el estimado queda pendiente en el reporte Seaboard'
                        : 'Enviar a Seaboard Marine'
                  }
                  onClick={() => {
                    if (aperturada) {
                      toast('Cierre la estimación antes de enviarla a Seaboard Marine.', 'info');
                      return;
                    }
                    if (esLiquidaciones && !estimacion.validadoLiquidaciones) {
                      toast('Primero valide el estimado con liquidaciones.', 'info');
                      return;
                    }
                    setDialogo({ tipo: 'ENVIAR_SEABOARD' });
                  }}
                >
                  <Upload className="h-4 w-4" />{' '}
                  {esLiquidaciones ? 'Enviar a SBM' : 'Enviar a Seaboard'}
                </button>
              )}
              {estimacion.estado === 'ENVIADO' && esOperadorDms && (
                <span className="dms-aviso-espera">
                  <Send className="h-3.5 w-3.5" /> En revisión Seaboard Marine
                </span>
              )}
              {estimacion.estado === 'APROBADO' && esSeaboard && (
                <span className="dms-aviso-espera">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Aprobado · enviado a liquidaciones
                </span>
              )}
              {estimacion.estado === 'RECHAZADO' && esSeaboard && (
                <span className="dms-aviso-espera">
                  <XCircle className="h-3.5 w-3.5" /> Rechazado · puede volver a revisar
                </span>
              )}
              <DescargasMenu
                estimacion={estimacion}
                onPrevisualizarInforme={(conValores) => setDialogo({ tipo: 'INFORME', conValores })}
                onVerHistorial={() => setDialogo({ tipo: 'HISTORIAL' })}
              />
            </div>
          </div>

          <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0 space-y-3">
              {mostrarSapNotasLiq && (
                <section className="dms-card">
                  <header className="dms-card-header">
                    <Database className="h-3.5 w-3.5" /> Información SAP
                  </header>
                  <div className="dms-card-body grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="dms-field-label">Itinerario Sap</label>
                      <input
                        className="dms-input-sm"
                        value={itinerarioSap}
                        placeholder="digitar descripcion"
                        disabled={!formulariosLiqActivos}
                        onChange={(e) => setItinerarioSapLocal(e.target.value)}
                        onBlur={() => {
                          if (!formulariosLiqActivos) return;
                          if (itinerarioSap === (estimacion.itinerarioSap || '')) return;
                          setSap(estimacion.id, { itinerarioSap }, actor);
                        }}
                        onFocus={() => {
                          if (!formulariosLiqActivos) {
                            toast('Aperture la estimación para editar SAP.', 'info');
                          }
                        }}
                      />
                    </div>
                    <div>
                      <label className="dms-field-label">Almacen Sap</label>
                      <select
                        className="dms-select h-9 w-full text-xs"
                        value={almacenSap}
                        disabled={!formulariosLiqActivos}
                        onChange={(e) => {
                          const v = e.target.value;
                          setAlmacenSapLocal(v);
                          if (!formulariosLiqActivos) return;
                          setSap(estimacion.id, { almacenSap: v }, actor);
                        }}
                        onFocus={() => {
                          if (!formulariosLiqActivos) {
                            toast('Aperture la estimación para editar SAP.', 'info');
                          }
                        }}
                      >
                        <option value="">Seleccione un Almacen Sap</option>
                        <option value="RFS1">RFS 1</option>
                        <option value="RFS2">RFS 2</option>
                        <option value="PATIO-EC">Patio Ecuador</option>
                        <option value="PATIO-PE">Patio Perú</option>
                      </select>
                    </div>
                  </div>
                </section>
              )}

              {mostrarAgregarDanoLiq && (
                <AgregarDanoCard
                  editable={aperturada}
                  seccionSugerida={
                    estimacion.tipoEstimacion.toUpperCase().includes('BOX')
                      ? 'ESTRUCTURAL'
                      : 'MAQUINA'
                  }
                  onAgregar={(dano) => {
                    if (!aperturada) {
                      toast('Aperture la estimación para agregar daños.', 'info');
                      return;
                    }
                    agregarDano(estimacion.id, dano, actor);
                    toast('Daño agregado al listado.', 'success');
                  }}
                />
              )}

              <section className="dms-card">
                <header className="dms-card-header">
                  <StickyNote className="h-3.5 w-3.5" /> Notas de Estimación
                </header>
                <div className="dms-card-body">
                  {puedeEditarNotas ? (
                    <>
                      <textarea
                        rows={3}
                        className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-xs shadow-sm transition-colors focus:border-rfsorange-500 focus:outline-none focus:ring-2 focus:ring-rfsorange-500/20 disabled:bg-slate-50 disabled:text-slate-500"
                        value={nota}
                        placeholder="Escriba una nota para el estimado…"
                        disabled={mostrarSapNotasLiq ? !formulariosLiqActivos : !editable}
                        onChange={(e) => {
                          if (mostrarSapNotasLiq && !formulariosLiqActivos) {
                            toast('Aperture la estimación para agregar notas.', 'info');
                            return;
                          }
                          if (!vistaCerradaLiq && exigirApertura()) return;
                          setNota(e.target.value);
                        }}
                        onFocus={() => {
                          if (
                            !formulariosLiqActivos &&
                            (mostrarAgregarDanoLiq || puedeAperturar)
                          ) {
                            toast('Aperture la estimación para modificar ítems.', 'info');
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="dms-btn-primary mt-2 px-4 py-2 text-sm disabled:opacity-50"
                        disabled={
                          nota.trim().length < 3 ||
                          (mostrarSapNotasLiq ? !formulariosLiqActivos : !aperturada)
                        }
                        onClick={() => {
                          if (!vistaCerradaLiq && exigirApertura()) return;
                          if (vistaCerradaLiq && !formulariosLiqActivos) return;
                          agregarNota(estimacion.id, nota.trim(), actor);
                          setNota('');
                          toast('Nota agregada al estimado.', 'success');
                        }}
                      >
                        {formulariosLiqActivos || !mostrarSapNotasLiq ? (
                          <Save className="h-4 w-4" />
                        ) : (
                          <Lock className="h-4 w-4" />
                        )}{' '}
                        Agregar
                      </button>
                    </>
                  ) : estimacion.notas.length === 0 ? (
                    <p className="text-[11px] text-slate-400">Sin notas registradas.</p>
                  ) : null}

                  {estimacion.notas.length > 0 && (
                    <ul className={cn('space-y-2', puedeEditarNotas && 'mt-3')}>
                      {estimacion.notas.map((n) => (
                        <li key={n.id} className="dms-nota-item">
                          <div className="flex items-center gap-2">
                            <span className="dms-chip-user">{n.usuario}</span>
                            <span className="text-[10px] tabular-nums text-gray-400">{n.fecha}</span>
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-gray-700">{n.texto}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>

            <section className="dms-card min-w-0">
            <header className="dms-card-header">
              <ListChecks className="h-3.5 w-3.5" /> Listado de Daños
            </header>
            <div className="p-3 bg-white">
              <div className="dms-info-box mb-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-200/60 text-xs font-bold">
                  i
                </span>
                <div className="min-w-0 truncate">
                  {puedeAperturar && !aperturada
                    ? 'Aperture para modificar ítems (queda histórico), aprobar/rechazar cada línea y luego el estimado.'
                    : 'Seleccione un daño para ver su detalle a la derecha.'}
                </div>
              </div>

              {puedeRevisarItems && (
                <div className="dms-danos-acciones-masivas">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="dms-btn-aprobar px-3 py-1.5 text-xs"
                      title={
                        !aperturada
                          ? 'Aperture la estimación para aprobar ítems'
                          : marcadosIds.length === 0
                            ? 'Marque al menos un ítem'
                            : undefined
                      }
                      onClick={aprobarItemsMarcados}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Aprobar ítems
                      {marcadosIds.length > 0 ? ` (${marcadosIds.length})` : ''}
                    </button>
                    <button
                      type="button"
                      className="dms-btn-rechazar px-3 py-1.5 text-xs"
                      title={
                        !aperturada
                          ? 'Aperture la estimación para rechazar ítems'
                          : marcadosIds.length === 0
                            ? 'Marque al menos un ítem'
                            : undefined
                      }
                      onClick={rechazarItemsMarcados}
                    >
                      <XCircle className="h-3.5 w-3.5" /> Rechazar ítems
                      {marcadosIds.length > 0 ? ` (${marcadosIds.length})` : ''}
                    </button>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {!aperturada
                      ? 'Aperture la estimación para marcar y aprobar/rechazar ítems'
                      : marcadosIds.length === 0
                        ? 'Marque ítems con el check a la izquierda de ⓘ'
                        : `${marcadosIds.length} ítem(s) marcado(s)`}
                  </span>
                </div>
              )}

              <div className="dms-danos-table-wrap">
              <ListadoDanosTable
                danos={estimacion.danos}
                seleccionadoId={danoSelId}
                editable={editable}
                cargoAplicaEditable={aperturada && puedeAperturar}
                mostrarDimensiones={estimacion.tipoEstimacion.toUpperCase().includes('BOX')}
                mostrarMarcacion={puedeAperturar}
                marcacionHabilitada={aperturada}
                marcadosIds={marcadosIds}
                onToggleMarcado={(id) => {
                  if (!aperturada) {
                    toast('Aperture la estimación para modificar ítems.', 'info');
                    return;
                  }
                  setMarcadosIds((prev) =>
                    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                  );
                }}
                onToggleTodos={(marcar) => {
                  if (!aperturada) {
                    toast('Aperture la estimación para modificar ítems.', 'info');
                    return;
                  }
                  setMarcadosIds(marcar ? estimacion.danos.map((d) => d.id) : []);
                }}
                onSeleccionar={(d) => {
                  setDanoSelId((prev) => (prev === d.id ? null : d.id));
                  if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1279px)').matches) {
                    window.setTimeout(() => {
                      document
                        .getElementById('panel-derecho-estimacion')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 50);
                  }
                }}
                onRemarkChange={(d, remark) => {
                  if (exigirApertura()) return;
                  cambiarDano(d, { remark }, `Línea ${d.linea} · Remark actualizado: "${remark}"`);
                }}
                onDonanteChange={(d, contenedorDonante) => {
                  if (exigirApertura()) return;
                  cambiarDano(
                    d,
                    { contenedorDonante },
                    `Línea ${d.linea} · Contenedor donante: "${contenedorDonante}"`
                  );
                }}
                onCargoChange={(d, cargo) => {
                  if (exigirApertura()) return;
                  cambiarDano(d, { cargo }, `Línea ${d.linea} · Cargo: ${cargo}`);
                }}
                onAplicaChange={(d, aplica) => {
                  if (exigirApertura()) return;
                  const extra =
                    aplica === 'Rechazado SBM'
                      ? {
                          cargo: 'Rechazado' as const,
                          horasHombre: 0,
                          csHoraHombre: 0,
                          csMaterial: 0,
                          csTotal: 0,
                        }
                      : {};
                  cambiarDano(
                    d,
                    { aplica, ...extra },
                    aplica === 'Rechazado SBM'
                      ? `Línea ${d.linea} · Rechazado · valores en $0`
                      : `Línea ${d.linea} · Aplica: ${aplica}`
                  );
                }}
                onEditar={(d) => {
                  if (!editable) {
                    toast(
                      puedeAperturar
                        ? 'Aperture la estimación para modificar ítems.'
                        : 'No tiene permiso para modificar ítems.',
                      'info'
                    );
                    return;
                  }
                  setDialogo({ tipo: 'EDITAR_DANO', dano: d });
                }}
                onEliminar={
                  esLiquidaciones || esSeaboard
                    ? (d) => {
                        if (!editable) {
                          toast(
                            puedeAperturar
                              ? 'Aperture la estimación para eliminar ítems.'
                              : 'No tiene permiso para eliminar ítems.',
                            'info'
                          );
                          return;
                        }
                        setDialogo({
                          tipo: 'ELIMINAR_DANO',
                          danoId: d.id,
                          linea: d.linea,
                        });
                      }
                    : undefined
                }
                onFotos={(d) => setDialogo({ tipo: 'FOTOS', danoId: d.id })}
                onVideo={(d) => setDialogo({ tipo: 'VIDEO', dano: d })}
                comentarioUsuario={actor}
                comentarioRol={rolComentario}
                comentariosSoloLectura={!puedeComentar}
              />
              </div>
            </div>
          </section>

            </div>

            <aside
              id="panel-derecho-estimacion"
              className="space-y-3 xl:sticky xl:top-3 xl:max-h-[calc(100vh-1.25rem)] xl:overflow-y-auto"
            >
            <InfoLateralCards
              estimacion={estimacion}
              danoSeleccionado={danoSeleccionado}
            />
            <InfoDanoPanel
              estimacion={estimacion}
              dano={danoSeleccionado}
              editable={puedeCargarEvidencias}
              modoLiquidaciones={esLiquidaciones}
              onActualizar={(cambios, resumen) => {
                if (!danoSeleccionado) return;
                cambiarDano(danoSeleccionado, cambios, resumen);
              }}
              onVerFotos={(d) => setDialogo({ tipo: 'FOTOS', danoId: d.id })}
              onVerVideo={(d) => setDialogo({ tipo: 'VIDEO', dano: d })}
            />
            </aside>
          </div>
        </div>
      </main>

      {/* ── Diálogos ─────────────────────────────────────────────── */}

      {/* Gestor Seaboard: Aprobar/Rechazar → Liquidaciones RFS */}
      <ConfirmacionEstimacionModal
        open={dialogo.tipo === 'ENVIAR_LIQUIDACIONES'}
        modo="DECISION"
        estimacion={estimacion}
        onClose={cerrar}
        onAprobar={() => {
          aprobar(
            [estimacion.id],
            actor,
            `Aprobado por ${actor}. Enviado a liquidaciones RFS.`
          );
          notificarAprobacionALiquidaciones(estimacion, actor);
          toast(
            `Estimación ${estimacion.codigo} aprobada y enviada a liquidaciones RFS (APROBADO).`,
            'success'
          );
          cerrar();
        }}
        onRechazar={(comentario) => {
          rechazar([estimacion.id], actor, comentario);
          notificarRechazoALiquidaciones(estimacion, comentario, actor);
          toast(
            `Estimación ${estimacion.codigo} rechazada y notificada a liquidaciones RFS.`,
            'success'
          );
          cerrar();
        }}
      />

      {/* Push / envío a bandeja Seaboard (queda PENDIENTE de revisión SBM) */}
      <ConfirmModal
        open={dialogo.tipo === 'ENVIAR_SEABOARD' || dialogo.tipo === 'PUSH_SBM'}
        title="Enviar a Seaboard Marine"
        subtitle={`${estimacion.codigo} · ${estimacion.contenedor} · ${estimacion.naviera}`}
        confirmLabel="Confirmar envío a SBM"
        confirmClass="dms-btn-enviar"
        onClose={cerrar}
        onConfirm={() => {
          enviarAprobacion([estimacion.id], actor);
          toast(
            `Estimación ${estimacion.codigo} enviada a Seaboard (estado PENDIENTE).`,
            'success'
          );
          cerrar();
        }}
      >
        <p className="text-sm leading-relaxed text-gray-600">
          El estimado validado se envía al <strong>reporte / bandeja Seaboard</strong> en estado{' '}
          <strong>PENDIENTE</strong>. El gestor Seaboard podrá modificar ítems, comentar y
          devolverlo <strong>aprobado o rechazado</strong> a liquidaciones.
        </p>
      </ConfirmModal>

      <ConfirmModal
        open={dialogo.tipo === 'ELIMINAR_DANO'}
        title="Eliminar ítem de daño"
        subtitle={
          dialogo.tipo === 'ELIMINAR_DANO' ? `Línea ${dialogo.linea}` : undefined
        }
        confirmLabel="Eliminar ítem"
        confirmClass="dms-btn-eliminar"
        onClose={cerrar}
        onConfirm={() => {
          if (dialogo.tipo !== 'ELIMINAR_DANO') return;
          eliminarDano(estimacion.id, dialogo.danoId, actor);
          if (danoSelId === dialogo.danoId) setDanoSelId(null);
          toast(`Línea ${dialogo.linea} eliminada.`, 'success');
          cerrar();
        }}
      >
        <p className="text-sm text-gray-600">
          Se eliminará la línea de daño del listado. Quedará registrado en la auditoría.
        </p>
      </ConfirmModal>

      <ComentarioModal
        open={dialogo.tipo === 'REVERSAR_APROB'}
        title="Reversar aprobación"
        subtitle={`${estimacion.codigo} · vuelve a PENDIENTE`}
        label="Motivo del reverso"
        confirmLabel="Confirmar reverso"
        confirmClass="dms-btn-reversar"
        onClose={cerrar}
        onConfirm={(comentario) => {
          reversarAprobacion(estimacion.id, actor, comentario);
          toast(`Aprobación de ${estimacion.codigo} reversada.`, 'success');
          cerrar();
        }}
      />

      <ConfirmModal
        open={dialogo.tipo === 'CERRAR_APERTURA'}
        title="Cerrar estimación"
        subtitle="Confirme si desea guardar los cambios realizados"
        confirmLabel="Guardar y cerrar"
        confirmClass="dms-btn-cerrar-est"
        onClose={cerrar}
        onConfirm={confirmarCerrarApertura}
      >
        {dialogo.tipo === 'CERRAR_APERTURA' && (
          <>
            <p className="mb-2">
              ¿Desea guardar estos cambios y cerrar la estimación{' '}
              <strong>{estimacion.codigo}</strong>?
            </p>
            {dialogo.resumen.length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                No se detectaron cambios respecto a la apertura.
              </p>
            ) : (
              <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                <p className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  Resumen de cambios ({dialogo.resumen.length})
                </p>
                <ul className="divide-y divide-slate-100 px-0 text-xs text-slate-700">
                  {dialogo.resumen.map((r, i) => (
                    <li key={i} className="px-3 py-2 leading-snug">
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </ConfirmModal>

      <Modal
        open={dialogo.tipo === 'SALIR_BLOQUEADO'}
        onClose={cerrar}
        size="sm"
        icon={<AlertTriangle className="h-4 w-4" />}
        title="Estimación aperturada"
        subtitle="Debe cerrar el estimado antes de salir"
        footer={
          <button type="button" className="dms-btn-primary px-4 py-2 text-sm" onClick={cerrar}>
            Entendido
          </button>
        }
      >
        <p className="text-sm leading-relaxed text-gray-600">
          No ha cerrado el estimado. No puede regresar ni salir de esta pantalla hasta que
          pulse <strong>Cerrar estimación</strong> y confirme el guardado de cambios.
        </p>
      </Modal>

      <Modal
        open={dialogo.tipo === 'SALIR_SIN_ACCION'}
        onClose={cerrar}
        size="md"
        icon={<AlertTriangle className="h-4 w-4" />}
        title="¿Salir del estimado?"
        subtitle={`${estimacion.codigo} · ${estimacion.contenedor}`}
        footer={
          <>
            <button
              type="button"
              className="dms-btn-action border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
              onClick={cerrar}
            >
              Quedarme
            </button>
            <button
              type="button"
              className="dms-btn-action border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700"
              onClick={salirSoloVisualizacion}
            >
              Solo visualicé · Salir
            </button>
            <button
              type="button"
              className="dms-btn-enviar px-4 py-2 text-sm"
              onClick={continuarRevision}
            >
              Continuar revisión / decisión
            </button>
          </>
        }
      >
        <div className="space-y-3 text-sm leading-relaxed text-gray-600">
          <p>
            Al visualizar este estimado se espera que <strong>apruebe o rechace cada ítem</strong> y
            luego use <strong>Aprobar / Rechazar</strong> sobre el estimado completo (notifica a
            liquidaciones RFS).
          </p>
          {itemsPendientesRevision.length > 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Aún hay <strong>{itemsPendientesRevision.length}</strong> ítem(s) sin revisar.
              Aperture la estimación y use «Aprobar ítems» / «Rechazar ítems».
            </p>
          )}
          <p className="text-xs text-slate-500">
            Si solo ingresó a consultar y no realizará cambios ni decisión, pulse{' '}
            <strong>Solo visualicé · Salir</strong>.
          </p>
        </div>
      </Modal>

      <ComentarioModal
        open={dialogo.tipo === 'RECHAZAR_ITEMS'}
        title="Rechazar ítems"
        subtitle={`${marcadosIds.length} línea(s) marcada(s) · indique el motivo`}
        label="Motivo del rechazo (obligatorio)"
        confirmLabel="Rechazar ítems"
        confirmClass="dms-btn-rechazar"
        onClose={cerrar}
        onConfirm={(comentario) => confirmarRechazoItems(comentario, marcadosIds)}
      />

      <ComentarioModal
        open={dialogo.tipo === 'RECHAZAR_ITEM'}
        title="Rechazar ítem"
        subtitle={
          dialogo.tipo === 'RECHAZAR_ITEM'
            ? `Línea ${String(dialogo.dano.linea).padStart(2, '0')} · ${dialogo.dano.comp}`
            : undefined
        }
        label="Motivo del rechazo (obligatorio)"
        confirmLabel="Rechazar ítem"
        confirmClass="dms-btn-rechazar"
        onClose={cerrar}
        onConfirm={(comentario) => {
          if (dialogo.tipo !== 'RECHAZAR_ITEM') return;
          confirmarRechazoItems(comentario, [dialogo.dano.id]);
        }}
      />

      <EditarDanoModal
        open={dialogo.tipo === 'EDITAR_DANO'}
        dano={dialogo.tipo === 'EDITAR_DANO' ? dialogo.dano : null}
        mostrarDimensiones={estimacion.tipoEstimacion.toUpperCase().includes('BOX')}
        onClose={cerrar}
        onGuardar={(cambios, resumen, comentarios) => {
          if (dialogo.tipo !== 'EDITAR_DANO') return;
          guardarEdicionDano(dialogo.dano, cambios, resumen, comentarios);
          toast('Línea de daño actualizada con comentarios.', 'success');
          cerrar();
        }}
      />

      <GaleriaFotosModal
        open={dialogo.tipo === 'FOTOS'}
        titulo={
          dialogo.tipo === 'FOTOS' && dialogo.danoId === 'TODAS'
            ? `Evidencias · ${estimacion.codigo}`
            : `Evidencias de la línea seleccionada`
        }
        subtitulo={`${estimacion.contenedor} · ${fotosDialogo.length} archivo(s)`}
        fotos={fotosDialogo}
        onClose={cerrar}
      />

      <VideoDanoModal
        open={dialogo.tipo === 'VIDEO'}
        estimacion={estimacion}
        dano={dialogo.tipo === 'VIDEO' ? dialogo.dano : null}
        onClose={cerrar}
      />

      <HistorialActividadModal
        open={dialogo.tipo === 'HISTORIAL'}
        estimacion={estimacion}
        onClose={cerrar}
      />

      <InformePreviewModal
        open={dialogo.tipo === 'INFORME'}
        estimacion={estimacion}
        conValores={dialogo.tipo === 'INFORME' ? dialogo.conValores : true}
        onClose={cerrar}
      />
    </>
  );
}
