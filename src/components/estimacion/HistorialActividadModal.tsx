'use client';

import { useEffect, useMemo, useState, Fragment } from 'react';
import { ChevronDown, History } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import {
  aLineaHistorial,
  type CampoSnapshotLinea,
  type DanoEstimacion,
  type Estimacion,
  type HistorialAccionItem,
  type LineaHistorialDano,
} from '@/types/estimacion';
import { historialItemOrdenado, timestampHistorial } from '@/lib/historialItem';
import { paresAntesDespues } from '@/lib/cambioAntesDespues';
import { cn, formatMoney } from '@/lib/utils';

function BloqueAntesDespuesHistorial({ ev }: { ev: HistorialAccionItem }) {
  if (!ev.snapshotAnterior || !ev.snapshot || !ev.camposCambiados?.length) return null;
  const pares = paresAntesDespues(ev.snapshotAnterior, ev.snapshot, ev.camposCambiados);
  if (pares.length === 0) return null;
  return (
    <div className="mb-2 flex flex-wrap gap-1.5 rounded-md border border-amber-200 bg-amber-50/80 px-2 py-1.5">
      <span className="w-full text-[10px] font-bold uppercase tracking-wide text-amber-900">
        Antes → Después
      </span>
      {pares.map((p) => (
        <span key={p.campo} className="dms-antes-despues-chip" title={p.texto}>
          <strong>{p.etiqueta}</strong>
          <span className="dms-cmp-antes">{p.antes}</span>
          <span className="dms-cmp-flecha" aria-hidden>
            →
          </span>
          <span className="dms-cmp-despues">{p.despues}</span>
        </span>
      ))}
    </div>
  );
}

interface FilaDano {
  id: string;
  dano: DanoEstimacion;
  linea: LineaHistorialDano;
  eventos: HistorialAccionItem[];
  ultimo: HistorialAccionItem;
}

