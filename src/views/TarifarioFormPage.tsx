'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { useTarifarioStore } from '@/store/tarifarioStore';
import {
  costoHorasHombre,
  costoTotal,
  formatUsd,
  tarifaVacia,
  validarTarifa,
} from '@/lib/tarifario';
import { toast } from '@/lib/utils';
import {
  MARCAS_MAQUINA,
  NAVIERAS_EC,
  TARIFA_HORA_HOMBRE_USD,
  TIPOS_CONTENEDOR,
  TITULOS_FORM,
  UNIDADES_MEDIDA,
  type MaterialTarifa,
  type TarifaIiclDraft,
  type TipoTarifa,
} from '@/types/tarifario';

interface TarifarioFormPageProps {
  modo: 'nuevo' | 'editar';
  tipoInicial?: TipoTarifa;
  id?: string;
}

function uidMat() {
  return `mat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

export default function TarifarioFormPage({ modo, tipoInicial = 'BOX', id }: TarifarioFormPageProps) {
  const router = useRouter();
  const getById = useTarifarioStore((s) => s.getById);
  const upsert = useTarifarioStore((s) => s.upsert);
  const existente = id ? getById(id) : undefined;
  const [listo, setListo] = useState(modo === 'nuevo');

  const [form, setForm] = useState<TarifaIiclDraft>(() =>
    existente ? { ...existente, materiales: [...existente.materiales] } : tarifaVacia(tipoInicial)
  );
  const [errores, setErrores] = useState<string[]>([]);

  useEffect(() => {
    function cargar() {
      if (modo === 'editar' && id) {
        const row = useTarifarioStore.getState().getById(id);
        if (row) setForm({ ...row, materiales: [...row.materiales] });
      }
      setListo(true);
    }
    if (useTarifarioStore.persist.hasHydrated()) {
      cargar();
      return;
    }
    return useTarifarioStore.persist.onFinishHydration(cargar);
  }, [modo, id]);

  const tipo = form.tipo;
  const titulos = TITULOS_FORM[tipo];
  const titulo = modo === 'nuevo' ? titulos.nuevo : titulos.editar;

  const costoHh = useMemo(() => costoHorasHombre(form), [form]);
  const total = useMemo(() => costoTotal(form), [form]);

  function set<K extends keyof TarifaIiclDraft>(campo: K, valor: TarifaIiclDraft[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  function guardar() {
    const errs = validarTarifa(form);
    setErrores(errs);
    if (errs.length) {
      toast(errs[0], 'error');
      return;
    }
    const res = upsert({ ...form, id: existente?.id });
    if (!res.ok) {
      toast(res.error ?? 'No se pudo guardar.', 'error');
      return;
    }
    toast(
      modo === 'nuevo'
        ? 'Tarifa registrada en el tarifario IICL Ecuador.'
        : 'Tarifa actualizada (incluye precio).',
      'success'
    );
    router.push('/catalogos/tarifario');
  }

  function addMaterial() {
    setForm((f) => ({
      ...f,
      materiales: [...f.materiales, { id: uidMat(), materialSap: '', cantidad: 1 }],
    }));
  }

  function patchMaterial(mid: string, patch: Partial<MaterialTarifa>) {
    setForm((f) => ({
      ...f,
      materiales: f.materiales.map((m) => (m.id === mid ? { ...m, ...patch } : m)),
    }));
  }

  function removeMaterial(mid: string) {
    setForm((f) => ({ ...f, materiales: f.materiales.filter((m) => m.id !== mid) }));
  }

  if (!listo) {
    return (
      <div className="min-h-screen">
        <Header title="Tarifario IICL" subtitle="Cargando tarifa…" />
      </div>
    );
  }

  if (modo === 'editar' && !existente) {
    return (
      <div className="min-h-screen">
        <Header title="Tarifa no encontrada" subtitle="Tarifario IICL Ecuador" />
        <main className="px-4 py-8">
          <p className="text-sm text-slate-600">La tarifa no existe o fue eliminada.</p>
          <button
            type="button"
            className="dms-btn-action mt-3 border-slate-300 bg-white px-3 py-2 text-xs"
            onClick={() => router.push('/catalogos/tarifario')}
          >
            Volver al tarifario
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title={titulo} subtitle="RFS · DMS Ecuador · Tarifario de Reparaciones IICL" />
      <main className="px-3 py-4 md:px-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.7fr)]">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <h2 className="text-xs font-bold uppercase tracking-wide text-rfs-700">
                Sección Información de la Reparación
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#3a3f4b] px-3 text-[11px] font-bold text-white"
                  onClick={() => router.push('/catalogos/tarifario')}
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Regresar
                </button>
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#5b2c6f] px-3 text-[11px] font-bold text-white"
                  onClick={guardar}
                >
                  <Save className="h-3.5 w-3.5" /> {modo === 'nuevo' ? 'Registrar' : 'Actualizar'}
                </button>
              </div>
            </div>

            {errores.length > 0 && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                <p className="font-semibold">No se puede guardar porque:</p>
                <ul className="mt-1 list-disc pl-4">
                  {errores.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Componente" required>
                <input
                  className="dms-input-sm"
                  value={form.componente}
                  onChange={(e) => set('componente', e.target.value.toUpperCase())}
                />
              </Field>
              <Field label="Descripción de Componente">
                <input
                  className="dms-input-sm"
                  value={form.descripcionComponente}
                  onChange={(e) => set('descripcionComponente', e.target.value)}
                />
              </Field>
              <Field label="Método Reparación" required>
                <input
                  className="dms-input-sm"
                  value={form.metodoReparacion}
                  onChange={(e) => set('metodoReparacion', e.target.value.toUpperCase())}
                />
              </Field>
            </div>

            {tipo === 'MAQUINA' && (
              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                <Field label="Código SAP">
                  <input
                    className="dms-input-sm"
                    value={form.codigoSap}
                    onChange={(e) => set('codigoSap', e.target.value.toUpperCase())}
                  />
                </Field>
                <Field label="Part Number" required>
                  <input
                    className="dms-input-sm"
                    value={form.partNumber}
                    onChange={(e) => set('partNumber', e.target.value)}
                  />
                </Field>
                <Field label="Nombre Ubicación">
                  <input
                    className="dms-input-sm"
                    value={form.nombreUbicacion}
                    onChange={(e) => set('nombreUbicacion', e.target.value)}
                  />
                </Field>
                <Field label="Marca">
                  <select
                    className="dms-select"
                    value={form.marca}
                    onChange={(e) => set('marca', e.target.value)}
                  >
                    {MARCAS_MAQUINA.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </Field>
              </div>
            )}

            {tipo === 'BOX' && (
              <div className="mt-3 grid gap-3 sm:grid-cols-5">
                <Field label="Largo Mínimo">
                  <input
                    type="number"
                    className="dms-input-sm"
                    value={form.largoMinimo}
                    onChange={(e) => set('largoMinimo', Number(e.target.value) || 0)}
                  />
                </Field>
                <Field label="Largo Máximo">
                  <input
                    type="number"
                    className="dms-input-sm"
                    value={form.largoMaximo}
                    onChange={(e) => set('largoMaximo', Number(e.target.value) || 0)}
                  />
                </Field>
                <Field label="Área Mínima">
                  <input
                    type="number"
                    className="dms-input-sm"
                    value={form.areaMinima}
                    onChange={(e) => set('areaMinima', Number(e.target.value) || 0)}
                  />
                </Field>
                <Field label="Área Máxima">
                  <input
                    type="number"
                    className="dms-input-sm"
                    value={form.areaMaxima}
                    onChange={(e) => set('areaMaxima', Number(e.target.value) || 0)}
                  />
                </Field>
                <Field label="Unidad de Medida">
                  <select
                    className="dms-select"
                    value={form.unidad}
                    onChange={(e) => set('unidad', e.target.value)}
                  >
                    {UNIDADES_MEDIDA.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                </Field>
              </div>
            )}

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Naviera" required>
                <select
                  className="dms-select"
                  value={form.naviera}
                  onChange={(e) => set('naviera', e.target.value)}
                >
                  {NAVIERAS_EC.map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </Field>
              {tipo === 'MAQUINA' ? (
                <Field label="Ubicación">
                  <input
                    className="dms-input-sm"
                    value={form.ubicacion}
                    onChange={(e) => set('ubicacion', e.target.value)}
                  />
                </Field>
              ) : (
                <Field label="Descripción HL">
                  <input
                    className="dms-input-sm"
                    value={form.descripcionHl}
                    onChange={(e) => set('descripcionHl', e.target.value)}
                  />
                </Field>
              )}
            </div>

            {tipo !== 'MAQUINA' && (
              <div className="mt-3">
                <span className="dms-field-label">Clasificación de contenedor</span>
                <div className="mt-1 flex gap-3">
                  {TIPOS_CONTENEDOR.map((c) => (
                    <label key={c} className="dms-radio-option">
                      <input
                        type="radio"
                        checked={form.tipoContenedor === c}
                        onChange={() => set('tipoContenedor', c)}
                      />
                      {c === 'DRY' ? 'Dry' : 'Reefer'}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-3">
              <Field label="Descripción" required>
                <input
                  className="dms-input-sm"
                  value={form.descripcion}
                  onChange={(e) => set('descripcion', e.target.value)}
                />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Descripción de Bodeguero">
                <textarea
                  rows={3}
                  className="dms-input-sm h-auto min-h-[4.5rem]"
                  value={form.descripcionBodeguero}
                  onChange={(e) => set('descripcionBodeguero', e.target.value)}
                />
              </Field>
            </div>

            <h3 className="mt-5 border-t border-slate-100 pt-3 text-[11px] font-bold uppercase tracking-wide text-rfs-700">
              Sección Información de Costo
            </h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <Field label="Horas Hombre" required>
                <input
                  type="number"
                  step="0.01"
                  className="dms-input-sm"
                  value={form.horasHombre}
                  onChange={(e) => set('horasHombre', Number(e.target.value) || 0)}
                />
              </Field>
              <Field label="Costo de Materiales" required>
                <input
                  type="number"
                  step="0.0001"
                  className="dms-input-sm"
                  value={form.costoMaterial}
                  onChange={(e) => set('costoMaterial', Number(e.target.value) || 0)}
                />
              </Field>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <label className="flex items-center gap-2 text-[11px] text-slate-700">
                <input
                  type="checkbox"
                  checked={form.omitirMultiplicacionHh}
                  onChange={(e) => set('omitirMultiplicacionHh', e.target.checked)}
                />
                Omitir Multiplicación Horas Hombre
              </label>
              <label className="flex items-center gap-2 text-[11px] text-slate-700">
                <input
                  type="checkbox"
                  checked={form.omitirAsignacionMateriales}
                  onChange={(e) => set('omitirAsignacionMateriales', e.target.checked)}
                />
                Omitir Asignación de Materiales
              </label>
            </div>
            <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
              Costo HH {form.omitirMultiplicacionHh ? '(omitido)' : `(${form.horasHombre} × $${TARIFA_HORA_HOMBRE_USD.toFixed(2)})`}{' '}
              = <strong>{formatUsd(costoHh)}</strong>
              {' · '}
              Costo total = <strong>{formatUsd(total)}</strong>
            </p>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-xs font-bold uppercase tracking-wide text-rfs-700">Materiales</h2>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#12C83F] px-3 text-[11px] font-bold text-white"
                onClick={addMaterial}
              >
                <Plus className="h-3.5 w-3.5" /> Agregar Material
              </button>
            </div>
            <div className="dms-table-scroll overflow-auto">
              <table className="dms-table text-[11px]">
                <thead>
                  <tr>
                    <th>Material SAP</th>
                    <th>Cantidad</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {form.materiales.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-slate-400">
                        Sin materiales asignados
                      </td>
                    </tr>
                  ) : (
                    form.materiales.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <input
                            className="dms-input-sm"
                            value={m.materialSap}
                            onChange={(e) => patchMaterial(m.id, { materialSap: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="dms-input-sm w-20"
                            value={m.cantidad}
                            onChange={(e) =>
                              patchMaterial(m.id, { cantidad: Number(e.target.value) || 0 })
                            }
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="inline-flex h-7 items-center gap-1 rounded bg-[#E53935] px-2 text-[10px] font-bold text-white"
                            onClick={() => removeMaterial(m.id)}
                          >
                            <Trash2 className="h-3 w-3" /> Quitar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="dms-field-label">
        {label}
        {required ? <span className="ml-0.5 text-red-600">*</span> : null}
      </label>
      {children}
    </div>
  );
}
