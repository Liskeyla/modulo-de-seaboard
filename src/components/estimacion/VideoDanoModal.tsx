'use client';

import { Video } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import type { DanoEstimacion, Estimacion } from '@/types/estimacion';

const VIDEO_DEMO = '/uploads/estimaciones/videos/inspeccion-demo.mp4';

export function VideoDanoModal({
  open,
  estimacion,
  dano,
  onClose,
}: {
  open: boolean;
  estimacion: Estimacion;
  dano: DanoEstimacion | null;
  onClose: () => void;
}) {
  if (!dano) return null;

  const poster = dano.fotos[0]?.url;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={<Video className="h-4 w-4" />}
      title={`Video de inspección · Línea ${String(dano.linea).padStart(2, '0')} · ${dano.comp}`}
      subtitle={`${estimacion.codigo} · ${estimacion.contenedor} · ${dano.dano}`}
      footer={
        <button
          type="button"
          className="dms-btn-action border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
          onClick={onClose}
        >
          Cerrar
        </button>
      }
    >
      {dano.tieneVideo ? (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-xl bg-black">
            <video
              key={dano.id}
              src={VIDEO_DEMO}
              poster={poster}
              controls
              playsInline
              className="h-auto max-h-[58vh] w-full"
            />
            <div className="pointer-events-none absolute right-3 top-3 rounded-md bg-black/60 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
              {estimacion.contenedor}
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="dms-mini-dato">
              <dt>Componente</dt>
              <dd>{dano.comp}</dd>
            </div>
            <div className="dms-mini-dato">
              <dt>Ubicación</dt>
              <dd>{dano.ubicacion || '—'}</dd>
            </div>
            <div className="dms-mini-dato">
              <dt>Técnico</dt>
              <dd>{estimacion.tecnico}</dd>
            </div>
            <div className="dms-mini-dato">
              <dt>Fecha</dt>
              <dd>{estimacion.fechaElaboracion}</dd>
            </div>
          </dl>
        </div>
      ) : (
        <div className="dms-empty-state">
          <div className="dms-empty-icon">
            <Video className="h-7 w-7" />
          </div>
          <p className="text-sm font-semibold text-gray-700">Sin video registrado</p>
          <p className="mt-1 max-w-sm text-xs text-gray-500">
            Esta línea de daño no tiene grabación de inspección asociada. El técnico puede cargarla
            desde la aplicación móvil de patio.
          </p>
        </div>
      )}
    </Modal>
  );
}
