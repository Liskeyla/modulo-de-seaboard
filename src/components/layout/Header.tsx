'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardCheck, FileBarChart, LogOut, Menu, Terminal, Truck } from 'lucide-react';
import { useAuthStore } from '@/store';

interface HeaderProps {
  onMenuToggle: () => void;
}

const SECTION_LABELS: Record<string, string> = {
  '/reportes/estimaciones': 'Reporte de Estimaciones',
  '/aprobaciones/seaboard': 'Aprobaciones Seaboard',
};

export function Header({ onMenuToggle }: HeaderProps) {
  const { user, logout } = useAuthStore();
  const pathname = usePathname();

  const currentLabel =
    Object.entries(SECTION_LABELS).find(
      ([href]) => pathname === href || pathname?.startsWith(href + '/')
    )?.[1] ?? null;

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-gradient-to-r from-[#002b5c] to-[#003d7a] text-white shadow-lg">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuToggle}
            className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium transition-colors hover:bg-white/20"
            aria-label="Abrir menú"
          >
            <Menu className="h-4 w-4" />
            <span className="hidden sm:inline">Menú</span>
          </button>

          <Link href="/reportes/estimaciones" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rfs-orange/20">
              <Truck className="h-4 w-4 text-rfs-orange" />
            </div>
            <div className="hidden sm:block">
              <span className="text-sm font-bold tracking-wide">RFS - DMS Ecuador</span>
              {currentLabel && <p className="text-[10px] text-white/60">{currentLabel}</p>}
            </div>
          </Link>

          <div className="hidden items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] text-white/80 lg:flex">
            <Terminal className="h-3.5 w-3.5" />
            <span>Producción</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/reportes/estimaciones"
            className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors hover:bg-white/10 sm:flex"
          >
            <FileBarChart className="h-4 w-4" />
            Estimaciones
          </Link>
          <Link
            href="/aprobaciones/seaboard"
            className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors hover:bg-white/10 md:flex"
          >
            <ClipboardCheck className="h-4 w-4" />
            Seaboard
          </Link>

          <div className="group relative flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/10">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rfs-orange text-xs font-bold text-white">
              {(user?.username ?? 'U').charAt(0).toUpperCase()}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-[10px] text-white/60">Bienvenido</p>
              <p className="text-xs font-semibold">{user?.username ?? 'usuario'}</p>
            </div>
            <div className="invisible absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-xl border border-gray-200 bg-white py-1 text-gray-800 opacity-0 shadow-xl transition-all group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-gray-50"
              >
                <LogOut className="h-4 w-4 text-red-500" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
