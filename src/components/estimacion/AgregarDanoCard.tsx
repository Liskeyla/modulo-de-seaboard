'use client';

import { useMemo, useRef, useState } from 'react';
import { ChevronDown, Plus, Search, Upload, X } from 'lucide-react';
import {
  APLICA_DANO,
  CARGOS_DANO,
  type AplicaDano,
  type CargoDano,
  type DanoEstimacion,
  type FotoDano,
} from '@/types/estimacion';
import { TARIFAS, type Tarifa } from '@/data/tarifas';
import { cn, formatMoney, toast } from '@/lib/utils';

const round2 = (n: number) => Math.round(n * 100) / 100;

interface AgregarDanoCardProps {
  editable: boolean;
  seccionSugerida: 'MAQUINA' | 'ESTRUCTURAL';
  onAgregar: (dano: Omit<DanoEstimacion, 'id' | 'linea'>) => void;
}

export function AgregarDanoCard({ editable, seccionSugerida, onAgregar }: AgregarDanoCardProps) {
  const [busqueda, setBusqueda] = useState('');
  const [listaAbierta, setListaAbierta] = useState(false);
  const [tarifa, setTarifa] = useState<Tarifa | null>(null);
  const [danio, setDanio] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [cargo, setCargo] = useState<CargoDano>('Línea');
  const [aplica, setAplica] = useState<AplicaDano>('Pendiente Revisión');
  const [archivos, setArchivos] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const coincidencias = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const base = [...TARIFAS].sort((a, b) => {
      if (a.seccion === b.seccion) return a.codigo.localeCompare(b.codigo);
      return a.seccion === seccionSugerida ? -1 : 1;
    });
    if (!q) return base.slice(0, 8);
    return base
      .filter(
        (t) =>
          t.codigo.toLowerCase().includes(q) ||
          t.comp.toLowerCase().includes(q) ||
          t.descripcion.toLowerCase().includes(q) ||
          t.dano.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [busqueda, seccionSugerida]);

  const cant = Math.max(1, round2(Number(cantidad) || 1));
  const csHH = tarifa ? round2(tarifa.costoHoraHombre * cant) : 0;
  const csMat = tarifa ? round2(tarifa.costoMaterial * cant) : 0;

  function limpiar() {
    setTarifa(null);
    setBusqueda('');
    setDanio('');
    setCantidad('1');
    setCargo('Línea');
    setAplica('Pendiente Revisión');
    setArchivos([]);
    if (fileRef.current) fileRef.current.value = '';
  }

  function agregar() {
    if (!tarifa) {
      toast('Seleccione una tarifa del catálogo para continuar.', 'error');
      return;
    }
    const fotos: FotoDano[] = archivos.map((file, i) => ({
      id: `up-${Date.now()}-${i}`,
      // En el prototipo la evidencia cargada vive en memoria durante la sesión.
      url: URL.createObjectURL(file),
      tipo: 'DANO',
      descripcion: file.name,
      fecha: new Date().toLocaleString('es-EC'),
    }));

    onAgregar({
      comp: tarifa.comp,
      partNumber: tarifa.metRep,
      ubicacion: tarifa.ubicacion,
      dano: tarifa.dano,
      obsAnalisis: danio.trim() || tarifa.descripcion,
      metRep: '',
      newMetRep: tarifa.metRep,
      serieAnterior: 'N/A',
      serieEntregado: '',
      largo: 0,
      ancho: 0,
      area: 0,
      longitud: 0,
      cantidad: cant,
      horasHombre: round2(tarifa.horasHombre * cant),
      csHoraHombre: csHH,
      csMaterial: csMat,
      csTotal: round2(csHH + csMat),
      cargo,
      aplica,
      medida: tarifa.medida,
      remark: '',
      contenedorDonante: '',
      tieneVideo: false,
      seccion: tarifa.seccion,
      fotos,
      archivos: [],
      comentarios: [],
    });
    limpiar();
  }

  return (
    <section className="dms-card">
      <header className="dms-card-header">
        <Plus className="h-3.5 w-3.5" /> Agregar Daño
      </header>
      <div className="dms-card-body">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="relative xl:col-span-2">
            <label className="dms-field-label">Tarifa</label>
            <div className="relative">
              <input
                className="dms-input-sm pr-8"
                value={tarifa ? `${tarifa.codigo} · ${tarifa.comp}` : busqueda}
                placeholder="Buscar tarifa…"
                disabled={!editable}
                onChange={(e) => {
                  setTarifa(null);
                  setBusqueda(e.target.value);
                  setListaAbierta(true);
                }}
                onFocus={() => setListaAbierta(true)}
                onBlur={() => window.setTimeout(() => setListaAbierta(false), 150)}
              />
              {tarifa ? (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"
                  onClick={() => {
                    setTarifa(null);
                    setBusqueda('');
                  }}
                  aria-label="Quitar tarifa"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <Search className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              )}
            </div>

            {listaAbierta && editable && !tarifa && (
              <ul className="dms-autocomplete">
                {coincidencias.length === 0 && (
                  <li className="px-3 py-2 text-[11px] text-gray-400">Sin coincidencias</li>
                )}
                {coincidencias.map((t) => (
                  <li key={t.codigo}>
                    <button
                      type="button"
                      className="dms-autocomplete-item"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setTarifa(t);
                        setBusqueda('');
                        setListaAbierta(false);
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-bold text-rfs-700">{t.codigo}</span>
                        <span className="dms-mini-badge">{t.seccion === 'MAQUINA' ? 'MQ' : 'BOX'}</span>
                        <span className="ml-auto tabular-nums text-gray-500">
                          ${formatMoney(t.costoHoraHombre + t.costoMaterial)}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] text-gray-500">
                        {t.comp} · {t.descripcion}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className="dms-field-label">Danio</label>
            <input
              className="dms-input-sm"
              value={danio}
              placeholder={tarifa?.dano ?? 'Observación'}
              disabled={!editable}
              onChange={(e) => setDanio(e.target.value)}
            />
          </div>

          <div>
            <label className="dms-field-label">Cantidad</label>
            <input
              className="dms-input-sm text-right"
              type="number"
              min="1"
              step="0.01"
              value={cantidad}
              disabled={!editable}
              onChange={(e) => setCantidad(e.target.value)}
            />
          </div>

          <div>
            <label className="dms-field-label">Imágenes</label>
            <button
              type="button"
              className="dms-file-btn"
              disabled={!editable}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              <span className="truncate">
                {archivos.length === 0
                  ? 'Elegir archivos'
                  : `${archivos.length} archivo(s)`}
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => setArchivos(Array.from(e.target.files ?? []))}
            />
          </div>

          <div>
            <label className="dms-field-label">Cargo</label>
            <select
              className="dms-select"
              value={cargo}
              disabled={!editable}
              onChange={(e) => setCargo(e.target.value as CargoDano)}
            >
              {CARGOS_DANO.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="dms-field-label">Aplica</label>
            <select
              className="dms-select"
              value={aplica}
              disabled={!editable}
              onChange={(e) => setAplica(e.target.value as AplicaDano)}
            >
              {APLICA_DANO.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>

        {tarifa && (
          <div className="dms-tarifa-preview">
            <span>
              <strong>{tarifa.comp}</strong> · {tarifa.descripcion}
            </span>
            <span className="flex flex-wrap items-center gap-x-4 gap-y-1 tabular-nums">
              <span>
                H.H. <strong>{round2(tarifa.horasHombre * cant).toFixed(2)}</strong>
              </span>
              <span>
                Cs. H.H. <strong>${formatMoney(csHH)}</strong>
              </span>
              <span>
                Cs. Mat. <strong>${formatMoney(csMat)}</strong>
              </span>
              <span className="text-rfs-700">
                Total <strong>${formatMoney(csHH + csMat)}</strong>
              </span>
            </span>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            className={cn('dms-btn-primary px-4 py-2 text-sm', !editable && 'opacity-50')}
            disabled={!editable}
            onClick={agregar}
          >
            <Plus className="h-4 w-4" /> Agregar
          </button>
          {!editable && (
            <p className="text-[11px] text-gray-400">
              El estimado no admite cambios en su estado actual.
            </p>
          )}
          {archivos.length > 0 && (
            <p className="text-[11px] text-gray-400">
              La evidencia cargada se conserva durante la sesión.
            </p>
          )}
          <ChevronDown className="ml-auto hidden h-4 w-4 text-gray-300 md:block" />
        </div>
      </div>
    </section>
  );
}