function DetalleLinea({
  linea,
  camposCambiados,
}: {
  linea: LineaHistorialDano;
  camposCambiados?: CampoSnapshotLinea[];
}) {
  const mod = (campo: CampoSnapshotLinea) =>
    camposCambiados?.includes(campo) ? 'dms-celda-modificada' : undefined;

  return (
    <div className="overflow-x-auto rounded border border-slate-200 bg-white">
      <table className="dms-table dms-table--danos min-w-[720px] text-[10px]">
        <thead>
          <tr>
            <th>#</th>
            <th>Comp</th>
            <th>P/N</th>
            <th>Ubic.</th>
            <th>Daño</th>
            <th>Mét. Rep.</th>
            <th>Cant.</th>
            <th>HH</th>
            <th>CS HH</th>
            <th>CS Mat.</th>
            <th>Total</th>
            <th>Cargo</th>
            <th>Estado</th>
            <th>Remark</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="text-center font-semibold">
              {String(linea.linea).padStart(2, '0')}
            </td>
            <td className={cn('whitespace-nowrap font-semibold text-rfs-navy', mod('comp'))}>
              {linea.comp}
            </td>
            <td className={cn('text-center', mod('partNumber'))}>{linea.partNumber || '—'}</td>
            <td className={cn('text-center', mod('ubicacion'))}>{linea.ubicacion || '—'}</td>
            <td className={cn('dms-cell-wrap font-semibold', mod('dano'))}>{linea.dano}</td>
            <td className={cn('text-center', mod('newMetRep'))}>{linea.newMetRep || '—'}</td>
            <td className={cn('text-right tabular-nums', mod('cantidad'))}>
              {linea.cantidad.toFixed(2)}
            </td>
            <td className={cn('text-right tabular-nums', mod('horasHombre'))}>
              {linea.horasHombre.toFixed(2)}
            </td>
            <td className={cn('text-right tabular-nums', mod('csHoraHombre'))}>
              ${formatMoney(linea.csHoraHombre)}
            </td>
            <td className={cn('text-right tabular-nums', mod('csMaterial'))}>
              ${formatMoney(linea.csMaterial)}
            </td>
            <td className={cn('text-right font-semibold tabular-nums', mod('csTotal'))}>
              ${formatMoney(linea.csTotal)}
            </td>
            <td className={cn('text-center whitespace-nowrap', mod('cargo'))}>{linea.cargo}</td>
            <td className={cn('text-center whitespace-nowrap', mod('aplica'))}>{linea.aplica}</td>
            <td className={cn('dms-cell-wrap max-w-[12rem]', mod('remark'))}>
              {linea.remark || '—'}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function filaHistorialDe(dano: DanoEstimacion, estimacion: Estimacion): FilaDano {
  const eventos = historialItemOrdenado(dano);
  const ultimo =
    eventos[0] ??
    ({
      id: `ha-default-${dano.id}`,
      fecha: estimacion.fechaModificacion || estimacion.fechaElaboracion || 's/f',
      usuario: estimacion.usuarioModificacion || 'sistema',
      tipo: 'CREACION',
      accion: 'Registro de daño',
      cambio: `Línea ${dano.linea} · ${dano.comp} · ${dano.dano}`,
      estadoNuevo: dano.aplica,
    } satisfies HistorialAccionItem);

  return {
    id: dano.id,
    dano,
    linea: aLineaHistorial(dano),
    eventos,
    ultimo,
  };
}

/**
 * Historial por ítem de daño: usuario, fecha/hora, cambio, estado anterior/nuevo y comentario.
 */
export function HistorialActividadModal({
  open,
  estimacion,
  onClose,
}: {
  open: boolean;
  estimacion: Estimacion | null;
  onClose: () => void;
}) {
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());

  const filas = useMemo<FilaDano[]>(() => {
    if (!estimacion) return [];
    return estimacion.danos
      .map((dano) => filaHistorialDe(dano, estimacion))
      .sort((a, b) => timestampHistorial(b.ultimo.fecha) - timestampHistorial(a.ultimo.fecha));
  }, [estimacion]);

  useEffect(() => {
    if (!open) {
      setAbiertos(new Set());
      return;
    }
    if (filas[0]) setAbiertos(new Set([filas[0].id]));
  }, [open, filas]);

  if (!estimacion) return null;

  function alternar(id: string) {
    setAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        setAbiertos(new Set());
        onClose();
      }}
      size="xl"
      icon={<History className="h-4 w-4" />}
      title="Historial de Actividad de Estimación"
      subtitle={`${estimacion.codigo} · ${estimacion.contenedor} · ${filas.length} ítem(s) de daño`}
      bodyClassName="!p-0"
      footer={
        <button
          type="button"
          className="dms-btn-primary px-4 py-2 text-sm"
          onClick={() => {
            setAbiertos(new Set());
            onClose();
          }}
        >
          Cerrar
        </button>
      }
    >
      <div className="max-h-[min(70vh,560px)] overflow-auto bg-slate-50/80 p-3">
        <p className="mb-2 text-[11px] text-slate-500">
          Histórico completo por ítem: <strong>usuario</strong>, <strong>fecha y hora</strong>,{' '}
          <strong>cambio realizado</strong>, <strong>estado anterior/nuevo</strong> y{' '}
          <strong>comentario</strong>. Expanda una fila para ver todas las acciones registradas.
        </p>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-left text-xs text-slate-800">
            <thead>
              <tr className="bg-rfs-700 text-[11px] font-bold text-white">
                <th className="w-8 px-2 py-2.5" aria-label="Expandir" />
                <th className="whitespace-nowrap px-2 py-2.5">Fecha / Hora</th>
                <th className="whitespace-nowrap px-2 py-2.5">Usuario</th>
                <th className="whitespace-nowrap px-2 py-2.5">Acción</th>
                <th className="min-w-[10rem] px-2 py-2.5">Cambio</th>
                <th className="whitespace-nowrap px-2 py-2.5">Estado ant.</th>
                <th className="whitespace-nowrap px-2 py-2.5">Estado nuevo</th>
                <th className="min-w-[12rem] px-2 py-2.5">Comentario</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const expandido = abiertos.has(f.id);
                const u = f.ultimo;
                return (
                  <Fragment key={f.id}>
                    <tr
                      className={cn(
                        'cursor-pointer border-b border-slate-100 align-top transition-colors',
                        expandido ? 'bg-rfs-50/70' : 'bg-white hover:bg-slate-50'
                      )}
                      onClick={() => alternar(f.id)}
                    >
                      <td className="px-2 py-2.5 text-center">
                        <ChevronDown
                          className={cn(
                            'mx-auto h-3.5 w-3.5 text-rfs-700 transition-transform',
                            expandido ? 'rotate-180' : 'rotate-0 text-slate-400'
                          )}
                        />
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 tabular-nums text-slate-600">
                        {u.fecha}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-slate-600">{u.usuario}</td>
                      <td className="whitespace-nowrap px-2 py-2.5 font-bold text-rfs-700">
                        <span className="mr-1 inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-600">
                          L{String(f.dano.linea).padStart(2, '0')}
                        </span>
                        {u.accion}
                      </td>
                      <td className="px-2 py-2.5 leading-snug text-slate-700">{u.cambio}</td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-slate-500">
                        {u.estadoAnterior || '—'}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 font-semibold text-slate-800">
                        {u.estadoNuevo || '—'}
                      </td>
                      <td className="px-2 py-2.5 leading-snug text-slate-500">
                        {u.comentario || '—'}
                      </td>
                    </tr>
                    {expandido && (
                      <tr className="border-b border-slate-200 bg-[#f3f1f8]">
                        <td colSpan={8} className="px-3 py-3">
                          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-rfs-700">
                            Histórico del ítem · {f.eventos.length} acción(es)
                          </p>
                          <div className="mb-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
                            <table className="w-full border-collapse text-[11px]">
                              <thead>
                                <tr className="border-b border-slate-100 bg-slate-50 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                  <th className="px-2 py-2">Fecha / Hora</th>
                                  <th className="px-2 py-2">Usuario</th>
                                  <th className="px-2 py-2">Acción</th>
                                  <th className="px-2 py-2">Cambio</th>
                                  <th className="px-2 py-2">Estado ant.</th>
                                  <th className="px-2 py-2">Estado nuevo</th>
                                  <th className="px-2 py-2">Comentario</th>
                                </tr>
                              </thead>
                              <tbody>
                                {f.eventos.map((ev) => (
                                  <Fragment key={ev.id}>
                                    <tr className="border-b border-slate-50 align-top last:border-0">
                                      <td className="whitespace-nowrap px-2 py-2 tabular-nums text-slate-500">
                                        {ev.fecha}
                                      </td>
                                      <td className="whitespace-nowrap px-2 py-2 text-slate-600">
                                        {ev.usuario}
                                      </td>
                                      <td className="whitespace-nowrap px-2 py-2 font-semibold text-rfs-700">
                                        {ev.accion}
                                      </td>
                                      <td className="px-2 py-2 text-slate-700">{ev.cambio}</td>
                                      <td className="whitespace-nowrap px-2 py-2 text-slate-500">
                                        {ev.estadoAnterior || '—'}
                                      </td>
                                      <td className="whitespace-nowrap px-2 py-2 font-medium text-slate-800">
                                        {ev.estadoNuevo || '—'}
                                      </td>
                                      <td className="px-2 py-2 leading-snug text-slate-600">
                                        {ev.comentario || '—'}
                                      </td>
                                    </tr>
                                    {ev.snapshotAnterior && ev.snapshot && ev.camposCambiados?.length ? (
                                      <tr className="border-b border-slate-100 bg-amber-50/40">
                                        <td colSpan={7} className="px-2 py-2">
                                          <BloqueAntesDespuesHistorial ev={ev} />
                                        </td>
                                      </tr>
                                    ) : null}
                                  </Fragment>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {f.eventos.some((ev) => ev.camposCambiados?.length) ? (
                            <>
                              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-rfs-700">
                                Detalle del listado · campos en verde = modificados
                              </p>
                              <DetalleLinea
                                linea={f.linea}
                                camposCambiados={
                                  f.eventos.find((ev) => ev.camposCambiados?.length)
                                    ?.camposCambiados
                                }
                              />
                            </>
                          ) : null}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {filas.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-xs text-slate-400">
                    Este estimado no tiene ítems de daño.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
