'use client';

import { useMemo, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import type { ArchivoDano, DanoEstimacion, Estimacion, FotoDano } from '@/types/estimacion';
import { fotosRealesDano } from '@/lib/fotosDano';

type FotoInspeccion = FotoDano & { linea: number; comp: string };

export function InfoLateralCards({
  estimacion,
  danoSeleccionado,
}: {
  estimacion: Estimacion;
  danoSeleccionado: DanoEstimacion | null;
}) {
  const dano = danoSeleccionado;
  const [fotoAmpliada, setFotoAmpliada] = useState<FotoInspeccion | null>(null);

  const fotosDanos = useMemo<FotoInspeccion[]>(
    () =>
      estimacion.danos.flatMap((d) =>
        fotosRealesDano(d.fotos).map((f) => ({ ...f, linea: d.linea, comp: d.comp }))
      ),
    [estimacion.danos]
  );

  const reversados: ArchivoDano[] = useMemo(() => {
    if (dano) return dano.archivosReversados ?? [];
    return estimacion.danos.flatMap((d) => d.archivosReversados ?? []);
  }, [dano, estimacion.danos]);

  return (
    <div className="space-y-3">
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
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-1">
              <p className="dms-field-label mb-0">Fotos de daños</p>
              <p className="text-[10px] font-semibold text-slate-400">
                Todas las líneas · {fotosDanos.length}
              </p>
            </div>
            {fotosDanos.length === 0 ? (
              <p className="text-[11px] leading-relaxed text-slate-400">
                El estimado no tiene fotografías de daños declarados.
              </p>
            ) : (
              <div className="dms-insp-grid">
                {fotosDanos.map((foto) => (
                  <button
                    key={`${foto.linea}-${foto.id}`}
                    type="button"
                    className="dms-insp-foto"
                    onClick={() => setFotoAmpliada(foto)}
                    title={`Línea ${foto.linea} · ${foto.comp} · ${foto.descripcion}`}
                  >
                    <span className="dms-insp-foto-img">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={foto.url} alt={foto.descripcion} />
                      <span className="dms-insp-foto-fecha">
                        L{String(foto.linea).padStart(2, '0')} · {foto.fecha.split(' ')[0]}
                      </span>
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
              Línea {String(fotoAmpliada.linea).padStart(2, '0')} · {fotoAmpliada.comp} ·{' '}
              {fotoAmpliada.descripcion} · {fotoAmpliada.fecha}
            </figcaption>
          </figure>
        </div>
      )}
    </div>
  );
}
