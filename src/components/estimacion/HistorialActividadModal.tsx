'use client';

import { useMemo } from 'react';
import { Download, History } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import type { Estimacion } from '@/types/estimacion';
import { descargarHistorialCsv } from '@/lib/descargas';
import { toast } from '@/lib/utils';

interface Entrada {
  id: string;
  fecha: string;
  usuario: string;
  accion: string;
  detalle: string;
  origen: 'FLUJO' | 'COMENTARIO';
}

/** Ordena "dd/mm/yyyy hh:mm[:ss]" cronológicamente; las fechas ilegibles quedan al final. */
function aTimestamp(fecha: string) {
  const m = fecha.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return Number.MAX_SAFE_INTEGER;
  return new Date(
    Number(m[3]),
    Number(m[2]) - 1,
    Number(m[1]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6] ?? 0)
  ).getTime();
}

const COLOR_ACCION = (accion: string) => {
  if (accion.includes('RECHAZ')) return 'dms-timeline-dot--red';
  if (accion.includes('APROBA')) return 'dms-timeline-dot--blue';
  if (accion.includes('REPARA')) return 'dms-timeline-dot--green';
  if (accion.includes('REVERSO')) return 'dms-timeline-dot--purple';
  if (accion.includes('ENVÍO') || accion.includes('ENVIO')) return 'dms-timeline-dot--teal';
  if (accion.includes('COMENTARIO')) return 'dms-timeline-dot--orange';
  return 'dms-timeline-dot--gray';
};

export function HistorialActividadModal({
  open,
  estimacion,
  onClose,
}: {
  open: boolean;
  estimacion: Estimacion | null;
  onClose: () => void;
}) {
  const entradas = useMemo<Entrada[]>(() => {
    if (!estimacion) return [];
    const flujo: Entrada[] = estimacion.auditoria.map((ev) => ({
      id: ev.id,
      fecha: ev.fecha,
      usuario: ev.usuario,
      accion: ev.accion,
      detalle: ev.detalle,
      origen: 'FLUJO',
    }));
    const comentarios: Entrada[] = estimacion.danos.flatMap((d) =>
      d.comentarios.map((c) => ({
        id: c.id,
        fecha: c.fecha,
        usuario: c.usuario,
        accion: `COMENTARIO · ${c.rol}`,
        detalle: `Línea ${d.linea} (${d.comp})${c.campoAfectado ? ` · Campo: ${c.campoAfectado}` : ''} — ${c.mensaje}`,
        origen: 'COMENTARIO',
      }))
    );
    return [...flujo, ...comentarios].sort((a, b) => aTimestamp(a.fecha) - aTimestamp(b.fecha));
  }, [estimacion]);

  if (!estimacion) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={<History className="h-4 w-4" />}
      title={`Historial de Actividad · ${estimacion.codigo}`}
      subtitle={`${entradas.length} evento(s) registrados sobre ${estimacion.contenedor}`}
      footer={
        <>
          <button
            type="button"
            className="dms-btn-action border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
            onClick={onClose}
          >
            Cerrar
          </button>
          <button
            type="button"
            className="dms-btn-excel px-4 py-2 text-sm"
            onClick={() => {
              const n = descargarHistorialCsv(estimacion);
              toast(`Historial exportado (${n} eventos).`, 'success');
            }}
          >
            <Download className="h-4 w-4" /> Exportar CSV
          </button>
        </>
      }
    >
      <ol className="dms-timeline">
        {entradas.map((e) => (
          <li key={e.id} className="dms-timeline-item">
            <span className={`dms-timeline-dot ${COLOR_ACCION(e.accion)}`} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wide text-rfs-700">
                  {e.accion}
                </span>
                <span className="dms-chip-user">{e.usuario || 'sistema'}</span>
                <span className="text-[10px] tabular-nums text-gray-400">{e.fecha || 's/f'}</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-gray-600">{e.detalle}</p>
            </div>
          </li>
        ))}
        {entradas.length === 0 && (
          <li className="py-6 text-center text-xs text-gray-400">Sin actividad registrada.</li>
        )}
      </ol>
    </Modal>
  );
}
