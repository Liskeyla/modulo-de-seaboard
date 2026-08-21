'use client';

import { useMemo, useState } from 'react';
import {
  Download,
  Eye,
  FileText,
  FileWarning,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Modal } from '@/components/ui/Modal';
import {
  construirDataLogCsv,
  descargarDataLog,
  descargarDataLogsZip,
  descargarDesdeUrl,
  descargarFotosListaZip,
  nombreDataLog,
} from '@/lib/descargas';
import { cn, toast } from '@/lib/utils';
import { fotosRealesDano } from '@/lib/fotosDano';
import type {
  ArchivoDano,
  ClaseArchivo,
  DanoEstimacion,
  Estimacion,
  FotoDano,
} from '@/types/estimacion';

function dataLogDemo(dano: DanoEstimacion, estimacion: Estimacion): ArchivoDano {
  return {
    id: `datalog-demo-${dano.id}`,
    url: '',
    clase: 'DATALOG',
    grupo: 'ESTIMACION',
    nombre: nombreDataLog(estimacion.contenedor, estimacion.fechaElaboracion),
    fecha: estimacion.fechaElaboracion,
    sintetico: true,
  };
}

function archivosDe(dano: DanoEstimacion, estimacion: Estimacion): ArchivoDano[] {
  if (dano.archivos) return dano.archivos;
  return [dataLogDemo(dano, estimacion)];
}

