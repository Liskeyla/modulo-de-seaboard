'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardCheck, FileBarChart, Search, X } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const LINKS = [
  {
    href: '/reportes/estimaciones',
    label: 'Reporte de Estimaciones',
    icon: FileBarChart,
    hint: 'Consulta y envío a aprobación',
  },
  {
    href: '/aprobaciones/seaboard',
    label: 'Aprobaciones Seaboard',
    icon: ClipboardCheck,
    hint: 'Aprobar, rechazar o reversar',
  },
];

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [search, setSearch] = useState('');

  const filtered = LINKS.filter((l) =>
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
            <p className="text-[11px] text-gray-500">Módulos operativos DMS</p>
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

        <nav className="flex-1 overflow-y-auto p-4">
          <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Estimaciones
          </p>
          <ul className="space-y-1.5">
            {filtered.map((l) => {
              const Icon = l.icon;
              const active = pathname === l.href;
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={onClose}
                    className={cn(
                      'flex items-start gap-3 rounded-xl px-3 py-3 transition-all',
                      active
                        ? 'bg-rfs-navy text-white shadow-md'
                        : 'text-gray-700 hover:bg-gray-50'
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                        active ? 'bg-white/15' : 'bg-gray-100 text-gray-500'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold leading-snug">{l.label}</span>
                      <span
                        className={cn(
                          'mt-0.5 block text-[11px] leading-snug',
                          active ? 'text-white/70' : 'text-gray-400'
                        )}
                      >
                        {l.hint}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}
