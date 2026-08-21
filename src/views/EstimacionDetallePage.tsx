'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Container,
  FileStack,
  Handshake,
  ListChecks,
  MessageSquare,
  RefreshCw,
  Save,
  Search,
  Send,
  StickyNote,
  XCircle,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { EstadoEstimacionBadge } from '@/components/dms/EstadoEstimacionBadge';
import { ComentarioModal } from '@/components/aprobaciones/ComentarioModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Modal } from '@/components/ui/Modal';
import { AgregarDanoCard } from '@/components/estimacion/AgregarDanoCard';
import {
  ComentariosDanoModal,
  rolDeUsuario,
} from '@/components/estimacion/ComentariosDanoModal';
import { DescargasMenu } from '@/components/estimacion/DescargasMenu';
import { EditarDanoModal } from '@/components/estimacion/EditarDanoModal';
import { GaleriaFotosModal } from '@/components/estimacion/GaleriaFotosModal';
import { HistorialActividadModal } from '@/components/estimacion/HistorialActividadModal';
import { InfoDanoPanel } from '@/components/estimacion/InfoDanoPanel';
import { InfoLateralCards } from '@/components/estimacion/InfoLateralCards';
import { InformePreviewModal } from '@/components/estimacion/InformePreviewModal';
import { ListadoDanosTable } from '@/components/estimacion/ListadoDanosTable';
import { VideoDanoModal } from '@/components/estimacion/VideoDanoModal';
import { ALMACENES_SAP, ITINERARIOS_SAP } from '@/data/tarifas';
import { useAuthStore } from '@/store';
import { useEstimacionesStore } from '@/store/estimacionesStore';
import {
  contarComentariosPendientes,
  type AplicaDano,
  type DanoEstimacion,
} from '@/types/estimacion';
import { formatMoney, toast } from '@/lib/utils';

/** Los estimados en curso admiten edición; una vez aprobados quedan en solo lectura. */
const ESTADOS_EDITABLES = ['PENDIENTE', 'RECHAZADO', 'REVERSADO'];

type Dialogo =
  | { tipo: 'NINGUNO' }
  | { tipo: 'CONTENEDOR' }
  | { tipo: 'APORTAR' }
  | { tipo: 'ENVIAR' }
  | { tipo: 'RECHAZAR' }
  | { tipo: 'ELIMINAR_DANO'; dano: DanoEstimacion }
  | { tipo: 'EDITAR_DANO'; dano: DanoEstimacion }
  | { tipo: 'COMENTARIOS'; danoId: string }
  | { tipo: 'FOTOS'; danoId: string | 'TODAS' }
  | { tipo: 'VIDEO'; dano: DanoEstimacion }
  | { tipo: 'HISTORIAL' }
  | { tipo: 'INFORME'; conValores: boolean };

