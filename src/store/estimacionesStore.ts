import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import seedData from '@/data/estimacionesSeed.json';
import type {
  Actividad,
  AplicaDano,
  ComentarioDano,
  ComentarioSeaboard,
  DanoEstimacion,
  Estimacion,
  EstadoEstimacion,
  EventoAuditoria,
  RolComentario,
  TipoComentario,
} from '@/types/estimacion';
import { APLICA_APROBADO_SBM, APLICA_RECHAZADO_SBM } from '@/types/estimacion';

const STORAGE_KEY = 'dms-estimaciones-prototipo-v8';
const CLAVES_OBSOLETAS = [
  'dms-estimaciones-prototipo',
  'dms-estimaciones-prototipo-v2',
  'dms-estimaciones-prototipo-v3',
  'dms-estimaciones-prototipo-v4',
  'dms-estimaciones-prototipo-v5',
  'dms-estimaciones-prototipo-v6',
  'dms-estimaciones-prototipo-v7',
];

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

function evento(usuario: string, accion: string, detalle: string): EventoAuditoria {
  return { id: uid('ev'), fecha: ahoraFmt(), usuario, accion, detalle };
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
  aprobar: (ids: string[], usuario: string, comentario?: string) => void;
  rechazar: (ids: string[], usuario: string, comentario: string) => void;
  reversar: (ids: string[], usuario: string, comentario: string) => void;
  reversarAprobacion: (id: string, usuario: string, comentario: string) => void;
  marcarReparado: (id: string, usuario: string) => void;
  eliminar: (id: string, usuario: string) => void;
  getEnviadosSeaboard: () => Estimacion[];

  // Edición del estimado
  setActividad: (id: string, actividad: Actividad, usuario: string) => void;
  setSap: (id: string, campos: { itinerarioSap?: string; almacenSap?: string }, usuario: string) => void;
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
    /** Obligatorio al rechazar: motivo que queda en comentarios de cada línea. */
    comentario?: string
  ) => void;
  eliminarDano: (id: string, danoId: string, usuario: string) => void;

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
        estimaciones: seedData as unknown as Estimacion[],

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
              set({ estimaciones: guardadas });
            }
          } catch {
            /* ignore */
          }
        },

        reset: () => set({ estimaciones: seedData as unknown as Estimacion[] }),

        getByCodigo: (codigo) => get().estimaciones.find((e) => e.codigo === codigo),

        enviarAprobacion: (ids, usuario) => {
          set((s) => ({
            estimaciones: s.estimaciones.map((e) => {
              if (!ids.includes(e.id) || !['PENDIENTE', 'RECHAZADO', 'REVERSADO'].includes(e.estado)) {
                return e;
              }
              return {
                ...e,
                estado: 'ENVIADO' as EstadoEstimacion,
                enviarAprobacion: 'SI',
                fechaEnvio: ahoraFmt(),
                fechaModificacion: ahoraFmt(),
                usuarioModificacion: usuario,
                comentariosSeaboard: [
                  ...e.comentariosSeaboard,
                  comentarioSeaboard('ENVIAR', 'Enviado a aprobación de la naviera.', usuario),
                ],
                auditoria: [
                  ...e.auditoria,
                  evento(
                    usuario,
                    'ENVÍO A APROBACIÓN',
                    `Enviado a ${e.naviera} por un total de $${e.pvpTotal.toFixed(2)}`
                  ),
                ],
              };
            }),
          }));
        },

        aprobar: (ids, usuario, comentario = 'Aprobado sin novedades por la naviera.') => {
          set((s) => ({
            estimaciones: s.estimaciones.map((e) => {
              if (!ids.includes(e.id) || e.estado !== 'ENVIADO') return e;
              return {
                ...e,
                estado: 'APROBADO' as EstadoEstimacion,
                fechaAprobacion: ahoraFmt(),
                fechaModificacion: ahoraFmt(),
                usuarioModificacion: usuario,
                comentariosSeaboard: [
                  ...e.comentariosSeaboard,
                  comentarioSeaboard('APROBAR', comentario, usuario),
                ],
                auditoria: [
                  ...e.auditoria,
                  evento(usuario, 'APROBACIÓN', 'La naviera aprobó el estimado. Habilitado para reparación.'),
                ],
              };
            }),
          }));
        },

        rechazar: (ids, usuario, comentario) => {
          set((s) => ({
            estimaciones: s.estimaciones.map((e) => {
              if (!ids.includes(e.id) || e.estado !== 'ENVIADO') return e;
              return {
                ...e,
                estado: 'RECHAZADO' as EstadoEstimacion,
                fechaModificacion: ahoraFmt(),
                usuarioModificacion: usuario,
                comentariosSeaboard: [
                  ...e.comentariosSeaboard,
                  comentarioSeaboard('RECHAZAR', comentario, usuario),
                ],
                auditoria: [...e.auditoria, evento(usuario, 'RECHAZO', comentario)],
              };
            }),
          }));
        },

        reversar: (ids, usuario, comentario) => {
          set((s) => ({
            estimaciones: s.estimaciones.map((e) => {
              if (!ids.includes(e.id) || e.estado !== 'ENVIADO') return e;
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
              estado: 'PENDIENTE' as EstadoEstimacion,
              fechaAprobacion: '',
              enviarAprobacion: 'NO',
              fechaModificacion: ahoraFmt(),
              usuarioModificacion: usuario,
              comentariosSeaboard: [
                ...e.comentariosSeaboard,
                comentarioSeaboard('REVERSAR', comentario, usuario),
              ],
              auditoria: [...e.auditoria, evento(usuario, 'REVERSO DE APROBACIÓN', comentario)],
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
            (e) => e.estado === 'ENVIADO' && e.naviera.toUpperCase().includes('SEABOARD')
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
            const nuevo: DanoEstimacion = { ...dano, id: uid('dano'), linea };
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
            const danos = e.danos.map((d) => {
              if (d.id !== danoId) return d;
              const mezclado = { ...d, ...cambios };
              return {
                ...mezclado,
                csTotal: round2(mezclado.csHoraHombre + mezclado.csMaterial),
              };
            });
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
                  etiqueta ?? `Línea ${anterior.linea} · ${anterior.comp} actualizado`
                ),
              ],
            });
          });
        },

        resolverItemsMasivo: (id, danoIds, accion, usuario, comentario) => {
          if (danoIds.length === 0) return;
          if (accion === 'RECHAZAR' && !String(comentario ?? '').trim()) return;
          const motivo = String(comentario ?? '').trim();
          const ids = new Set(danoIds);
          mutar(id, (e) => {
            const afectados = e.danos.filter((d) => ids.has(d.id));
            if (afectados.length === 0) return e;
            const danos = e.danos.map((d) => {
              if (!ids.has(d.id)) return d;
              if (accion === 'RECHAZAR') {
                const cmt: ComentarioDano = {
                  id: uid('cmt'),
                  usuario,
                  rol: 'TECNICO',
                  fecha: ahoraFmt(),
                  tipo: 'RECHAZADO',
                  mensaje: motivo,
                  campoAfectado: 'Aplica',
                  valorAnterior: d.aplica,
                  valorNuevo: APLICA_RECHAZADO_SBM,
                };
                return {
                  ...d,
                  aplica: APLICA_RECHAZADO_SBM,
                  comentarios: [...d.comentarios, cmt],
                };
              }
              return { ...d, aplica: APLICA_APROBADO_SBM };
            });
            const lineas = afectados.map((d) => String(d.linea).padStart(2, '0')).join(', ');
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
                    ? `${afectados.length} línea(s): ${lineas}. Motivo: ${motivo}`
                    : `${afectados.length} línea(s): ${lineas}`
                ),
              ],
            });
          });
        },

        eliminarDano: (id, danoId, usuario) => {
          mutar(id, (e) => {
            const objetivo = e.danos.find((d) => d.id === danoId);
            if (!objetivo) return e;
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
                d.id === danoId ? { ...d, comentarios: [...d.comentarios, comentario] } : d
              ),
              fechaModificacion: ahoraFmt(),
              usuarioModificacion: entrada.usuario,
              auditoria: [
                ...e.auditoria,
                evento(
                  entrada.usuario,
                  'COMENTARIO EN DAÑO',
                  `Línea ${objetivo.linea} · ${entrada.rol} · ${entrada.tipo.replace('_', ' ')}: ${entrada.mensaje}`
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
      };
    },
    { name: STORAGE_KEY }
  )
);
