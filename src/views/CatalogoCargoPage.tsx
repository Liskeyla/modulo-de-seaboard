'use client';

import { useMemo, useState } from 'react';
import { BookOpen, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useAuthStore } from '@/store';
import { useCatalogoCargoStore } from '@/store/catalogoCargoStore';
import type {
  CatalogoCargo,
  EfectoEstadoCabecera,
  EfectoVistaLiquidaciones,
} from '@/types/catalogoCargo';
import { cn, toast } from '@/lib/utils';

const CABECERA_OPTS: EfectoEstadoCabecera[] = ['ENVIADO', 'RECHAZADO', 'APROBADO'];
const VISTA_LIQ_OPTS: EfectoVistaLiquidaciones[] = ['RECHAZADO', 'APROBADO'];

export default function CatalogoCargoPage() {
  const { user } = useAuthStore();
  const { cargos, upsert, setCampo, toggleActivo, eliminar, resetSeed } =
    useCatalogoCargoStore();
  const [nuevoCodigo, setNuevoCodigo] = useState('');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [confirmarReset, setConfirmarReset] = useState(false);
  const [eliminarId, setEliminarId] = useState<string | null>(null);

  const actor =
    user?.nombre && user.username && user.nombre !== user.username
      ? `${user.nombre} (${user.username})`
      : user?.username ?? user?.nombre ?? 'liquidaciones';

  const ordenados = useMemo(
    () => [...cargos].sort((a, b) => a.orden - b.orden || a.codigo.localeCompare(b.codigo)),
    [cargos]
  );

  function guardarNuevo() {
    const codigo = nuevoCodigo.trim();
    const nombre = nuevoNombre.trim() || codigo;
    if (codigo.length < 2) {
      toast('Indique un código de cargo (mín. 2 caracteres).', 'info');
      return;
    }
    if (cargos.some((c) => c.codigo.toLowerCase() === codigo.toLowerCase())) {
      toast('Ya existe un cargo con ese código.', 'info');
      return;
    }
    upsert(
      {
        codigo,
        nombre,
        descripcion: '',
        activo: true,
        rechazoNoBloqueaAprobacion: false,
        alRechazarEstadoCabecera: 'ENVIADO',
        alRechazarVistaLiquidaciones: 'RECHAZADO',
        incluirEnReporteriaItems: true,
        orden: cargos.length + 1,
      },
      actor
    );
    setNuevoCodigo('');
    setNuevoNombre('');
    toast(`Cargo «${codigo}» agregado al catálogo.`, 'success');
  }

  function patch(
    row: CatalogoCargo,
    campo: keyof CatalogoCargo,
    valor: CatalogoCargo[keyof CatalogoCargo]
  ) {
    setCampo(row.id, campo, valor, actor);
  }

  return (
    <div className="min-h-screen">
      <Header
        title="Catálogo de cargo"
        subtitle="Liquidaciones · reglas de rechazo / envío a Seaboard por cargo"
      />
      <main className="mx-auto max-w-[1400px] space-y-4 px-3 py-4 sm:px-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-base font-bold text-rfs-navy">
                <BookOpen className="h-4 w-4" /> Catálogo de cargo
              </h1>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600">
                Configure aquí las condiciones por cargo. El envío Seaboard → Liquidaciones usa
                estas reglas (por ejemplo: rechazo solo de cargos «no bloqueantes» deja el
                estimado APROBADO; otros rechazos dejan cabecera ENVIADO y liquidaciones ve
                RECHAZADO).
              </p>
            </div>
            <button
              type="button"
              className="dms-btn-action border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700"
              onClick={() => setConfirmarReset(true)}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Restaurar valores base
            </button>
          </div>

          <div className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-3">
            <div>
              <label className="dms-field-label">Código</label>
              <input
                className="dms-input-sm w-36"
                value={nuevoCodigo}
                placeholder="Ej. Cliente"
                onChange={(e) => setNuevoCodigo(e.target.value)}
              />
            </div>
            <div>
              <label className="dms-field-label">Nombre</label>
              <input
                className="dms-input-sm w-44"
                value={nuevoNombre}
                placeholder="Etiqueta visible"
                onChange={(e) => setNuevoNombre(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="dms-btn-primary px-3 py-1.5 text-xs"
              onClick={guardarNuevo}
            >
              <Plus className="h-3.5 w-3.5" /> Agregar cargo
            </button>
          </div>

          <div className="dms-table-scroll">
            <table className="dms-table dms-table--reporte text-[11px]">
              <thead>
                <tr>
                  <th className="w-10">Ord.</th>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th className="min-w-[12rem]">Descripción / condición</th>
                  <th className="text-center" title="Rechazo de este cargo no impide APROBADO si hay otros ítems aprobados">
                    Rechazo no bloquea APROBADO
                  </th>
                  <th className="text-center">Cabecera al rechazar</th>
                  <th className="text-center">Vista Liquidaciones</th>
                  <th className="text-center">Reportería ítems</th>
                  <th className="text-center">Activo</th>
                  <th>Modificado</th>
                  <th className="w-16">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ordenados.map((row) => (
                  <tr key={row.id} className={cn(!row.activo && 'opacity-55')}>
                    <td className="text-center">
                      <input
                        type="number"
                        className="dms-input-sm w-14 text-center"
                        value={row.orden}
                        onChange={(e) =>
                          patch(row, 'orden', Number(e.target.value) || 0)
                        }
                      />
                    </td>
                    <td className="font-bold text-rfs-navy">{row.codigo}</td>
                    <td>
                      <input
                        className="dms-input-sm w-full min-w-[7rem]"
                        value={row.nombre}
                        onChange={(e) => patch(row, 'nombre', e.target.value)}
                      />
                    </td>
                    <td>
                      <textarea
                        rows={2}
                        className="dms-input-sm h-auto w-full min-w-[14rem] text-[10px]"
                        value={row.descripcion}
                        onChange={(e) => patch(row, 'descripcion', e.target.value)}
                      />
                    </td>
                    <td className="text-center">
                      <input
                        type="checkbox"
                        className="rounded border-slate-400"
                        checked={row.rechazoNoBloqueaAprobacion}
                        title="Si se marca: rechazos solo de este cargo + resto aprobado → estimado APROBADO"
                        onChange={(e) =>
                          patch(row, 'rechazoNoBloqueaAprobacion', e.target.checked)
                        }
                      />
                    </td>
                    <td className="text-center">
                      <select
                        className="dms-select text-[11px]"
                        value={row.alRechazarEstadoCabecera}
                        onChange={(e) =>
                          patch(
                            row,
                            'alRechazarEstadoCabecera',
                            e.target.value as EfectoEstadoCabecera
                          )
                        }
                      >
                        {CABECERA_OPTS.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="text-center">
                      <select
                        className="dms-select text-[11px]"
                        value={row.alRechazarVistaLiquidaciones}
                        onChange={(e) =>
                          patch(
                            row,
                            'alRechazarVistaLiquidaciones',
                            e.target.value as EfectoVistaLiquidaciones
                          )
                        }
                      >
                        {VISTA_LIQ_OPTS.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="text-center">
                      <input
                        type="checkbox"
                        className="rounded border-slate-400"
                        checked={row.incluirEnReporteriaItems}
                        onChange={(e) =>
                          patch(row, 'incluirEnReporteriaItems', e.target.checked)
                        }
                      />
                    </td>
                    <td className="text-center">
                      <button
                        type="button"
                        className={cn(
                          'rounded-md px-2 py-0.5 text-[10px] font-bold',
                          row.activo
                            ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                            : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200'
                        )}
                        onClick={() => {
                          toggleActivo(row.id, actor);
                          toast(
                            row.activo
                              ? `Cargo ${row.codigo} desactivado.`
                              : `Cargo ${row.codigo} activado.`,
                            'success'
                          );
                        }}
                      >
                        {row.activo ? 'Sí' : 'No'}
                      </button>
                    </td>
                    <td className="whitespace-nowrap text-[10px] text-slate-500">
                      {row.fechaModificacion || '—'}
                      {row.usuarioModificacion ? (
                        <span className="mt-0.5 block">{row.usuarioModificacion}</span>
                      ) : null}
                    </td>
                    <td className="text-center">
                      <button
                        type="button"
                        className="dms-icon-action dms-icon-action--info text-red-600"
                        title="Eliminar del catálogo"
                        onClick={() => setEliminarId(row.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-relaxed text-slate-500">
            <Save className="mt-0.5 h-3 w-3 shrink-0" />
            Los cambios se guardan en el navegador (prototipo). Afectan el Enviar de Seaboard
            hacia liquidaciones según las columnas de regla.
          </p>
        </div>
      </main>

      <ConfirmModal
        open={confirmarReset}
        title="Restaurar catálogo base"
        subtitle="Se perderán altas y cambios locales del catálogo de cargo"
        confirmLabel="Restaurar"
        confirmClass="dms-btn-rechazar"
        onClose={() => setConfirmarReset(false)}
        onConfirm={() => {
          resetSeed();
          setConfirmarReset(false);
          toast('Catálogo de cargo restaurado a valores base.', 'success');
        }}
      >
        <p className="text-sm text-slate-600">
          ¿Restablecer Cliente / Línea / Transportista / RFS con las reglas por defecto?
        </p>
      </ConfirmModal>

      <ConfirmModal
        open={Boolean(eliminarId)}
        title="Eliminar cargo"
        subtitle={ordenados.find((c) => c.id === eliminarId)?.codigo}
        confirmLabel="Eliminar"
        confirmClass="dms-btn-rechazar"
        onClose={() => setEliminarId(null)}
        onConfirm={() => {
          if (eliminarId) eliminar(eliminarId);
          setEliminarId(null);
          toast('Cargo eliminado del catálogo.', 'success');
        }}
      >
        <p className="text-sm text-slate-600">
          Los ítems existentes con este código de cargo seguirán mostrándolo; solo deja de
          aplicar la regla del catálogo.
        </p>
      </ConfirmModal>
    </div>
  );
}
