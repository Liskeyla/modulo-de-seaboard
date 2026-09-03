import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import seedData from '@/data/estimacionesSeed.json';
import type {
  Actividad,
  AplicaDano,
  CargoDano,
  ComentarioDano,
  ComentarioSeaboard,
  DanoEstimacion,
  Estimacion,
  EstadoEstimacion,
  EventoAuditoria,
  LineaHistorialDano,
  RolComentario,
  TipoCobro,
  TipoComentario,
} from '@/types/estimacion';
import {
  aLineaHistorial,
  APLICA_APROBADO_SBM,
  APLICA_PENDIENTE,
  APLICA_RECHAZADO_SBM,
  CARGO_DEFAULT,
  cargoDesdeTipoCobro,
  esAplicaRechazado,
  esItemAprobado,
  normalizarAplicaDano,
  normalizarCargoDano,
  tipoCobroDesdeCargo,
  valoresCeroPorRechazoItem,
} from '@/types/estimacion';
import { esNavieraSeaboard, resolverEstadoEnvioALiquidaciones } from '@/lib/seaboardFlow';
import { useCatalogoCargoStore } from '@/store/catalogoCargoStore';
import {
  appendHistorialItem,
  construirEntradaDesdeCambios,
  entradaAprobacionItem,
  entradaComentarioItem,
  entradaCreacionItem,
  entradaRechazoItem,
  entradaReversaItem,
  reconstruirHistorialItem,
} from '@/lib/historialItem';

const STORAGE_KEY = 'dms-estimaciones-prototipo-v22';
const CLAVES_OBSOLETAS = [
  'dms-estimaciones-prototipo',
  'dms-estimaciones-prototipo-v2',
  'dms-estimaciones-prototipo-v3',
  'dms-estimaciones-prototipo-v4',
  'dms-estimaciones-prototipo-v5',
  'dms-estimaciones-prototipo-v6',
  'dms-estimaciones-prototipo-v7',
  'dms-estimaciones-prototipo-v8',
  'dms-estimaciones-prototipo-v9',
  'dms-estimaciones-prototipo-v10',
  'dms-estimaciones-prototipo-v11',
  'dms-estimaciones-prototipo-v12',
  'dms-estimaciones-prototipo-v13',
  'dms-estimaciones-prototipo-v14',
  'dms-estimaciones-prototipo-v15',
  'dms-estimaciones-prototipo-v16',
  'dms-estimaciones-prototipo-v17',
  'dms-estimaciones-prototipo-v18',
  'dms-estimaciones-prototipo-v19',
  'dms-estimaciones-prototipo-v20',
  'dms-estimaciones-prototipo-v21',
];

function migrarEstadosItem(estims: Estimacion[]): Estimacion[] {
  return estims.map((e) => ({
    ...e,
    danos: e.danos.map((d) => {
      const normalizado = {
        ...d,
        aplica: normalizarAplicaDano(d.aplica),
        cargo: normalizarCargoDano(d.cargo),
      };
      const historialAcciones =
        d.historialAcciones && d.historialAcciones.length > 0
          ? d.historialAcciones
          : reconstruirHistorialItem(normalizado);
      return { ...normalizado, historialAcciones };
    }),
  }));
}

