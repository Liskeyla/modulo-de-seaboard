'use client';

import { useMemo, useRef, useState } from 'react';
import {
  Download,
  Eye,
  FileText,
  FileWarning,
  ImagePlus,
  RotateCcw,
  Trash2,
  Upload,
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
import { esFotoEsquema } from '@/lib/fotosDano';
import type {
  ArchivoDano,
  ClaseArchivo,
  DanoEstimacion,
  Estimacion,
  FotoDano,
  GrupoArchivo,
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

function ahoraFmtLocal() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`;
}

function uidLocal(prefijo: string) {
  return `${prefijo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function leerArchivoComoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function claseDesdeFile(file: File): ClaseArchivo {
  const t = file.type.toLowerCase();
  const n = file.name.toLowerCase();
  if (t.startsWith('image/')) return 'IMAGEN';
  if (t.startsWith('video/') || /\.(mp4|webm|mov|avi)$/i.test(n)) return 'VIDEO';
  if (t === 'application/pdf' || n.endsWith('.pdf')) return 'PDF';
  if (t.includes('csv') || t.includes('text') || /\.(csv|txt|log|dat)$/i.test(n)) {
    return 'DATALOG';
  }
  if (/\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(n)) return 'IMAGEN';
  return 'PDF';
}

function etiquetaClase(clase: ClaseArchivo) {
  switch (clase) {
    case 'IMAGEN':
      return 'imagen';
    case 'VIDEO':
      return 'video';
    case 'DATALOG':
      return 'data log';
    case 'PDF':
      return 'PDF';
    default:
      return 'archivo';
  }
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
  const [subiendo, setSubiendo] = useState(false);
  const [eliminar, setEliminar] = useState<ArchivoDano | FotoDano | null>(null);
  const [papelera, setPapelera] = useState<ArchivoDano | null>(null);
  const [previewLog, setPreviewLog] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState<FotoDano | null>(null);
  const [grupoCarga, setGrupoCarga] = useState<GrupoArchivo>('ESTIMACION');
  const [tipoFoto, setTipoFoto] = useState<'DANO' | 'REPARADO'>('DANO');
  const inputRef = useRef<HTMLInputElement>(null);

  const archivos = useMemo(
    () => (dano ? archivosDe(dano, estimacion) : []),
    [dano, estimacion]
  );
  const fotosVisibles = useMemo(
    () => (dano ? dano.fotos.filter((f) => !esFotoEsquema(f.url)) : []),
    [dano]
  );
  const logs = archivos.filter((a) => a.clase === 'DATALOG');
  const porGrupo = {
    ESTIMACION: archivos.filter((a) => a.grupo === 'ESTIMACION'),
    REPARADO: archivos.filter((a) => a.grupo === 'REPARADO'),
  };

  function persistirArchivos(
    lista: ArchivoDano[],
    resumen: string,
    extra: Partial<DanoEstimacion> = {}
  ) {
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
      const n = await descargarFotosListaZip(
        fotosVisibles,
        estimacion.codigo,
        estimacion.contenedor
      );
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

  async function alElegirArchivos(lista: FileList | null) {
    if (!dano || !editable || !lista?.length) return;
    setSubiendo(true);
    try {
      const fecha = ahoraFmtLocal();
      const nuevasFotos: FotoDano[] = [];
      const nuevosArchivos: ArchivoDano[] = [];
      let video = dano.tieneVideo;

      for (const file of Array.from(lista)) {
        const clase = claseDesdeFile(file);
        const url = await leerArchivoComoDataUrl(file);
        if (!url) continue;

        if (clase === 'IMAGEN') {
          nuevasFotos.push({
            id: uidLocal('foto'),
            url,
            tipo: tipoFoto,
            descripcion: file.name,
            fecha,
            importada: true,
          });
          nuevosArchivos.push({
            id: uidLocal('img'),
            url,
            clase: 'IMAGEN',
            grupo: grupoCarga,
            nombre: file.name,
            fecha,
          });
        } else {
          if (clase === 'VIDEO') video = true;
          nuevosArchivos.push({
            id: uidLocal(clase.toLowerCase()),
            url,
            clase,
            grupo: grupoCarga,
            nombre: file.name,
            fecha,
          });
        }
      }

      if (nuevasFotos.length === 0 && nuevosArchivos.length === 0) {
        toast('No se pudo leer ningún archivo.', 'error');
        return;
      }

      const otros = nuevosArchivos.filter((a) => a.clase !== 'IMAGEN');
      const resumenPartes: string[] = [];
      if (nuevasFotos.length) resumenPartes.push(`${nuevasFotos.length} foto(s)`);
      if (otros.length) {
        resumenPartes.push(
          otros.map((a) => `${etiquetaClase(a.clase)}:${a.nombre}`).join(', ')
        );
      }

      onActualizar(
        {
          fotos: [...dano.fotos, ...nuevasFotos],
          archivos: [...archivos.filter((a) => !a.sintetico), ...nuevosArchivos],
          tieneVideo: video,
        },
        `Línea ${dano.linea} · cargado: ${resumenPartes.join(' · ')}`
      );
      toast(
        `Se cargaron ${nuevasFotos.length + otros.length} archivo(s) en la línea ${dano.linea}.`,
        'success'
      );
    } catch {
      toast('Error al cargar archivos. Intente de nuevo.', 'error');
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = '';
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
    const restaurar =
      papelera?.id === archivo.id
        ? papelera
        : reversados.find((a) => a.id === archivo.id);
    if (!restaurar) {
      toast('El archivo está vigente; no hay nada que reversar.', 'info');
      return;
    }
    persistirArchivos(
      [...archivos.filter((a) => !a.sintetico), restaurar],
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
      if (archivo.url && !archivo.sintetico) {
        window.open(archivo.url, '_blank', 'noopener,noreferrer');
        return;
      }
      setPreviewLog(true);
      return;
    }
    if (archivo.url) window.open(archivo.url, '_blank', 'noopener,noreferrer');
  }

  function bajarArchivo(archivo: ArchivoDano) {
    if (archivo.sintetico || (archivo.clase === 'DATALOG' && !archivo.url)) {
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
            Seleccione una línea del <strong>Listado de Daños</strong> para visualizar o cargar
            el anexo fotográfico, videos, data logs o PDF asociados.
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

        {editable && (
          <div className="rounded-lg border border-dashed border-sky-200 bg-sky-50/60 p-3">
            <p className="dms-field-label mb-2">Cargar evidencias</p>
            <div className="mb-2 flex flex-wrap gap-2">
              <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
                Grupo
                <select
                  className="dms-select h-8 text-[11px]"
                  value={grupoCarga}
                  onChange={(e) => setGrupoCarga(e.target.value as GrupoArchivo)}
                >
                  <option value="ESTIMACION">Estimación</option>
                  <option value="REPARADO">Reparado</option>
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
                Tipo foto
                <select
                  className="dms-select h-8 text-[11px]"
                  value={tipoFoto}
                  onChange={(e) => setTipoFoto(e.target.value as 'DANO' | 'REPARADO')}
                >
                  <option value="DANO">Daño / Estimación</option>
                  <option value="REPARADO">Reparado</option>
                </select>
              </label>
            </div>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/*,video/*,.pdf,application/pdf,.csv,.txt,.log,.dat,text/csv,text/plain"
              className="hidden"
              onChange={(e) => void alElegirArchivos(e.target.files)}
            />
            <button
              type="button"
              className="dms-btn-azul inline-flex items-center gap-2 px-3 py-2 text-xs"
              disabled={subiendo}
              onClick={() => inputRef.current?.click()}
            >
              {subiendo ? (
                <>Subiendo…</>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" />
                  Subir fotos, PDF, video o data log
                </>
              )}
            </button>
            <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
              Acepta imágenes, PDF, videos y archivos de data log (.csv, .txt, .log). Quedan
              asociados a la línea seleccionada.
            </p>
          </div>
        )}

        {!editable && (
          <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-[10px] text-amber-800">
            Aperture la estimación para cargar o eliminar evidencias (fotos, PDF, video, data
            log).
          </p>
        )}

        <div>
          <p className="dms-field-label mb-1.5">Anexo Fotográfico</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="dms-zip-btn"
              disabled={bajando === 'fotos' || fotosVisibles.length === 0}
              onClick={() => void bajarFotos()}
            >
              <Download className="h-3.5 w-3.5" />
              {bajando === 'fotos' ? 'Preparando zip…' : 'Descargar todas las imágenes (.zip)'}
            </button>
            {editable && (
              <button
                type="button"
                className="dms-zip-btn"
                onClick={() => {
                  setTipoFoto('DANO');
                  inputRef.current?.click();
                }}
              >
                <ImagePlus className="h-3.5 w-3.5" /> Cargar imágenes
              </button>
            )}
          </div>
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
          <p className="dms-field-label mb-1.5">Archivos Data Log / PDF / Video</p>
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
                        <span className="ml-1 font-normal text-slate-400">
                          ({etiquetaClase(archivo.clase)})
                        </span>
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
            Se eliminará{' '}
            <strong>{'nombre' in eliminar ? eliminar.nombre : eliminar.descripcion}</strong> de
            la línea {String(dano.linea).padStart(2, '0')}. Puede restaurarlo con Reversar.
          </>
        )}
      </ConfirmModal>

      <Modal
        open={previewLog}
        onClose={() => setPreviewLog(false)}
        size="lg"
        icon={<FileText className="h-4 w-4" />}
        title="Data Log"
        subtitle={dano ? `Línea ${dano.linea} · ${estimacion.contenedor}` : undefined}
        footer={
          <button
            type="button"
            className="dms-btn-azul inline-flex items-center gap-2 px-3 py-2 text-sm"
            onClick={() =>
              descargarDataLog(
                estimacion,
                `DataLog_${estimacion.contenedor}_${estimacion.codigo}.csv`
              )
            }
          >
            <Download className="h-4 w-4" /> Descargar CSV
          </button>
        }
      >
        <div className="max-h-[50vh] overflow-auto rounded border border-slate-200 bg-white text-[11px]">
          <pre className="whitespace-pre-wrap p-3 font-mono text-slate-700">
            {filasLog.slice(0, 40).join('\n')}
            {filasLog.length > 40 ? '\n…' : ''}
          </pre>
        </div>
      </Modal>

      <Modal
        open={!!fotoAmpliada}
        onClose={() => setFotoAmpliada(null)}
        size="lg"
        icon={<ImagePlus className="h-4 w-4" />}
        title={fotoAmpliada?.descripcion ?? 'Foto'}
        subtitle={fotoAmpliada?.fecha}
      >
        {fotoAmpliada && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fotoAmpliada.url}
            alt={fotoAmpliada.descripcion}
            className="mx-auto max-h-[70vh] w-auto rounded-lg object-contain"
          />
        )}
      </Modal>
    </section>
  );
}
