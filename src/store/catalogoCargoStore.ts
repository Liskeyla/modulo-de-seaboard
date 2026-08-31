import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  CATALOGO_CARGO_SEED,
  type CatalogoCargo,
  type EfectoEstadoCabecera,
  type EfectoVistaLiquidaciones,
} from '@/types/catalogoCargo';

const STORAGE_KEY = 'dms-catalogo-cargo-v1';

function ahoraFmt() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

interface CatalogoCargoState {
  cargos: CatalogoCargo[];
  getActivos: () => CatalogoCargo[];
  getByCodigo: (codigo: string) => CatalogoCargo | undefined;
  /** Códigos cuyo rechazo no bloquea APROBADO del estimado (si hay otros aprobados). */
  codigosRechazoNoBloqueante: () => string[];
  upsert: (
    data: Partial<CatalogoCargo> & { codigo: string; nombre: string },
    usuario: string
  ) => void;
  setCampo: <K extends keyof CatalogoCargo>(
    id: string,
    campo: K,
    valor: CatalogoCargo[K],
    usuario: string
  ) => void;
  toggleActivo: (id: string, usuario: string) => void;
  eliminar: (id: string) => void;
  resetSeed: () => void;
}

export const useCatalogoCargoStore = create<CatalogoCargoState>()(
  persist(
    (set, get) => ({
      cargos: CATALOGO_CARGO_SEED.map((c) => ({ ...c })),

      getActivos: () =>
        get()
          .cargos.filter((c) => c.activo)
          .sort((a, b) => a.orden - b.orden),

      getByCodigo: (codigo) => {
        const n = String(codigo || '').trim().toLowerCase();
        return get().cargos.find((c) => c.codigo.toLowerCase() === n && c.activo);
      },

      codigosRechazoNoBloqueante: () =>
        get()
          .cargos.filter((c) => c.activo && c.rechazoNoBloqueaAprobacion)
          .map((c) => c.codigo),

      upsert: (data, usuario) => {
        const codigo = data.codigo.trim();
        if (!codigo) return;
        set((s) => {
          const idx = s.cargos.findIndex(
            (c) => c.codigo.toLowerCase() === codigo.toLowerCase()
          );
          const base: CatalogoCargo =
            idx >= 0
              ? s.cargos[idx]
              : {
                  id: uid('cargo'),
                  codigo,
                  nombre: data.nombre.trim() || codigo,
                  descripcion: '',
                  activo: true,
                  orden: s.cargos.length + 1,
                  rechazoNoBloqueaAprobacion: false,
                  alRechazarEstadoCabecera: 'ENVIADO' as EfectoEstadoCabecera,
                  alRechazarVistaLiquidaciones: 'RECHAZADO' as EfectoVistaLiquidaciones,
                  incluirEnReporteriaItems: true,
                  fechaModificacion: '',
                  usuarioModificacion: '',
                };
          const next: CatalogoCargo = {
            ...base,
            ...data,
            codigo,
            nombre: (data.nombre || base.nombre).trim() || codigo,
            fechaModificacion: ahoraFmt(),
            usuarioModificacion: usuario,
          };
          const cargos =
            idx >= 0
              ? s.cargos.map((c, i) => (i === idx ? next : c))
              : [...s.cargos, next];
          return { cargos };
        });
      },

      setCampo: (id, campo, valor, usuario) => {
        set((s) => ({
          cargos: s.cargos.map((c) =>
            c.id === id
              ? {
                  ...c,
                  [campo]: valor,
                  fechaModificacion: ahoraFmt(),
                  usuarioModificacion: usuario,
                }
              : c
          ),
        }));
      },

      toggleActivo: (id, usuario) => {
        const c = get().cargos.find((x) => x.id === id);
        if (!c) return;
        get().setCampo(id, 'activo', !c.activo, usuario);
      },

      eliminar: (id) => {
        set((s) => ({ cargos: s.cargos.filter((c) => c.id !== id) }));
      },

      resetSeed: () => set({ cargos: CATALOGO_CARGO_SEED.map((c) => ({ ...c })) }),
    }),
    { name: STORAGE_KEY }
  )
);
