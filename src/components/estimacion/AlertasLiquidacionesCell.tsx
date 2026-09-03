'use client';

import {
  AlertTriangle,
  Ban,
  CircleDollarSign,
  MessageSquareWarning,
  PencilLine,
  Undo2,
  XCircle,
} from 'lucide-react';
import {
  alertasLiquidaciones,
  type AlertaLiquidaciones,
  type TipoAlertaLiquidaciones,
} from '@/lib/alertasLiquidaciones';
import type { Estimacion } from '@/types/estimacion';
import { cn } from '@/lib/utils';

const ICONO_ALERTA: Record<
  TipoAlertaLiquidaciones,
  { Icon: typeof AlertTriangle; clase: string; etiqueta: string }
> = {
  SIN_TARIFA: {
    Icon: CircleDollarSign,
    clase: 'dms-alerta-icono--tarifa',
    etiqueta: 'Sin tarifa',
  },
  MODIFICADO: {
    Icon: PencilLine,
    clase: 'dms-alerta-icono--mod',
    etiqueta: 'Modificado',
  },
  ITEM_RECHAZADO: {
    Icon: XCircle,
    clase: 'dms-alerta-icono--rechazo',
    etiqueta: 'Ítem rechazado',
  },
  RECHAZO_TOTAL: {
    Icon: Ban,
    clase: 'dms-alerta-icono--rechazo',
    etiqueta: 'Rechazo total',
  },
  PENDIENTE_CAMBIO: {
    Icon: MessageSquareWarning,
    clase: 'dms-alerta-icono--cambio',
    etiqueta: 'Cambio pendiente',
  },
  SOLICITUD_REVERSO: {
    Icon: Undo2,
    clase: 'dms-alerta-icono--cambio',
    etiqueta: 'Solicitud de reverso',
  },
};

function IconoAlerta({ alerta }: { alerta: AlertaLiquidaciones }) {
  const meta = ICONO_ALERTA[alerta.id];
  const { Icon } = meta;
  return (
    <span
      className={cn('dms-alerta-icono', meta.clase)}
      title={alerta.title}
      aria-label={`${meta.etiqueta}: ${alerta.title}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
    </span>
  );
}

/** Columna de alertas (izq. de Acciones): solo iconos + tooltip. */
export function AlertasLiquidacionesCell({ estimacion }: { estimacion: Estimacion }) {
  const alertas = alertasLiquidaciones(estimacion);
  if (alertas.length === 0) {
    return <span className="text-[10px] text-slate-300">—</span>;
  }
  return (
    <div className="dms-alertas-cell" onDoubleClick={(e) => e.stopPropagation()}>
      {alertas.map((a) => (
        <IconoAlerta key={a.id} alerta={a} />
      ))}
    </div>
  );
}
