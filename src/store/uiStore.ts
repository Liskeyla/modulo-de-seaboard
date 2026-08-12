import { create } from 'zustand';

const CLAVE_FIJADO = 'dms-estimaciones-menu-fijado';

interface UiState {
  menuAbierto: boolean;
  menuFijado: boolean;
  hidratadoUi: boolean;
  abrirMenu: () => void;
  cerrarMenu: () => void;
  alternarMenu: () => void;
  alternarFijado: () => void;
  hidratarUi: () => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  menuAbierto: false,
  menuFijado: false,
  hidratadoUi: false,

  abrirMenu: () => set({ menuAbierto: true }),
  cerrarMenu: () => set((s) => (s.menuFijado ? s : { menuAbierto: false })),
  alternarMenu: () => set((s) => ({ menuAbierto: !s.menuAbierto })),

  alternarFijado: () => {
    const fijado = !get().menuFijado;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CLAVE_FIJADO, String(fijado));
    }
    set({ menuFijado: fijado, menuAbierto: fijado });
  },

  hidratarUi: () => {
    if (typeof window === 'undefined') return;
    const fijado = window.localStorage.getItem(CLAVE_FIJADO) === 'true';
    const escritorio = window.matchMedia('(min-width: 1024px)').matches;
    set({ menuFijado: fijado, menuAbierto: fijado && escritorio, hidratadoUi: true });
  },
}));
