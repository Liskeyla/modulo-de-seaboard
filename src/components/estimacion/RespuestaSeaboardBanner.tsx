'use client';

import { AlertTriangle, CheckCircle2, MessageSquare, PencilLine, XCircle } from 'lucide-react';
import { resumenRetornoSeaboard } from '@/lib/seaboardFlow';
import type { Estimacion } from '@/types/estimacion';
import { cn } from '@/lib/utils';

/** Panel visual: lo que Seaboard devolvió a Liquidaciones (aprobado / rechazado / modificados). */
export function RespuestaSeaboardBanner({ estimacion }: { estimacion: Estimacion }) {
  const r = resumenRetornoSeaboard(estimacion);
  if (!r) return null;

  return (
    <div
      className={cn(
        'rounded-xl border px-3 py-2.5 shadow-sm',
        r.rechazoTotal
          ? 'border-red-200 bg-red-50 text-red-950'
          : 'border-emerald-200 bg-emerald-50 text-emerald-950'
      )}
    >
      <div className="flex flex-wrap items-start gap-2">
        {r.rechazoTotal ? (
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
        ) : (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold">
            {r.rechazoTotal
              ? 'Devuelto por Seaboard · RECHAZADO por completo'
              : `Devuelto por Seaboard · ${estimacion.estado}`}
          </p>
          <p className="mt-0.5 text-[11px] opacity-90">
            {r.usuario}
            {r.fecha ? ` · ${r.fecha}` : ''}
          </p>
          {r.comentario ? (
            <p className="mt-1.5 flex gap-1.5 text-[11px] leading-relaxed">
              <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" />
              <span>{r.comentario}</span>
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {r.itemsModificados > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200">
                <PencilLine className="h-3 w-3" />
                {r.itemsModificados} ítem(s) modificado(s)
              </span>
            )}
            {r.itemsRechazados > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-red-800 ring-1 ring-red-200">
                <AlertTriangle className="h-3 w-3" />
                {r.itemsRechazados} ítem(s) rechazado(s) SBM
              </span>
            )}
            {r.itemsAprobados > 0 && !r.rechazoTotal && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
                <CheckCircle2 className="h-3 w-3" />
                {r.itemsAprobados} ítem(s) aprobado(s) SBM
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Chips compactos para la fila del reporte de Liquidaciones. */
export function ChipsRetornoSeaboard({ estimacion }: { estimacion: Estimacion }) {
  const r = resumenRetornoSeaboard(estimacion);
  if (!r) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {r.rechazoTotal && (
        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-700">
          Rechazo total SBM
        </span>
      )}
      {r.itemsModificados > 0 && (
        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-800">
          {r.itemsModificados} mod.
        </span>
      )}
      {r.itemsRechazados > 0 && (
        <span className="rounded bg-red-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-700">
          {r.itemsRechazados} ítem rech.
        </span>
      )}
    </div>
  );
}
