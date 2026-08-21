import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PaisOperacion } from '@/lib/pais';

export interface User {
  username: string;
  nombre: string;
  rol: 'dms' | 'seaboard' | 'liquidaciones';
  /** País fijo para Liquidaciones (EC/PE). Seaboard puede cambiar en cabecera. */
  pais?: PaisOperacion;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hydrate: () => void;
}

type DemoUser = {
  password: string;
  rol: User['rol'];
  nombre: string;
  pais?: PaisOperacion;
};

const DEMO_USERS: Record<string, DemoUser> = {
  /** Gestor Seaboard: ver, modificar con histórico, aprobar/rechazar. */
  seaboard: {
    password: 'admin123',
    rol: 'seaboard',
    nombre: 'Usuario Seaboard',
  },
  apptelink: {
    password: 'admin123',
    rol: 'seaboard',
    nombre: 'Usuario Seaboard',
  },
  /** RFS Liquidaciones por país: ven su reporte y comentan (simulación). */
  liqecuador: {
    password: 'admin123',
    rol: 'liquidaciones',
    nombre: 'Aprobaciones de Estimados Ecuador',
    pais: 'ECUADOR',
  },
  liqperu: {
    password: 'admin123',
    rol: 'liquidaciones',
    nombre: 'Aprobaciones de Estimados Perú',
    pais: 'PERU',
  },
  /** Alias legado → Ecuador */
  cesarvalencia: {
    password: 'admin123',
    rol: 'liquidaciones',
    nombre: 'Aprobaciones de Estimados Ecuador',
    pais: 'ECUADOR',
  },
};

function aUsuario(key: string, demo: DemoUser): User {
  return {
    username: key,
    nombre: demo.nombre,
    rol: demo.rol,
    ...(demo.pais ? { pais: demo.pais } : {}),
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: async (username, password) => {
        await new Promise((r) => setTimeout(r, 200));
        const key = username.trim().toLowerCase();
        const demo = DEMO_USERS[key];
        if (!demo || demo.password !== password) {
          throw new Error('Credenciales inválidas');
        }
        localStorage.setItem('dms_estimaciones_token', 'demo-token');
        set({
          user: aUsuario(key, demo),
          isAuthenticated: true,
        });
      },
      logout: () => {
        localStorage.removeItem('dms_estimaciones_token');
        set({ user: null, isAuthenticated: false });
      },
      hydrate: () => {
        const token = localStorage.getItem('dms_estimaciones_token');
        const stored = localStorage.getItem('dms-estimaciones-auth');
        if (token && stored) {
          try {
            const parsed = JSON.parse(stored);
            const u = parsed?.state?.user as User | undefined;
            if (u?.username) {
              const demo = DEMO_USERS[u.username.toLowerCase()];
              set({
                user: demo ? aUsuario(u.username.toLowerCase(), demo) : u,
                isAuthenticated: true,
              });
            }
          } catch {
            /* ignore */
          }
        }
      },
    }),
    { name: 'dms-estimaciones-auth', partialize: (s) => ({ user: s.user }) }
  )
);

export { DEMO_USERS };
export { useEstimacionesStore } from './estimacionesStore';
export { useUiStore } from './uiStore';
