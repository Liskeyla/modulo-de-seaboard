import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  username: string;
  nombre: string;
  rol: 'dms' | 'seaboard';
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hydrate: () => void;
}

const DEMO_USERS: Record<string, { password: string; rol: User['rol']; nombre: string }> = {
  apptelink: { password: 'admin123', rol: 'dms', nombre: 'apptelink' },
  seaboard: { password: 'admin123', rol: 'seaboard', nombre: 'Usuario Seaboard' },
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
            if (parsed?.state?.user) {
              set({ user: parsed.state.user, isAuthenticated: true });
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
