'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComentarioModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  label?: string;
  required?: boolean;
  confirmLabel: string;
  confirmClass?: string;
  onClose: () => void;
  onConfirm: (comentario: string) => void;
}

export function ComentarioModal({
  open,
  title,
  subtitle,
  label = 'Comentario',
  required = true,
  confirmLabel,
  confirmClass = 'dms-btn-aprobar',
  onClose,
  onConfirm,
}: ComentarioModalProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => textareaRef.current?.focus(), 50);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="dms-modal-overlay" onClick={onClose}>
      <div className="dms-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="dms-modal-header flex items-start justify-between gap-3">
          <div>
            <p>{title}</p>
            {subtitle && <p className="mt-0.5 text-[11px] font-normal text-white/70">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white/10 p-1.5 transition-colors hover:bg-white/20"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const comentario = String(fd.get('comentario') ?? '').trim();
            if (required && !comentario) return;
            onConfirm(comentario);
          }}
        >
          <div className="dms-modal-body">
            <label className="dms-field-label">{label}</label>
            <textarea
              ref={textareaRef}
              name="comentario"
              rows={4}
              className="w-full rounded-lg border border-gray-300 p-3 text-sm shadow-sm transition-colors focus:border-[#f16e26] focus:outline-none focus:ring-2 focus:ring-[#f16e26]/20"
              placeholder="Ingrese el comentario…"
              required={required}
            />
            {required && (
              <p className="text-[11px] text-gray-400">El comentario es obligatorio para continuar.</p>
            )}
          </div>
          <div className="dms-modal-footer">
            <button
              type="button"
              className="dms-btn-action border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button type="submit" className={cn(confirmClass, 'px-4 py-2 text-sm')}>
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
