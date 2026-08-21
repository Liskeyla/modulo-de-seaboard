'use client';

import { useMemo, useRef } from 'react';
import { FileText, Printer } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import type { Estimacion } from '@/types/estimacion';
import { construirInformeHtml, type VarianteInforme } from '@/lib/descargas';
import { toast } from '@/lib/utils';

const TITULOS: Record<VarianteInforme, string> = {
  ESTIMADO: 'Estimado de ReparaciÃ³n',
  PRELIMINAR: 'Informe Preliminar',
  FINAL: 'Informe Final',
};

interface InformePreviewModalProps {
  open: boolean;
  estimacion: Estimacion | null;
  conValores: boolean;
  variante?: VarianteInforme;
  onClose: () => void;
}

export function InformePreviewModal({
  open,
  estimacion,
  conValores,
  variante = 'ESTIMADO',
  onClose,
}: InformePreviewModalProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const html = useMemo(
    () => (estimacion ? construirInformeHtml(estimacion, conValores, variante) : ''),
    [estimacion, conValores, variante]
  );

  if (!estimacion) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      icon={<FileText className="h-4 w-4" />}
      title={`${TITULOS[variante]} ${estimacion.codigo}`}
      subtitle={
        conValores
          ? `${estimacion.contenedor} Â· ${estimacion.danos.length} lÃ­nea(s) Â· Total $${estimacion.pvpTotal.toFixed(2)}`
          : `${estimacion.contenedor} Â· versiÃ³n sin valores para la naviera`
      }
      bodyClassName="!p-0"
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
            className="dms-btn-primary px-4 py-2 text-sm"
            onClick={() => {
              iframeRef.current?.contentWindow?.focus();
              iframeRef.current?.contentWindow?.print();
              toast('Elija "Guardar como PDF" en el diÃ¡logo de impresiÃ³n.', 'info');
            }}
          >
            <Printer className="h-4 w-4" /> Imprimir / Guardar PDF
          </button>
        </>
      }
    >
      <iframe
        ref={iframeRef}
        srcDoc={html}
        title={`${TITULOS[variante]} ${estimacion.codigo}`}
        className="h-[68vh] w-full border-0 bg-gray-100"
      />
    </Modal>
  );
}
