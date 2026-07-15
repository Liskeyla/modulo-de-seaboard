import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import seedData from '@/data/estimacionesSeed.json';
import type { ComentarioSeaboard, Estimacion, EstadoEstimacion } from '@/types/estimacion';

const STORAGE_KEY = 'dms-estimaciones-prototipo';

function ahoraFmt() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ahoraIso() {
  return new Date().toISOString();
}

function addComentario(
  est: Estimacion,
  accion: ComentarioSeaboard['accion'],
  comentario: string,
  usuario: string
): ComentarioSeaboard[] {
  return [
    ...est.comentariosSeaboard,
    {
      id: `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      fecha: ahoraFmt(),
      usuario,
      accion,
      comentario,
    },
  ];
}

interface EstimacionesState {
  estimaciones: Estimacion[];
  hydrate: () => void;
  reset: () => void;
  enviarAprobacion: (ids: string[], usuario: string) => void;
  aprobar: (ids: string[], usuario: string, comentario?: string) => void;
  rechazar: (ids: string[], usuario: string, comentario: string) => void;
  reversar: (ids: string[], usuario: string, comentario: string) => void;
  reversarAprobacion: (id: string, usuario: string, comentario: string) => void;
  getEnviadosSeaboard: () => Estimacion[];
}

export const useEstimacionesStore = create<EstimacionesState>()(
  persist(
    (set, get) => ({
      estimaciones: seedData as Estimacion[],

      hydrate: () => {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.state?.estimaciones?.length) {
            set({ estimaciones: parsed.state.estimaciones });
          }
        } catch {
          /* ignore */
        }
      },

      reset: () => set({ estimaciones: seedData as Estimacion[] }),

      enviarAprobacion: (ids, usuario) => {
        set((s) => ({
          estimaciones: s.estimaciones.map((e) => {
            if (!ids.includes(e.id) || e.estado !== 'PENDIENTE') return e;
            return {
              ...e,
              estado: 'ENVIADO' as EstadoEstimacion,
              enviarAprobacion: 'SI',
              fechaEnvio: ahoraFmt(),
              fechaModificacion: ahoraIso(),
              usuarioModificacion: usuario,
              comentariosSeaboard: addComentario(e, 'ENVIAR', 'Enviado a aprobación Seaboard', usuario),
            };
          }),
        }));
      },

      aprobar: (ids, usuario, comentario = 'Aprobado por Seaboard') => {
        set((s) => ({
          estimaciones: s.estimaciones.map((e) => {
            if (!ids.includes(e.id) || e.estado !== 'ENVIADO') return e;
            return {
              ...e,
              estado: 'APROBADO' as EstadoEstimacion,
              fechaAprobacion: ahoraFmt(),
              fechaModificacion: ahoraIso(),
              usuarioModificacion: usuario,
              comentariosSeaboard: addComentario(e, 'APROBAR', comentario, usuario),
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
              fechaModificacion: ahoraIso(),
              usuarioModificacion: usuario,
              comentariosSeaboard: addComentario(e, 'RECHAZAR', comentario, usuario),
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
              fechaModificacion: ahoraIso(),
              usuarioModificacion: usuario,
              comentariosSeaboard: addComentario(e, 'REVERSAR', comentario, usuario),
            };
          }),
        }));
      },

      reversarAprobacion: (id, usuario, comentario) => {
        set((s) => ({
          estimaciones: s.estimaciones.map((e) => {
            if (e.id !== id || e.estado !== 'APROBADO') return e;
            return {
              ...e,
              estado: 'PENDIENTE' as EstadoEstimacion,
              fechaAprobacion: '',
              enviarAprobacion: 'NO',
              fechaModificacion: ahoraIso(),
              usuarioModificacion: usuario,
              comentariosSeaboard: addComentario(e, 'REVERSAR', comentario, usuario),
            };
          }),
        }));
      },

      getEnviadosSeaboard: () => {
        return get().estimaciones.filter(
          (e) =>
            e.estado === 'ENVIADO' &&
            e.naviera.toUpperCase().includes('SEABOARD')
        );
      },
    }),
    { name: STORAGE_KEY }
  )
);
