'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ClipboardList,
  Download,
  FileArchive,
  FileDown,
  FileText,
  Loader2,
} from 'lucide-react';
import type { Estimacion } from '@/types/estimacion';
import {
  construirInformeHtml,
  descargarFotosZip,
  descargarHistorialCsv,
  fotosDe,
  imprimirInforme,
  type GrupoFotos,
} from '@/lib/descargas';
import { toast } from '@/lib/utils';

type Accion =
  | { tipo: 'ZIP'; grupo: GrupoFotos }
  | { tipo: 'INFORME'; conValores: boolean; previsualizar: boolean }
  | { tipo: 'HISTORIAL' };

interface Opcion {
  id: string;
  label: string;
  icon: typeof FileArchive;
  accion: Accion;
  separador?: boolean;
}

const OPCIONES: Opcion[] = [
  {
    id: 'zip-todas',
    label: 'Descargar todas las fotos en formato .zip',
    icon: FileArchive,
    accion: { tipo: 'ZIP', grupo: 'TODAS' },
  },
  {
    id: 'zip-danos',
    label: 'Descargar todas las fotos de daños en formato .zip',
    icon: FileArchive,
    accion: { tipo: 'ZIP', grupo: 'DANO' },
  },
  {
    id: 'zip-reparados',
    label: 'Descargar todas las fotos de reparados en formato .zip',
    icon: FileArchive,
    accion: { tipo: 'ZIP', grupo: 'REPARADO' },
  },
  {
    id: 'prev-informe',
    label: 'Previsualizar Informe de Estimado',
    icon: FileText,
    accion: { tipo: 'INFORME', conValores: true, previsualizar: true },
    separador: true,
  },
  {
    id: 'desc-informe',
    label: 'Descargar Informe de Estimado',
    icon: FileDown,
    accion: { tipo: 'INFORME', conValores: true, previsualizar: false },
  },
  {
    id: 'prev-informe-sv',
    label: 'Previsualizar Informe de Estimado sin Valores',
    icon: FileText,
    accion: { tipo: 'INFORME', conValores: false, previsualizar: true },
  },
  {
    id: 'desc-informe-sv',
    label: 'Descargar Informe de Estimado sin Valores',
    icon: FileDown,
    accion: { tipo: 'INFORME', conValores: false, previsualizar: false },
  },
  {
    id: 'historial',
    label: 'Historial de Actividad de Estimación',
    icon: ClipboardList,
    accion: { tipo: 'HISTORIAL' },
    separador: true,
  },
];

interface DescargasMenuProps {
  estimacion: Estimacion;
  onPrevisualizarInforme: (conValores: boolean) => void;
  onVerHistorial: () => void;
}

export function DescargasMenu({
  estimacion,
  onPrevisualizarInforme,
  onVerHistorial,
}: DescargasMenuProps) {
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [abierto]);

  const conteos: Record<GrupoFotos, number> = {
    TODAS: fotosDe(estimacion, 'TODAS').length,
    DANO: fotosDe(estimacion, 'DANO').length,
    REPARADO: fotosDe(estimacion, 'REPARADO').length,
  };

  async function ejecutar(opcion: Opcion) {
    const { accion } = opcion;

    if (accion.tipo === 'ZIP') {
      if (conteos[accion.grupo] === 0) {
        toast('No hay fotos disponibles para este grupo.', 'error');
        setAbierto(false);
        return;
      }
      setOcupado(opcion.id);
      try {
        const n = await descargarFotosZip(estimacion, accion.grupo);
        toast(`Se descargó el .zip con ${n} foto(s).`, 'success');
      } catch {
        toast('No se pudo generar el archivo .zip.', 'error');
      } finally {
        setOcupado(null);
        setAbierto(false);
      }
      return;
    }

    if (accion.tipo === 'INFORME') {
      if (accion.previsualizar) {
        onPrevisualizarInforme(accion.conValores);
      } else {
        imprimirInforme(construirInformeHtml(estimacion, accion.conValores));
        toast('Informe enviado a impresión. Elija "Guardar como PDF".', 'info');
      }
      setAbierto(false);
      return;
    }

    onVerHistorial();
    descargarHistorialCsv(estimacion);
    setAbierto(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="dms-btn-descargas"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="menu"
      >
        <Download className="h-4 w-4" /> Descargas
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {abierto && (
        <div className="dms-descargas-menu" role="menu">
          {OPCIONES.map((op) => {
            const Icon = op.icon;
            const cargando = ocupado === op.id;
            const cantidad =
              op.accion.tipo === 'ZIP' ? conteos[op.accion.grupo] : undefined;
            return (
              <button
                key={op.id}
                type="button"
                role="menuitem"
                className={`dms-descargas-item ${op.separador ? 'dms-descargas-item--sep' : ''}`}
                disabled={cargando}
                onClick={() => void ejecutar(op)}
              >
                {cargando ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-rfsorange-500" />
                ) : (
                  <Icon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                )}
                <span className="flex-1">{op.label}</span>
                {cantidad !== undefined && (
                  <span className="dms-descargas-count">{cantidad}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
