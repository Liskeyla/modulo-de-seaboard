'use client';

import { useMemo, useState, Fragment } from 'react';
import { ChevronDown, History } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import {
  aLineaHistorial,
  type Estimacion,
  type LineaHistorialDano,
} from '@/types/estimacion';
import { cn, formatMoney } from '@/lib/utils';

interface Entrada {
  id: string;
  fecha: string;
  usuario: string;
  actividad: string;
  comentario: string;
  lineas: LineaHistorialDano[];
}

/** Ordena "dd/mm/yyyy hh:mm[:ss]" cronológicamente; las fechas ilegibles quedan al final. */
function aTimestamp(fecha: string) {
  const m = fecha.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return Number.MAX_SAFE_INTEGER;
  return new Date(
    Number(m[3]),
    Number(m[2]) - 1,
    Number(m[1]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6] ?? 0)
  ).getTime();
}

function formatearComentario(accion: string, detalle: string, modo?: string) {
  const partes = [`Acción: ${accion}`, `Comentario: ${detalle || '—'}`];
  if (modo) partes.push(`Modo: ${modo}`);
  return partes.join(' || ');
}

function lineasParaEvento(
  accion: string,
  detalle: string,
  lineasGuardadas: LineaHistorialDano[] | undefined,
  estimacion: Estimacion
): LineaHistorialDano[] {
  if (lineasGuardadas && lineasGuardadas.length > 0) return lineasGuardadas;

  const m = detalle.match(/Línea\s+(\d+)/i);
  if (m) {
    const d = estimacion.danos.find((x) => x.linea === Number(m[1]));
    return d ? [aLineaHistorial(d)] : [];
  }

  if (
    /VISUALIZ|CIERR|CREACI|APERTUR|ENVÍO|ENVIO|APROBA|RECHAZ|GATE|PTI|REPARA|REVERSO/i.test(
      accion
    )
  ) {
    return estimacion.danos.map(aLineaHistorial);
  }

  return [];
}

