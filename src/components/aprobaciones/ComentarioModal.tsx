'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Resumen de línea(s) mostrado antes del comentario (p. ej. al rechazar ítems). */
export type LineaResumenItem = {
  linea: number;
  comp: string;
  dano?: string;
  ubicacion?: string;
  cargo?: string;
};

interface ComentarioModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  label?: string;
  required?: boolean;
  confirmLabel: string;
  confirmClass?: string;
  /** Listado de ítems afectados (línea, comp, daño…) visible sobre el comentario. */
  lineasResumen?: LineaResumenItem[];
  resumenTitulo?: string;
  placeholder?: string;
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
  lineasResumen,
  resumenTitulo,
  placeholder = 'Ingrese la observación (mín. 5 caracteres)…',
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
            if (required && comentario.length < 5) return;
            onConfirm(comentario);
          }}
        >
          <div className="dms-modal-body space-y-4">
            {lineasResumen && lineasResumen.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50/70 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-900">
                  {resumenTitulo ??
                    (lineasResumen.length === 1
                      ? 'Ítem a rechazar'
                      : `${lineasResumen.length} ítems a rechazar`)}
                </p>
                <ul className="max-h-44 space-y-1.5 overflow-y-auto">
                  {lineasResumen.map((item) => (
                    <li
                      key={item.linea}
                      className="rounded-md border border-red-100 bg-white px-2.5 py-2 text-xs leading-snug"
                    >
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 font-bold tabular-nums text-red-900">
                          Línea {String(item.linea).padStart(2, '0')}
                        </span>
                        <span className="font-semibold text-gray-800">{item.comp}</span>
                        {item.ubicacion ? (
                          <span className="text-gray-500">· {item.ubicacion}</span>
                        ) : null}
                        {item.cargo ? (
                          <span className="text-gray-500">· Cargo: {item.cargo}</span>
                        ) : null}
                      </div>
                      {item.dano ? (
                        <p className="mt-1 truncate text-gray-600" title={item.dano}>
                          Daño: {item.dano}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <label className="dms-field-label">{label}</label>
              <textarea
                ref={textareaRef}
                name="comentario"
                rows={4}
                className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-sm shadow-sm transition-colors focus:border-[#f16e26] focus:outline-none focus:ring-2 focus:ring-[#f16e26]/20"
                placeholder={placeholder}
                required={required}
                minLength={required ? 5 : undefined}
              />
              {required && (
                <p className="mt-1.5 text-[11px] text-gray-400">
                  La observación es obligatoria (mín. 5 caracteres) para evidenciar la decisión manual.
                </p>
              )}
            </div>
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
