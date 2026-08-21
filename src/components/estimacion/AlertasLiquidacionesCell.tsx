'use client';

import { AlertTriangle } from 'lucide-react';
import {
  alertasLiquidaciones,
  type AlertaLiquidaciones,
} from '@/lib/alertasLiquidaciones';
import type { Estimacion } from '@/types/estimacion';
import { cn } from '@/lib/utils';

function PillAlerta({ alerta }: { alerta: AlertaLiquidaciones }) {
  return (
    <span
      className={cn(
        'dms-alerta-pill',
        alerta.id === 'MODIFICADO' && 'dms-alerta-pill--mod',
        alerta.id === 'PENDIENTE_CAMBIO' && 'dms-alerta-pill--cambio',
        (alerta.id === 'ITEM_RECHAZADO' || alerta.id === 'RECHAZO_TOTAL') &&
          'dms-alerta-pill--rechazo'
      )}
      title={alerta.title}
    >
      <span className="dms-alerta-pill__icono">
        <AlertTriangle className="h-3 w-3" aria-hidden />
        <span>{alerta.lineas[0]}</span>
      </span>
      {alerta.lineas.slice(1).map((linea) => (
        <span key={linea}>{linea}</span>
      ))}
    </span>
  );
}

/** Columna de alertas (izq. de Acciones) para Aprobaciones de Estimados / Liquidaciones. */
export function AlertasLiquidacionesCell({ estimacion }: { estimacion: Estimacion }) {
  const alertas = alertasLiquidaciones(estimacion);
  if (alertas.length === 0) {
    return <span className="text-[10px] text-slate-300">—</span>;
  }
  return (
    <div className="dms-alertas-cell" onDoubleClick={(e) => e.stopPropagation()}>
      {alertas.map((a) => (
        <PillAlerta key={a.id} alerta={a} />
      ))}
    </div>
  );
}