export function InfoDanoPanel({
  estimacion,
  dano,
  editable,
  onActualizar,
  onVerFotos,
  onVerVideo,
}: {
  estimacion: Estimacion;
  dano: DanoEstimacion | null;
  editable: boolean;
  onActualizar: (cambios: Partial<DanoEstimacion>, resumen: string) => void;
  onVerFotos: (dano: DanoEstimacion) => void;
  onVerVideo: (dano: DanoEstimacion) => void;
}) {
  const [bajando, setBajando] = useState<'fotos' | 'logs' | null>(null);
  const [eliminar, setEliminar] = useState<ArchivoDano | FotoDano | null>(null);
  const [papelera, setPapelera] = useState<ArchivoDano | null>(null);
  const [previewLog, setPreviewLog] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState<FotoDano | null>(null);

  const archivos = useMemo(
    () => (dano ? archivosDe(dano, estimacion) : []),
    [dano, estimacion]
  );
  const fotosVisibles = useMemo(
    () => (dano ? fotosRealesDano(dano.fotos) : []),
    [dano]
  );
  const logs = archivos.filter((a) => a.clase === 'DATALOG');
  const porGrupo = {
    ESTIMACION: archivos.filter((a) => a.grupo === 'ESTIMACION'),
    REPARADO: archivos.filter((a) => a.grupo === 'REPARADO'),
  };

  function persistirArchivos(lista: ArchivoDano[], resumen: string, extra: Partial<DanoEstimacion> = {}) {
    if (!dano) return;
    onActualizar({ archivos: lista, ...extra }, resumen);
  }

  async function bajarFotos() {
    if (!dano || fotosVisibles.length === 0) {
      toast('Esta línea no tiene imágenes para descargar.', 'error');
      return;
    }
    setBajando('fotos');
    try {
      const n = await descargarFotosListaZip(fotosVisibles, estimacion.codigo, estimacion.contenedor);
      toast(`${n} imagen(es) empaquetadas en el .zip.`, 'success');
    } catch {
      toast('No se pudo generar el zip de imágenes.', 'error');
    } finally {
      setBajando(null);
    }
  }

  async function bajarLogs() {
    if (logs.length === 0) {
      toast('No hay data logs en esta línea.', 'error');
      return;
    }
    setBajando('logs');
    try {
      const n = await descargarDataLogsZip(estimacion, logs);
      toast(`${n} data log(s) empaquetados en el .zip.`, 'success');
    } catch {
      toast('No se pudo generar el zip de data logs.', 'error');
    } finally {
      setBajando(null);
    }
  }

  function confirmarEliminar() {
    if (!dano || !eliminar) return;
    if ('clase' in eliminar) {
      setPapelera(eliminar);
      persistirArchivos(
        archivos.filter((a) => a.id !== eliminar.id),
        `Línea ${dano.linea} · archivo reversado: ${eliminar.nombre}`,
        { archivosReversados: [...(dano.archivosReversados ?? []), eliminar] }
      );
      toast(`Se reversó ${eliminar.nombre}. Quedó en Archivos reversados.`, 'success');
    } else {
      onActualizar(
        { fotos: dano.fotos.filter((f) => f.id !== eliminar.id) },
        `Línea ${dano.linea} · imagen eliminada`
      );
      toast('Imagen eliminada de la línea.', 'success');
    }
    setEliminar(null);
  }

  function reversar(archivo: ArchivoDano) {
    if (!dano) return;
    const reversados = dano.archivosReversados ?? [];
    const restaurar = papelera?.id === archivo.id ? papelera : reversados.find((a) => a.id === archivo.id);
    if (!restaurar) {
      toast('El archivo está vigente; no hay nada que reversar.', 'info');
      return;
    }
    persistirArchivos(
      [...archivos, restaurar],
      `Línea ${dano.linea} · archivo restaurado: ${restaurar.nombre}`,
      {
        archivosReversados: reversados.filter((a) => a.id !== restaurar.id),
        ...(restaurar.clase === 'VIDEO' ? { tieneVideo: true } : {}),
      }
    );
    setPapelera(null);
    toast(`Se restauró ${restaurar.nombre}.`, 'success');
  }

  function verArchivo(archivo: ArchivoDano) {
    if (!dano) return;
    if (archivo.clase === 'VIDEO') {
      onVerVideo(dano);
      return;
    }
    if (archivo.clase === 'DATALOG') {
      setPreviewLog(true);
      return;
    }
    if (archivo.url) window.open(archivo.url, '_blank', 'noopener,noreferrer');
  }

  function bajarArchivo(archivo: ArchivoDano) {
    if (archivo.sintetico || archivo.clase === 'DATALOG') {
      descargarDataLog(estimacion, `${archivo.nombre}.csv`);
      return;
    }
    descargarDesdeUrl(archivo.url, archivo.nombre);
  }

  if (!dano) {
    return (
      <section id="info-dano-panel" className="dms-card">
        <header className="dms-card-header">
          <FileWarning className="h-3.5 w-3.5" /> Información del Daño
        </header>
        <div className="dms-card-body">
          <p className="text-[11px] leading-relaxed text-gray-400">
            Seleccione una línea del <strong>Listado de Daños</strong> para visualizar el anexo
            fotográfico, videos, data logs o PDF asociados.
          </p>
        </div>
      </section>
    );
  }

  const csvLog = construirDataLogCsv(estimacion);
  const lineasLog = csvLog.split('\r\n');
  const headerLog = lineasLog.findIndex((l) => l.startsWith('Fecha;'));
  const filasLog = headerLog >= 0 ? lineasLog.slice(headerLog) : [];

  return (
    <section id="info-dano-panel" className="dms-card">
      <header className="dms-card-header">
        <FileWarning className="h-3.5 w-3.5" /> Información del Daño
      </header>
      <div className="dms-card-body space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="dms-mini-badge">Línea {String(dano.linea).padStart(2, '0')}</span>
          <span className="text-xs font-bold text-rfs-navy">{dano.comp}</span>
          <span className="truncate text-[11px] text-slate-500">{dano.dano}</span>
        </div>

        <div>
          <p className="dms-field-label mb-1.5">Anexo Fotográfico</p>
          <button
            type="button"
            className="dms-zip-btn"
            disabled={bajando === 'fotos' || fotosVisibles.length === 0}
            onClick={() => void bajarFotos()}
          >
            <Download className="h-3.5 w-3.5" />
            {bajando === 'fotos' ? 'Preparando zip…' : 'Descargar todas las imágenes (.zip)'}
          </button>
          {fotosVisibles.length === 0 ? (
            <p className="mt-2 text-[11px] text-slate-400">Esta línea aún no tiene fotografías.</p>
          ) : (
            <div className="dms-anexo-grid">
              {fotosVisibles.map((foto) => (
                <button
                  key={foto.id}
                  type="button"
                  className="dms-anexo-thumb group"
                  title={foto.descripcion}
                  onClick={() => setFotoAmpliada(foto)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={foto.url} alt={foto.descripcion} />
                  <span
                    className={cn(
                      'dms-foto-tag',
                      foto.tipo === 'DANO' ? 'dms-foto-tag--dano' : 'dms-foto-tag--reparado'
                    )}
                  >
                    {foto.tipo === 'DANO' ? 'Estimación' : 'Reparado'}
                  </span>
                </button>
              ))}
            </div>
          )}
          {fotosVisibles.length > 0 && (
            <button
              type="button"
              className="mt-2 text-[11px] font-semibold text-[#31b0d5] hover:underline"
              onClick={() => onVerFotos(dano)}
            >
              Ver galería completa ({fotosVisibles.length})
            </button>
          )}
        </div>

        <div>
          <p className="dms-field-label mb-1.5">Archivos Data Log</p>
          <button
            type="button"
            className="dms-zip-btn"
            disabled={bajando === 'logs' || logs.length === 0}
            onClick={() => void bajarLogs()}
          >
            <Download className="h-3.5 w-3.5" />
            {bajando === 'logs' ? 'Preparando zip…' : 'Descargar todos los Data Logs (.zip)'}
          </button>
        </div>

        {(['ESTIMACION', 'REPARADO'] as const).map((grupo) =>
          porGrupo[grupo].length === 0 ? null : (
            <div key={grupo} className="dms-archivo-grupo">
              <p>{grupo === 'ESTIMACION' ? 'Estimación' : 'Reparado'}</p>
              <ul className="space-y-2">
                {porGrupo[grupo].map((archivo) => (
                  <li key={archivo.id}>
                    <div className="flex items-start gap-2">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#152483]" />
                      <span className="break-all text-[11px] font-semibold text-slate-800">
                        {archivo.nombre}
                      </span>
                    </div>
                    <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      <button
                        type="button"
                        className="dms-archivo-accion dms-archivo-accion--ver"
                        onClick={() => verArchivo(archivo)}
                      >
                        <Eye className="h-3 w-3" /> Ver {etiquetaClase(archivo.clase)}
                      </button>
                      <button
                        type="button"
                        className="dms-archivo-accion dms-archivo-accion--bajar"
                        onClick={() => bajarArchivo(archivo)}
                      >
                        <Download className="h-3 w-3" /> Descargar {etiquetaClase(archivo.clase)}
                      </button>
                      <button
                        type="button"
                        className="dms-archivo-accion dms-archivo-accion--borrar"
                        disabled={!editable}
                        onClick={() => setEliminar(archivo)}
                      >
                        <Trash2 className="h-3 w-3" /> Eliminar {etiquetaClase(archivo.clase)}
                      </button>
                      <button
                        type="button"
                        className="dms-archivo-accion dms-archivo-accion--reversar"
                        disabled={!editable}
                        onClick={() => reversar(archivo)}
                      >
                        <RotateCcw className="h-3 w-3" /> Reversar {etiquetaClase(archivo.clase)}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )
        )}
      </div>

      <ConfirmModal
        open={!!eliminar}
        title="Eliminar archivo"
        subtitle="La evidencia se retira de esta línea de daño"
        confirmLabel="Eliminar"
        onClose={() => setEliminar(null)}
        onConfirm={confirmarEliminar}
      >
        {eliminar && (
          <>
            Se eliminará <strong>{'nombre' in eliminar ? eliminar.nombre : eliminar.descripcion}</strong> de
            la línea {String(dano.linea).padStart(2, '0')}. Puede restaurarlo con Reversar.
          </>
        )}
      </ConfirmModal>

      <Modal
        open={previewLog}
        onClose={() => setPreviewLog(false)}
        size="lg"
        icon={<FileText className="h-4 w-4" />}
        title={`Data Log · ${nombreDataLog(estimacion.contenedor, estimacion.fechaElaboracion)}`}
        subtitle={`${estimacion.contenedor} · ${estimacion.modeloMaquina}`}
        footer={
          <>
            <button
              type="button"
              className="dms-btn-action border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
              onClick={() => setPreviewLog(false)}
            >
              Cerrar
            </button>
            <button
              type="button"
              className="dms-btn-azul px-4 py-2 text-sm"
              onClick={() =>
                descargarDataLog(
                  estimacion,
                  `${nombreDataLog(estimacion.contenedor, estimacion.fechaElaboracion)}.csv`
                )
              }
            >
              <Download className="h-4 w-4" /> Descargar CSV
            </button>
          </>
        }
      >
        <div className="max-h-[55vh] overflow-auto rounded-lg border border-slate-200">
          <table className="dms-table text-[10px]">
            <thead>
              <tr>
                {filasLog[0]?.split(';').map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filasLog.slice(1, 25).map((fila, i) => (
                <tr key={i}>
                  {fila.split(';').map((c, j) => (
                    <td key={j} className={c === 'ALARMA' ? 'font-bold text-red-600' : ''}>
                      {c || '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-3 py-2 text-[10px] text-slate-400">Mostrando las primeras 24 lecturas de 96.</p>
        </div>
      </Modal>

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
              <span className="font-semibold">
                {fotoAmpliada.tipo === 'DANO' ? 'Estimación' : 'Reparado'}
              </span>{' '}
              · {fotoAmpliada.descripcion} · {fotoAmpliada.fecha}
            </figcaption>
          </figure>
        </div>
      )}
    </section>
  );
}

function etiquetaClase(clase: ClaseArchivo) {
  if (clase === 'IMAGEN') return 'Imagen';
  if (clase === 'VIDEO') return 'Video';
  if (clase === 'PDF') return 'PDF';
  return 'Data Log';
}
