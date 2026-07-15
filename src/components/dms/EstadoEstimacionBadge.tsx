import { CheckCircle2, Clock3, RotateCcw, Send, ShieldCheck, XCircle } from 'lucide-react';
import type { EstadoEstimacion } from '@/types/estimacion';
import { cn } from '@/lib/utils';

const MAP: Record<
  EstadoEstimacion,
  { className: string; Icon: typeof Clock3 }
> = {
  REPARADO: { className: 'dms-badge--reparado', Icon: ShieldCheck },
  APROBADO: { className: 'dms-badge--aprobado', Icon: CheckCircle2 },
  ENVIADO: { className: 'dms-badge--enviado', Icon: Send },
  PENDIENTE: { className: 'dms-badge--pendiente', Icon: Clock3 },
  RECHAZADO: { className: 'dms-badge--rechazado', Icon: XCircle },
  REVERSADO: { className: 'dms-badge--reversado', Icon: RotateCcw },
};

export function EstadoEstimacionBadge({ estado }: { estado: EstadoEstimacion }) {
  const cfg = MAP[estado] ?? MAP.PENDIENTE;
  const Icon = cfg.Icon;
  return (
    <span className={cn('dms-badge whitespace-nowrap', cfg.className)}>
      <Icon className="h-3 w-3 shrink-0" />
      {estado}
    </span>
  );
}
