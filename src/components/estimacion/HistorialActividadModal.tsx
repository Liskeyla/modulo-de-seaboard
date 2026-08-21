'use client';

import { useEffect, useMemo, useState, Fragment } from 'react';
import { ChevronDown, History } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import {
  aLineaHistorial,
  type DanoEstimacion,
  type Estimacion,
  type LineaHistorialDano,
} from '@/types/estimacion';
import { cn, formatMoney } from '@/lib/utils';

interface UltimoCambio {
  fecha: string;
  usuario: string;
  actividad: string;
  comentario: string;
}

interface FilaDano {
  id: string;
  dano: DanoEstimacion;
  linea: LineaHistorialDano;
  ultimo: UltimoCambio;
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
  return `Acción: ${accion} || Comentario: ${detalle || '—'}`;
}

/** Obtiene el último cambio / modificación asociado a una línea de daño. */
function ultimoCambioDeDano(dano: DanoEstimacion, estimacion: Estimacion): UltimoCambio {
  type Cand = { ts: number; cambio: UltimoCambio };
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
      /APERTUR|CIERR|ENVÍO|ENVIO|APROBA|RECHAZ|GATE|CREACI|VISUALIZ|ÍTEMS APROBAD|ÍTEMS RECHAZ/i.test(
        ev.accion
      );
    if (!mencionaLinea && !afectaTodos) return;
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
    return {
      fecha: estimacion.fechaModificacion || estimacion.fechaElaboracion || 's/f',
      usuario: estimacion.usuarioModificacion || 'sistema',
      actividad: 'Registro de daño',
      comentario: formatearComentario(
        'Registro de daño',
        `Línea ${dano.linea} · ${dano.comp} · ${dano.dano}`
      ),
    };
  }

  cands.sort((a, b) => b.ts - a.ts);
  return cands[0].cambio;
}

function DetalleLinea({ linea }: { linea: LineaHistorialDano }) {
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
            <td className="whitespace-nowrap font-semibold text-rfs-navy">{linea.comp}</td>
            <td className="text-center">{linea.partNumber || '—'}</td>
            <td className="text-center">{linea.ubicacion || '—'}</td>
            <td className="dms-cell-wrap font-semibold">{linea.dano}</td>
            <td className="text-center">{linea.newMetRep || '—'}</td>
            <td className="text-right tabular-nums">{linea.cantidad.toFixed(2)}</td>
            <td className="text-right tabular-nums">{linea.horasHombre.toFixed(2)}</td>
            <td className="text-right tabular-nums">${formatMoney(linea.csHoraHombre)}</td>
            <td className="text-right tabular-nums">${formatMoney(linea.csMaterial)}</td>
            <td className="text-right font-semibold tabular-nums">
              ${formatMoney(linea.csTotal)}
            </td>
            <td className="text-center whitespace-nowrap">{linea.cargo}</td>
            <td className="text-center whitespace-nowrap">{linea.aplica}</td>
            <td className="dms-cell-wrap max-w-[12rem]">{linea.remark || '—'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/**
 * Historial por ítem de daño: la fila principal muestra el último cambio/modificación;
 * al expandir se ve el detalle de esa línea de daño.
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
        const ultimo = ultimoCambioDeDano(dano, estimacion);
        return {
          id: dano.id,
          dano,
          linea: aLineaHistorial(dano),
          ultimo,
        };
      })
      .sort((a, b) => aTimestamp(b.ultimo.fecha) - aTimestamp(a.ultimo.fecha));
  }, [estimacion]);

  useEffect(() => {
    if (!open) {
      setAbiertos(new Set());
      return;
    }
    // Al abrir, deja expandido el ítem con el cambio más reciente.
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
          Cada fila muestra el <strong>último cambio</strong> del ítem. Expanda para ver el detalle
          del daño.
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
                      <td className="whitespace-nowrap px-2 py-2.5 font-bold text-rfs-700">
                        {f.ultimo.actividad}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-slate-500">
                        {f.ultimo.usuario || 'sistema'}
                      </td>
                      <td className="px-2 py-2.5 leading-snug text-slate-500">
                        <span className="mr-1.5 inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-600">
                          L{String(f.dano.linea).padStart(2, '0')} · {f.dano.comp}
                        </span>
                        {f.ultimo.comentario}
                      </td>
                    </tr>
                    {expandido && (
                      <tr className="border-b border-slate-200 bg-[#f3f1f8]">
                        <td colSpan={5} className="px-3 py-3">
                          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-rfs-700">
                            Detalle del listado de daños (1)
                          </p>
                          <DetalleLinea linea={f.linea} />
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
