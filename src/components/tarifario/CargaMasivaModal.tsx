'use client';

import { useRef, useState } from 'react';
import { AlertCircle, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import {
  costoHorasHombre,
  costoTotal,
  formatUsd,
  validarTarifa,
} from '@/lib/tarifario';
import { descargarPlantillaCarga, parseArchivoTarifario } from '@/lib/tarifarioExcel';
import { useTarifarioStore } from '@/store/tarifarioStore';
import { LABELS_TIPO, type TipoTarifa } from '@/types/tarifario';
import { toast } from '@/lib/utils';

interface CargaMasivaModalProps {
  open: boolean;
  tipo: TipoTarifa;
  onClose: () => void;
}

export function CargaMasivaModal({ open, tipo, onClose }: CargaMasivaModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const importar = useTarifarioStore((s) => s.importar);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ReturnType<typeof parseArchivoTarifario>>([]);
  const [busy, setBusy] = useState(false);
  const [resultado, setResultado] = useState<{
    insertados: number;
    actualizados: number;
    errores: string[];
  } | null>(null);

  function reset() {
    setFile(null);
    setPreview([]);
    setResultado(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function leerArchivo(f: File) {
    setFile(f);
    setResultado(null);
    const buf = await f.arrayBuffer();
    const filas = parseArchivoTarifario(buf);
    setPreview(filas);
  }

  async function confirmar() {
    if (!preview.length) return;
    setBusy(true);
    try {
      const res = importar(preview);
      setResultado(res);
      const ok = res.insertados + res.actualizados;
      if (ok > 0) {
        toast(
          `Carga masiva: ${res.insertados} nuevas · ${res.actualizados} actualizadas (con precio).`,
          'success'
        );
      }
      if (res.errores.length === 0) {
        setTimeout(() => {
          reset();
          onClose();
        }, 900);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      size="xl"
      icon={<Upload className="h-4 w-4" />}
      title="Carga masiva de tarifarios"
      subtitle={`DMS Ecuador · ${LABELS_TIPO[tipo]} · incluye precio (material + HH)`}
      bodyClassName="max-h-[70vh] overflow-y-auto"
      footer={
        <>
          <button
            type="button"
            className="dms-btn-action border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cerrar
          </button>
          <button
            type="button"
            className="dms-btn-primary px-4 py-2 text-sm"
            disabled={!preview.length || busy}
            onClick={confirmar}
          >
            {busy ? 'Importando…' : 'Importar tarifas y precios'}
          </button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-xs leading-relaxed text-slate-600">
          Suba un Excel o CSV con las columnas del tarifario IICL Ecuador. Si la fila ya existe
          (componente + naviera + método / part number), se <strong>actualiza el precio</strong>{' '}
          (Horas Hombre y Costo Material). Las filas nuevas se insertan.
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="dms-btn-excel text-xs"
            onClick={() => descargarPlantillaCarga(tipo)}
          >
            <Download className="h-3.5 w-3.5" /> Plantilla {LABELS_TIPO[tipo]}
          </button>
          <button
            type="button"
            className="dms-btn-action border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700"
            onClick={() => descargarPlantillaCarga()}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Plantilla completa (3 tipos)
          </button>
        </div>

        <div
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 hover:border-[#f16e26]"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="mb-2 h-8 w-8 text-rfs-700" />
          <p className="text-sm font-semibold text-slate-700">
            {file ? file.name : 'Seleccione archivo .xlsx o .csv'}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">Clic para elegir · incluye CostoMaterial y HorasHombre</p>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void leerArchivo(f);
            }}
          />
        </div>

        {preview.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-bold uppercase text-rfs-700">
              Vista previa · {preview.length} fila(s)
            </p>
            <div className="dms-table-scroll max-h-56 overflow-auto rounded-md border border-slate-200">
              <table className="dms-table text-[10px]">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Componente</th>
                    <th>Naviera</th>
                    <th>Descripción</th>
                    <th>HH</th>
                    <th>Costo mat.</th>
                    <th>Costo HH</th>
                    <th>Total</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 40).map((f, i) => {
                    const errs = validarTarifa(f);
                    return (
                      <tr key={`${f.componente}-${i}`}>
                        <td>{f.tipo}</td>
                        <td className="font-semibold">{f.componente}</td>
                        <td>{f.naviera}</td>
                        <td className="dms-cell-wrap max-w-[14rem]">{f.descripcion}</td>
                        <td className="text-right">{f.horasHombre}</td>
                        <td className="text-right">{formatUsd(f.costoMaterial)}</td>
                        <td className="text-right">{formatUsd(costoHorasHombre(f))}</td>
                        <td className="text-right font-semibold">{formatUsd(costoTotal(f))}</td>
                        <td>
                          {errs.length ? (
                            <span className="text-red-600">Error</span>
                          ) : (
                            <span className="text-emerald-700">OK</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {preview.length > 40 && (
              <p className="mt-1 text-[11px] text-slate-500">Se muestran las primeras 40 filas.</p>
            )}
          </div>
        )}

        {resultado && (
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
            <p className="font-semibold">
              Insertadas: {resultado.insertados} · Actualizadas: {resultado.actualizados}
            </p>
            {resultado.errores.length > 0 && (
              <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-red-700">
                {resultado.errores.map((err) => (
                  <li key={err} className="flex gap-1">
                    <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                    {err}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
