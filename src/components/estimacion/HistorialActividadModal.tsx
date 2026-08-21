'use client';

import { useEffect, useMemo, useState, Fragment } from 'react';
import { ChevronDown, History } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import {
  aLineaHistorial,
  type CampoSnapshotLinea,
  type DanoEstimacion,
  type Estimacion,
  type LineaHistorialDano,
} from '@/types/estimacion';
import { cn, formatMoney } from '@/lib/utils';

interface EntradaHistorial {
  fecha: string;
  usuario: string;
  actividad: string;
  comentario: string;
}

interface FilaDano {
  id: string;
  dano: DanoEstimacion;
  linea: LineaHistorialDano;
  ultimo: EntradaHistorial;
  eventos: EntradaHistorial[];
}

/** Ordena "dd/mm/yyyy hh:mm[:ss]" cronológicamente. */
function aTimestamp(fecha: string) {
  const m = fecha.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return 0;
  return new Date(
    Number(m[3]),
    Number(m[2]) - 1,
    Number(m[1]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6] ?? 0)
  ).getTime();
}

function formatearComentario(accion: string, detalle: string) {
  const texto = detalle.trim();
  if (!texto) return accion;
  if (texto.toLowerCase().startsWith(accion.toLowerCase())) return texto;
  return texto;
}

