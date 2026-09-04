'use client';

import { useMemo, useState } from 'react';
import { DollarSign, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useAuthStore } from '@/store';
import { useMontoReparacionStore } from '@/store/montoReparacionStore';
import type { MontoReparacion } from '@/types/montoReparacion';
import { toast } from '@/lib/utils';

const VACIO: Omit<MontoReparacion, 'id' | 'fechaModificacion' | 'usuarioModificacion'> = {
  descripcion: '',
  valorMinimo: 0,
  valorMaximo: 0,
  naviera: 'SEABOARD MARINE LINE',
  tipoEstimacion: 'MÁQUINA',
  clasificacion: 'Reefer',
  modeloMaquina: '',
  actividad: 'DM',
  activo: true,
};

export default function MontoReparacionPage() {
  const { user } = useAuthStore();
  const { montos, upsert, eliminar, toggleActivo, resetSeed } = useMontoReparacionStore();
  const [form, setForm] = useState({ ...VACIO });
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmarReset, setConfirmarReset] = useState(false);
  const [eliminarId, setEliminarId] = useState<string | null>(null);

  const actor =
    user?.nombre && user.username && user.nombre !== user.username
      ? `${user.nombre} (${user.username})`
      : user?.username ?? user?.nombre ?? 'liquidaciones';

  const ordenados = useMemo(
    () =>
      [...montos].sort((a, b) =>
        a.descripcion.localeCompare(b.descripcion, 'es', { sensitivity: 'base' })
      ),
    [montos]
  );

  function setCampo<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function cargar(m: MontoReparacion) {
    setEditId(m.id);
    setForm({
      descripcion: m.descripcion,
      valorMinimo: m.valorMinimo,
      valorMaximo: m.valorMaximo,
      naviera: m.naviera,
      tipoEstimacion: m.tipoEstimacion,
      clasificacion: m.clasificacion,
      modeloMaquina: m.modeloMaquina,
      actividad: m.actividad,
      activo: m.activo,
    });
  }

  function limpiar() {
    setEditId(null);
    setForm({ ...VACIO });
  }

  function guardar() {
    if (form.descripcion.trim().length < 3) {
      toast('Indique una descripción (mín. 3 caracteres).', 'info');
      return;
    }
    if (form.valorMaximo < form.valorMinimo) {
      toast('El valor máximo debe ser ≥ al mínimo.', 'info');
      return;
    }
    upsert(
      {
        id: editId || undefined,
        ...form,
        descripcion: form.descripcion.trim(),
      },
      actor
    );
    toast(editId ? 'Regla de monto actualizada.' : 'Regla de monto registrada.', 'success');
    limpiar();
  }

  return (
    <>
      <Header
        title="Lista Monto Reparación"
        subtitle="Catálogo de autoaprobación · Liquidaciones"
      />
      <main className="px-3 py-4 md:px-5 md:py-6">
        <div className="dms-shell space-y-4">
          <section className="dms-card">
            <header className="dms-card-header">
              <DollarSign className="h-3.5 w-3.5" />
              {editId ? 'Editar monto reparación' : 'Registrar Nuevo Monto Reparación'}
            </header>
            <div className="dms-card-body grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="sm:col-span-2">
                <label className="dms-field-label">Descripción</label>
                <input
                  className="dms-input-sm"
                  value={form.descripcion}
                  onChange={(e) => setCampo('descripcion', e.target.value)}
                  placeholder="AUTOAPROBACIÓN SEABOARD…"
                />
              </div>
              <div>
                <label className="dms-field-label">Valor mínimo</label>
                <input
                  type="number"
                  step="0.01"
                  className="dms-input-sm"
                  value={form.valorMinimo}
                  onChange={(e) => setCampo('valorMinimo', Number(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="dms-field-label">Valor máximo</label>
                <input
                  type="number"
                  step="0.01"
                  className="dms-input-sm"
                  value={form.valorMaximo}
                  onChange={(e) => setCampo('valorMaximo', Number(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="dms-field-label">Naviera</label>
                <input
                  className="dms-input-sm"
                  value={form.naviera}
                  onChange={(e) => setCampo('naviera', e.target.value)}
                />
              </div>
              <div>
                <label className="dms-field-label">Tipo estimación</label>
                <select
                  className="dms-select h-9 w-full text-xs"
                  value={form.tipoEstimacion}
                  onChange={(e) => setCampo('tipoEstimacion', e.target.value)}
                >
                  <option value="MÁQUINA">MÁQUINA</option>
                  <option value="BOX">BOX</option>
                  <option value="">(cualquiera)</option>
                </select>
              </div>
              <div>
                <label className="dms-field-label">Clasificación</label>
                <select
                  className="dms-select h-9 w-full text-xs"
                  value={form.clasificacion}
                  onChange={(e) => setCampo('clasificacion', e.target.value)}
                >
                  <option value="Reefer">Reefer</option>
                  <option value="Dry">Dry</option>
                  <option value="">(cualquiera)</option>
                </select>
              </div>
              <div>
                <label className="dms-field-label">Modelo máquina</label>
                <input
                  className="dms-input-sm"
                  value={form.modeloMaquina}
                  onChange={(e) => setCampo('modeloMaquina', e.target.value)}
                  placeholder="DAIKIN / vacío = cualquiera"
                />
              </div>
              <div>
                <label className="dms-field-label">Actividad</label>
                <select
                  className="dms-select h-9 w-full text-xs"
                  value={form.actividad}
                  onChange={(e) => setCampo('actividad', e.target.value)}
                >
                  <option value="DM">DM</option>
                  <option value="SVL">SVL</option>
                  <option value="WTY">WTY</option>
                  <option value="">(cualquiera)</option>
                </select>
              </div>
              <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-4">
                <button type="button" className="dms-btn-primary px-4 py-2 text-sm" onClick={guardar}>
                  <Plus className="h-4 w-4" /> {editId ? 'Guardar cambios' : 'Registrar'}
                </button>
                {editId && (
                  <button
                    type="button"
                    className="dms-btn-action border-gray-300 bg-white px-3 py-2 text-sm"
                    onClick={limpiar}
                  >
                    Cancelar edición
                  </button>
                )}
                <button
                  type="button"
                  className="dms-btn-action border-gray-300 bg-white px-3 py-2 text-sm"
                  onClick={() => setConfirmarReset(true)}
                >
                  <RotateCcw className="h-4 w-4" /> Restaurar catálogo DMS
                </button>
              </div>
            </div>
          </section>

          <section className="dms-card overflow-hidden">
            <header className="dms-card-header">Lista Monto Reparación · {ordenados.length}</header>
            <div className="dms-danos-table-wrap">
              <table className="dms-table text-[11px]">
                <thead>
                  <tr>
                    <th>Descripción</th>
                    <th>Valor Mínimo</th>
                    <th>Valor Máximo</th>
                    <th>Naviera</th>
                    <th>Tipo Estimación</th>
                    <th>Clasificación</th>
                    <th>Modelo Máquina</th>
                    <th>Actividad</th>
                    <th>Activo</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenados.map((m) => (
                    <tr key={m.id} className={!m.activo ? 'opacity-50' : undefined}>
                      <td className="font-semibold text-rfs-navy">{m.descripcion}</td>
                      <td className="text-right tabular-nums">{m.valorMinimo.toFixed(2)}</td>
                      <td className="text-right tabular-nums">{m.valorMaximo.toFixed(2)}</td>
                      <td className="dms-cell-wrap">{m.naviera || '—'}</td>
                      <td className="text-center">{m.tipoEstimacion || '—'}</td>
                      <td className="text-center">{m.clasificacion || '—'}</td>
                      <td className="text-center">{m.modeloMaquina || '—'}</td>
                      <td className="text-center">{m.actividad || '—'}</td>
                      <td className="text-center">
                        <button
                          type="button"
                          className="dms-link-option"
                          onClick={() => toggleActivo(m.id, actor)}
                        >
                          {m.activo ? 'Sí' : 'No'}
                        </button>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="dms-btn-azul px-2 py-1 text-[10px]"
                            onClick={() => cargar(m)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="dms-btn-rechazar px-2 py-1 text-[10px]"
                            onClick={() => setEliminarId(m.id)}
                          >
                            <Trash2 className="h-3 w-3" /> Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>

      <ConfirmModal
        open={confirmarReset}
        title="Restaurar catálogo"
        subtitle="Se reemplazan las reglas por el seed DMS"
        confirmLabel="Restaurar"
        onClose={() => setConfirmarReset(false)}
        onConfirm={() => {
          resetSeed();
          setConfirmarReset(false);
          toast('Catálogo Monto Reparación restaurado.', 'success');
        }}
      >
        <p className="text-sm text-gray-600">
          Se perderán reglas agregadas o editadas en este prototipo.
        </p>
      </ConfirmModal>

      <ConfirmModal
        open={Boolean(eliminarId)}
        title="Eliminar regla"
        confirmLabel="Eliminar"
        confirmClass="dms-btn-rechazar"
        onClose={() => setEliminarId(null)}
        onConfirm={() => {
          if (eliminarId) eliminar(eliminarId);
          setEliminarId(null);
          toast('Regla eliminada.', 'success');
        }}
      >
        <p className="text-sm text-gray-600">¿Eliminar esta regla de autoaprobación?</p>
      </ConfirmModal>
    </>
  );
}