function DetalleLineas({ lineas }: { lineas: LineaHistorialDano[] }) {
  if (lineas.length === 0) {
    return (
      <p className="px-3 py-2 text-xs text-slate-500">
        Sin detalle de líneas de daño para este evento.
      </p>
    );
  }

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
          {lineas.map((l) => (
            <tr key={`${l.linea}-${l.comp}-${l.dano}`}>
              <td className="text-center font-semibold">{String(l.linea).padStart(2, '0')}</td>
              <td className="whitespace-nowrap font-semibold text-rfs-navy">{l.comp}</td>
              <td className="text-center">{l.partNumber || '—'}</td>
              <td className="text-center">{l.ubicacion || '—'}</td>
              <td className="dms-cell-wrap font-semibold">{l.dano}</td>
              <td className="text-center">{l.newMetRep || '—'}</td>
              <td className="text-right tabular-nums">{l.cantidad.toFixed(2)}</td>
              <td className="text-right tabular-nums">{l.horasHombre.toFixed(2)}</td>
              <td className="text-right tabular-nums">${formatMoney(l.csHoraHombre)}</td>
              <td className="text-right tabular-nums">${formatMoney(l.csMaterial)}</td>
              <td className="text-right font-semibold tabular-nums">
                ${formatMoney(l.csTotal)}
              </td>
              <td className="text-center whitespace-nowrap">{l.cargo}</td>
              <td className="text-center whitespace-nowrap">{l.aplica}</td>
              <td className="dms-cell-wrap max-w-[12rem]">{l.remark || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Historial de actividad del estimado: tabla expandible con detalle del listado de daños. */
export function HistorialActividadModal({
  open,
  estimacion,
  onClose,
}: {
  open: boolean;
  estimacion: Estimacion | null;
  onClose: () => void;
}) {
  const [abiertoId, setAbiertoId] = useState<string | null>(null);

  const entradas = useMemo<Entrada[]>(() => {
    if (!estimacion) return [];

    const flujo: Entrada[] = estimacion.auditoria.map((ev) => ({
      id: ev.id,
      fecha: ev.fecha,
      usuario: ev.usuario,
      actividad: ev.accion,
      comentario: formatearComentario(
        ev.accion,
        ev.detalle,
        /VISUALIZ/i.test(ev.accion) ? estimacion.estado : undefined
      ),
      lineas: lineasParaEvento(ev.accion, ev.detalle, ev.lineas, estimacion),
    }));

    const comentarios: Entrada[] = estimacion.danos.flatMap((d) =>
      d.comentarios.map((c) => ({
        id: c.id,
        fecha: c.fecha,
        usuario: c.usuario,
        actividad: `Comentario · ${c.rol}`,
        comentario: formatearComentario(
          `Comentario · ${c.rol}`,
          `Línea ${d.linea} (${d.comp})${c.campoAfectado ? ` · Campo: ${c.campoAfectado}` : ''} — ${c.mensaje}`
        ),
        lineas: [aLineaHistorial(d)],
      }))
    );

    const notas: Entrada[] = estimacion.notas.map((n) => ({
      id: n.id,
      fecha: n.fecha,
      usuario: n.usuario,
      actividad: 'Nota de estimación',
      comentario: formatearComentario('Nota de estimación', n.texto),
      lineas: estimacion.danos.map(aLineaHistorial),
    }));

    return [...flujo, ...comentarios, ...notas].sort(
      (a, b) => aTimestamp(a.fecha) - aTimestamp(b.fecha)
    );
  }, [estimacion]);

  if (!estimacion) return null;

  return (
    <Modal
      open={open}
      onClose={() => {
        setAbiertoId(null);
        onClose();
      }}
      size="xl"
      icon={<History className="h-4 w-4" />}
      title="Historial de Actividad de Estimación"
      subtitle={`${estimacion.codigo} · ${estimacion.contenedor} · ${entradas.length} registro(s)`}
      bodyClassName="!p-0"
      footer={
        <button
          type="button"
          className="dms-btn-primary px-4 py-2 text-sm"
          onClick={() => {
            setAbiertoId(null);
            onClose();
          }}
        >
          Cerrar
        </button>
      }
    >
      <div className="max-h-[min(70vh,560px)] overflow-auto bg-slate-50/80 p-3">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-left text-xs text-slate-800">
            <thead>
              <tr className="border-b border-slate-200 bg-white text-[11px] font-bold text-slate-800">
                <th className="w-8 px-2 py-2.5" aria-label="Expandir" />
                <th className="whitespace-nowrap px-2 py-2.5">Fecha de Actividad</th>
                <th className="whitespace-nowrap px-2 py-2.5">Actividad</th>
                <th className="whitespace-nowrap px-2 py-2.5">Nombre de Usuario</th>
                <th className="min-w-[14rem] px-2 py-2.5">Comentarios</th>
              </tr>
            </thead>
            <tbody>
              {entradas.map((e) => {
                const expandido = abiertoId === e.id;
                return (
                  <Fragment key={e.id}>
                    <tr
                      className={cn(
                        'cursor-pointer border-b border-slate-100 align-top transition-colors',
                        expandido ? 'bg-rfs-50/60' : 'bg-white hover:bg-slate-50'
                      )}
                      onClick={() => setAbiertoId(expandido ? null : e.id)}
                    >
                      <td className="px-2 py-2.5 text-center">
                        <ChevronDown
                          className={cn(
                            'mx-auto h-3.5 w-3.5 text-slate-400 transition-transform',
                            expandido && 'rotate-180 text-rfs-700'
                          )}
                        />
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 tabular-nums text-slate-600">
                        {e.fecha || 's/f'}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 font-semibold text-slate-800">
                        {e.actividad}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-slate-700">
                        {e.usuario || 'sistema'}
                      </td>
                      <td className="px-2 py-2.5 leading-snug text-slate-600">{e.comentario}</td>
                    </tr>
                    {expandido && (
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <td colSpan={5} className="px-3 py-3">
                          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            Detalle del listado de daños
                            {e.lineas.length > 0 ? ` (${e.lineas.length})` : ''}
                          </p>
                          <DetalleLineas lineas={e.lineas} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {entradas.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-xs text-slate-400">
                    Sin actividad registrada.
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
