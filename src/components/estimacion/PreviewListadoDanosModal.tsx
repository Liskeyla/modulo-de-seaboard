'use client';

import { useState } from 'react';
import { ClipboardList, ExternalLink } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { ListadoDanosTable } from '@/components/estimacion/ListadoDanosTable';
import { EstadoEstimacionBadge } from '@/components/dms/EstadoEstimacionBadge';
import type { Estimacion } from '@/types/estimacion';
import { formatMoney } from '@/lib/utils';

/**
 * Previsualización emergente del Listado de Daños sin entrar al estimado.
 */
export function PreviewListadoDanosModal({
  open,
  estimacion,
  onClose,
  onAbrirEstimado,
}: {
  open: boolean;
  estimacion: Estimacion | null;
  onClose: () => void;
  onAbrirEstimado?: (codigo: string) => void;
}) {
  const [danoSelId, setDanoSelId] = useState<string | null>(null);

  if (!estimacion) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="full"
      icon={<ClipboardList className="h-4 w-4" />}
      title={`Listado de Daños · ${estimacion.codigo}`}
      subtitle={`${estimacion.contenedor} · ${estimacion.tipoContenedor || '—'} · ${estimacion.naviera}`}
      bodyClassName="!p-3 max-h-[min(75vh,720px)] overflow-auto"
      footer={
        <>
          <button type="button" className="dms-btn-action border-gray-300 bg-white px-3 py-2 text-sm text-gray-700" onClick={onClose}>
            Cerrar
          </button>
          {onAbrirEstimado && (
            <button
              type="button"
              className="dms-btn-azul inline-flex items-center gap-2 px-3 py-2 text-sm"
              onClick={() => onAbrirEstimado(estimacion.codigo)}
            >
              <ExternalLink className="h-4 w-4" /> Abrir estimado
            </button>
          )}
        </>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
        <EstadoEstimacionBadge estado={estimacion.estado} />
        <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
          {estimacion.danos.length} línea(s)
        </span>
        <span>
          PVP Total · <strong className="text-rfs-navy">${formatMoney(estimacion.pvpTotal)}</strong>
        </span>
        <span className="text-slate-400">Solo lectura · previsualización</span>
      </div>

      <ListadoDanosTable
        danos={estimacion.danos}
        seleccionadoId={danoSelId}
        editable={false}
        cargoAplicaEditable={false}
        mostrarDimensiones={estimacion.tipoEstimacion.toUpperCase().includes('BOX')}
        mostrarMarcacion={false}
        onSeleccionar={(d) => setDanoSelId((prev) => (prev === d.id ? null : d.id))}
        onRemarkChange={() => undefined}
        onDonanteChange={() => undefined}
        onEditar={() => undefined}
        onFotos={() => undefined}
        onVideo={() => undefined}
        comentariosSoloLectura
        ocultarAcciones
      />
    </Modal>
  );
}
