'use client';

import { useMemo, useRef, useState } from 'react';
import {
  CloudUpload,
  Download,
  Eye,
  FileText,
  FileWarning,
  RotateCcw,
  Trash2,
  Video,
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
import type {
  ArchivoDano,
  ClaseArchivo,
  DanoEstimacion,
  Estimacion,
  FotoDano,
  GrupoArchivo,
} from '@/types/estimacion';

type TipoArchivoUi = 'NINGUNA' | 'ESTIMACION' | 'REPARADO';

function esDelTipo(file: File, clase: ClaseArchivo) {
  const n = file.name.toLowerCase();
  if (clase === 'IMAGEN') return file.type.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp)$/.test(n);
  if (clase === 'VIDEO') return file.type.startsWith('video/') || /\.(mp4|webm|mov|avi)$/.test(n);
  if (clase === 'PDF') return file.type === 'application/pdf' || n.endsWith('.pdf');
  return /\.(csv|txt|log|v1a)$/.test(n) || file.type.startsWith('text/');
}

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
  const fileRef = useRef<HTMLInputElement>(null);
  const [tipoArchivo, setTipoArchivo] = useState<TipoArchivoUi>('NINGUNA');
  const [pendientes, setPendientes] = useState<File[]>([]);
  const [bajando, setBajando] = useState<'fotos' | 'logs' | null>(null);
  const [eliminar, setEliminar] = useState<ArchivoDano | FotoDano | null>(null);
  const [papelera, setPapelera] = useState<ArchivoDano | null>(null);
  const [previewLog, setPreviewLog] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState<FotoDano | null>(null);

  const archivos = useMemo(
    () => (dano ? archivosDe(dano, estimacion) : []),
    [dano, estimacion]
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

  function grupoDeTipo(): GrupoArchivo {
    return tipoArchivo === 'REPARADO' ? 'REPARADO' : 'ESTIMACION';
  }

  function elegirYSubir(clase: ClaseArchivo) {
    if (!dano) return;
    if (tipoArchivo === 'NINGUNA') {
      toast('Seleccione el tipo de archivo: Estimación o Reparado.', 'error');
      return;
    }
    const lista = pendientes.length ? pendientes : null;
    if (!lista) {
      toast('Elija uno o más archivos primero.', 'error');
      return;
    }
    const validos = lista.filter((f) => esDelTipo(f, clase));
    if (validos.length === 0) {
      toast(`Ningún archivo coincide con ${etiquetaClase(clase)}.`, 'error');
      return;
    }

    const grupo = grupoDeTipo();
    const fecha = new Date().toLocaleString('es-EC');

    if (clase === 'IMAGEN') {
      const nuevas: FotoDano[] = validos.map((file, i) => ({
        id: `up-img-${Date.now()}-${i}`,
        url: URL.createObjectURL(file),
        tipo: grupo === 'REPARADO' ? 'REPARADO' : 'DANO',
        descripcion: file.name,
        fecha,
      }));
      onActualizar(
        { fotos: [...dano.fotos, ...nuevas] },
        `Línea ${dano.linea} · ${nuevas.length} imagen(es) de ${grupo === 'REPARADO' ? 'reparado' : 'estimación'}`
      );
    } else {
      const nuevos: ArchivoDano[] = validos.map((file, i) => ({
        id: `up-${clase}-${Date.now()}-${i}`,
        url: URL.createObjectURL(file),
        clase,
        grupo,
        nombre: file.name,
        fecha,
      }));
      persistirArchivos(
        [...archivos, ...nuevos],
        `Línea ${dano.linea} · ${nuevos.length} ${etiquetaClase(clase).toLowerCase()} cargado(s)`,
        clase === 'VIDEO' ? { tieneVideo: true } : {}
      );
    }

    setPendientes([]);
    if (fileRef.current) fileRef.current.value = '';
    toast(`${validos.length} archivo(s) cargado(s) en ${tipoArchivo === 'REPARADO' ? 'Reparado' : 'Estimación'}.`, 'success');
  }

  async function bajarFotos() {
    if (!dano || dano.fotos.length === 0) {
      toast('Esta línea no tiene imágenes para descargar.', 'error');
      return;
    }
    setBajando('fotos');
    try {
      const n = await descargarFotosListaZip(dano.fotos, estimacion.codigo, estimacion.contenedor);
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
    if (archivos.some((a) => a.id === archivo.id) && !papelera) {
      toast('El archivo está vigente; no hay nada que reversar.', 'info');
      return;
    }
    const restaurar = papelera ?? dataLogDemo(dano, estimacion);
    persistirArchivos(
      [...archivos.filter((a) => a.id !== restaurar.id), restaurar],
      `Línea ${dano.linea} · data log restaurado: ${restaurar.nombre}`,
      {
        archivosReversados: (dano.archivosReversados ?? []).filter((a) => a.id !== restaurar.id),
      }
    );
    setPapelera(null);
    toast(`Se restauró ${restaurar.nombre}.`, 'success');
  }

  function verArchivo(archivo: ArchivoDano) {
    if (archivo.clase === 'DATALOG') {
      if (archivo.sintetico || !archivo.url) {
        setPreviewLog(true);
        return;
      }
      window.open(archivo.url, '_blank', 'noopener');
      return;
    }
    if (archivo.clase === 'VIDEO') {
      onVerVideo(dano!);
      return;
    }
    if (archivo.url) window.open(archivo.url, '_blank', 'noopener');
  }

  function bajarArchivo(archivo: ArchivoDano) {
    if (archivo.sintetico || !archivo.url) {
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
            Seleccione una línea del <strong>Listado de Daños</strong> para ver sus evidencias y
            cargar imágenes, videos, data logs o PDF.
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
          <p className="dms-field-label mb-1.5">Cargar Archivo</p>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Tipo Archivo
          </p>
          <div className="mb-2 flex flex-wrap gap-3 text-[11px] font-semibold text-slate-600">
            {(['NINGUNA', 'ESTIMACION', 'REPARADO'] as const).map((t) => (
              <label key={t} className="inline-flex cursor-pointer items-center gap-1.5">
                <input
                  type="radio"
                  name={`tipo-archivo-${dano.id}`}
                  checked={tipoArchivo === t}
                  onChange={() => setTipoArchivo(t)}
                  disabled={!editable}
                />
                {t === 'NINGUNA' ? 'Ninguna' : t === 'ESTIMACION' ? 'Estimación' : 'Reparado'}
              </label>
            ))}
          </div>
          <input
            ref={fileRef}
            type="file"
            multiple
            disabled={!editable}
            accept="image/*,video/*,.csv,.txt,.log,.v1a,.V1a,.pdf,application/pdf"
            className="dms-file-native"
            onChange={(e) => setPendientes(Array.from(e.target.files ?? []))}
          />
          {pendientes.length > 0 && (
            <p className="mt-1 text-[10px] text-slate-500">
              {pendientes.length} archivo(s) seleccionado(s)
            </p>
          )}
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              className="dms-upload-btn dms-upload-btn--img"
              disabled={!editable}
              onClick={() => elegirYSubir('IMAGEN')}
            >
              <CloudUpload className="h-3.5 w-3.5" /> Subir Imágenes
            </button>
            <button
              type="button"
              className="dms-upload-btn dms-upload-btn--video"
              disabled={!editable}
              onClick={() => elegirYSubir('VIDEO')}
            >
              <Video className="h-3.5 w-3.5" /> Subir Videos
            </button>
            <button
              type="button"
              className="dms-upload-btn dms-upload-btn--log"
              disabled={!editable}
              onClick={() => elegirYSubir('DATALOG')}
            >
              <FileText className="h-3.5 w-3.5" /> Subir Archivos Data Log
            </button>
            <button
              type="button"
              className="dms-upload-btn dms-upload-btn--pdf"
              disabled={!editable}
              onClick={() => elegirYSubir('PDF')}
            >
              <FileText className="h-3.5 w-3.5" /> Subir Archivos PDF
            </button>
          </div>
        </div>

        <div>
          <p className="dms-field-label mb-1.5">Anexo Fotográfico</p>
          <button
            type="button"
            className="dms-zip-btn"
            disabled={bajando === 'fotos' || dano.fotos.length === 0}
            onClick={() => void bajarFotos()}
          >
            <Download className="h-3.5 w-3.5" />
            {bajando === 'fotos' ? 'Preparando zip…' : 'Descargar todas las imágenes (.zip)'}
          </button>
          {dano.fotos.length === 0 ? (
            <p className="mt-2 text-[11px] text-slate-400">Esta línea aún no tiene fotografías.</p>
          ) : (
            <div className="dms-anexo-grid">
              {dano.fotos.map((foto) => (
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
          {dano.fotos.length > 0 && (
            <button
              type="button"
              className="mt-2 text-[11px] font-semibold text-[#31b0d5] hover:underline"
              onClick={() => onVerFotos(dano)}
            >
              Ver galería completa ({dano.fotos.length})
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
                      {archivo.clase === 'VIDEO' ? (
                        <Video className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      ) : archivo.clase === 'PDF' ? (
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                      ) : (
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                      )}
                      <span className="break-all text-[11px] font-semibold text-slate-700">
                        {archivo.nombre}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-col gap-1">
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