/** Todos los cambios / comentarios asociados a una línea de daño (más reciente primero). */
function eventosDeDano(dano: DanoEstimacion, estimacion: Estimacion): EntradaHistorial[] {
  type Cand = { ts: number; cambio: EntradaHistorial };
  const cands: Cand[] = [];

  if (dano.edicionReciente) {
    cands.push({
      ts: aTimestamp(dano.edicionReciente.fecha),
      cambio: {
        fecha: dano.edicionReciente.fecha,
        usuario: dano.edicionReciente.usuario,
        actividad: 'Modificación de ítem',
        comentario: formatearComentario(
          'Modificación de ítem',
          [
            dano.edicionReciente.resumenCambios,
            dano.edicionReciente.comentarioSbm
              ? `SBM: ${dano.edicionReciente.comentarioSbm}`
              : '',
            dano.edicionReciente.camposCambiados?.length
              ? `Campos: ${dano.edicionReciente.camposCambiados.join(', ')}`
              : '',
          ]
            .filter(Boolean)
            .join(' · ') || `Línea ${dano.linea} · ${dano.comp}`
        ),
      },
    });
  }

  dano.comentarios.forEach((c) => {
    cands.push({
      ts: aTimestamp(c.fecha),
      cambio: {
        fecha: c.fecha,
        usuario: c.usuario,
        actividad: `Comentario · ${c.rol}`,
        comentario: formatearComentario(
          `Comentario · ${c.rol}`,
          `${c.campoAfectado ? `Campo: ${c.campoAfectado} — ` : ''}${c.mensaje}`
        ),
      },
    });
  });

  estimacion.auditoria.forEach((ev) => {
    const mencionaLinea =
      new RegExp(`Línea\\s+${dano.linea}\\b`, 'i').test(ev.detalle) ||
      (ev.lineas?.some((l) => l.linea === dano.linea) ?? false);
    const afectaTodos =
      /APERTUR|CIERR|ENVÍO|ENVIO|APROBA|RECHAZ|GATE|CREACI|VISUALIZ|ÍTEMS APROBAD|ÍTEMS RECHAZ|DAÑO MODIFICADO/i.test(
        ev.accion
      );
    if (!mencionaLinea && !afectaTodos) return;
    // Evitar duplicar el mismo "DAÑO MODIFICADO" si ya está en edicionReciente
    if (ev.accion === 'DAÑO MODIFICADO' && dano.edicionReciente) {
      const mismoResumen =
        ev.detalle.includes(dano.edicionReciente.resumenCambios) ||
        Math.abs(aTimestamp(ev.fecha) - aTimestamp(dano.edicionReciente.fecha)) < 2000;
      if (mismoResumen) return;
    }
    cands.push({
      ts: aTimestamp(ev.fecha),
      cambio: {
        fecha: ev.fecha,
        usuario: ev.usuario,
        actividad: ev.accion,
        comentario: formatearComentario(ev.accion, ev.detalle),
      },
    });
  });

  if (cands.length === 0) {
    return [
      {
        fecha: estimacion.fechaModificacion || estimacion.fechaElaboracion || 's/f',
        usuario: estimacion.usuarioModificacion || 'sistema',
        actividad: 'Registro de daño',
        comentario: formatearComentario(
          'Registro de daño',
          `Línea ${dano.linea} · ${dano.comp} · ${dano.dano}`
        ),
      },
    ];
  }

  cands.sort((a, b) => b.ts - a.ts);
  return cands.map((c) => c.cambio);
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
            <th>Aplica</th>
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

/**
 * Historial por ítem de daño: fila = último cambio;
 * al expandir: todos los cambios/comentarios + detalle con campos modificados en verde.
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
      .map((dano) => {
        const eventos = eventosDeDano(dano, estimacion);
        return {
          id: dano.id,
          dano,
          linea: aLineaHistorial(dano),
          ultimo: eventos[0],
          eventos,
        };
      })
      .sort((a, b) => aTimestamp(b.ultimo.fecha) - aTimestamp(a.ultimo.fecha));
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
          Cada fila muestra el <strong>último cambio</strong> del ítem. Expanda para ver{' '}
          <strong>todos los cambios y comentarios</strong>; los campos modificados aparecen en{' '}
          <span className="font-semibold text-emerald-600">verde</span>.
        </p>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-left text-xs text-slate-800">
            <thead>
              <tr className="bg-rfs-700 text-[11px] font-bold text-white">
                <th className="w-8 px-2 py-2.5" aria-label="Expandir" />
                <th className="whitespace-nowrap px-2 py-2.5">Fecha de Actividad</th>
                <th className="whitespace-nowrap px-2 py-2.5">Actividad</th>
                <th className="whitespace-nowrap px-2 py-2.5">Nombre de Usuario</th>
                <th className="min-w-[14rem] px-2 py-2.5">Comentarios</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const expandido = abiertos.has(f.id);
                const modificado = Boolean(f.dano.edicionReciente?.camposCambiados?.length);
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
                        {f.ultimo.fecha || 's/f'}
                      </td>
                      <td
                        className={cn(
                          'whitespace-nowrap px-2 py-2.5 font-bold',
                          modificado ? 'text-emerald-600' : 'text-rfs-700'
                        )}
                      >
                        {f.ultimo.actividad}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-slate-500">
                        {f.ultimo.usuario || 'sistema'}
                      </td>
                      <td className="px-2 py-2.5 leading-snug text-slate-500">
                        <span className="mr-1.5 inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-600">
                          L{String(f.dano.linea).padStart(2, '0')} · {f.dano.comp}
                        </span>
                        <span className={cn(modificado && 'text-emerald-700')}>
                          {f.ultimo.comentario}
                        </span>
                      </td>
                    </tr>
                    {expandido && (
                      <tr className="border-b border-slate-200 bg-[#f3f1f8]">
                        <td colSpan={5} className="px-3 py-3">
                          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-rfs-700">
                            Cambios y comentarios ({f.eventos.length})
                          </p>
                          <ul className="mb-3 max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2.5">
                            {f.eventos.map((ev, i) => (
                              <li
                                key={`${ev.fecha}-${ev.actividad}-${i}`}
                                className="border-b border-slate-100 pb-2 last:border-0 last:pb-0"
                              >
                                <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                                  <span className="font-bold text-slate-800">{ev.actividad}</span>
                                  <span className="text-slate-400">·</span>
                                  <span className="text-slate-600">{ev.usuario}</span>
                                  <span className="ml-auto tabular-nums text-slate-400">
                                    {ev.fecha}
                                  </span>
                                </div>
                                <p className="text-[12px] leading-relaxed text-slate-700">
                                  {ev.comentario}
                                </p>
                              </li>
                            ))}
                          </ul>
                          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-rfs-700">
                            Detalle del listado de daños
                            {modificado ? ' · campos en verde = modificados' : ''}
                          </p>
                          <DetalleLinea
                            linea={f.linea}
                            camposCambiados={f.dano.edicionReciente?.camposCambiados}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {filas.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-xs text-slate-400">
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
