'use client';

import { useEffect, useState } from 'react';
import { Briefcase, ImageIcon, Save } from 'lucide-react';
import type { ArchivoDano, DanoEstimacion, Estimacion, FotoDano } from '@/types/estimacion';
import { toast } from '@/lib/utils';

function aIso(fecha: string | undefined) {
  if (!fecha) return '';
  const dmy = fecha.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(fecha)) return fecha.slice(0, 10);
  return '';
}

function deIso(iso: string) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function InfoLateralCards({
  estimacion,
  danoSeleccionado,
  editable,
  onGuardarGarantia,
}: {
  estimacion: Estimacion;
  danoSeleccionado: DanoEstimacion | null;
  editable: boolean;
  onGuardarGarantia: (cambios: Partial<DanoEstimacion>, resumen: string) => void;
}) {
  const dano = danoSeleccionado;
  const [serieAnterior, setSerieAnterior] = useState('');
  const [serieEntrega, setSerieEntrega] = useState('');
  const [fechaAceptacion, setFechaAceptacion] = useState('');
  const [ncGenerada, setNcGenerada] = useState('');
  const [montoNc, setMontoNc] = useState('');

  useEffect(() => {
    if (!dano) {
      setSerieAnterior('');
      setSerieEntrega('');
      setFechaAceptacion(aIso(estimacion.inspeccion.fecha));
      setNcGenerada('');
      setMontoNc('');
      return;
    }
    setSerieAnterior(dano.serieAnterior === 'N/A' ? '' : dano.serieAnterior);
    setSerieEntrega(dano.serieEntregado);
    setFechaAceptacion(aIso(dano.fechaAceptacion) || aIso(estimacion.inspeccion.fecha));
    setNcGenerada(dano.ncGenerada ?? '');
    setMontoNc(dano.montoNc != null ? String(dano.montoNc) : '');
  }, [dano, estimacion.inspeccion.fecha]);

  const [fotoAmpliada, setFotoAmpliada] = useState<FotoDano | null>(null);
  const reversados: ArchivoDano[] = dano?.archivosReversados ?? [];
  const fotos: FotoDano[] = dano?.fotos ?? [];

  function guardar() {
    if (!dano) {
      toast('Seleccione una línea de daño para guardar la garantía.', 'error');
      return;
    }
    const monto = montoNc.trim() === '' ? undefined : Number(montoNc.replace(',', '.'));
    if (montoNc.trim() && Number.isNaN(monto)) {
      toast('El monto NC debe ser numérico.', 'error');
      return;
    }
    onGuardarGarantia(
      {
        serieAnterior: serieAnterior.trim() || 'N/A',
        serieEntregado: serieEntrega.trim(),
        fechaAceptacion: fechaAceptacion ? deIso(fechaAceptacion) : '',
        ncGenerada: ncGenerada.trim(),
        montoNc: monto,
      },
      `Línea ${dano.linea} · garantía actualizada (serie ${serieEntrega.trim() || 's/n'})`
    );
    toast('Información de garantía guardada.', 'success');
  }

  return (
    <div className="space-y-3">
      <section className="dms-card">
        <header className="dms-card-header">
          <Briefcase className="h-3.5 w-3.5" /> Información de Garantía
        </header>
        <div className="dms-card-body space-y-2.5">
          <div>
            <label className="dms-field-label">Serie Anterior</label>
            <input
              className="dms-input-sm"
              value={serieAnterior}
              disabled={!editable || !dano}
              onChange={(e) => setSerieAnterior(e.target.value)}
            />
          </div>
          <div>
            <label className="dms-field-label">Serie Entrega</label>
            <input
              className="dms-input-sm"
              value={serieEntrega}
              disabled={!editable || !dano}
              onChange={(e) => setSerieEntrega(e.target.value)}
            />
          </div>
          <div>
            <label className="dms-field-label">Fecha Aceptación</label>
            <input
              type="date"
              className="dms-input-sm"
              value={fechaAceptacion}
              disabled={!editable || !dano}
              onChange={(e) => setFechaAceptacion(e.target.value)}
            />
          </div>
          <div>
            <label className="dms-field-label">No. NC Generada</label>
            <input
              className="dms-input-sm"
              value={ncGenerada}
              disabled={!editable || !dano}
              onChange={(e) => setNcGenerada(e.target.value)}
            />
          </div>
          <div>
            <label className="dms-field-label">Monto NC</label>
            <input
              className="dms-input-sm"
              inputMode="decimal"
              value={montoNc}
              disabled={!editable || !dano}
              onChange={(e) => setMontoNc(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="dms-btn-azul px-4 py-2 text-sm"
            disabled={!editable || !dano}
            onClick={guardar}
          >
            <Save className="h-4 w-4" /> Guardar
          </button>
        </div>
      </section>

      <section className="dms-card">
        <header className="dms-card-header">
          <ImageIcon className="h-3.5 w-3.5" /> Información de la Inspección
        </header>
        <div className="dms-card-body space-y-3">
          <div>
            <p className="dms-field-label mb-1.5">Archivos reversados</p>
            {reversados.length === 0 ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-center text-[11px] text-slate-400">
                No hay archivos reversados
              </div>
            ) : (
              <ul className="space-y-1">
                {reversados.map((a) => (
                  <li
                    key={a.id}
                    className="truncate rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-600"
                    title={a.nombre}
                  >
                    {a.nombre}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="dms-field-label mb-1.5">Fotos de daños</p>
            {!dano ? (
              <p className="text-[11px] leading-relaxed text-slate-400">
                Seleccione una línea del listado para ver las fotos de la inspección.
              </p>
            ) : fotos.length === 0 ? (
              <p className="text-[11px] leading-relaxed text-slate-400">
                Esta línea no tiene fotografías de inspección.
              </p>
            ) : (
              <div className="dms-insp-grid">
                {fotos.map((foto) => (
                  <button
                    key={foto.id}
                    type="button"
                    className="dms-insp-foto"
                    onClick={() => setFotoAmpliada(foto)}
                    title="Ver foto"
                  >
                    <span className="dms-insp-foto-img">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={foto.url} alt={foto.descripcion} />
                      <span className="dms-insp-foto-fecha">{foto.fecha.split(' ')[0]}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {fotoAmpliada && (
        <div className="dms-lightbox" onClick={() => setFotoAmpliada(null)}>
          <figure className="dms-lightbox-figure" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fotoAmpliada.url}
              alt={fotoAmpliada.descripcion}
              className="max-h-[78vh] w-auto rounded-lg object-contain shadow-2xl"
            />
            <figcaption className="dms-lightbox-caption">
              {fotoAmpliada.descripcion} · {fotoAmpliada.fecha}
            </figcaption>
          </figure>
        </div>
      )}
    </div>
  );
}
