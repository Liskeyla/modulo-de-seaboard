import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  username: string;
  nombre: string;
  rol: 'dms' | 'seaboard' | 'liquidaciones';
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hydrate: () => void;
}

const DEMO_USERS: Record<string, { password: string; rol: User['rol']; nombre: string }> = {
  /** Usuario principal del prototipo: gestor Seaboard (misma experiencia que se mejoró en apptelink). */
  apptelink: { password: 'admin123', rol: 'seaboard', nombre: 'Usuario Seaboard' },
  seaboard: { password: 'admin123', rol: 'seaboard', nombre: 'Usuario Seaboard' },
  /** Operativo RFS (solo envía estimados a la bandeja Seaboard). */
  rfs: { password: 'admin123', rol: 'dms', nombre: 'Operador RFS' },
  cesarvalencia: { password: 'admin123', rol: 'liquidaciones', nombre: 'César Valencia' },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: async (username, password) => {
        await new Promise((r) => setTimeout(r, 200));
        const key = username.toLowerCase();
        const demo = DEMO_USERS[key];
        if (!demo || demo.password !== password) {
          throw new Error('Credenciales inválidas');
        }
        localStorage.setItem('dms_estimaciones_token', 'demo-token');
        set({
          user: { username: key, nombre: demo.nombre, rol: demo.rol },
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
            if (u) {
              // Asegura que apptelink / seaboard queden siempre como gestor Seaboard.
              const demo = DEMO_USERS[u.username.toLowerCase()];
              const user = demo
                ? { username: u.username.toLowerCase(), nombre: demo.nombre, rol: demo.rol }
                : u;
              set({ user, isAuthenticated: true });
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

export { useEstimacionesStore } from './estimacionesStore';
export { useUiStore } from './uiStore';
