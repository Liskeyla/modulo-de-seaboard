'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileText, Send, XCircle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import type { Estimacion } from '@/types/estimacion';
import { construirInformeHtml } from '@/lib/descargas';
import { formatMoney, toast } from '@/lib/utils';

/** Destinatarios prototipo: gestores de liquidaciones RFS. */
export const CORREOS_LIQUIDACIONES_RFS = [
  'liquidaciones@rfs.com.ec',
  'gestor.liquidaciones@rfs.com.ec',
];

/** Abre mailto y confirma en UI el aviso a liquidaciones (prototipo). */
export function notificarRechazoALiquidaciones(
  estimacion: Estimacion,
  comentario: string,
  usuario: string
) {
  const asunto = `Estimación ${estimacion.codigo} RECHAZADA · ${estimacion.contenedor}`;
  const cuerpo = [
    `Estimados gestores de liquidaciones RFS,`,
    ``,
    `La estimación ${estimacion.codigo} (${estimacion.contenedor}) fue rechazada.`,
    ``,
    `Naviera: ${estimacion.naviera}`,
    `Estado previo: ${estimacion.estado}`,
    `Total PVP: $${estimacion.pvpTotal.toFixed(2)}`,
    `Líneas de daño: ${estimacion.danos.length}`,
    `Usuario: ${usuario}`,
    ``,
    `Motivo del rechazo:`,
    comentario.trim(),
    ``,
    `— Notificación automática DMS Estimaciones (prototipo)`,
  ].join('\n');

  const mailto = `mailto:${CORREOS_LIQUIDACIONES_RFS.join(',')}?subject=${encodeURIComponent(
    asunto
  )}&body=${encodeURIComponent(cuerpo)}`;

  if (typeof window !== 'undefined') {
    window.location.href = mailto;
  }

  toast(
    `Correo de rechazo preparado para liquidaciones RFS\n${CORREOS_LIQUIDACIONES_RFS.join(', ')}`,
    'success'
  );
}

function resumenCambiosEstimacion(est: Estimacion): string[] {
  const items: string[] = [];
  est.danos.forEach((d) => {
    if (d.edicionReciente) {
      items.push(
        `Línea ${String(d.linea).padStart(2, '0')} · ${d.comp}: ${d.edicionReciente.resumenCambios}`
      );
      if (d.edicionReciente.comentarioSbm) {
        items.push(`  SBM: ${d.edicionReciente.comentarioSbm}`);
      }
    }
  });
  const recientes = [...est.auditoria].slice(-8).reverse();
  recientes.forEach((ev) => {
    if (
      /DAÑO|ÍTEM|APROB|RECHAZ|NOTA|CIERR|APERTUR|ENVÍO|ENVIO/i.test(ev.accion)
    ) {
      items.push(`${ev.fecha} · ${ev.accion}: ${ev.detalle}`);
    }
  });
  return items.slice(0, 24);
}

export type ModoConfirmacionEstimacion = 'ENVIAR' | 'DECISION';

interface ConfirmacionEstimacionModalProps {
  open: boolean;
  modo: ModoConfirmacionEstimacion;
  estimacion: Estimacion | null;
  onClose: () => void;
  onEnviar: () => void;
  onAprobar: () => void;
  onRechazar: (comentario: string) => void;
}

