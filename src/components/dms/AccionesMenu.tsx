'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AccionMenuItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  peligro?: boolean;
};

/** Menú desplegable de acciones con etiqueta visible. */
export function AccionesMenu({
  items,
  open,
  onOpenChange,
  className,
}: {
  items: AccionMenuItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
}) {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) onOpenChange(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onOpenChange(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onOpenChange]);

  if (items.length === 0) {
    return <span className="text-[10px] text-slate-400">—</span>;
  }

  return (
    <div ref={rootRef} className={cn('dms-acciones-menu', className)}>
      <button
        type="button"
        className="dms-acciones-menu__trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={panelId}
        onClick={(e) => {
          e.stopPropagation();
          onOpenChange(!open);
        }}
      >
        <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
        Acciones
        <ChevronDown
          className={cn('h-3 w-3 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open && (
        <div
          id={panelId}
          role="menu"
          className="dms-acciones-menu__panel"
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className={cn(
                'dms-acciones-menu__item',
                item.peligro && 'dms-acciones-menu__item--peligro'
              )}
              onClick={() => {
                onOpenChange(false);
                item.onClick();
              }}
            >
              {item.icon ? (
                <span className="dms-acciones-menu__icono">{item.icon}</span>
              ) : null}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
