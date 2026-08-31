'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, FileText, Send } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import {
  contarComentariosPendientes,
  esAplicaRechazado,
  esRevisionParcialItems,
  itemsSinRevisionSbm,
  MSG_ITEMS_SIN_APROBAR,
  MSG_REVISION_PARCIAL,
  type Estimacion,
} from '@/types/estimacion';
import { construirInformeHtml } from '@/lib/descargas';
import { cn, formatMoney, toast } from '@/lib/utils';
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

/** Notifica a liquidaciones RFS el envío del estimado (prototipo mailto). */
export function notificarEnvioALiquidaciones(
  estimacion: Estimacion,
  comentario: string,
  usuario: string,
  estadoResultante: string
) {
  const correos = correosDeEstimacion(estimacion);
  const paisLabel = paisDe(estimacion) === 'PERU' ? 'Perú' : 'Ecuador';
  const hayRechazos = estimacion.danos.some((d) => esAplicaRechazado(d.aplica));
  const asunto =
    estadoResultante === 'APROBADO'
      ? `Estimación ${estimacion.codigo} APROBADA · ${estimacion.contenedor} · ${paisLabel}`
      : `Estimación ${estimacion.codigo} ENVIADA (${estadoResultante}) · ${estimacion.contenedor} · ${paisLabel}`;
  const cuerpo = [
    `Estimados gestores de liquidaciones RFS (${paisLabel}),`,
    ``,
    estadoResultante === 'APROBADO'
      ? `La estimación ${estimacion.codigo} (${estimacion.contenedor}) fue enviada por Seaboard Marine en estado APROBADO.`
      : `La estimación ${estimacion.codigo} (${estimacion.contenedor}) fue enviada por Seaboard Marine.`,
    ``,
    `País: ${paisLabel}`,
    `Naviera: ${estimacion.naviera}`,
    `Estado resultante: ${estadoResultante}`,
    `Ítems con rechazo: ${hayRechazos ? 'Sí' : 'No'}`,
    `Total PVP: $${estimacion.pvpTotal.toFixed(2)}`,
    `Líneas de daño: ${estimacion.danos.length}`,
    `Usuario Seaboard: ${usuario}`,
    ``,
    `Comentarios generales:`,
    comentario.trim(),
    ``,
    `— Notificación automática · Gestor Seaboard Marine (prototipo)`,
  ].join('\n');

  mailtoLiquidaciones(correos, asunto, cuerpo);
  toast(
    estadoResultante === 'APROBADO'
      ? `Correo de estimado APROBADO preparado para liquidaciones ${paisLabel}\n${correos.join(', ')}`
      : `Correo de envío preparado para liquidaciones ${paisLabel}\n${correos.join(', ')}`,
    'success'
  );
}

/** @deprecated Use notificarEnvioALiquidaciones */
export function notificarRechazoALiquidaciones(
  estimacion: Estimacion,
  comentario: string,
  usuario: string
) {
  notificarEnvioALiquidaciones(estimacion, comentario, usuario, 'RECHAZADO');
}

/** @deprecated Use notificarEnvioALiquidaciones */
export function notificarAprobacionALiquidaciones(
  estimacion: Estimacion,
  usuario: string,
  comentario: string
) {
  notificarEnvioALiquidaciones(estimacion, comentario, usuario, 'APROBADO');
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
  return items;
}

export type ModoConfirmacionEstimacion = 'ENVIAR' | 'DECISION';

interface ConfirmacionEstimacionModalProps {
  open: boolean;
  modo: ModoConfirmacionEstimacion;
  estimacion: Estimacion | null;
  onClose: () => void;
  /** Seaboard envía el estimado a liquidaciones RFS con comentarios generales. */
  onEnviar: (comentario: string) => void;
}

/**
 * Confirmación del gestor Seaboard: informe + Enviar a Liquidaciones RFS
 * (sin aprobar/rechazar el estimado; la decisión de ítems ya se hizo en el listado).
 */
