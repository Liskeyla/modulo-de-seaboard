import { create } from 'zustand';
import type { PaisOperacion } from '@/lib/pais';

const CLAVE_FIJADO = 'dms-estimaciones-menu-fijado';
const CLAVE_PAIS = 'dms-estimaciones-pais';

interface UiState {
  menuAbierto: boolean;
  menuFijado: boolean;
  hidratadoUi: boolean;
  pais: PaisOperacion;
  abrirMenu: () => void;
  cerrarMenu: () => void;
  alternarMenu: () => void;
  alternarFijado: () => void;
  setPais: (pais: PaisOperacion) => void;
  hidratarUi: () => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  menuAbierto: false,
  menuFijado: false,
  hidratadoUi: false,
  pais: 'ECUADOR',

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

  setPais: (pais) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CLAVE_PAIS, pais);
    }
    set({ pais });
  },

  hidratarUi: () => {
    if (typeof window === 'undefined') return;
    const fijado = window.localStorage.getItem(CLAVE_FIJADO) === 'true';
    const guardado = window.localStorage.getItem(CLAVE_PAIS);
    const pais: PaisOperacion = guardado === 'PERU' ? 'PERU' : 'ECUADOR';
    const escritorio = window.matchMedia('(min-width: 1024px)').matches;
    set({ menuFijado: fijado, menuAbierto: fijado && escritorio, hidratadoUi: true, pais });
  },
}));
