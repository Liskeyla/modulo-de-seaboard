'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChevronDown,
  ClipboardCheck,
  FileBarChart,
  Home,
  LogOut,
  Pin,
  PinOff,
  Search,
  X,
} from 'lucide-react';
import { grupoDeRuta, menuParaRol, type MenuItem } from '@/data/menu';
import { Flag } from '@/components/ui/Flag';
import { useAuthStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { metaPais } from '@/lib/pais';
import { cn } from '@/lib/utils';

const iconos: Record<string, React.ComponentType<{ className?: string }>> = {
  FileBarChart,
  ClipboardCheck,
};

export function MenuLateral() {
  const pathname = usePathname();
  const router = useRouter();
  const { menuAbierto, menuFijado, cerrarMenu, alternarFijado, pais } = useUiStore();
  const { user, logout } = useAuthStore();

  const [abiertos, setAbiertos] = useState<string[]>(['estimaciones']);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    const grupo = grupoDeRuta(pathname ?? '');
    if (grupo) setAbiertos((prev) => (prev.includes(grupo) ? prev : [...prev, grupo]));
  }, [pathname]);

  useEffect(() => {
    function alEscape(e: KeyboardEvent) {
      if (e.key === 'Escape' && !menuFijado) cerrarMenu();
    }
    document.addEventListener('keydown', alEscape);
    return () => document.removeEventListener('keydown', alEscape);
  }, [menuFijado, cerrarMenu]);

  const termino = busqueda.trim().toLowerCase();
  const menuBase = useMemo(() => menuParaRol(user?.rol), [user?.rol]);
  const grupos = useMemo(() => {
    if (!termino) return menuBase;
    return menuBase
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (i) =>
            i.label.toLowerCase().includes(termino) ||
            i.descripcion.toLowerCase().includes(termino)
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [termino, menuBase]);

  function alternarGrupo(id: string) {
    setAbiertos((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
  }

  function salir() {
    logout();
    router.replace('/login');
  }

  const iniciales = (user?.nombre ?? user?.username ?? 'U').slice(0, 2).toUpperCase();
  const sinResultados = termino.length > 0 && grupos.length === 0;
  const homeHref = '/reportes/estimaciones';

  return (
    <>
      {menuAbierto && !menuFijado && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/45 backdrop-blur-[2px] animate-fade-in"
          onClick={cerrarMenu}
          aria-hidden
        />
      )}

      <aside
        id="menu-principal"
        aria-hidden={!menuAbierto}
        className={cn(
          'fixed left-0 top-0 z-50 flex h-screen w-72 flex-col bg-white shadow-2xl transition-transform duration-300 ease-out',
          menuAbierto ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3.5">
          <Link
            href={homeHref}
            onClick={cerrarMenu}
            className="shrink-0 transition hover:opacity-80"
            aria-label="Ir a inicio"
          >
            <Image
              src="/brand/logo-rfs.jpg"
              alt="Road Feeder Services"
              width={1385}
              height={1080}
              className="h-9 w-12 object-contain"
            />
          </Link>

          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-extrabold leading-tight text-rfs-700">
              Road Feeder Services
            </p>
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-rfsorange-600">
              <Flag pais={pais} className="h-2.5 w-4" />
              {metaPais(pais).label}
            </p>
          </div>

          <button
            type="button"
            onClick={alternarFijado}
            className={cn(
              'hidden rounded-lg p-2 transition lg:block',
              menuFijado
                ? 'bg-rfs-50 text-rfs-700'
                : 'text-slate-400 hover:bg-slate-100 hover:text-rfs-700'
            )}
            aria-pressed={menuFijado}
            title={menuFijado ? 'Desanclar menú' : 'Mantener menú abierto'}
          >
            {menuFijado ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={() => {
              if (menuFijado) alternarFijado();
              else cerrarMenu();
            }}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 lg:hidden"
            aria-label="Cerrar menú"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-slate-100 px-3 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar módulo…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-rfsorange-400 focus:bg-white focus:ring-4 focus:ring-rfsorange-500/12"
            />
          </div>
        </div>

        <nav className="dms-scroll-claro flex-1 overflow-y-auto px-3 py-3">
          <Link
            href={homeHref}
            onClick={cerrarMenu}
            className={cn(
              'mb-1 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
              pathname === homeHref
                ? 'bg-rfs-700 text-white shadow-md'
                : 'text-slate-700 hover:bg-slate-50 hover:text-rfs-700'
            )}
          >
            <Home
              className={cn(
                'h-4 w-4',
                pathname === homeHref ? 'text-rfsorange-400' : 'text-rfsorange-500'
              )}
            />
            Inicio
          </Link>

          {grupos.map((grupo) => {
            const desplegado = abiertos.includes(grupo.id) || termino.length > 0;
            const tieneActivo = grupo.items.some((i) => pathname?.startsWith(i.href));

            return (
              <div key={grupo.id} className="mt-1">
                <button
                  type="button"
                  onClick={() => alternarGrupo(grupo.id)}
                  aria-expanded={desplegado}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition',
                    tieneActivo ? 'text-rfs-700' : 'text-slate-600 hover:bg-slate-50'
                  )}
                >
                  <FileBarChart className="h-4 w-4 shrink-0 text-rfsorange-500" />
                  <span className="flex-1 text-[11px] font-bold uppercase tracking-wider">
                    {grupo.titulo}
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200',
                      desplegado && 'rotate-180'
                    )}
                  />
                </button>

                <div
                  className={cn(
                    'grid transition-all duration-300 ease-out',
                    desplegado ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  )}
                >
                  <ul className="ml-4 space-y-0.5 overflow-hidden border-l border-slate-200 pl-2">
                    {grupo.items.map((item) => (
                      <li key={item.href}>
                        <EnlaceMenu
                          item={item}
                          activo={
                            pathname === item.href ||
                            (pathname?.startsWith(item.href + '/') ?? false)
                          }
                          onNavegar={cerrarMenu}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}

          {sinResultados && (
            <p className="px-3 py-6 text-center text-xs text-slate-500">
              Sin coincidencias para <span className="font-semibold">“{busqueda}”</span>
            </p>
          )}
        </nav>

        {user && (
          <div className="border-t border-slate-200 p-3">
            <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-3 py-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rfs-700 text-xs font-bold text-white">
                {iniciales}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold text-slate-700">{user.nombre}</span>
                <span className="block truncate text-[10px] text-slate-500">
                  {user.rol === 'seaboard' ? 'Aprobador Seaboard' : 'Operador DMS'}
                </span>
              </span>
              <button
                type="button"
                onClick={salir}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

function EnlaceMenu({
  item,
  activo,
  onNavegar,
}: {
  item: MenuItem;
  activo: boolean;
  onNavegar: () => void;
}) {
  const Icono = iconos[item.icon];

  return (
    <Link
      href={item.href}
      onClick={onNavegar}
      title={item.descripcion}
      className={cn(
        'group relative flex items-start gap-2.5 rounded-xl px-3 py-2 text-sm transition',
        activo
          ? 'bg-rfs-700 font-semibold text-white shadow-md'
          : 'text-slate-600 hover:bg-slate-50 hover:text-rfs-700'
      )}
    >
      {activo && (
        <span className="absolute -left-[9px] top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-rfsorange-500" />
      )}
      {Icono && (
        <Icono
          className={cn(
            'mt-0.5 h-4 w-4 shrink-0',
            activo ? 'text-rfsorange-400' : 'text-slate-400 group-hover:text-rfsorange-500'
          )}
        />
      )}
      <span className="min-w-0">
        <span className="block leading-snug">{item.label}</span>
        <span
          className={cn(
            'mt-0.5 block text-[10px] leading-snug',
            activo ? 'text-white/70' : 'text-slate-400'
          )}
        >
          {item.descripcion}
        </span>
      </span>
    </Link>
  );
}
