'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardCheck, FileBarChart, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store';
import { cn } from '@/lib/utils';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const LINKS_BASE = [
  {
    href: '/reportes/estimaciones',
    label: 'Aprobaciones de Estimados',
    icon: ClipboardCheck,
    hint: 'Validar, enviar a SBM, reversar y eliminar',
    roles: ['liquidaciones'] as const,
  },
  {
    href: '/reportes/estimaciones',
    label: 'Reporte de Estimaciones Seaboard Marine',
    icon: FileBarChart,
    hint: 'Ver, modificar con histórico y devolver a liquidaciones',
    roles: ['dms', 'seaboard'] as const,
  },
];

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');

  const links = useMemo(() => {
    const rol = user?.rol ?? 'dms';
    return LINKS_BASE.filter((l) => (l.roles as readonly string[]).includes(rol));
  }, [user?.rol]);

  const filtered = links.filter((l) =>
    l.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 top-16 z-40 bg-black/50 backdrop-blur-sm transition-opacity',
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={cn(
          'fixed left-0 top-16 z-50 flex h-[calc(100vh-4rem)] w-80 flex-col border-r border-gray-200 bg-white shadow-2xl transition-transform duration-300',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white p-4">
          <div>
            <p className="text-sm font-bold text-rfs-navy">Navegación</p>
            <p className="text-[11px] text-gray-500">
              {user?.rol === 'liquidaciones'
                ? 'Aprobaciones de Estimados'
                : 'Gestor Seaboard Marine'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-gray-100"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-gray-100 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar módulo…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg bg-gray-50 pl-9"
            />
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {filtered.map((item) => {
            const Icon = item.icon;
            const activo = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-start gap-3 rounded-xl px-3 py-3 transition-colors',
                  activo
                    ? 'bg-rfs-50 text-rfs-800 ring-1 ring-rfs-100'
                    : 'text-slate-700 hover:bg-slate-50'
                )}
              >
                <Icon
                  className={cn(
                    'mt-0.5 h-5 w-5 shrink-0',
                    activo ? 'text-rfs-700' : 'text-slate-400'
                  )}
                />
                <span>
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className="mt-0.5 block text-[11px] text-slate-500">{item.hint}</span>
                </span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
