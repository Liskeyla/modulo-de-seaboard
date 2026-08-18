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

function partirMensaje(msg: string) {
  const i = msg.indexOf('\n');
  if (i >= 0) {
    return { titulo: msg.slice(0, i).trim(), cuerpo: msg.slice(i + 1).trim() };
  }
  const dosPuntos = msg.indexOf(': ');
  if (dosPuntos > 0 && dosPuntos < 40) {
    return { titulo: msg.slice(0, dosPuntos).trim(), cuerpo: msg.slice(dosPuntos + 2).trim() };
  }
  return { titulo: msg, cuerpo: '' };
}

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<ToastDetail>).detail;
      if (!detail?.msg) return;
      const id = Date.now() + Math.random();
      setItems((prev) => [...prev.slice(-2), { id, ...detail }]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, 4200);
    };
    window.addEventListener('dms-toast', onToast);
    return () => window.removeEventListener('dms-toast', onToast);
  }, []);

  if (!items.length) return null;

  return (
    <div className="pointer-events-none fixed inset-x-3 top-[4.75rem] z-[110] flex flex-col items-end gap-2 sm:right-5 sm:left-auto">
      {items.map((t) => {
        const Icon = ICONS[t.type ?? 'info'];
        const { titulo, cuerpo } = partirMensaje(t.msg);
        return (
          <div
            key={t.id}
            className={cn('dms-toast', `dms-toast--${t.type ?? 'info'}`)}
            role="status"
          >
            <span className={cn('dms-toast-icon', `dms-toast-icon--${t.type ?? 'info'}`)}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-5">{titulo}</p>
              {cuerpo ? <p className="mt-0.5 text-xs leading-5 opacity-80">{cuerpo}</p> : null}
            </div>
            <button
              type="button"
              className="pointer-events-auto -mr-1 -mt-1 rounded-md p-1 opacity-50 transition hover:bg-black/5 hover:opacity-100"
              onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
              aria-label="Cerrar aviso"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