function ahoraFmt() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`;
}

function uid(prefijo: string) {
  return `${prefijo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Intenta recuperar HH/costos previos al rechazo (quedan en $0 tras rechazar). */
function costosPreviosAlRechazo(d: DanoEstimacion): {
  horasHombre: number;
  csHoraHombre: number;
  csMaterial: number;
  csTotal: number;
} {
  const snap =
    d.historialAcciones?.find((h) => h.tipo === 'RECHAZO' && h.snapshotAnterior)?.snapshotAnterior ||
    d.edicionReciente?.snapshotAnterior;
  if (snap && (snap.csTotal > 0 || snap.horasHombre > 0)) {
    return {
      horasHombre: snap.horasHombre,
      csHoraHombre: snap.csHoraHombre,
      csMaterial: snap.csMaterial,
      csTotal: snap.csTotal,
    };
  }
  const cmt = [...d.comentarios]
    .filter((c) => c.tipo === 'RECHAZADO' && c.valorAnterior)
    .sort((a, b) => b.fecha.localeCompare(a.fecha, 'es'))[0];
  if (cmt?.valorAnterior) {
    const hh = cmt.valorAnterior.match(/HH\s+([\d.]+)/i);
    const tot = cmt.valorAnterior.match(/\$\s*([\d.]+)/);
    const horasHombre = hh ? Number(hh[1]) : 0;
    const csTotal = tot ? Number(tot[1]) : 0;
    if (horasHombre > 0 || csTotal > 0) {
      const csHoraHombre = horasHombre > 0 ? round2(csTotal * 0.35) : 0;
      const csMaterial = round2(csTotal - csHoraHombre);
      return { horasHombre, csHoraHombre, csMaterial, csTotal };
    }
  }
  return {
    horasHombre: d.horasHombre,
    csHoraHombre: d.csHoraHombre,
    csMaterial: d.csMaterial,
    csTotal: d.csTotal,
  };
}

function semanaIso(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Genera un código ERSBM-AAAA-NNNNNN único (nunca reutiliza el del estimado origen). */
function siguienteCodigoEstimado(existentes: Estimacion[], anio: number) {
  const usados = new Set(existentes.map((e) => e.codigo));
  const nums = existentes
    .map((e) => {
      const m = e.codigo.match(/(\d+)$/);
      return m ? Number(m[1]) : 0;
    })
    .filter((n) => n > 0);
  let next = (nums.length ? Math.max(...nums) : 179200) + 1;
  let codigo = `ERSBM-${anio}-${next}`;
  while (usados.has(codigo)) {
    next += 1;
    codigo = `ERSBM-${anio}-${next}`;
  }
  return codigo;
}

function evento(
  usuario: string,
  accion: string,
  detalle: string,
  lineas?: LineaHistorialDano[]
): EventoAuditoria {
  return {
    id: uid('ev'),
    fecha: ahoraFmt(),
    usuario,
    accion,
    detalle,
    ...(lineas && lineas.length > 0 ? { lineas } : {}),
  };
}

function comentarioSeaboard(
  accion: ComentarioSeaboard['accion'],
  comentario: string,
  usuario: string
): ComentarioSeaboard {
  return { id: uid('cmt'), fecha: ahoraFmt(), usuario, accion, comentario };
}

/** Recalcula los PVP de cabecera a partir de las líneas de daño vigentes. */
function recalcular(est: Estimacion): Estimacion {
  const horasHombre = round2(est.danos.reduce((a, d) => a + d.horasHombre, 0));
  const pvpHorasHombre = round2(est.danos.reduce((a, d) => a + d.csHoraHombre, 0));
  const pvpMateriales = round2(est.danos.reduce((a, d) => a + d.csMaterial, 0));
  return {
    ...est,
    horasHombre,
    pvpHorasHombre,
    pvpMateriales,
    pvpTotal: round2(pvpHorasHombre + pvpMateriales),
    sinDanos: est.danos.length === 0,
  };
}

interface EstimacionesState {
  estimaciones: Estimacion[];
  hydrate: () => void;
  reset: () => void;
  getByCodigo: (codigo: string) => Estimacion | undefined;

  // Flujo de aprobación
  enviarAprobacion: (ids: string[], usuario: string) => void;
  /** Liquidaciones marca el estimado como validado (habilita push a SBM). */
  validarLiquidaciones: (id: string, usuario: string) => void;
  aprobar: (ids: string[], usuario: string, comentario: string) => void;
  rechazar: (ids: string[], usuario: string, comentario: string) => void;
  /**
   * Seaboard envía a liquidaciones RFS con comentarios generales.
   * Todos aprobados → APROBADO.
   * Solo rechazos cargo Cliente (+ resto aprobado) → APROBADO (ítems Cliente siguen Rechazado).
   * Otros rechazos → RECHAZADO.
   */
  enviarALiquidaciones: (id: string, usuario: string, comentario: string) => void;
  reversar: (ids: string[], usuario: string, comentario: string) => void;
  reversarAprobacion: (id: string, usuario: string, comentario: string) => void;
  /**
   * Seaboard / Coordinador: solicita a liquidaciones que reverse un estimado APROBADO
   * (mensaje interno + correo). No cambia el estado.
   */
  solicitarReversoAprobacion: (id: string, usuario: string, comentario: string) => void;
  marcarReparado: (id: string, usuario: string) => void;
  eliminar: (id: string, usuario: string) => void;
  getEnviadosSeaboard: () => Estimacion[];

  // Edición del estimado
  setActividad: (id: string, actividad: Actividad, usuario: string) => void;
  setSap: (id: string, campos: { itinerarioSap?: string; almacenSap?: string }, usuario: string) => void;
  /** Liquidaciones: marca cobro al Cliente o a la Línea (aplica a ítems no rechazados). */
  setTipoCobro: (id: string, tipo: TipoCobro, usuario: string) => void;
  revalidarTarifas: (id: string, usuario: string) => void;

  // Listado de daños
  agregarDano: (id: string, dano: Omit<DanoEstimacion, 'id' | 'linea'>, usuario: string) => void;
  actualizarDano: (
    id: string,
    danoId: string,
    cambios: Partial<DanoEstimacion>,
    usuario: string,
    etiqueta?: string
  ) => void;
  /** Aprueba o rechaza varias líneas (Aplica) en una sola auditoría. */
  resolverItemsMasivo: (
    id: string,
    danoIds: string[],
    accion: 'APROBAR' | 'RECHAZAR',
    usuario: string,
    /** Obligatorio en aprobar y rechazar: evidencia de decisión manual. */
    comentario?: string,
    rol?: RolComentario
  ) => void;
  /**
   * Revierte ítems aprobados a Pendiente de revisión (obligatorio comentar)
   * para poder editarlos y volver a enviarlos a revisión.
   */
  reversarItemsMasivo: (
    id: string,
    danoIds: string[],
    usuario: string,
    comentario: string,
    rol?: RolComentario
  ) => void;
  eliminarDano: (id: string, danoId: string, usuario: string) => void;
  /** Restaura daños y notas al estado de una apertura (descartar cambios). */
  restaurarDesdeApertura: (
    id: string,
    snap: { danos: DanoEstimacion[]; notasCount: number }
  ) => void;

  // Trazabilidad con liquidaciones
  agregarComentarioDano: (
    id: string,
    danoId: string,
    entrada: {
      usuario: string;
      rol: RolComentario;
      tipo: TipoComentario;
      mensaje: string;
      campoAfectado?: string;
    }
  ) => void;

  agregarNota: (id: string, texto: string, usuario: string) => void;
  /** Registra un evento en el historial de actividad (con detalle opcional del listado de daños). */
  registrarActividad: (
    id: string,
    usuario: string,
    accion: string,
    detalle: string,
    lineas?: LineaHistorialDano[]
  ) => void;

  /**
   * Prototipo liquidaciones: genera un nuevo estimado PENDIENTE a partir de ítems rechazados.
   * Sujeto a validación con Sistemas. Retorna el estimado creado o null si no aplica.
   */
  generarEstimadoDesdeItems: (
    seleccion: { estimacionId: string; danoId: string }[],
    usuario: string,
    /** Responsable del cobro del nuevo estimado (aplica a todas las líneas). */
    cargoCobro: CargoDano
  ) => Estimacion | null;

  /**
   * Coordinador / patio: crea un estimado PENDIENTE vacío (sin daños).
   * Luego se agregan líneas con AgregarDano; Liquidaciones envía a la línea.
   */
  crearEstimado: (
    datos: {
      contenedor: string;
      naviera: string;
      modeloMaquina?: string;
      codigoRfs?: string;
      tipoEstimacion: string;
      lugarEstimacion?: string;
      tecnico?: string;
      actividad?: Actividad;
      buque?: string;
      viaje?: string;
      tipoContenedor?: string;
      pais?: 'ECUADOR' | 'PERU';
    },
    usuario: string
  ) => Estimacion;
}

export const useEstimacionesStore = create<EstimacionesState>()(
  persist(
    (set, get) => {
      /** Aplica una transformación a una estimación por id, registrando siempre auditoría. */
      const mutar = (id: string, fn: (est: Estimacion) => Estimacion) => {
        set((s) => ({
          estimaciones: s.estimaciones.map((e) => (e.id === id ? fn(e) : e)),
        }));
      };

      return {
        estimaciones: migrarEstadosItem(seedData as unknown as Estimacion[]),

        hydrate: () => {
          try {
            CLAVES_OBSOLETAS.forEach((k) => localStorage.removeItem(k));
          } catch {
            /* ignore */
          }
          const raw = localStorage.getItem(STORAGE_KEY);
          if (!raw) return;
          try {
            const parsed = JSON.parse(raw);
            const guardadas = parsed?.state?.estimaciones;
            // El seed cambió de forma: si lo persistido no trae daños, se descarta.
            if (Array.isArray(guardadas) && guardadas.length && guardadas[0]?.danos) {
              set({ estimaciones: migrarEstadosItem(guardadas) });
            }
          } catch {
            /* ignore */
          }
        },

        reset: () => set({ estimaciones: migrarEstadosItem(seedData as unknown as Estimacion[]) }),

        getByCodigo: (codigo) => get().estimaciones.find((e) => e.codigo === codigo),

        enviarAprobacion: (ids, usuario) => {
          set((s) => ({
            estimaciones: s.estimaciones.map((e) => {
              if (!ids.includes(e.id) || !['PENDIENTE', 'RECHAZADO', 'REVERSADO'].includes(e.estado)) {
                return e;
              }
              if (e.enviarAprobacion === 'SI') return e;
              // Push a SBM solo aplica a naviera Seaboard (otras navieras no entran a bandeja SBM).
              if (!esNavieraSeaboard(e.naviera)) return e;
              const pendientesLiq = e.danos.reduce(
                (acc, d) =>
                  acc + d.comentarios.filter((c) => c.tipo === 'SOLICITA_CAMBIO').length,
                0
              );
              const destino = 'Seaboard Marine';
              return {
                ...e,
                /** Llega a la bandeja Seaboard en estado ENVIADO. */
                estado: 'ENVIADO' as EstadoEstimacion,
                enviarAprobacion: 'SI',
                validadoLiquidaciones: true,
                /** Fecha en que Liquidaciones envió el estimado al reporte Seaboard. */
                fechaEnvio: ahoraFmt(),
                fechaModificacion: ahoraFmt(),
                usuarioModificacion: usuario,
                comentariosSeaboard: [
                  ...e.comentariosSeaboard,
                  comentarioSeaboard(
                    'ENVIAR',
                    pendientesLiq > 0
                      ? `Enviar a SBM · ${pendientesLiq} comentario(s) de liquidaciones pendientes.`
                      : 'Enviar a SBM · estimado en revisión Seaboard.',
                    usuario
                  ),
                ],
                auditoria: [
                  ...e.auditoria,
                  evento(
                    usuario,
                    'PUSH A SEABOARD',
                    `Enviado a ${destino} (estado ENVIADO) · $${e.pvpTotal.toFixed(2)}` +
                      (pendientesLiq > 0
                        ? ` · ${pendientesLiq} comentario(s) liquidaciones pendientes`
                        : '')
                  ),
                ],
              };
            }),
          }));
        },

        validarLiquidaciones: (id, usuario) => {
          mutar(id, (e) => {
            if (
              e.validadoLiquidaciones ||
              e.enviarAprobacion === 'SI' ||
              !['PENDIENTE', 'RECHAZADO', 'REVERSADO'].includes(e.estado)
            ) {
              return e;
            }
            return {
              ...e,
              validadoLiquidaciones: true,
              fechaValidacionLiquidaciones: ahoraFmt(),
              fechaModificacion: ahoraFmt(),
              usuarioModificacion: usuario,
              auditoria: [
                ...e.auditoria,
                evento(
                  usuario,
                  'VALIDACIÓN LIQUIDACIONES',
                  esNavieraSeaboard(e.naviera)
                    ? 'Validado por liquidaciones. Listo para enviar a Seaboard Marine.'
                    : 'Validado por liquidaciones (naviera distinta de Seaboard).'
                ),
              ],
            };
          });
        },

        aprobar: (ids, usuario, comentario) => {
          const obs = String(comentario ?? '').trim();
          if (obs.length < 5) return;
          set((s) => ({
            estimaciones: s.estimaciones.map((e) => {
              if (!ids.includes(e.id)) return e;
              const desdeSeaboard = ['ENVIADO', 'PENDIENTE', 'RECHAZADO', 'REVERSADO'].includes(
                e.estado
              );
              if (!desdeSeaboard) return e;
              return {
                ...e,
                estado: 'APROBADO' as EstadoEstimacion,
                fechaAprobacion: ahoraFmt(),
                fechaRevision: ahoraFmt(),
                fechaModificacion: ahoraFmt(),
                usuarioModificacion: usuario,
                enviarAprobacion: 'SI',
                /** Conserva la fecha del push Liquidaciones → Seaboard (no la de aprobación). */
                fechaEnvio: e.fechaEnvio,
                comentariosSeaboard: [
                  ...e.comentariosSeaboard,
                  comentarioSeaboard('APROBAR', obs, usuario),
                ],
                auditoria: [
                  ...e.auditoria,
                  evento(
                    usuario,
                    'APROBACIÓN SEABOARD',
                    `Seaboard Marine aprobó el estimado y lo envió a liquidaciones RFS. Observación: ${obs}`
                  ),
                ],
              };
            }),
          }));
        },

        rechazar: (ids, usuario, comentario) => {
          const obs = String(comentario ?? '').trim();
          if (obs.length < 5) return;
          set((s) => ({
            estimaciones: s.estimaciones.map((e) => {
              if (
                !ids.includes(e.id) ||
                !['ENVIADO', 'PENDIENTE', 'RECHAZADO', 'REVERSADO'].includes(e.estado)
              ) {
                return e;
              }
              return {
                ...e,
                estado: 'RECHAZADO' as EstadoEstimacion,
                fechaRevision: ahoraFmt(),
                fechaModificacion: ahoraFmt(),
                usuarioModificacion: usuario,
                /** Conserva la fecha del push Liquidaciones → Seaboard. */
                fechaEnvio: e.fechaEnvio,
                comentariosSeaboard: [
                  ...e.comentariosSeaboard,
                  comentarioSeaboard('RECHAZAR', obs, usuario),
                ],
                auditoria: [
                  ...e.auditoria,
                  evento(
                    usuario,
                    'RECHAZO SEABOARD',
                    `Seaboard Marine rechazó el estimado y notificó a liquidaciones RFS: ${obs}`
                  ),
                ],
              };
            }),
          }));
        },

        enviarALiquidaciones: (id, usuario, comentario) => {
          const obs = String(comentario ?? '').trim();
          if (obs.length < 5) return;
          mutar(id, (e) => {
            if (!['ENVIADO', 'PENDIENTE', 'RECHAZADO', 'REVERSADO'].includes(e.estado)) {
              return e;
            }
            if (e.danos.length === 0) return e;
            const catalogo = useCatalogoCargoStore.getState().cargos;
            const {
              estado,
              paraLiquidaciones,
              soloRechazosCargoCliente,
              soloRechazosNoBloqueantes,
            } = resolverEstadoEnvioALiquidaciones(e.danos, catalogo);
            /**
             * Reglas desde catálogo de cargo.
             * APROBADO queda enviado; retorno rechazado libera bandeja a liquidaciones.
             */
            const liberarBandeja = paraLiquidaciones === 'RECHAZADO' || estado === 'RECHAZADO';
            const detalleAuditoria =
              soloRechazosNoBloqueantes || soloRechazosCargoCliente
                ? `Seaboard envió a liquidaciones RFS como APROBADO (rechazos de cargos no bloqueantes según catálogo; resto aprobado). Comentarios: ${obs}`
                : paraLiquidaciones === 'RECHAZADO'
                  ? `Seaboard envió a liquidaciones RFS (cabecera ${estado}; liquidaciones recibe ${paraLiquidaciones} según catálogo de cargo). Comentarios: ${obs}`
                  : `Seaboard envió a liquidaciones RFS como APROBADO. Comentarios: ${obs}`;
            return {
              ...e,
              estado,
              fechaRevision: ahoraFmt(),
              fechaModificacion: ahoraFmt(),
              usuarioModificacion: usuario,
              fechaAprobacion: estado === 'APROBADO' ? ahoraFmt() : e.fechaAprobacion,
              enviarAprobacion: liberarBandeja ? 'NO' : 'SI',
              fechaEnvio: e.fechaEnvio,
              comentariosSeaboard: [
                ...e.comentariosSeaboard,
                comentarioSeaboard(
                  paraLiquidaciones === 'RECHAZADO' ? 'RECHAZAR' : 'ENVIAR',
                  obs,
                  usuario
                ),
              ],
              auditoria: [
                ...e.auditoria,
                evento(
                  usuario,
                  paraLiquidaciones === 'RECHAZADO'
                    ? 'ENVÍO RECHAZADO A LIQUIDACIONES'
                    : 'ENVÍO APROBADO A LIQUIDACIONES',
                  detalleAuditoria
                ),
              ],
            };
          });
        },

        reversar: (ids, usuario, comentario) => {
          set((s) => ({
            estimaciones: s.estimaciones.map((e) => {
              if (
                !ids.includes(e.id) ||
                !(e.estado === 'ENVIADO' || (e.estado === 'PENDIENTE' && e.enviarAprobacion === 'SI'))
              ) {
                return e;
              }
              return {
                ...e,
                estado: 'REVERSADO' as EstadoEstimacion,
                enviarAprobacion: 'NO',
                fechaEnvio: '',
                fechaModificacion: ahoraFmt(),
                usuarioModificacion: usuario,
                comentariosSeaboard: [
                  ...e.comentariosSeaboard,
                  comentarioSeaboard('REVERSAR', comentario, usuario),
                ],
                auditoria: [...e.auditoria, evento(usuario, 'REVERSO DE ENVÍO', comentario)],
              };
            }),
          }));
        },

        reversarAprobacion: (id, usuario, comentario) => {
          mutar(id, (e) => {
            if (!['APROBADO', 'REPARADO'].includes(e.estado)) return e;
            return {
              ...e,
              /** Queda listo para volver a Enviar a SBM. */
              estado: 'REVERSADO' as EstadoEstimacion,
              fechaAprobacion: '',
              enviarAprobacion: 'NO',
              validadoLiquidaciones: false,
              fechaModificacion: ahoraFmt(),
              usuarioModificacion: usuario,
              /**
               * No se toca el estado de los ítems: los ya aprobados siguen Aprobado.
               * Solo se re-revisan los que luego se reverse/modifique (revisión parcial).
               */
              comentariosSeaboard: [
                ...e.comentariosSeaboard,
                comentarioSeaboard('REVERSAR', comentario, usuario),
              ],
              auditoria: [
                ...e.auditoria,
                evento(
                  usuario,
                  'REVERSO DE APROBACIÓN',
                  `${comentario} · Ítems ya aprobados se conservan; la nueva revisión solo aplica a ítems que se reverse o modifique.`
                ),
              ],
            };
          });
        },

        solicitarReversoAprobacion: (id, usuario, comentario) => {
          const obs = comentario.trim();
          if (obs.length < 5) return;
          mutar(id, (e) => {
            if (e.estado !== 'APROBADO') return e;
            return {
              ...e,
              fechaModificacion: ahoraFmt(),
              usuarioModificacion: usuario,
              comentariosSeaboard: [
                ...e.comentariosSeaboard,
                comentarioSeaboard('SOLICITAR_REVERSO', obs, usuario),
              ],
              auditoria: [
                ...e.auditoria,
                evento(
                  usuario,
                  'SOLICITUD DE REVERSO',
                  `${usuario} solicita a liquidaciones reversar ${e.codigo} para modificar ítems. Motivo: ${obs}`
                ),
              ],
            };
          });
        },

        marcarReparado: (id, usuario) => {
          mutar(id, (e) => {
            if (e.estado !== 'APROBADO') return e;
            return {
              ...e,
              estado: 'REPARADO' as EstadoEstimacion,
              fechaReparacion: ahoraFmt(),
              fechaModificacion: ahoraFmt(),
              usuarioModificacion: usuario,
              auditoria: [
                ...e.auditoria,
                evento(usuario, 'REPARACIÓN FINALIZADA', 'Trabajos ejecutados y evidencias cargadas.'),
              ],
            };
          });
        },

        eliminar: (id, usuario) => {
          set((s) => ({ estimaciones: s.estimaciones.filter((e) => e.id !== id) }));
          void usuario;
        },

        getEnviadosSeaboard: () =>
          get().estimaciones.filter(
            (e) =>
              esNavieraSeaboard(e.naviera) &&
              e.enviarAprobacion === 'SI' &&
              (e.estado === 'PENDIENTE' || e.estado === 'ENVIADO')
          ),

        setActividad: (id, actividad, usuario) => {
          mutar(id, (e) => {
            if (e.actividad === actividad) return e;
            return {
              ...e,
              actividad,
              fechaModificacion: ahoraFmt(),
              usuarioModificacion: usuario,
              auditoria: [
                ...e.auditoria,
                evento(
                  usuario,
                  'CAMBIO DE ACTIVIDAD',
                  `Actividad modificada de ${e.actividad} a ${actividad}`
                ),
              ],
            };
          });
        },

        setSap: (id, campos, usuario) => {
          mutar(id, (e) => {
            const detalles: string[] = [];
            if (campos.itinerarioSap !== undefined && campos.itinerarioSap !== e.itinerarioSap) {
              detalles.push(`Itinerario SAP: "${campos.itinerarioSap}"`);
            }
            if (campos.almacenSap !== undefined && campos.almacenSap !== e.almacenSap) {
              detalles.push(`Almacén SAP: "${campos.almacenSap}"`);
            }
            if (detalles.length === 0) return e;
            return {
              ...e,
              ...campos,
              fechaModificacion: ahoraFmt(),
              usuarioModificacion: usuario,
              auditoria: [...e.auditoria, evento(usuario, 'ACTUALIZACIÓN SAP', detalles.join(' · '))],
            };
          });
        },

        setTipoCobro: (id, tipo, usuario) => {
          mutar(id, (e) => {
            if (e.tipoCobro === tipo) return e;
            const cargo = cargoDesdeTipoCobro(tipo);
            const danos = e.danos.map((d) =>
              esAplicaRechazado(d.aplica) || esItemAprobado(d.aplica) ? d : { ...d, cargo }
            );
            const etiqueta = tipo === 'CLIENTE' ? 'Cliente' : 'Línea';
            return {
              ...e,
              tipoCobro: tipo,
              danos,
              fechaModificacion: ahoraFmt(),
              usuarioModificacion: usuario,
              auditoria: [
                ...e.auditoria,
                evento(
                  usuario,
                  'TIPO DE COBRO',
                  `Cobro marcado a ${etiqueta}. Se actualizó el cargo de las líneas vigentes.`
                ),
              ],
            };
          });
        },

        revalidarTarifas: (id, usuario) => {
          mutar(id, (e) =>
            recalcular({
              ...e,
              fechaModificacion: ahoraFmt(),
              usuarioModificacion: usuario,
              auditoria: [
                ...e.auditoria,
                evento(
                  usuario,
                  'REVALIDACIÓN DE TARIFAS',
                  `Tarifas revalidadas contra el catálogo vigente sobre ${e.danos.length} línea(s)`
                ),
              ],
            })
          );
        },

        agregarDano: (id, dano, usuario) => {
          mutar(id, (e) => {
            const linea = e.danos.reduce((max, d) => Math.max(max, d.linea), 0) + 1;
            const fecha = ahoraFmt();
            const nuevo: DanoEstimacion = {
              ...dano,
              id: uid('dano'),
              linea,
              cargo: normalizarCargoDano(dano.cargo) || CARGO_DEFAULT,
              aplica: normalizarAplicaDano(dano.aplica) || APLICA_PENDIENTE,
              historialAcciones: [],
            };
            nuevo.historialAcciones = [entradaCreacionItem(nuevo, usuario, fecha)];
            return recalcular({
              ...e,
              danos: [...e.danos, nuevo],
              fechaModificacion: ahoraFmt(),
              usuarioModificacion: usuario,
              auditoria: [
                ...e.auditoria,
                evento(
                  usuario,
                  'DAÑO AGREGADO',
                  `Línea ${linea} · ${nuevo.comp} · ${nuevo.dano} · $${nuevo.csTotal.toFixed(2)}`
                ),
              ],
            });
          });
        },

        actualizarDano: (id, danoId, cambios, usuario, etiqueta) => {
          mutar(id, (e) => {
            const anterior = e.danos.find((d) => d.id === danoId);
            if (!anterior) return e;
            /** Ítem aprobado: no se edita hasta reversar. */
            if (esItemAprobado(anterior.aplica)) return e;
            const fecha = ahoraFmt();
            const danos = e.danos.map((d) => {
              if (d.id !== danoId) return d;
              const mezclado = { ...d, ...cambios };
              const actualizado = {
                ...mezclado,
                csTotal: round2(mezclado.csHoraHombre + mezclado.csMaterial),
              };
              const entrada = construirEntradaDesdeCambios(
                anterior,
                actualizado,
                usuario,
                fecha,
                etiqueta ?? `Línea ${anterior.linea} · ${anterior.comp} actualizado`,
                {
                  comentario: cambios.edicionReciente?.comentarioSbm,
                  edicionReciente: cambios.edicionReciente,
                }
              );
              return {
                ...actualizado,
                historialAcciones: appendHistorialItem(d.historialAcciones, entrada),
              };
            });
            const actualizado = danos.find((d) => d.id === danoId)!;
            return recalcular({
              ...e,
              danos,
              fechaModificacion: ahoraFmt(),
              usuarioModificacion: usuario,
              auditoria: [
                ...e.auditoria,
                evento(
                  usuario,
                  'DAÑO MODIFICADO',
                  `${usuario}: ${etiqueta ?? `Línea ${anterior.linea} · ${anterior.comp} actualizado`}`,
                  [aLineaHistorial(actualizado)]
                ),
              ],
            });
          });
        },

        resolverItemsMasivo: (id, danoIds, accion, usuario, comentario, rol) => {
          if (danoIds.length === 0) return;
          const motivo = String(comentario ?? '').trim();
          /** Observación obligatoria en aprobación y rechazo: evidencia de decisión manual. */
          if (motivo.length < 5) return;
          const rolActor: RolComentario = rol ?? 'SEABOARD';
          const ids = new Set(danoIds);
          mutar(id, (e) => {
            const afectados = e.danos.filter((d) => {
              if (!ids.has(d.id)) return false;
              /** Aprobados: solo se tocan vía reversa. */
              if (esItemAprobado(d.aplica)) return false;
              return true;
            });
            if (afectados.length === 0) return e;
            const idsOk = new Set(afectados.map((d) => d.id));
            const fecha = ahoraFmt();
            const danos = e.danos.map((d) => {
              if (!idsOk.has(d.id)) return d;
              if (accion === 'RECHAZAR') {
                const cmt: ComentarioDano = {
                  id: uid('cmt'),
                  usuario,
                  rol: rolActor,
                  fecha,
                  tipo: 'RECHAZADO',
                  mensaje: motivo,
                  campoAfectado: 'Estado',
                  valorAnterior: `${d.aplica} · HH ${d.horasHombre} · $${d.csTotal}`,
                  valorNuevo: `${APLICA_RECHAZADO_SBM} · HH 0 · $0`,
                };
                return {
                  ...d,
                  aplica: APLICA_RECHAZADO_SBM,
                  ...valoresCeroPorRechazoItem(),
                  comentarios: [...d.comentarios, cmt],
                  historialAcciones: appendHistorialItem(
                    d.historialAcciones,
                    entradaRechazoItem(d, usuario, fecha, motivo)
                  ),
                };
              }
              const cmtAprobado: ComentarioDano = {
                id: uid('cmt'),
                usuario,
                rol: rolActor,
                fecha,
                tipo: 'ACEPTADO',
                mensaje: motivo,
                campoAfectado: 'Estado',
                valorAnterior: d.aplica,
                valorNuevo: APLICA_APROBADO_SBM,
              };
              return {
                ...d,
                aplica: APLICA_APROBADO_SBM,
                comentarios: [...d.comentarios, cmtAprobado],
                historialAcciones: appendHistorialItem(
                  d.historialAcciones,
                  entradaAprobacionItem(d, usuario, fecha, motivo)
                ),
              };
            });
            const lineasTxt = afectados.map((d) => String(d.linea).padStart(2, '0')).join(', ');
            const lineasSnap = danos.filter((d) => idsOk.has(d.id)).map(aLineaHistorial);
            return recalcular({
              ...e,
              danos,
              fechaModificacion: ahoraFmt(),
              usuarioModificacion: usuario,
              auditoria: [
                ...e.auditoria,
                evento(
                  usuario,
                  accion === 'RECHAZAR' ? 'ÍTEMS RECHAZADOS' : 'ÍTEMS APROBADOS',
                  accion === 'RECHAZAR'
                    ? `${usuario} rechazó ${afectados.length} línea(s): ${lineasTxt}. Observación: ${motivo}`
                    : `${usuario} aprobó ${afectados.length} línea(s): ${lineasTxt}. Observación: ${motivo}`,
                  lineasSnap
                ),
              ],
            });
          });
        },

        reversarItemsMasivo: (id, danoIds, usuario, comentario, rol) => {
          if (danoIds.length === 0) return;
          const motivo = String(comentario ?? '').trim();
          if (motivo.length < 5) return;
          const rolActor: RolComentario = rol ?? 'SEABOARD';
          const ids = new Set(danoIds);
          mutar(id, (e) => {
            const afectados = e.danos.filter(
              (d) => ids.has(d.id) && esItemAprobado(d.aplica)
            );
            if (afectados.length === 0) return e;
            const idsOk = new Set(afectados.map((d) => d.id));
            const fecha = ahoraFmt();
            const danos = e.danos.map((d) => {
              if (!idsOk.has(d.id)) return d;
              const cmt: ComentarioDano = {
                id: uid('cmt'),
                usuario,
                rol: rolActor,
                fecha,
                tipo: 'INFORMATIVO',
                mensaje: motivo,
                campoAfectado: 'Estado',
                valorAnterior: d.aplica,
                valorNuevo: APLICA_PENDIENTE,
              };
              return {
                ...d,
                aplica: APLICA_PENDIENTE,
                comentarios: [...d.comentarios, cmt],
                historialAcciones: appendHistorialItem(
                  d.historialAcciones,
                  entradaReversaItem(d, usuario, fecha, motivo)
                ),
              };
            });
            const lineasTxt = afectados.map((d) => String(d.linea).padStart(2, '0')).join(', ');
            const lineasSnap = danos.filter((d) => idsOk.has(d.id)).map(aLineaHistorial);
            const eraAprobadoCabecera = ['APROBADO', 'REPARADO'].includes(e.estado);
            /**
             * Reversa de ítem(s) en estimado ya aprobado: el estimado vuelve a REVERSADO
             * para editar/reenviar, pero el resto de ítems aprobados se conservan
             * (revisión parcial — la línea solo re-revisa lo pendiente).
             */
            const cabecera = eraAprobadoCabecera
              ? {
                  estado: 'REVERSADO' as EstadoEstimacion,
                  fechaAprobacion: '',
                  enviarAprobacion: 'NO',
                  validadoLiquidaciones: false,
                }
              : {};
            return recalcular({
              ...e,
              ...cabecera,
              danos,
              fechaModificacion: ahoraFmt(),
              usuarioModificacion: usuario,
              auditoria: [
                ...e.auditoria,
                evento(
                  usuario,
                  eraAprobadoCabecera ? 'REVISIÓN PARCIAL · ÍTEMS REVERSADOS' : 'ÍTEMS REVERSADOS',
                  eraAprobadoCabecera
                    ? `${usuario} revirtió ${afectados.length} línea(s) (${lineasTxt}) a Pendiente de revisión. El estimado pasa a REVERSADO; los demás ítems aprobados se mantienen (no requieren nueva revisión). Observación: ${motivo}`
                    : `${usuario} revirtió ${afectados.length} línea(s) aprobada(s) a Pendiente de revisión: ${lineasTxt}. Observación: ${motivo}`,
                  lineasSnap
                ),
              ],
            });
          });
        },

        eliminarDano: (id, danoId, usuario) => {
          mutar(id, (e) => {
            const objetivo = e.danos.find((d) => d.id === danoId);
            if (!objetivo) return e;
            if (esItemAprobado(objetivo.aplica)) return e;
            return recalcular({
              ...e,
              danos: e.danos
                .filter((d) => d.id !== danoId)
                .map((d, i) => ({ ...d, linea: i + 1 })),
              fechaModificacion: ahoraFmt(),
              usuarioModificacion: usuario,
              auditoria: [
                ...e.auditoria,
                evento(
                  usuario,
                  'DAÑO ELIMINADO',
                  `Línea ${objetivo.linea} · ${objetivo.comp} · ${objetivo.dano} retirado del estimado`
                ),
              ],
            });
          });
        },

        agregarComentarioDano: (id, danoId, entrada) => {
          mutar(id, (e) => {
            const objetivo = e.danos.find((d) => d.id === danoId);
            if (!objetivo) return e;
            if (esItemAprobado(objetivo.aplica) && entrada.tipo === 'SOLICITA_CAMBIO') {
              return e;
            }
            const comentario: ComentarioDano = {
              id: uid('cd'),
              usuario: entrada.usuario,
              rol: entrada.rol,
              fecha: ahoraFmt(),
              tipo: entrada.tipo,
              mensaje: entrada.mensaje,
              campoAfectado: entrada.campoAfectado,
            };
            return {
              ...e,
              danos: e.danos.map((d) =>
                d.id === danoId
                  ? {
                      ...d,
                      comentarios: [...d.comentarios, comentario],
                      historialAcciones: appendHistorialItem(
                        d.historialAcciones,
                        entradaComentarioItem(comentario)
                      ),
                    }
                  : d
              ),
              fechaModificacion: ahoraFmt(),
              usuarioModificacion: entrada.usuario,
              auditoria: [
                ...e.auditoria,
                evento(
                  entrada.usuario,
                  'COMENTARIO EN DAÑO',
                  `${entrada.usuario} · Línea ${objetivo.linea} · ${entrada.rol} · ${entrada.tipo.replace('_', ' ')}: ${entrada.mensaje}`
                ),
              ],
            };
          });
        },

        agregarNota: (id, texto, usuario) => {
          mutar(id, (e) => ({
            ...e,
            notas: [...e.notas, { id: uid('nota'), fecha: ahoraFmt(), usuario, texto }],
            fechaModificacion: ahoraFmt(),
            usuarioModificacion: usuario,
            auditoria: [...e.auditoria, evento(usuario, 'NOTA AGREGADA', texto)],
          }));
        },

        registrarActividad: (id, usuario, accion, detalle, lineas) => {
          mutar(id, (e) => ({
            ...e,
            auditoria: [...e.auditoria, evento(usuario, accion, detalle, lineas)],
          }));
        },

        restaurarDesdeApertura: (id, snap) => {
          mutar(id, (e) =>
            recalcular({
              ...e,
              danos: structuredClone(snap.danos),
              notas: e.notas.slice(0, Math.max(0, snap.notasCount)),
            })
          );
        },

        generarEstimadoDesdeItems: (seleccion, usuario, cargoCobro) => {
          if (!seleccion.length) return null;
          const cargo = normalizarCargoDano(cargoCobro);
          const origenes: { est: Estimacion; dano: DanoEstimacion }[] = [];
          for (const s of seleccion) {
            const est = get().estimaciones.find((e) => e.id === s.estimacionId);
            const dano = est?.danos.find((d) => d.id === s.danoId);
            if (!est || !dano) continue;
            if (!esAplicaRechazado(dano.aplica)) continue;
            origenes.push({ est, dano });
          }
          if (origenes.length === 0) return null;

          const contenedores = new Set(origenes.map((o) => o.est.contenedor));
          if (contenedores.size > 1) return null;

          const base = origenes[0].est;
          const fecha = ahoraFmt();
          const anio = new Date().getFullYear();
          const codigo = siguienteCodigoEstimado(get().estimaciones, anio);
          const refs = origenes
            .map((o) => `${o.est.codigo} L${String(o.dano.linea).padStart(2, '0')} (${o.dano.comp})`)
            .join('; ');
          const codigosOrigen = Array.from(new Set(origenes.map((o) => o.est.codigo))).join(', ');

          const danosNuevos: DanoEstimacion[] = origenes.map((o, i) => {
            const costos = costosPreviosAlRechazo(o.dano);
            const nuevo: DanoEstimacion = {
              ...structuredClone(o.dano),
              id: uid('dano'),
              linea: i + 1,
              ...costos,
              aplica: APLICA_PENDIENTE,
              cargo,
              comentarios: [
                {
                  id: uid('cd'),
                  usuario,
                  rol: 'LIQUIDACIONES',
                  fecha,
                  tipo: 'INFORMATIVO',
                  mensaje: `Ítem generado desde rechazo en ${o.est.codigo} línea ${o.dano.linea}. Cobro: ${cargo}. Observación origen: ${
                    o.dano.comentarios.find((c) => c.tipo === 'RECHAZADO')?.mensaje ||
                    o.dano.historialAcciones?.find((h) => h.tipo === 'RECHAZO')?.comentario ||
                    's/d'
                  }`,
                  campoAfectado: 'Cargo',
                  valorAnterior: normalizarCargoDano(o.dano.cargo),
                  valorNuevo: cargo,
                },
              ],
              edicionReciente: undefined,
              historialAcciones: [],
            };
            nuevo.historialAcciones = [entradaCreacionItem(nuevo, usuario, fecha)];
            return nuevo;
          });

          const tipoCobro = tipoCobroDesdeCargo(cargo);

          // Nuevo registro: código distinto; mismo contenedor/movimiento del original.
          // El estimado origen NO se modifica (queda como histórico), solo auditoría.
          const creado = recalcular({
            id: uid('est'),
            codigo,
            semana: semanaIso(),
            anio,
            estado: 'PENDIENTE',
            // Datos de contenedor / movimiento (mismos del origen)
            contenedor: base.contenedor,
            tipoContenedor: base.tipoContenedor,
            codigoRfs: base.codigoRfs,
            modeloMaquina: base.modeloMaquina,
            naviera: base.naviera,
            buque: base.buque,
            viaje: base.viaje,
            fechaGateIn: base.fechaGateIn,
            diasEstadia: base.diasEstadia,
            lugarEstimacion: base.lugarEstimacion,
            lugarAsistencia: base.lugarAsistencia,
            actividad: base.actividad,
            tipoEstimacion: base.tipoEstimacion,
            tipoDano: base.tipoDano,
            tecnico: base.tecnico,
            estadoPti: base.estadoPti,
            fechaFinPti: base.fechaFinPti,
            itinerarioSap: base.itinerarioSap,
            almacenSap: base.almacenSap,
            ediEnviadoOne: 'NO',
            fechaEnvioEdiOne: '',
            niveles: base.niveles,
            pais: base.pais,
            garantia: structuredClone(base.garantia),
            inspeccion: {
              ...structuredClone(base.inspeccion),
              codigo: `INSP-${codigo.slice(-6)}`,
              fecha: base.fechaGateIn || base.inspeccion.fecha,
            },
            // Cabecera del nuevo estimado (no reutiliza el código origen)
            fechaElaboracion: fecha,
            fechaReparacion: '',
            fechaEnvio: '',
            fechaAprobacion: '',
            fechaRevision: '',
            enviarAprobacion: 'NO',
            validadoLiquidaciones: false,
            fechaValidacionLiquidaciones: undefined,
            tipoCobro,
            codigoOrigen: codigosOrigen,
            estimadoOrigenId: base.id,
            analisisObservacion: `Nuevo estimado ${codigo} (código distinto del origen ${codigosOrigen}). Mismo contenedor ${base.contenedor} · buque ${base.buque || '—'} · viaje ${base.viaje || '—'} · GateIn ${base.fechaGateIn || '—'}. Cobro: ${cargo}. Ítems desde: ${refs}`,
            fechaModificacion: fecha,
            usuarioModificacion: usuario,
            horasHombre: 0,
            pvpHorasHombre: 0,
            pvpMateriales: 0,
            pvpTotal: 0,
            sinDanos: false,
            danos: danosNuevos,
            notas: [
              {
                id: uid('nota'),
                fecha,
                usuario,
                texto: `Registro nuevo ${codigo} generado desde rechazos del histórico ${codigosOrigen}. Contenedor ${base.contenedor} · movimiento ${base.buque || 's/d'} / ${base.viaje || 's/d'}. Cobro: ${cargo}.`,
              },
            ],
            auditoria: [
              evento(
                usuario,
                'ESTIMADO GENERADO DESDE RECHAZOS',
                `${usuario} creó ${codigo} (nuevo código) desde histórico ${codigosOrigen} · contenedor ${base.contenedor} · cobro ${cargo} · ${origenes.length} línea(s): ${refs}`,
                danosNuevos.map(aLineaHistorial)
              ),
            ],
            comentariosSeaboard: [],
          });

          // Inserta el nuevo; el original permanece intacto (solo se agrega auditoría).
          set((s) => ({ estimaciones: [creado, ...s.estimaciones] }));

          const porEst = new Map<string, DanoEstimacion[]>();
          origenes.forEach((o) => {
            const list = porEst.get(o.est.id) ?? [];
            list.push(o.dano);
            porEst.set(o.est.id, list);
          });
          porEst.forEach((danos, estId) => {
            mutar(estId, (e) => ({
              ...e,
              // No cambia estado, daños ni código del estimado histórico.
              auditoria: [
                ...e.auditoria,
                evento(
                  usuario,
                  'ÍTEMS ENVIADOS A NUEVO ESTIMADO',
                  `Histórico conservado (${e.codigo}). Líneas ${danos
                    .map((d) => String(d.linea).padStart(2, '0'))
                    .join(', ')} generaron el nuevo registro ${codigo} · cobro ${cargo}`,
                  danos.map(aLineaHistorial)
                ),
              ],
            }));
          });

          return creado;
        },

        crearEstimado: (datos, usuario) => {
          const fecha = ahoraFmt();
          const anio = new Date().getFullYear();
          const codigo = siguienteCodigoEstimado(get().estimaciones, anio);
          const contenedor = datos.contenedor.trim().toUpperCase();
          const tipoEst = datos.tipoEstimacion.trim() || 'Máquina';
          const creado = recalcular({
            id: uid('est'),
            codigo,
            semana: semanaIso(),
            anio,
            estado: 'PENDIENTE',
            contenedor,
            tipoContenedor: datos.tipoContenedor?.trim() || '',
            codigoRfs: datos.codigoRfs?.trim() || '',
            modeloMaquina: datos.modeloMaquina?.trim() || '',
            naviera: datos.naviera.trim(),
            buque: datos.buque?.trim() || '',
            viaje: datos.viaje?.trim() || '',
            fechaGateIn: '',
            diasEstadia: 0,
            lugarEstimacion: datos.lugarEstimacion?.trim() || '',
            lugarAsistencia: datos.lugarEstimacion?.trim() || '',
            actividad: datos.actividad ?? 'DM',
            tipoEstimacion: tipoEst,
            tipoDano: '',
            tecnico: datos.tecnico?.trim() || usuario,
            estadoPti: '',
            fechaFinPti: '',
            itinerarioSap: '',
            almacenSap: '',
            ediEnviadoOne: 'NO',
            fechaEnvioEdiOne: '',
            niveles: '',
            pais: datos.pais,
            garantia: {
              enGarantia: false,
              proveedor: '',
              fechaInicio: '',
              fechaFin: '',
              ordenGarantia: '',
              observacion: '',
            },
            inspeccion: {
              codigo: `INSP-${codigo.slice(-6)}`,
              fecha: '',
              inspector: '',
              resultado: '',
              observacion: '',
            },
            fechaElaboracion: fecha,
            fechaReparacion: '',
            fechaEnvio: '',
            fechaAprobacion: '',
            fechaRevision: '',
            enviarAprobacion: 'NO',
            validadoLiquidaciones: false,
            analisisObservacion: `Estimado creado por coordinador (${usuario}). Pendiente de agregar daños y de envío a línea por Liquidaciones.`,
            fechaModificacion: fecha,
            usuarioModificacion: usuario,
            horasHombre: 0,
            pvpHorasHombre: 0,
            pvpMateriales: 0,
            pvpTotal: 0,
            sinDanos: true,
            /** Cargo por defecto: Línea. */
            tipoCobro: 'LINEA' as const,
            danos: [],
            notas: [
              {
                id: uid('nota'),
                fecha,
                usuario,
                texto: `Estimado ${codigo} creado por Coordinador. Contenedor ${contenedor} · naviera ${datos.naviera}. Liquidaciones revisará el historial y enviará a la línea cuando corresponda.`,
              },
            ],
            auditoria: [
              evento(
                usuario,
                'ESTIMADO CREADO POR COORDINADOR',
                `${usuario} creó ${codigo} · contenedor ${contenedor} · naviera ${datos.naviera} · tipo ${tipoEst}. Queda PENDIENTE para Liquidaciones (envío a línea).`
              ),
            ],
            comentariosSeaboard: [],
          });

          set((s) => ({ estimaciones: [creado, ...s.estimaciones] }));
          return creado;
        },
      };
    },
    { name: STORAGE_KEY }
  )
);
