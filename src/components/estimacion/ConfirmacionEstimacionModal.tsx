'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileText, XCircle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import {
  contarComentariosPendientes,
  itemsSinRevisionSbm,
  MSG_ITEMS_SIN_APROBAR,
  type Estimacion,
} from '@/types/estimacion';
import { construirInformeHtml } from '@/lib/descargas';
import { formatMoney, toast } from '@/lib/utils';
import { paisDe, type PaisOperacion } from '@/lib/pais';

/** Destinatarios prototipo por país de operación. */
export const CORREOS_LIQUIDACIONES_POR_PAIS: Record<PaisOperacion, string[]> = {
  ECUADOR: ['liquidaciones.ec@rfs.com.ec', 'gestor.liquidaciones.ec@rfs.com.ec'],
  PERU: ['liquidaciones.pe@rfs.com.pe', 'gestor.liquidaciones.pe@rfs.com.pe'],
};

export const CORREOS_LIQUIDACIONES_RFS = CORREOS_LIQUIDACIONES_POR_PAIS.ECUADOR;

function correosDeEstimacion(estimacion: Estimacion) {
  return CORREOS_LIQUIDACIONES_POR_PAIS[paisDe(estimacion)];
}

function mailtoLiquidaciones(correos: string[], asunto: string, cuerpo: string) {
  const mailto = `mailto:${correos.join(',')}?subject=${encodeURIComponent(
    asunto
  )}&body=${encodeURIComponent(cuerpo)}`;
  if (typeof window !== 'undefined') {
    window.location.href = mailto;
  }
}

/** Notifica a liquidaciones RFS el rechazo del estimado (prototipo mailto). */
export function notificarRechazoALiquidaciones(
  estimacion: Estimacion,
  comentario: string,
  usuario: string
) {
  const correos = correosDeEstimacion(estimacion);
  const paisLabel = paisDe(estimacion) === 'PERU' ? 'Perú' : 'Ecuador';
  const asunto = `Estimación ${estimacion.codigo} RECHAZADA · ${estimacion.contenedor} · ${paisLabel}`;
  const cuerpo = [
    `Estimados gestores de liquidaciones RFS (${paisLabel}),`,
    ``,
    `La estimación ${estimacion.codigo} (${estimacion.contenedor}) fue rechazada por Seaboard Marine.`,
    ``,
    `País: ${paisLabel}`,
    `Naviera: ${estimacion.naviera}`,
    `Total PVP: $${estimacion.pvpTotal.toFixed(2)}`,
    `Líneas de daño: ${estimacion.danos.length}`,
    `Usuario Seaboard: ${usuario}`,
    ``,
    `Motivo del rechazo:`,
    comentario.trim(),
    ``,
    `— Notificación automática · Gestor Seaboard Marine (prototipo)`,
  ].join('\n');

  mailtoLiquidaciones(correos, asunto, cuerpo);
  toast(
    `Correo de rechazo preparado para liquidaciones ${paisLabel}\n${correos.join(', ')}`,
    'success'
  );
}

/** Notifica a liquidaciones RFS la aprobación del estimado (prototipo mailto). */
export function notificarAprobacionALiquidaciones(
  estimacion: Estimacion,
  usuario: string
) {
  const correos = correosDeEstimacion(estimacion);
  const paisLabel = paisDe(estimacion) === 'PERU' ? 'Perú' : 'Ecuador';
  const asunto = `Estimación ${estimacion.codigo} APROBADA · ${estimacion.contenedor} · ${paisLabel}`;
  const cuerpo = [
    `Estimados gestores de liquidaciones RFS (${paisLabel}),`,
    ``,
    `La estimación ${estimacion.codigo} (${estimacion.contenedor}) fue aprobada por Seaboard Marine.`,
    ``,
    `País: ${paisLabel}`,
    `Naviera: ${estimacion.naviera}`,
    `Total PVP: $${estimacion.pvpTotal.toFixed(2)}`,
    `Líneas de daño: ${estimacion.danos.length}`,
    `Usuario Seaboard: ${usuario}`,
    ``,
    `— Notificación automática · Gestor Seaboard Marine (prototipo)`,
  ].join('\n');

  mailtoLiquidaciones(correos, asunto, cuerpo);
  toast(
    `Correo de aprobación preparado para liquidaciones ${paisLabel}\n${correos.join(', ')}`,
    'success'
  );
}