/** Confirmación con informe/resumen para Enviar, Aprobar o Rechazar el estimado. */
export function ConfirmacionEstimacionModal({
  open,
  modo,
  estimacion,
  onClose,
  onEnviar,
  onAprobar,
  onRechazar,
}: ConfirmacionEstimacionModalProps) {
  const [comentario, setComentario] = useState('');
  const [rechazando, setRechazando] = useState(false);

  useEffect(() => {
    if (!open) {
      setComentario('');
      setRechazando(false);
    }
  }, [open]);

  const html = useMemo(
    () => (estimacion ? construirInformeHtml(estimacion, true, 'ESTIMADO') : ''),
    [estimacion]
  );
  const cambios = useMemo(
    () => (estimacion ? resumenCambiosEstimacion(estimacion) : []),
    [estimacion]
  );

  if (!estimacion) return null;

  const titulo =
    modo === 'ENVIAR'
      ? 'Confirmar envío a aprobación'
      : 'Aprobación Seaboard Marine';
  const subtitle =
    modo === 'ENVIAR'
      ? `${estimacion.codigo} · Destino: ${estimacion.naviera}`
      : `${estimacion.codigo} · ${estimacion.contenedor} · Total $${formatMoney(estimacion.pvpTotal)}`;

  function confirmarRechazo() {
    const motivo = comentario.trim();
    if (motivo.length < 5) {
      toast('Indique un comentario general del rechazo (mín. 5 caracteres).', 'info');
      return;
    }
    onRechazar(motivo);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      icon={<FileText className="h-4 w-4" />}
      title={titulo}
      subtitle={subtitle}
      bodyClassName="!p-0"
      footer={
        <>
          <button
            type="button"
            className="dms-btn-action border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
            onClick={onClose}
          >
            Cancelar
          </button>
          {modo === 'ENVIAR' && (
            <button
              type="button"
              className="dms-btn-enviar px-4 py-2 text-sm"
              onClick={onEnviar}
            >
              <Send className="h-4 w-4" /> Enviar a Aprobación
            </button>
          )}
          {modo === 'DECISION' && !rechazando && (
            <>
              <button
                type="button"
                className="dms-btn-rechazar px-4 py-2 text-sm"
                onClick={() => setRechazando(true)}
              >
                <XCircle className="h-4 w-4" /> Rechazar
              </button>
              <button
                type="button"
                className="dms-btn-aprobar px-4 py-2 text-sm"
                onClick={onAprobar}
              >
                <CheckCircle2 className="h-4 w-4" /> Aprobar
              </button>
            </>
          )}
          {modo === 'DECISION' && rechazando && (
            <>
              <button
                type="button"
                className="dms-btn-action border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
                onClick={() => {
                  setRechazando(false);
                  setComentario('');
                }}
              >
                Volver
              </button>
              <button
                type="button"
                className="dms-btn-rechazar px-4 py-2 text-sm"
                onClick={confirmarRechazo}
              >
                <XCircle className="h-4 w-4" /> Confirmar rechazo y notificar
              </button>
            </>
          )}
        </>
      }
    >
      <div className="space-y-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-xs leading-relaxed text-slate-600">
          {modo === 'ENVIAR' ? (
            <>
              Revise el informe resumen del estimado antes de enviarlo a{' '}
              <strong>{estimacion.naviera}</strong>. Pasará a estado <strong>ENVIADO</strong>.
            </>
          ) : (
            <>
              Revise el informe del estimado. Pulse <strong>Aprobar</strong> o{' '}
              <strong>Rechazar</strong> directamente aquí (no es necesario ir a otra pantalla). Si
              rechaza, indique un comentario general y se notificará a liquidaciones RFS.
            </>
          )}
        </p>
        {cambios.length > 0 && (
          <div className="max-h-28 overflow-y-auto rounded-lg border border-slate-200 bg-white">
            <p className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Resumen de cambios ({cambios.length})
            </p>
            <ul className="divide-y divide-slate-100 text-[11px] text-slate-700">
              {cambios.map((c, i) => (
                <li key={i} className="px-3 py-1.5 leading-snug">
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}
        {modo === 'DECISION' && rechazando && (
          <div>
            <label className="dms-field-label">Comentario general del rechazo</label>
            <textarea
              rows={3}
              className="dms-input-sm h-auto w-full border-red-200 bg-white"
              value={comentario}
              placeholder="Indique el motivo por el cual se rechaza el estimado…"
              onChange={(e) => setComentario(e.target.value)}
            />
            <p className="mt-1 text-[10px] text-slate-500">
              Se enviará notificación a: {CORREOS_LIQUIDACIONES_RFS.join(', ')}
            </p>
          </div>
        )}
      </div>
      <iframe
        srcDoc={html}
        title={`Informe resumen ${estimacion.codigo}`}
        className="h-[min(52vh,420px)] w-full border-0 bg-white"
      />
    </Modal>
  );
}
