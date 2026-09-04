import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  MONTO_REPARACION_SEED,
  type MontoReparacion,
} from '@/types/montoReparacion';

const STORAGE_KEY = 'dms-monto-reparacion-v1';

function ahoraFmt() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

interface MontoReparacionState {
  montos: MontoReparacion[];
  getActivos: () => MontoReparacion[];
  upsert: (
    data: Partial<MontoReparacion> & { descripcion: string },
    usuario: string
  ) => string;
  eliminar: (id: string) => void;
  toggleActivo: (id: string, usuario: string) => void;
  resetSeed: () => void;
}

export const useMontoReparacionStore = create<MontoReparacionState>()(
  persist(
    (set, get) => ({
      montos: MONTO_REPARACION_SEED.map((m) => ({ ...m })),

      getActivos: () => get().montos.filter((m) => m.activo),

      upsert: (data, usuario) => {
        const desc = data.descripcion.trim();
        if (!desc) return '';
        let idOut = data.id || '';
        set((s) => {
          const idx = data.id
            ? s.montos.findIndex((m) => m.id === data.id)
            : -1;
          if (idx >= 0) {
            idOut = s.montos[idx].id;
            const next = [...s.montos];
            next[idx] = {
              ...next[idx],
              ...data,
              descripcion: desc,
              valorMinimo: Number(data.valorMinimo ?? next[idx].valorMinimo) || 0,
              valorMaximo: Number(data.valorMaximo ?? next[idx].valorMaximo) || 0,
              fechaModificacion: ahoraFmt(),
              usuarioModificacion: usuario,
            };
            return { montos: next };
          }
          idOut = uid('mr');
          const nuevo: MontoReparacion = {
            id: idOut,
            descripcion: desc,
            valorMinimo: Number(data.valorMinimo) || 0,
            valorMaximo: Number(data.valorMaximo) || 0,
            naviera: data.naviera?.trim() || '',
            tipoEstimacion: data.tipoEstimacion?.trim() || '',
            clasificacion: data.clasificacion?.trim() || '',
            modeloMaquina: data.modeloMaquina?.trim() || '',
            actividad: data.actividad?.trim() || '',
            activo: data.activo ?? true,
            fechaModificacion: ahoraFmt(),
            usuarioModificacion: usuario,
          };
          return { montos: [nuevo, ...s.montos] };
        });
        return idOut;
      },

      eliminar: (id) => set((s) => ({ montos: s.montos.filter((m) => m.id !== id) })),

      toggleActivo: (id, usuario) =>
        set((s) => ({
          montos: s.montos.map((m) =>
            m.id === id
              ? {
                  ...m,
                  activo: !m.activo,
                  fechaModificacion: ahoraFmt(),
                  usuarioModificacion: usuario,
                }
              : m
          ),
        })),

      resetSeed: () => set({ montos: MONTO_REPARACION_SEED.map((m) => ({ ...m })) }),
    }),
    { name: STORAGE_KEY }
  )
);
