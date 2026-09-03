import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TARIFARIO_SEED } from '@/data/tarifarioSeed';
import { aplicarCargaMasiva, hoyIso, claveTarifa } from '@/lib/tarifario';
import type { ResultadoCargaMasiva, TarifaIicl, TarifaIiclDraft } from '@/types/tarifario';

const STORAGE_KEY = 'dms-tarifario-iicl-ec-v1';

function uid() {
  return `tar-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

interface TarifarioState {
  tarifas: TarifaIicl[];
  getById: (id: string) => TarifaIicl | undefined;
  upsert: (data: TarifaIiclDraft) => { ok: boolean; error?: string; id: string };
  eliminar: (id: string) => void;
  importar: (filas: TarifaIiclDraft[]) => ResultadoCargaMasiva;
  resetSeed: () => void;
}

export const useTarifarioStore = create<TarifarioState>()(
  persist(
    (set, get) => ({
      tarifas: TARIFARIO_SEED.map((t) => ({ ...t, materiales: [...t.materiales] })),

      getById: (id) => get().tarifas.find((t) => t.id === id),

      upsert: (data) => {
        const componente = data.componente.trim();
        if (!componente) return { ok: false, error: 'Componente vacío.', id: '' };
        const draft: TarifaIiclDraft = { ...data, componente };
        const key = claveTarifa(draft);
        const actuales = get().tarifas;

        if (!data.id) {
          const dup = actuales.find((t) => claveTarifa(t) === key);
          if (dup) {
            return {
              ok: false,
              error: `Ya existe una tarifa con la misma clave (${dup.componente} · ${dup.naviera}).`,
              id: dup.id,
            };
          }
          const created: TarifaIicl = {
            ...draft,
            id: uid(),
            fechaActualizacion: hoyIso(),
            materiales: (draft.materiales ?? []).map((m) => ({
              ...m,
              id: m.id || uid(),
            })),
          };
          set({ tarifas: [created, ...actuales] });
          return { ok: true, id: created.id };
        }

        set({
          tarifas: actuales.map((t) =>
            t.id === data.id
              ? {
                  ...t,
                  ...draft,
                  id: t.id,
                  fechaActualizacion: hoyIso(),
                  materiales: (draft.materiales ?? t.materiales).map((m) => ({
                    ...m,
                    id: m.id || uid(),
                  })),
                }
              : t
          ),
        });
        return { ok: true, id: data.id };
      },

      eliminar: (id) => set((s) => ({ tarifas: s.tarifas.filter((t) => t.id !== id) })),

      importar: (filas) => {
        const { next, resultado } = aplicarCargaMasiva(get().tarifas, filas, uid);
        set({ tarifas: next });
        return resultado;
      },

      resetSeed: () =>
        set({ tarifas: TARIFARIO_SEED.map((t) => ({ ...t, materiales: [...t.materiales] })) }),
    }),
    { name: STORAGE_KEY }
  )
);
