'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  FileStack,
  ListChecks,
  Lock,
  MessageSquare,
  RefreshCw,
  Save,
  Send,
  StickyNote,
  Unlock,
  XCircle,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { EstadoEstimacionBadge } from '@/components/dms/EstadoEstimacionBadge';
import { ComentarioModal } from '@/components/aprobaciones/ComentarioModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Modal } from '@/components/ui/Modal';
import { ComentariosDanoModal, rolDeUsuario } from '@/components/estimacion/ComentariosDanoModal';
import { DescargasMenu } from '@/components/estimacion/DescargasMenu';
import { EditarDanoModal } from '@/components/estimacion/EditarDanoModal';
import { GaleriaFotosModal } from '@/components/estimacion/GaleriaFotosModal';
import { HistorialActividadModal } from '@/components/estimacion/HistorialActividadModal';
import { InfoDanoPanel } from '@/components/estimacion/InfoDanoPanel';
import { InfoLateralCards } from '@/components/estimacion/InfoLateralCards';
import { InformePreviewModal } from '@/components/estimacion/InformePreviewModal';
import { ListadoDanosTable } from '@/components/estimacion/ListadoDanosTable';
import { VideoDanoModal } from '@/components/estimacion/VideoDanoModal';
import { useAuthStore } from '@/store';
import { useEstimacionesStore } from '@/store/estimacionesStore';
import { useUiStore } from '@/store/uiStore';
import {
  contarComentariosPendientes,
  aLineaHistorial,
  snapshotDesdeDano,
  type CampoSnapshotLinea,
  type DanoEstimacion,
  type Estimacion,
} from '@/types/estimacion';
import { textoComentariosRfs } from '@/components/estimacion/EditarDanoModal';
import { cn, formatMoney, toast } from '@/lib/utils';
import { fotosRealesDano } from '@/lib/fotosDano';

/** Los estimados en curso admiten edición; una vez aprobados quedan en solo lectura. */
const ESTADOS_EDITABLES = ['PENDIENTE', 'RECHAZADO', 'REVERSADO'];

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
  | { tipo: 'ENVIAR' }
  | { tipo: 'RECHAZAR' }
  | { tipo: 'RECHAZAR_ITEMS' }
  | { tipo: 'RECHAZAR_ITEM'; dano: DanoEstimacion }
  | { tipo: 'EDITAR_DANO'; dano: DanoEstimacion }
  | { tipo: 'COMENTARIOS'; danoId: string }
  | { tipo: 'FOTOS'; danoId: string | 'TODAS' }
  | { tipo: 'VIDEO'; dano: DanoEstimacion }
  | { tipo: 'HISTORIAL' }
  | { tipo: 'INFORME'; conValores: boolean }
  | { tipo: 'CERRAR_APERTURA'; resumen: string[] }
  | { tipo: 'SALIR_BLOQUEADO' };

