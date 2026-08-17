'use client';

import { ClipboardCheck, FileWarning, Images, MessageSquare, ShieldCheck } from 'lucide-react';
import type { DanoEstimacion, Estimacion } from '@/types/estimacion';
import { cn, formatMoney } from '@/lib/utils';

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="dms-info-row">
      <span>{label}</span>
      <strong>{valor || '—'}</strong>
    </div>
  );
}

export function InfoLateralCards({
  estimacion,
  danoSeleccionado,
  onVerFotos,
  onVerComentarios,
}: {
  estimacion: Estimacion;
  danoSeleccionado: DanoEstimacion | null;
  onVerFotos: (dano: DanoEstimacion) => void;
  onVerComentarios: (dano: DanoEstimacion) => void;
}) {
  const { garantia, inspeccion } = estimacion;

  return (
    <div className="space-y-3">
      <section className="dms-card">
        <header className="dms-card-header">
          <ShieldCheck className="h-3.5 w-3.5" /> Información de Garantía
        </header>
        <div className="dms-card-body">
          {garantia.enGarantia ? (
            <>
              <span className="dms-badge dms-badge--aprobado mb-2">En garantía</span>
              <Dato label="Proveedor" valor={garantia.proveedor} />
              <Dato label="Orden" valor={garantia.ordenGarantia} />
              <Dato label="Vigencia" valor={`${garantia.fechaInicio} — ${garantia.fechaFin}`} />
              <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
                {garantia.observacion}
              </p>
            </>
          ) : (
            <p className="text-[11px] leading-relaxed text-gray-400">{garantia.observacion}</p>
          )}
        </div>
      </section>

      <section className="dms-card">
        <header className="dms-card-header">
          <ClipboardCheck className="h-3.5 w-3.5" /> Información de la Inspección
        </header>
        <div className="dms-card-body">
          <Dato label="Código" valor={inspeccion.codigo} />
          <Dato label="Fecha" valor={inspeccion.fecha} />
          <Dato label="Inspector" valor={inspeccion.inspector} />
          <Dato label="Resultado" valor={inspeccion.resultado} />
          <Dato label="Niveles" valor={estimacion.niveles} />
          <Dato label="Días de estadía" valor={String(estimacion.diasEstadia)} />
          <p className="mt-2 text-[11px] leading-relaxed text-gray-500">{inspeccion.observacion}</p>
        </div>
      </section>

      <section className="dms-card">
        <header className="dms-card-header">
          <FileWarning className="h-3.5 w-3.5" /> Información del Daño
        </header>
        <div className="dms-card-body">
          {!danoSeleccionado ? (
            <p className="text-[11px] leading-relaxed text-gray-400">
              Seleccione una línea del <strong>Listado de Daños</strong> para ver la tarifa aplicada
              y su información adicional.
            </p>
          ) : (
            <>
              <div className="mb-2 flex items-center gap-2">
                <span className="dms-mini-badge">
                  Línea {String(danoSeleccionado.linea).padStart(2, '0')}
                </span>
                <span className="text-xs font-bold text-rfs-navy">{danoSeleccionado.comp}</span>
              </div>
              <Dato label="Daño" valor={danoSeleccionado.dano} />
              <Dato label="Ubicación" valor={danoSeleccionado.ubicacion} />
              <Dato label="Met. Rep." valor={danoSeleccionado.newMetRep} />
              <Dato label="Medida" valor={danoSeleccionado.medida} />
              <Dato label="Cantidad" valor={danoSeleccionado.cantidad.toFixed(2)} />
              <Dato label="H.H." valor={danoSeleccionado.horasHombre.toFixed(2)} />
              <Dato label="Cs. H.H." valor={`$${formatMoney(danoSeleccionado.csHoraHombre)}`} />
              <Dato label="Cs. Mat." valor={`$${formatMoney(danoSeleccionado.csMaterial)}`} />
              <Dato label="Cs. Total" valor={`$${formatMoney(danoSeleccionado.csTotal)}`} />
              <Dato label="Cargo" valor={danoSeleccionado.cargo} />
              <Dato label="Aplica" valor={danoSeleccionado.aplica} />
              {danoSeleccionado.contenedorDonante && (
                <Dato label="Cont. donante" valor={danoSeleccionado.contenedorDonante} />
              )}
              {danoSeleccionado.obsAnalisis && (
                <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
                  {danoSeleccionado.obsAnalisis}
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  className="dms-btn-action dms-btn-info"
                  onClick={() => onVerFotos(danoSeleccionado)}
                >
                  <Images className="h-3 w-3" /> {danoSeleccionado.fotos.length} foto(s)
                </button>
                <button
                  type="button"
                  className={cn(
                    'dms-btn-action',
                    danoSeleccionado.comentarios.some((c) => c.tipo === 'SOLICITA_CAMBIO')
                      ? 'dms-btn-reversar'
                      : 'dms-btn-ver'
                  )}
                  onClick={() => onVerComentarios(danoSeleccionado)}
                >
                  <MessageSquare className="h-3 w-3" /> {danoSeleccionado.comentarios.length}{' '}
                  comentario(s)
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
