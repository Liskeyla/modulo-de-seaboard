'use client';

import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
}

const ANCHOS: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
};

export function Modal({
  open,
  title,
  subtitle,
  icon,
  size = 'md',
  onClose,
  footer,
  children,
  bodyClassName,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="dms-modal-overlay" onClick={onClose}>
      <div
        className={cn('dms-modal w-full', ANCHOS[size])}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="dms-modal-header flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            {icon && <span className="mt-0.5 shrink-0 text-white/80">{icon}</span>}
            <div className="min-w-0">
              <p className="truncate">{title}</p>
              {subtitle && (
                <p className="mt-0.5 text-[11px] font-normal text-white/70">{subtitle}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg bg-white/10 p-1.5 transition-colors hover:bg-white/20"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className={cn('dms-modal-body', bodyClassName)}>{children}</div>
        {footer && <div className="dms-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