export default function EstimacionDetallePage({ codigo }: { codigo: string }) {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    estimaciones,
    getByCodigo,
    revalidarTarifas,
    enviarAprobacion,
    aprobar,
    rechazar,
    actualizarDano,
    resolverItemsMasivo,
    agregarComentarioDano,
    agregarNota,
    registrarActividad,
  } = useEstimacionesStore();
  const setGuardiaSesion = useUiStore((s) => s.setGuardiaSesion);

  const estimacion = useMemo(() => getByCodigo(codigo), [codigo, estimaciones, getByCodigo]);

  const [dialogo, setDialogo] = useState<Dialogo>({ tipo: 'NINGUNO' });
  const [danoSelId, setDanoSelId] = useState<string | null>(null);
  const [nota, setNota] = useState('');
  const [aperturada, setAperturada] = useState(false);
  const [snapshotApertura, setSnapshotApertura] = useState<SnapshotApertura | null>(null);
  const [marcadosIds, setMarcadosIds] = useState<string[]>([]);
  const snapshotRef = useRef<SnapshotApertura | null>(null);
  const vistaRegistradaRef = useRef<string | null>(null);

  useEffect(() => {
    snapshotRef.current = snapshotApertura;
  }, [snapshotApertura]);

  useEffect(() => {
    if (!estimacion) return;
    if (vistaRegistradaRef.current === estimacion.id) return;
    vistaRegistradaRef.current = estimacion.id;
    const usuarioVista = useAuthStore.getState().user?.username ?? 'apptelink';
    registrarActividad(
      estimacion.id,
      usuarioVista,
      'Visualización Estimación',
      'VISUALIZACIÓN ESTIMACIÓN',
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
  }, [aperturada, estimacion?.id, estimacion?.codigo, setGuardiaSesion]);

  const usuario = user?.username ?? 'apptelink';
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
  /** El gestor DMS puede aperturar cualquier estimado, en cualquier estado. */
  const puedeAperturar = esOperadorDms;
  /** Solo con la estimación aperturada se pueden mutar ítems. */
  const editable = puedeAperturar && aperturada;
  const puedeEnviar =
    puedeAperturar && ESTADOS_EDITABLES.includes(estimacion.estado);
  const puedeComentar = user?.rol === 'dms' || user?.rol === 'liquidaciones';
  const danoSeleccionado = estimacion.danos.find((d) => d.id === danoSelId) ?? null;
  const pendientes = contarComentariosPendientes(estimacion.danos);
  const esSeaboard = user?.rol === 'seaboard';

  const fotosDialogo =
    dialogo.tipo === 'FOTOS'
      ? dialogo.danoId === 'TODAS'
        ? estimacion.danos.flatMap((d) => fotosRealesDano(d.fotos))
        : fotosRealesDano(
            estimacion.danos.find((d) => d.id === dialogo.danoId)?.fotos ?? []
          )
      : [];

  const danoComentarios =
    dialogo.tipo === 'COMENTARIOS'
      ? (estimacion.danos.find((d) => d.id === dialogo.danoId) ?? null)
      : null;

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
      usuario,
      'Aperturó estimado en el aplicativo',
      `Apertura de ${estimacion!.codigo} para modificación de ítems`,
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
      usuario,
      'Cerró estimado en el aplicativo',
      detalle,
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
    resolverItemsMasivo(estimacion!.id, marcadosIds, 'APROBAR', usuario);
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
    resolverItemsMasivo(estimacion!.id, danoIds, 'RECHAZAR', usuario, comentario);
    toast(`${danoIds.length} ítem(s) rechazado(s) con motivo registrado.`, 'success');
    setMarcadosIds([]);
    cerrar();
  }

  function intentarRegresar() {
    if (aperturada) {
      setDialogo({ tipo: 'SALIR_BLOQUEADO' });
      return;
    }
    router.push('/reportes/estimaciones');
  }

  function cambiarDano(dano: DanoEstimacion, cambios: Partial<DanoEstimacion>, resumen: string) {
    if (exigirApertura()) return;
    actualizarDano(estimacion!.id, dano.id, cambios, usuario, resumen);
  }

  function guardarEdicionDano(
    dano: DanoEstimacion,
    cambios: Partial<DanoEstimacion>,
    resumen: string,
    comentarios: { sbm: string; rfs: string }
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

    actualizarDano(
      estimacion!.id,
      dano.id,
      {
        ...cambios,
        edicionReciente: {
          fecha: ahora,
          usuario,
          resumenCambios: resumen,
          snapshot,
          camposCambiados,
          ...(comentarios.sbm ? { comentarioSbm: comentarios.sbm } : {}),
          comentarioRfs: rfsExistente.startsWith('Sin comentarios')
            ? undefined
            : rfsExistente,
        },
      },
      usuario,
      `Línea ${dano.linea} · ${resumen}`
    );
    if (comentarios.sbm) {
      agregarComentarioDano(estimacion!.id, dano.id, {
        usuario,
        rol: 'SEABOARD',
        tipo: 'INFORMATIVO',
        mensaje: comentarios.sbm,
        campoAfectado: 'Comentarios línea SBM',
      });
    }
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
              {esOperadorDms && (
                <>
                  <button
                    type="button"
                    className="dms-btn-azul"
                    onClick={() => {
                      if (exigirApertura()) return;
                      revalidarTarifas(estimacion.id, usuario);
                      toast(
                        `Tarifas revalidadas sobre ${estimacion.danos.length} línea(s).`,
                        'success'
                      );
                    }}
                  >
                    <RefreshCw className="h-4 w-4" /> Revalidar Tarifas
                  </button>
                </>
              )}
              <button
                type="button"
                className="dms-btn-azul"
                onClick={() => setDialogo({ tipo: 'FOTOS', danoId: 'TODAS' })}
              >
                <FileStack className="h-4 w-4" /> Ver evidencias
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
              {puedeEnviar && (
                <button
                  type="button"
                  className="dms-btn-enviar"
                  disabled={estimacion.danos.length === 0 || aperturada}
                  title={
                    aperturada
                      ? 'Cierre la estimación antes de enviarla a aprobación'
                      : undefined
                  }
                  onClick={() => {
                    if (aperturada) {
                      toast('Cierre la estimación antes de enviarla a aprobación.', 'info');
                      return;
                    }
                    setDialogo({ tipo: 'ENVIAR' });
                  }}
                >
                  <Send className="h-4 w-4" /> Enviar a Aprobación
                </button>
              )}
              {estimacion.estado === 'ENVIADO' && esSeaboard && (
                <>
                  <button
                    type="button"
                    className="dms-btn-aprobar px-3 py-2 text-sm"
                    onClick={() => {
                      aprobar([estimacion.id], usuario);
                      toast(`Estimación ${estimacion.codigo} aprobada.`, 'success');
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Aprobar
                  </button>
                  <button
                    type="button"
                    className="dms-btn-rechazar px-3 py-2 text-sm"
                    onClick={() => setDialogo({ tipo: 'RECHAZAR' })}
                  >
                    <XCircle className="h-4 w-4" /> Rechazar
                  </button>
                </>
              )}
              {estimacion.estado === 'ENVIADO' && !esSeaboard && (
                <span className="dms-aviso-espera">
                  <Send className="h-3.5 w-3.5" /> En espera de {estimacion.naviera}
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
              <section className="dms-card">
                <header className="dms-card-header">
                  <StickyNote className="h-3.5 w-3.5" /> Notas de Estimación
                </header>
                <div className="dms-card-body">
                  {puedeAperturar ? (
                    <>
                      <textarea
                        rows={3}
                        className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-xs shadow-sm transition-colors focus:border-rfsorange-500 focus:outline-none focus:ring-2 focus:ring-rfsorange-500/20"
                        value={nota}
                        placeholder="Escriba una nota para el estimado…"
                        onChange={(e) => {
                          if (exigirApertura()) return;
                          setNota(e.target.value);
                        }}
                        onFocus={() => {
                          if (!aperturada) {
                            toast('Aperture la estimación para modificar ítems.', 'info');
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="dms-btn-primary mt-2 px-4 py-2 text-sm disabled:opacity-50"
                        disabled={nota.trim().length < 3 || !aperturada}
                        onClick={() => {
                          if (exigirApertura()) return;
                          agregarNota(estimacion.id, nota.trim(), usuario);
                          setNota('');
                          toast('Nota agregada al estimado.', 'success');
                        }}
                      >
                        <Save className="h-4 w-4" /> Agregar
                      </button>
                    </>
                  ) : estimacion.notas.length === 0 ? (
                    <p className="text-[11px] text-slate-400">Sin notas registradas.</p>
                  ) : null}

                  {estimacion.notas.length > 0 && (
                    <ul className={cn('space-y-2', puedeAperturar && 'mt-3')}>
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
                    ? 'Para modificar ítems, pulse Aperturar estimación.'
                    : 'Seleccione un daño para ver su detalle a la derecha.'}
                </div>
              </div>

              {puedeAperturar && (
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
                onFotos={(d) => setDialogo({ tipo: 'FOTOS', danoId: d.id })}
                onVideo={(d) => setDialogo({ tipo: 'VIDEO', dano: d })}
                onComentarios={(d) => setDialogo({ tipo: 'COMENTARIOS', danoId: d.id })}
              />
              </div>

              <div className="dms-resumen-valores">
                <span>
                  PVP Horas Hombre <strong>${formatMoney(estimacion.pvpHorasHombre)}</strong>
                </span>
                <span>
                  PVP Materiales <strong>${formatMoney(estimacion.pvpMateriales)}</strong>
                </span>
                <span>
                  Horas Hombre <strong>{estimacion.horasHombre.toFixed(2)}</strong>
                </span>
                <span className="dms-resumen-total">
                  PVP Total <strong>${formatMoney(estimacion.pvpTotal)}</strong>
                </span>
              </div>
            </div>
          </section>

            <section className="dms-card">
              <header className="dms-card-header">
                <ClipboardList className="h-3.5 w-3.5" /> Últimos movimientos
              </header>
              <div className="dms-card-body">
                <ul className="space-y-2">
                  {estimacion.auditoria
                    .slice(-4)
                    .reverse()
                    .map((ev) => (
                      <li key={ev.id} className="dms-nota-item">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wide text-rfs-700">
                            {ev.accion}
                          </span>
                          <span className="dms-chip-user">{ev.usuario || 'sistema'}</span>
                          <span className="text-[10px] tabular-nums text-gray-400">{ev.fecha}</span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-gray-600">{ev.detalle}</p>
                      </li>
                    ))}
                </ul>
                <button
                  type="button"
                  className="dms-btn-action dms-btn-info mt-3"
                  onClick={() => setDialogo({ tipo: 'HISTORIAL' })}
                >
                  <ClipboardList className="h-3 w-3" /> Ver historial completo
                </button>
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
              editable={editable}
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

      <ConfirmModal
        open={dialogo.tipo === 'ENVIAR'}
        title="Enviar a Aprobación"
        subtitle={`Destino: ${estimacion.naviera}`}
        confirmLabel="Enviar"
        confirmClass="dms-btn-enviar"
        onClose={cerrar}
        onConfirm={() => {
          enviarAprobacion([estimacion.id], usuario);
          toast(`Estimación ${estimacion.codigo} enviada a aprobación.`, 'success');
        }}
      >
        El estimado pasará a estado <strong>ENVIADO</strong> y quedará en espera de la naviera.
        {pendientes > 0 && (
          <p className="mt-2 text-xs text-rfsorange-600">
            Atención: hay {pendientes} comentario(s) de liquidaciones sin resolver.
          </p>
        )}
      </ConfirmModal>

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

      <ComentarioModal
        open={dialogo.tipo === 'RECHAZAR'}
        title="Rechazar Estimación"
        subtitle="Indique el motivo; el técnico deberá corregir y reenviar"
        label="Motivo del rechazo (obligatorio)"
        confirmLabel="Rechazar estimado"
        confirmClass="dms-btn-rechazar"
        onClose={cerrar}
        onConfirm={(comentario) => {
          rechazar([estimacion.id], usuario, comentario);
          toast(`Estimación ${estimacion.codigo} rechazada.`, 'success');
          cerrar();
        }}
      />

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

      <ComentariosDanoModal
        open={dialogo.tipo === 'COMENTARIOS'}
        estimacion={estimacion}
        dano={danoComentarios}
        usuario={usuario}
        rol={rolComentario}
        soloLectura={!puedeComentar}
        onClose={cerrar}
        onEnviar={(entrada) => {
          if (dialogo.tipo !== 'COMENTARIOS' || !puedeComentar) return;
          agregarComentarioDano(estimacion.id, dialogo.danoId, {
            usuario,
            rol: rolComentario,
            ...entrada,
          });
          toast('Comentario publicado con trazabilidad.', 'success');
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