export default function EstimacionDetallePage({ codigo }: { codigo: string }) {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    estimaciones,
    getByCodigo,
    setSap,
    revalidarTarifas,
    enviarAprobacion,
    aprobar,
    rechazar,
    agregarDano,
    actualizarDano,
    eliminarDano,
    agregarComentarioDano,
    agregarNota,
  } = useEstimacionesStore();

  const estimacion = useMemo(() => getByCodigo(codigo), [codigo, estimaciones, getByCodigo]);

  const [dialogo, setDialogo] = useState<Dialogo>({ tipo: 'NINGUNO' });
  const [danoSelId, setDanoSelId] = useState<string | null>(null);
  const [itinerario, setItinerario] = useState('');
  const [almacen, setAlmacen] = useState('');
  const [nota, setNota] = useState('');

  useEffect(() => {
    if (!estimacion) return;
    setItinerario(estimacion.itinerarioSap);
    setAlmacen(estimacion.almacenSap);
    setDanoSelId((prev) =>
      prev && estimacion.danos.some((d) => d.id === prev) ? prev : (estimacion.danos[0]?.id ?? null)
    );
  }, [estimacion]);

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

  const editable = ESTADOS_EDITABLES.includes(estimacion.estado);
  const danoSeleccionado = estimacion.danos.find((d) => d.id === danoSelId) ?? null;
  const pendientes = contarComentariosPendientes(estimacion.danos);
  const sapPendiente =
    itinerario !== estimacion.itinerarioSap || almacen !== estimacion.almacenSap;
  const esSeaboard = user?.rol === 'seaboard';

  const fotosDialogo =
    dialogo.tipo === 'FOTOS'
      ? dialogo.danoId === 'TODAS'
        ? estimacion.danos.flatMap((d) => d.fotos)
        : (estimacion.danos.find((d) => d.id === dialogo.danoId)?.fotos ?? [])
      : [];

  const danoComentarios =
    dialogo.tipo === 'COMENTARIOS'
      ? (estimacion.danos.find((d) => d.id === dialogo.danoId) ?? null)
      : null;

  function cambiarDano(dano: DanoEstimacion, cambios: Partial<DanoEstimacion>, resumen: string) {
    actualizarDano(estimacion!.id, dano.id, cambios, usuario, resumen);
  }

  return (
    <>
      <Header
        title={`Estimación ${estimacion.codigo}`}
        subtitle={`${estimacion.contenedor} · ${estimacion.tipoEstimacion} · ${estimacion.naviera}`}
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
                onClick={() => router.push('/reportes/estimaciones')}
              >
                <ArrowLeft className="h-4 w-4" /> Regresar
              </button>
              <button
                type="button"
                className="dms-btn-azul"
                onClick={() => {
                  revalidarTarifas(estimacion.id, usuario);
                  toast(
                    `Tarifas revalidadas sobre ${estimacion.danos.length} línea(s).`,
                    'success'
                  );
                }}
              >
                <RefreshCw className="h-4 w-4" /> Revalidar Tarifas
              </button>
              <button
                type="button"
                className="dms-btn-azul"
                onClick={() => setDialogo({ tipo: 'CONTENEDOR' })}
              >
                <Container className="h-4 w-4" /> Actualizar Información Contenedor
              </button>
              <button
                type="button"
                className="dms-btn-teal"
                onClick={() => setDialogo({ tipo: 'APORTAR' })}
              >
                <Handshake className="h-4 w-4" /> Aportar Estimación
              </button>
              <button
                type="button"
                className="dms-btn-azul"
                onClick={() => setDialogo({ tipo: 'FOTOS', danoId: 'TODAS' })}
              >
                <FileStack className="h-4 w-4" /> Ver evidencias
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
              {editable && (
                <button
                  type="button"
                  className="dms-btn-enviar"
                  disabled={estimacion.danos.length === 0}
                  onClick={() => setDialogo({ tipo: 'ENVIAR' })}
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
                <div className="dms-card-body">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="dms-field-label">Itinerario Sap</label>
                      <div className="relative">
                        <input
                          className="dms-input-sm pr-8"
                          list="itinerarios-sap"
                          value={itinerario}
                          placeholder="digitar descripcion"
                          onChange={(e) => setItinerario(e.target.value)}
                        />
                        <Search className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                        <datalist id="itinerarios-sap">
                          {ITINERARIOS_SAP.map((i) => (
                            <option key={i} value={i} />
                          ))}
                        </datalist>
                      </div>
                    </div>
                    <div>
                      <label className="dms-field-label">Almacen Sap</label>
                      <select
                        className="dms-select"
                        value={almacen}
                        onChange={(e) => setAlmacen(e.target.value)}
                      >
                        <option value="">Seleccione un Almacen Sap</option>
                        {ALMACENES_SAP.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {sapPendiente && (
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        className="dms-btn-primary px-3 py-1.5 text-xs"
                        onClick={() => {
                          setSap(
                            estimacion.id,
                            { itinerarioSap: itinerario, almacenSap: almacen },
                            usuario
                          );
                          toast('Información SAP guardada.', 'success');
                        }}
                      >
                        <Save className="h-3.5 w-3.5" /> Guardar SAP
                      </button>
                      <button
                        type="button"
                        className="dms-btn-action border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-600"
                        onClick={() => {
                          setItinerario(estimacion.itinerarioSap);
                          setAlmacen(estimacion.almacenSap);
                        }}
                      >
                        Descartar
                      </button>
                    </div>
                  )}
                </div>
              </section>

              <AgregarDanoCard
                editable={editable}
                seccionSugerida={
                  estimacion.tipoEstimacion.toUpperCase().startsWith('M') ? 'MAQUINA' : 'ESTRUCTURAL'
                }
                onAgregar={(dano) => {
                  agregarDano(estimacion.id, dano, usuario);
                  toast(`Daño ${dano.comp} agregado al estimado.`, 'success');
                }}
              />

              <section className="dms-card">
                <header className="dms-card-header">
                  <StickyNote className="h-3.5 w-3.5" /> Notas de Estimación
                </header>
                <div className="dms-card-body">
                  <textarea
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 p-2.5 text-xs shadow-sm transition-colors focus:border-rfsorange-500 focus:outline-none focus:ring-2 focus:ring-rfsorange-500/20"
                    value={nota}
                    placeholder="Escriba una nota para el estimado…"
                    onChange={(e) => setNota(e.target.value)}
                  />
                  <button
                    type="button"
                    className="dms-btn-primary mt-2 px-4 py-2 text-sm disabled:opacity-50"
                    disabled={nota.trim().length < 3}
                    onClick={() => {
                      agregarNota(estimacion.id, nota.trim(), usuario);
                      setNota('');
                      toast('Nota agregada al estimado.', 'success');
                    }}
                  >
                    <Save className="h-4 w-4" /> Agregar
                  </button>

                  {estimacion.notas.length > 0 && (
                    <ul className="mt-3 space-y-2">
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
            <div className="p-3">
              <div className="dms-info-box mb-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-200/60 text-xs font-bold">
                  i
                </span>
                <div className="min-w-0">
                  Seleccione un daño para ver a la derecha la garantía, las fotos de inspección y
                  la Información del Daño (carga de imágenes, videos, data logs y PDF). La columna{' '}
                  <strong>Comentarios</strong> guarda la conversación con liquidaciones.
                </div>
              </div>

              <ListadoDanosTable
                danos={estimacion.danos}
                seleccionadoId={danoSelId}
                editable={editable}
                onSeleccionar={(d) => {
                  setDanoSelId(d.id);
                  if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1279px)').matches) {
                    window.setTimeout(() => {
                      document
                        .getElementById('panel-derecho-estimacion')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 50);
                  }
                }}
                onAplicaChange={(d, aplica: AplicaDano) =>
                  cambiarDano(
                    d,
                    { aplica },
                    `Línea ${d.linea} · Aplica: "${d.aplica}" → "${aplica}"`
                  )
                }
                onRemarkChange={(d, remark) =>
                  cambiarDano(d, { remark }, `Línea ${d.linea} · Remark actualizado: "${remark}"`)
                }
                onDonanteChange={(d, contenedorDonante) =>
                  cambiarDano(
                    d,
                    { contenedorDonante },
                    `Línea ${d.linea} · Contenedor donante: "${contenedorDonante}"`
                  )
                }
                onEditar={(d) => setDialogo({ tipo: 'EDITAR_DANO', dano: d })}
                onEliminar={(d) => setDialogo({ tipo: 'ELIMINAR_DANO', dano: d })}
                onFotos={(d) => setDialogo({ tipo: 'FOTOS', danoId: d.id })}
                onVideo={(d) => setDialogo({ tipo: 'VIDEO', dano: d })}
                onComentarios={(d) => setDialogo({ tipo: 'COMENTARIOS', danoId: d.id })}
              />

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
              editable={editable}
              onGuardarGarantia={(cambios, resumen) => {
                if (!danoSeleccionado) return;
                cambiarDano(danoSeleccionado, cambios, resumen);
              }}
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

      <Modal
        open={dialogo.tipo === 'CONTENEDOR'}
        onClose={cerrar}
        size="md"
        icon={<Container className="h-4 w-4" />}
        title={`Información del contenedor ${estimacion.contenedor}`}
        subtitle="Datos sincronizados desde el maestro de contenedores"
        footer={
          <>
            <button
              type="button"
              className="dms-btn-action border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
              onClick={cerrar}
            >
              Cerrar
            </button>
            <button
              type="button"
              className="dms-btn-primary px-4 py-2 text-sm"
              onClick={() => {
                setSap(
                  estimacion.id,
                  { itinerarioSap: itinerario, almacenSap: almacen },
                  usuario
                );
                toast(`Información de ${estimacion.contenedor} actualizada.`, 'success');
                cerrar();
              }}
            >
              <RefreshCw className="h-4 w-4" /> Actualizar información
            </button>
          </>
        }
      >
        <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          {[
            ['Contenedor', estimacion.contenedor],
            ['Código RFS', estimacion.codigoRfs],
            ['Tipo', estimacion.tipoContenedor],
            ['Modelo máquina', estimacion.modeloMaquina],
            ['Naviera', estimacion.naviera],
            ['Buque', estimacion.buque],
            ['Viaje', estimacion.viaje],
            ['Gate In', estimacion.fechaGateIn],
            ['Días de estadía', String(estimacion.diasEstadia)],
            ['Depósito', estimacion.lugarEstimacion],
            ['Estado PTI', estimacion.estadoPti || 'Sin PTI'],
            ['Fin PTI', estimacion.fechaFinPti || '—'],
          ].map(([k, v]) => (
            <div key={k} className="dms-mini-dato">
              <dt>{k}</dt>
              <dd>{v || '—'}</dd>
            </div>
          ))}
        </dl>
      </Modal>

      <ConfirmModal
        open={dialogo.tipo === 'APORTAR'}
        title="Aportar Estimación"
        subtitle="El estimado se vincula al itinerario y almacén SAP indicados"
        confirmLabel="Aportar"
        confirmClass="dms-btn-teal"
        onClose={cerrar}
        onConfirm={() => {
          setSap(estimacion.id, { itinerarioSap: itinerario, almacenSap: almacen }, usuario);
          toast(`Estimación ${estimacion.codigo} aportada a SAP.`, 'success');
        }}
      >
        Se aportará la estimación <strong>{estimacion.codigo}</strong> con{' '}
        <strong>{estimacion.danos.length}</strong> línea(s) por un total de{' '}
        <strong>${formatMoney(estimacion.pvpTotal)}</strong>.
        {!itinerario && (
          <p className="mt-2 text-xs text-rfsorange-600">
            Sugerencia: seleccione un Itinerario SAP antes de aportar.
          </p>
        )}
      </ConfirmModal>

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
        open={dialogo.tipo === 'ELIMINAR_DANO'}
        title="Eliminar línea de daño"
        subtitle="Esta acción recalcula los valores del estimado"
        confirmLabel="Eliminar"
        onClose={cerrar}
        onConfirm={() => {
          if (dialogo.tipo !== 'ELIMINAR_DANO') return;
          eliminarDano(estimacion.id, dialogo.dano.id, usuario);
          toast(`Línea ${dialogo.dano.linea} eliminada del estimado.`, 'success');
        }}
      >
        {dialogo.tipo === 'ELIMINAR_DANO' && (
          <>
            Se eliminará la línea <strong>{String(dialogo.dano.linea).padStart(2, '0')}</strong> (
            {dialogo.dano.comp} · {dialogo.dano.dano}) por{' '}
            <strong>${formatMoney(dialogo.dano.csTotal)}</strong>.
          </>
        )}
      </ConfirmModal>

      <ComentarioModal
        open={dialogo.tipo === 'RECHAZAR'}
        title="Rechazar Estimación"
        subtitle="El técnico deberá corregir y reenviar"
        label="Motivo del rechazo"
        confirmLabel="Rechazar"
        confirmClass="dms-btn-rechazar"
        onClose={cerrar}
        onConfirm={(comentario) => {
          rechazar([estimacion.id], usuario, comentario);
          toast(`Estimación ${estimacion.codigo} rechazada.`, 'success');
          cerrar();
        }}
      />

      <EditarDanoModal
        open={dialogo.tipo === 'EDITAR_DANO'}
        dano={dialogo.tipo === 'EDITAR_DANO' ? dialogo.dano : null}
        onClose={cerrar}
        onGuardar={(cambios, resumen) => {
          if (dialogo.tipo !== 'EDITAR_DANO') return;
          cambiarDano(dialogo.dano, cambios, resumen);
          toast('Línea de daño actualizada.', 'success');
          cerrar();
        }}
      />

      <ComentariosDanoModal
        open={dialogo.tipo === 'COMENTARIOS'}
        estimacion={estimacion}
        dano={danoComentarios}
        usuario={usuario}
        rol={rolComentario}
        onClose={cerrar}
        onEnviar={(entrada) => {
          if (dialogo.tipo !== 'COMENTARIOS') return;
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
