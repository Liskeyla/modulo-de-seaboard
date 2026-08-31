'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { ACTIVIDADES, type Actividad } from '@/types/estimacion';

export type DatosNuevoEstimado = {
  contenedor: string;
  naviera: string;
  modeloMaquina: string;
  codigoRfs: string;
  tipoEstimacion: string;
  lugarEstimacion: string;
  tecnico: string;
  actividad: Actividad;
  buque: string;
  viaje: string;
  tipoContenedor: string;
};

const VACIO: DatosNuevoEstimado = {
  contenedor: '',
  naviera: 'SEABOARD MARINE',
  modeloMaquina: '',
  codigoRfs: '',
  tipoEstimacion: 'Máquina',
  lugarEstimacion: '',
  tecnico: '',
  actividad: 'DM',
  buque: '',
  viaje: '',
  tipoContenedor: '',
};

interface NuevoEstimadoModalProps {
  open: boolean;
  tipoInicial?: 'Máquina' | 'Box';
  navierasSugeridas?: string[];
  patiosSugeridos?: string[];
  onClose: () => void;
  onCrear: (datos: DatosNuevoEstimado) => void;
}

/** Formulario corto para que el Coordinador cree un estimado PENDIENTE. */
export function NuevoEstimadoModal({
  open,
  tipoInicial = 'Máquina',
  navierasSugeridas = [],
  patiosSugeridos = [],
  onClose,
  onCrear,
}: NuevoEstimadoModalProps) {
  const [form, setForm] = useState<DatosNuevoEstimado>(VACIO);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm({
      ...VACIO,
      tipoEstimacion: tipoInicial,
      naviera: navierasSugeridas[0] || 'SEABOARD MARINE',
      lugarEstimacion: patiosSugeridos[0] || '',
    });
    setError(null);
  }, [open, tipoInicial, navierasSugeridas, patiosSugeridos]);

  function setCampo<K extends keyof DatosNuevoEstimado>(k: K, v: DatosNuevoEstimado[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.contenedor.trim()) {
      setError('Indique el contenedor.');
      return;
    }
    if (!form.naviera.trim()) {
      setError('Indique la naviera.');
      return;
    }
    onCrear({
      ...form,
      contenedor: form.contenedor.trim().toUpperCase(),
      naviera: form.naviera.trim(),
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuevo estimado"
      subtitle={`Tipo ${tipoInicial} · queda PENDIENTE para Liquidaciones`}
      size="lg"
    >
      <form onSubmit={enviar} className="space-y-3">
        <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
          El Coordinador crea y completa daños. <strong>Liquidaciones</strong> revisa el
          historial y envía la información a la línea naviera (SBM).
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-slate-600">
            Contenedor *
            <input
              className="dms-input-sm mt-1 w-full"
              value={form.contenedor}
              onChange={(e) => setCampo('contenedor', e.target.value.toUpperCase())}
              placeholder="XXXX1234567"
              autoFocus
            />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Naviera *
            {navierasSugeridas.length > 0 ? (
              <select
                className="dms-input-sm mt-1 w-full"
                value={form.naviera}
                onChange={(e) => setCampo('naviera', e.target.value)}
              >
                {navierasSugeridas.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="dms-input-sm mt-1 w-full"
                value={form.naviera}
                onChange={(e) => setCampo('naviera', e.target.value)}
              />
            )}
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Tipo estimación
            <select
              className="dms-input-sm mt-1 w-full"
              value={form.tipoEstimacion}
              onChange={(e) => setCampo('tipoEstimacion', e.target.value)}
            >
              <option value="Máquina">Máquina</option>
              <option value="Box">Box</option>
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Actividad
            <select
              className="dms-input-sm mt-1 w-full"
              value={form.actividad}
              onChange={(e) => setCampo('actividad', e.target.value as Actividad)}
            >
              {ACTIVIDADES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Modelo máquina
            <input
              className="dms-input-sm mt-1 w-full"
              value={form.modeloMaquina}
              onChange={(e) => setCampo('modeloMaquina', e.target.value)}
            />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Código RFS
            <input
              className="dms-input-sm mt-1 w-full"
              value={form.codigoRfs}
              onChange={(e) => setCampo('codigoRfs', e.target.value)}
            />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Lugar de estimación
            {patiosSugeridos.length > 0 ? (
              <select
                className="dms-input-sm mt-1 w-full"
                value={form.lugarEstimacion}
                onChange={(e) => setCampo('lugarEstimacion', e.target.value)}
              >
                <option value="">—</option>
                {patiosSugeridos.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="dms-input-sm mt-1 w-full"
                value={form.lugarEstimacion}
                onChange={(e) => setCampo('lugarEstimacion', e.target.value)}
              />
            )}
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Técnico
            <input
              className="dms-input-sm mt-1 w-full"
              value={form.tecnico}
              onChange={(e) => setCampo('tecnico', e.target.value)}
            />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Buque
            <input
              className="dms-input-sm mt-1 w-full"
              value={form.buque}
              onChange={(e) => setCampo('buque', e.target.value)}
            />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Viaje
            <input
              className="dms-input-sm mt-1 w-full"
              value={form.viaje}
              onChange={(e) => setCampo('viaje', e.target.value)}
            />
          </label>
        </div>

        {error && (
          <p className="text-xs font-semibold text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            className="dms-btn-action border-gray-300 bg-white px-3 py-2 text-xs text-gray-700"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button type="submit" className="dms-btn-primary px-3 py-2 text-xs">
            Crear estimado
          </button>
        </div>
      </form>
    </Modal>
  );
}
