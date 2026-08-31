'use client';

import { AlertCircle, CheckCircle2, Clock3, XCircle } from 'lucide-react';
import {
  APLICA_APROBADO_SBM,
  APLICA_PENDIENTE,
  APLICA_RECHAZADO_SBM,
  normalizarAplicaDano,
  type AplicaDano,
  type Estimacion,
} from '@/types/estimacion';
import {
  estimadoRequiereRevisionItems,
  esItemPendienteRevision,
  tituloIndicadorItemPendiente,
  tituloIndicadorRevisionEstimado,
} from '@/lib/revisionPendiente';
import { cn } from '@/lib/utils';

/** Badge de estado del ítem (Aprobado / Rechazado / Pendiente). */
export function BadgeEstadoItem({
  estado,
  compacto = false,
  className,
}: {
  estado: AplicaDano | string;
  compacto?: boolean;
  className?: string;
}) {
  const n = normalizarAplicaDano(estado);
  if (n === APLICA_APROBADO_SBM) {
    return (
      <span
        className={cn(
          'dms-badge-estado-item dms-badge-estado-item--aprobado',
          compacto && 'dms-badge-estado-item--compacto',
          className
        )}
      >
        <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden />
        Aprobado
      </span>
    );
  }
  if (n === APLICA_RECHAZADO_SBM) {
    return (
      <span
        className={cn(
          'dms-badge-estado-item dms-badge-estado-item--rechazado',
          compacto && 'dms-badge-estado-item--compacto',
          className
        )}
      >
        <XCircle className="h-3 w-3 shrink-0" aria-hidden />
        Rechazado
      </span>
    );
  }
  return (
    <span
      className={cn(
        'dms-badge-estado-item dms-badge-estado-item--pendiente',
        compacto && 'dms-badge-estado-item--compacto',
        className
      )}
      title={tituloIndicadorItemPendiente(n)}
    >
      <Clock3 className="h-3 w-3 shrink-0" aria-hidden />
      {compacto ? 'Pend.' : 'Pendiente revisión'}
    </span>
  );
}

/** Icono de alerta junto al código cuando hay ítems por revisar. */
export function IconoAlertaRevisionEstimado({
  estimacion,
  className,
}: {
  estimacion: Estimacion;
  className?: string;
}) {
  if (!estimadoRequiereRevisionItems(estimacion)) return null;
  const titulo = tituloIndicadorRevisionEstimado(estimacion);
  return (
    <span
      className={cn('inline-flex shrink-0', className)}
      title={titulo}
      aria-label={titulo}
    >
      <AlertCircle className="h-3.5 w-3.5 text-slate-500" aria-hidden />
    </span>
  );
}

/** Clase de fila para tablas de estimados o ítems con acción pendiente. */
export function claseFilaRevisionPendiente(opts: {
  itemPendiente?: boolean;
  estimacion?: Estimacion;
  seleccionada?: boolean;
}) {
  const { itemPendiente, estimacion, seleccionada } = opts;
  const est =
    estimacion && estimadoRequiereRevisionItems(estimacion);
  const item = itemPendiente ?? false;
  if (!est && !item) {
    return seleccionada ? 'dms-row-selected' : undefined;
  }
  return cn(
    item && 'dms-row-item-pendiente',
    est && 'dms-row-estimado-revision',
    seleccionada && 'dms-row-selected'
  );
}

export function esItemPendiente(estado: AplicaDano | string) {
  return esItemPendienteRevision(estado);
}