export function ConfirmacionEstimacionModal({
  open,
  modo,
  estimacion,
  onClose,
  onEnviar,
}: ConfirmacionEstimacionModalProps) {
  const [comentario, setComentario] = useState('');

  useEffect(() => {
    if (!open) setComentario('');
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
  const revisionParcial = useMemo(
    () => (estimacion ? esRevisionParcialItems(estimacion.danos) : false),
    [estimacion]
  );
  const hayRechazos = useMemo(
    () => (estimacion ? estimacion.danos.some((d) => esAplicaRechazado(d.aplica)) : false),
    [estimacion]
  );
  const faltanItems = sinRevision.length > 0;

  if (!estimacion) return null;

  const titulo =
    modo === 'ENVIAR' || modo === 'DECISION'
      ? 'Enviar a liquidaciones RFS'
      : 'Enviar estimado';
  const subtitle = `${estimacion.codigo} · Seaboard → Liquidaciones RFS · Total $${formatMoney(
    estimacion.pvpTotal
  )}`;

  function confirmarEnviar() {
    if (faltanItems) {
      toast(MSG_ITEMS_SIN_APROBAR, 'info');
      return;
    }
    const motivo = comentario.trim();
    if (motivo.length < 5) {
      toast(
        'Indique comentarios generales (mín. 5 caracteres) antes de enviar.',
        'info'
      );
      return;
    }
    onEnviar(motivo);
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
          <button
            type="button"
            className="dms-btn-enviar px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            disabled={faltanItems}
            title={faltanItems ? 'Revise todos los ítems antes de enviar' : undefined}
            onClick={confirmarEnviar}
          >
            <Send className="h-4 w-4" /> Enviar
          </button>
        </>
      }
    >
      <div className="space-y-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-xs leading-relaxed text-slate-600">
          Revise el informe y envíe el estimado a <strong>liquidaciones RFS</strong>. La decisión
          de cada ítem (aprobar / rechazar) ya se define en el listado de daños.
          {hayRechazos ? (
            <>
              {' '}
              Hay ítems rechazados: el estimado quedará en estado <strong>ENVIADO</strong> para que
              liquidaciones lo gestione.
            </>
          ) : (
            <>
              {' '}
              Si todos los ítems están aprobados, al enviar el estimado pasa a{' '}
              <strong>APROBADO</strong> y se notifica a liquidaciones RFS.
            </>
          )}
          {revisionParcial && (
            <>
              {' '}
              <strong>Revisión parcial:</strong> solo debe resolver los ítems pendientes; los ya
              aprobados no se vuelven a revisar.
            </>
          )}
        </p>

        {pendientesLiq > 0 && (
          <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-950">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            <span>
              Atención: hay <strong>{pendientesLiq}</strong> comentario(s) de liquidaciones sin
              resolver. Revíselos antes de enviar.
            </span>
          </div>
        )}

        {faltanItems && (
          <div className="flex gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[11px] leading-snug text-red-950">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
            <span>
              {revisionParcial ? (
                <>
                  {MSG_REVISION_PARCIAL} Pendiente
                  {sinRevision.length === 1 ? '' : 's'}: líneas{' '}
                  {sinRevision.map((d) => String(d.linea).padStart(2, '0')).join(', ')}.
                </>
              ) : (
                <>
                  Debe aprobar o rechazar los ítems de daño antes de enviar a liquidaciones (
                  <strong>{sinRevision.length}</strong> pendiente
                  {sinRevision.length === 1 ? '' : 's'}: líneas{' '}
                  {sinRevision.map((d) => String(d.linea).padStart(2, '0')).join(', ')}). Aperture el
                  estimado y use «Aprobar ítems» / «Rechazar ítems».
                </>
              )}
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
        <div>
          <label className="dms-field-label">Comentarios generales (obligatorio)</label>
          <textarea
            rows={3}
            className={cn('dms-input-sm h-auto w-full border-slate-200 bg-white')}
            value={comentario}
            placeholder="Escriba comentarios generales para liquidaciones RFS…"
            onChange={(e) => setComentario(e.target.value)}
          />
          <p className="mt-1 text-[10px] text-slate-500">
            Se notificará a: {correosDeEstimacion(estimacion).join(', ')}
          </p>
        </div>
      </div>
      <iframe
        srcDoc={html}
        title={`Informe resumen ${estimacion.codigo}`}
        className="h-[min(52vh,420px)] w-full border-0 bg-white"
      />
    </Modal>
  );
}
