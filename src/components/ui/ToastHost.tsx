'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn, type ToastDetail, type ToastType } from '@/lib/utils';

interface ToastItem extends ToastDetail {
  id: number;
}

const ICONS: Record<ToastType, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<ToastDetail>).detail;
      if (!detail?.msg) return;
      const id = Date.now() + Math.random();
      setItems((prev) => [...prev, { id, ...detail }]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, 3800);
    };
    window.addEventListener('dms-toast', onToast);
    return () => window.removeEventListener('dms-toast', onToast);
  }, []);

  if (!items.length) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[110] flex flex-col gap-2">
      {items.map((t) => {
        const Icon = ICONS[t.type ?? 'info'];
        return (
          <div
            key={t.id}
            className={cn('dms-toast animate-in slide-in-from-right-4 fade-in duration-200', `dms-toast--${t.type ?? 'info'}`)}
            role="status"
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="flex-1 text-sm font-medium leading-snug whitespace-pre-line">{t.msg}</p>
            <button
              type="button"
              className="pointer-events-auto rounded p-0.5 opacity-60 hover:opacity-100"
              onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
              aria-label="Cerrar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
