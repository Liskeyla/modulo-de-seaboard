'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  MapPin,
  ShieldCheck,
  User,
} from 'lucide-react';
import { BrandBackdrop } from '@/components/auth/BrandBackdrop';
import { Flag } from '@/components/ui/Flag';
import { useAuthStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { cn, toast } from '@/lib/utils';

const DEMO = [
  {
    usuario: 'seaboard',
    clave: 'admin123',
    rol: 'Línea · revisar ENVIADO · aprobar/rechazar ítems · Enviar a liquidaciones',
  },
  {
    usuario: 'liqecuador',
    clave: 'admin123',
    rol: 'Liquidaciones EC · PENDIENTE → Enviar a SBM',
  },
  {
    usuario: 'liqperu',
    clave: 'admin123',
    rol: 'Liquidaciones PE · PENDIENTE → Enviar a SBM',
  },
  {
    usuario: 'coordecuador',
    clave: 'admin123',
    rol: 'Coordinador · Ecuador · crear / modificar estimados',
  },
  {
    usuario: 'coordperu',
    clave: 'admin123',
    rol: 'Coordinador · Perú · crear / modificar estimados',
  },
];

/** Login con la misma estructura visual que layout-dms (formulario + panel). */
export default function LoginPage() {
  const router = useRouter();
  const { user, isAuthenticated, login, hydrate } = useAuthStore();
  const setPais = useUiStore((s) => s.setPais);

  const [usuario, setUsuario] = useState('seaboard');
  const [clave, setClave] = useState('admin123');
  const [verClave, setVerClave] = useState(false);
  const [recordar, setRecordar] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);
  const [demoAbierto, setDemoAbierto] = useState(false);
  const usuarioRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (isAuthenticated && user) {
      const dest =
        user.rol === 'seaboard' || user.rol === 'liquidaciones'
          ? '/reportes/estimaciones'
          : '/reportes/estimaciones';
      router.replace(dest);
    }
  }, [isAuthenticated, user, router]);

  useEffect(() => {
    usuarioRef.current?.focus();
  }, []);

  const listo = usuario.trim().length > 0 && clave.length > 0;

  async function manejarEnvio(e: React.FormEvent) {
    e.preventDefault();
    if (!listo || cargando) return;
    setError(null);
    setCargando(true);
    try {
      await login(usuario.trim(), clave);
      setExito(true);
      const u = useAuthStore.getState().user;
      if (u?.pais) {
        setPais(u.pais);
      }
      router.replace('/reportes/estimaciones');
      if (u?.rol === 'liquidaciones' && u.pais) {
        toast(
          `Aprobaciones de Estimados · ${u.pais === 'PERU' ? 'Perú' : 'Ecuador'}`,
          'success'
        );
      } else if (u?.rol === 'coordinador' && u.pais) {
        toast(
          `Coordinador · ${u.pais === 'PERU' ? 'Perú' : 'Ecuador'} · edite y cree estimados; Liquidaciones envía a la línea`,
          'success'
        );
      }
    } catch {
      setError('Credenciales inválidas. Use seaboard, coordecuador, coordperu, liqecuador o liqperu / admin123');
    } finally {
      setCargando(false);
    }
  }

  function usarDemo(u: string, c: string) {
    setUsuario(u);
    setClave(c);
    setError(null);
    toast(`Credenciales de ${u} cargadas. Pulsa «Iniciar sesión».`, 'info');
    usuarioRef.current?.focus();
  }

  return (
    <div className="relative min-h-screen">
      <BrandBackdrop />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:py-12">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white/95 shadow-brand-lg ring-1 ring-slate-200/70 backdrop-blur-sm animate-fade-up lg:grid-cols-[1.05fr_1fr]">
          <section className="px-6 py-8 sm:px-10 sm:py-10">
            <div className="mx-auto flex max-w-sm flex-col">
              <div className="mx-auto block w-44">
                <Image
                  src="/brand/logo-rfs.jpg"
                  alt="Road Feeder Services"
                  width={1385}
                  height={1080}
                  priority
                  className="h-auto w-full mix-blend-multiply"
                />
              </div>

              <h1 className="mt-5 text-center text-xl font-extrabold tracking-tight text-rfs-700 sm:text-2xl">
                Road Feeder Services
              </h1>

              <div className="mt-3 flex items-center justify-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-rfs-100 bg-rfs-50 px-3 py-1 text-xs font-semibold text-rfs-700">
                  <Flag className="h-3 w-[18px]" />
                  Operación Ecuador
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                  <ShieldCheck className="h-3 w-3" />
                  Conexión segura
                </span>
              </div>

              <p className="mt-5 text-sm font-semibold text-slate-700">
                Ingresa tu nombre de usuario y contraseña
              </p>

              {error && (
                <div
                  role="alert"
                  className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700 animate-shake"
                >
                  <AlertCircle className="mt-px h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {exito && (
                <div
                  role="status"
                  className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-700"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Acceso concedido — abriendo el módulo…
                </div>
              )}

              <form onSubmit={manejarEnvio} className="mt-4 space-y-4" noValidate>
                <div>
                  <label htmlFor="usuario" className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Usuario
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="usuario"
                      ref={usuarioRef}
                      type="text"
                      autoComplete="username"
                      placeholder="nombre.usuario"
                      className="dms-field pl-9"
                      value={usuario}
                      onChange={(e) => {
                        setUsuario(e.target.value);
                        setError(null);
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="clave" className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="clave"
                      type={verClave ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="dms-field px-9"
                      value={clave}
                      onChange={(e) => {
                        setClave(e.target.value);
                        setError(null);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setVerClave((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-rfs-700"
                      aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {verClave ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={recordar}
                    onChange={(e) => setRecordar(e.target.checked)}
                    className="h-4 w-4 cursor-pointer accent-rfsorange-500"
                  />
                  Mantener iniciada la sesión
                </label>

                <button
                  type="submit"
                  disabled={!listo || cargando}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-rfsorange-500 text-sm font-bold uppercase tracking-wide text-white shadow-sm transition hover:bg-rfsorange-600 disabled:opacity-50"
                >
                  {cargando ? 'Verificando…' : 'Iniciar sesión'}
                  {!cargando && <ArrowRight className="h-4 w-4" />}
                </button>
              </form>

              <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-3">
                <button
                  type="button"
                  onClick={() => setDemoAbierto((a) => !a)}
                  className="flex w-full items-center justify-between text-xs font-semibold text-slate-600 transition hover:text-rfs-700"
                  aria-expanded={demoAbierto}
                >
                  <span className="flex items-center gap-2">
                    <KeyRound className="h-3.5 w-3.5 text-rfsorange-500" />
                    Credenciales de demostración
                  </span>
                  <span className={cn('text-slate-400 transition-transform', demoAbierto && 'rotate-180')}>
                    ▾
                  </span>
                </button>
                {demoAbierto && (
                  <div className="mt-3 space-y-3 animate-fade-in">
                    <ul className="space-y-1.5">
                    {DEMO.map((c) => (
                      <li key={c.usuario}>
                        <button
                          type="button"
                          onClick={() => usarDemo(c.usuario, c.clave)}
                          className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-rfsorange-300 hover:bg-rfsorange-50"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-semibold text-slate-700">
                              {c.usuario}
                            </span>
                            <span className="block truncate text-[11px] text-slate-500">{c.rol}</span>
                          </span>
                          <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
                            Usar
                          </span>
                        </button>
                      </li>
                    ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className="relative hidden overflow-hidden bg-rfs-700 p-7 text-white lg:flex lg:flex-col">
            <div aria-hidden className="absolute inset-0">
              <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-rfsorange-500/85" />
              <div className="absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-rfsorange-500/25" />
              <div className="absolute bottom-1/3 right-1/4 h-40 w-40 rounded-full bg-white/5" />
            </div>

            <div className="relative shrink-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-rfsorange-300">
                Plataforma integral RFS
              </p>
              <h2 className="mt-2 text-2xl font-extrabold leading-tight">
                Usuario Seaboard y Liquidaciones RFS
                <span className="mt-2 block text-base font-semibold text-rfsorange-200">
                  Simule la interacción por país (Ecuador / Perú)
                </span>
              </h2>
            </div>

            <a
              href="https://citiaduanas.com"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative my-5 flex min-h-0 flex-1 items-center justify-center"
            >
              <Image
                src="/brand/banner-citiaduanas.gif"
                alt="CITIADUANAS"
                width={330}
                height={571}
                unoptimized
                className="max-h-full w-auto rounded-2xl object-contain shadow-2xl ring-1 ring-white/20 transition group-hover:ring-rfsorange-400"
              />
            </a>

            <div className="relative flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/15 pt-4 text-xs">
              <span className="flex items-center gap-1.5 font-medium text-rfs-100">
                <MapPin className="h-3.5 w-3.5 text-rfsorange-300" /> Guayaquil
              </span>
              <span className="flex items-center gap-1.5 font-medium text-rfs-100">
                <Clock className="h-3.5 w-3.5 text-rfsorange-300" /> America/Guayaquil · 24/7
              </span>
              <span className="flex items-center gap-1.5 font-medium text-rfs-100">
                <KeyRound className="h-3.5 w-3.5 text-rfsorange-300" /> DMS Estimaciones
              </span>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
