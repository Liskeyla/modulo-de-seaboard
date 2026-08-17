'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Images, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import type { FotoDano } from '@/types/estimacion';
import { cn } from '@/lib/utils';

interface GaleriaFotosModalProps {
  open: boolean;
  titulo: string;
  subtitulo?: string;
  fotos: FotoDano[];
  onClose: () => void;
}

export function GaleriaFotosModal({
  open,
  titulo,
  subtitulo,
  fotos,
  onClose,
}: GaleriaFotosModalProps) {
  const [filtro, setFiltro] = useState<'TODAS' | 'DANO' | 'REPARADO'>('TODAS');
  const [ampliada, setAmpliada] = useState<number | null>(null);

  const visibles = filtro === 'TODAS' ? fotos : fotos.filter((f) => f.tipo === filtro);

  useEffect(() => {
    if (!open) {
      setAmpliada(null);
      setFiltro('TODAS');
    }
  }, [open]);

  useEffect(() => {
    if (ampliada === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setAmpliada((i) => ((i ?? 0) + 1) % visibles.length);
      if (e.key === 'ArrowLeft') setAmpliada((i) => ((i ?? 0) - 1 + visibles.length) % visibles.length);
      if (e.key === 'Escape') setAmpliada(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ampliada, visibles.length]);

  const conteos = {
    TODAS: fotos.length,
    DANO: fotos.filter((f) => f.tipo === 'DANO').length,
    REPARADO: fotos.filter((f) => f.tipo === 'REPARADO').length,
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="xl"
        icon={<Images className="h-4 w-4" />}
        title={titulo}
        subtitle={subtitulo}
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
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(['TODAS', 'DANO', 'REPARADO'] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={cn('dms-tab', filtro === f && 'dms-tab--activo')}
              onClick={() => setFiltro(f)}
            >
              {f === 'TODAS' ? 'Todas' : f === 'DANO' ? 'Daños' : 'Reparados'}
              <span className="dms-tab-count">{conteos[f]}</span>
            </button>
          ))}
        </div>

        {visibles.length === 0 ? (
          <p className="py-8 text-center text-xs text-gray-400">
            No hay fotografías en esta categoría.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visibles.map((foto, i) => (
              <button
                key={foto.id}
                type="button"
                className="dms-foto-card group"
                onClick={() => setAmpliada(i)}
              >
                <span className="relative block h-32 w-full overflow-hidden bg-gray-100">
                  <Image
                    src={foto.url}
                    alt={foto.descripcion}
                    fill
                    sizes="220px"
                    className="object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                </span>
                <span className="dms-foto-card-body">
                  <span
                    className={cn(
                      'dms-foto-tag',
                      foto.tipo === 'DANO' ? 'dms-foto-tag--dano' : 'dms-foto-tag--reparado'
                    )}
                  >
                    {foto.tipo === 'DANO' ? 'Daño' : 'Reparado'}
                  </span>
                  <span className="mt-1 block truncate text-[10px] text-gray-500">{foto.fecha}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </Modal>

      {ampliada !== null && visibles[ampliada] && (
        <div className="dms-lightbox" onClick={() => setAmpliada(null)}>
          <button
            type="button"
            className="dms-lightbox-close"
            onClick={() => setAmpliada(null)}
            aria-label="Cerrar imagen"
          >
            <X className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="dms-lightbox-nav left-3"
            onClick={(e) => {
              e.stopPropagation();
              setAmpliada((i) => ((i ?? 0) - 1 + visibles.length) % visibles.length);
            }}
            aria-label="Anterior"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <figure className="dms-lightbox-figure" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={visibles[ampliada].url}
              alt={visibles[ampliada].descripcion}
              className="max-h-[78vh] w-auto rounded-lg object-contain shadow-2xl"
            />
            <figcaption className="dms-lightbox-caption">
              <span className="font-semibold">
                {visibles[ampliada].tipo === 'DANO' ? 'Evidencia de daño' : 'Evidencia de reparado'}
              </span>{' '}
              · {visibles[ampliada].descripcion} · {visibles[ampliada].fecha}
              <span className="ml-2 text-white/50">
                {ampliada + 1} / {visibles.length}
              </span>
            </figcaption>
          </figure>
          <button
            type="button"
            className="dms-lightbox-nav right-3"
            onClick={(e) => {
              e.stopPropagation();
              setAmpliada((i) => ((i ?? 0) + 1) % visibles.length);
            }}
            aria-label="Siguiente"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>
      )}
    </>
  );
}