function resumenCambiosEstimacion(est: Estimacion): string[] {
  const items: string[] = [];
  est.danos.forEach((d) => {
    if (d.edicionReciente) {
      items.push(
        `Línea ${String(d.linea).padStart(2, '0')} · ${d.comp} · ${d.edicionReciente.usuario}: ${d.edicionReciente.resumenCambios}`
      );
      if (d.edicionReciente.comentarioSbm) {
        items.push(`  Motivo (${d.edicionReciente.usuario}): ${d.edicionReciente.comentarioSbm}`);
      }
    }
  });
  const recientes = [...est.auditoria].slice(-8).reverse();
  recientes.forEach((ev) => {
    if (/DAÑO|ÍTEM|APROB|RECHAZ|NOTA|CIERR|APERTUR|ENVÍO|ENVIO|LIQUID/i.test(ev.accion)) {
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
  onAprobar: () => void;
  onRechazar: (comentario: string) => void;
}

/**
 * Confirmación del gestor Seaboard: informe + Aprobar/Rechazar
 * con destino Liquidaciones RFS (no al revés).
 */
export function ConfirmacionEstimacionModal({
  open,
  modo,
  estimacion,
  onClose,
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
  const pendientesLiq = useMemo(
    () => (estimacion ? contarComentariosPendientes(estimacion.danos) : 0),
    [estimacion]
  );
  const sinRevision = useMemo(
    () => (estimacion ? itemsSinRevisionSbm(estimacion.danos) : []),
    [estimacion]
  );
  const faltanItems = sinRevision.length > 0;

  if (!estimacion) return null;

  const titulo =
    modo === 'ENVIAR' || modo === 'DECISION'
      ? 'Aprobar o rechazar estimado'
      : 'Decisión Seaboard';
  const subtitle = `${estimacion.codigo} · Seaboard → Liquidaciones RFS · Total $${formatMoney(
    estimacion.pvpTotal
  )}`;

  function confirmarRechazo() {
    if (faltanItems) {
      toast(MSG_ITEMS_SIN_APROBAR, 'info');
      return;
    }
    const motivo = comentario.trim();
    if (motivo.length < 5) {
      toast('Indique un comentario general del rechazo (mín. 5 caracteres).', 'info');
      return;
    }
    onRechazar(motivo);
  }

  function confirmarAprobar() {
    if (faltanItems) {
      toast(MSG_ITEMS_SIN_APROBAR, 'info');
      return;
    }
    onAprobar();
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
          {!rechazando && (
            <>
              <button
                type="button"
                className="dms-btn-rechazar px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                disabled={faltanItems}
                title={faltanItems ? 'Revise todos los ítems antes de rechazar' : undefined}
                onClick={() => {
                  if (faltanItems) {
                    toast(MSG_ITEMS_SIN_APROBAR, 'info');
                    return;
                  }
                  setRechazando(true);
                }}
              >
                <XCircle className="h-4 w-4" /> Rechazar y notificar
              </button>
              <button
                type="button"
                className="dms-btn-aprobar px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                disabled={faltanItems}
                title={faltanItems ? 'Revise todos los ítems antes de aprobar' : undefined}
                onClick={confirmarAprobar}
              >
                <CheckCircle2 className="h-4 w-4" /> Aprobar y enviar
              </button>
            </>
          )}
          {rechazando && (
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
                <XCircle className="h-4 w-4" /> Confirmar rechazo a liquidaciones
              </button>
            </>
          )}
        </>
      }
    >
      <div className="space-y-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-xs leading-relaxed text-slate-600">
          Revise el informe. <strong>Aprobar</strong> deja el estimado en{' '}
          <strong>APROBADO</strong>; <strong>Rechazar</strong> en <strong>RECHAZADO</strong>. En
          ambos casos se notifica a liquidaciones RFS.
        </p>

        {pendientesLiq > 0 && (
          <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-950">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            <span>
              Atención: hay <strong>{pendientesLiq}</strong> comentario(s) de liquidaciones sin
              resolver. Revíselos antes de decidir.
            </span>
          </div>
        )}

        {faltanItems && (
          <div className="flex gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[11px] leading-snug text-red-950">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
            <span>
              Debe aprobar o rechazar los ítems de daño antes de enviar a liquidaciones (
              <strong>{sinRevision.length}</strong> pendiente
              {sinRevision.length === 1 ? '' : 's'}: líneas{' '}
              {sinRevision.map((d) => String(d.linea).padStart(2, '0')).join(', ')}). Aperture el
              estimado y use «Aprobar ítems» / «Rechazar ítems».
            </span>
          </div>
        )}

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
        {rechazando && (
          <div>
            <label className="dms-field-label">Comentario general del rechazo</label>
            <textarea
              rows={3}
              className="dms-input-sm h-auto w-full border-red-200 bg-white"
              value={comentario}
              placeholder="Indique el motivo por el cual Seaboard rechaza el estimado…"
              onChange={(e) => setComentario(e.target.value)}
            />
            <p className="mt-1 text-[10px] text-slate-500">
              Se notificará a: {correosDeEstimacion(estimacion).join(', ')}
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
