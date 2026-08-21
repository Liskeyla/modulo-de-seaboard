'use client';

import { CheckCircle2, ClipboardList, Images, MessageSquare, PencilLine, Video } from 'lucide-react';
import {
  APLICA_DANO,
  totalesDanos,
  type AplicaDano,
  type DanoEstimacion,
} from '@/types/estimacion';
import { cn, formatMoney } from '@/lib/utils';

interface ListadoDanosTableProps {
  danos: DanoEstimacion[];
  seleccionadoId: string | null;
  editable: boolean;
  /** Solo estimados BOX muestran Largo / Ancho / Área / Longitud. */
  mostrarDimensiones?: boolean;
  /** Mostrar columna de check (visible aunque esté deshabilitada). */
  mostrarMarcacion?: boolean;
  /** Permite marcar/desmarcar checks (solo con estimado aperturado). */
  marcacionHabilitada?: boolean;
  marcadosIds?: string[];
  onToggleMarcado?: (danoId: string) => void;
  onToggleTodos?: (marcar: boolean) => void;
  onSeleccionar: (dano: DanoEstimacion) => void;
  onAplicaChange: (dano: DanoEstimacion, aplica: AplicaDano) => void;
  onRemarkChange: (dano: DanoEstimacion, remark: string) => void;
  onDonanteChange: (dano: DanoEstimacion, donante: string) => void;
  onEditar: (dano: DanoEstimacion) => void;
  onFotos: (dano: DanoEstimacion) => void;
  onVideo: (dano: DanoEstimacion) => void;
  onComentarios: (dano: DanoEstimacion) => void;
}

export function ListadoDanosTable({
  danos,
  seleccionadoId,
  editable,
  mostrarDimensiones = false,
  mostrarMarcacion = false,
  marcacionHabilitada = false,
  marcadosIds = [],
  onToggleMarcado,
  onToggleTodos,
  onSeleccionar,
  onAplicaChange,
  onRemarkChange,
  onDonanteChange,
  onEditar,
  onFotos,
  onVideo,
  onComentarios,
}: ListadoDanosTableProps) {
  const totales = totalesDanos(danos);
  const colspanAntesHh =
    (mostrarMarcacion ? 1 : 0) + 10 + (mostrarDimensiones ? 4 : 0) + 1; // hasta Cant. inclusive
  const todosMarcados =
    marcacionHabilitada &&
    danos.length > 0 &&
    danos.every((d) => marcadosIds.includes(d.id));
  const algunosMarcados =
    marcacionHabilitada &&
    danos.some((d) => marcadosIds.includes(d.id)) &&
    !todosMarcados;

  if (danos.length === 0) {
    return (
      <div className="dms-empty-state">
        <div className="dms-empty-icon">
          <ClipboardList className="h-7 w-7" />
        </div>
        <p className="text-sm font-semibold text-gray-700">Este estimado no tiene daños</p>
        <p className="mt-1 max-w-sm text-xs text-gray-500">
          Este estimado no tiene líneas de daño para visualizar.
        </p>
      </div>
    );
  }

  return (
    <div className="dms-table-scroll">
      <table className="dms-table dms-table--danos">
        <thead>
          <tr>
            {mostrarMarcacion && (
              <th
                className="w-9"
                title={
                  marcacionHabilitada
                    ? 'Marcar ítems para aprobar o rechazar'
                    : 'Aperture la estimación para marcar ítems'
                }
              >
                <input
                  type="checkbox"
                  className="dms-check-dano"
                  checked={todosMarcados}
                  disabled={!marcacionHabilitada}
                  ref={(el) => {
                    if (el) el.indeterminate = algunosMarcados;
                  }}
                  onChange={(e) => {
                    if (!marcacionHabilitada) return;
                    onToggleTodos?.(e.target.checked);
                  }}
                  aria-label="Marcar todos los ítems"
                />
              </th>
            )}
            <th className="w-8" title="Seleccione un daño para ver su información">
              <span className="sr-only">Seleccionar</span>ⓘ
            </th>
            <th>Comp.</th>
            <th>Part Number</th>
            <th>Ubicación</th>
            <th>Daño</th>
            <th>Obs. Análisis</th>
            <th className="underline decoration-dotted">Met. Rep.</th>
            <th className="underline decoration-dotted">New Met. Rep.</th>
            <th>
              Número de
              <br />
              Serie Anterior
            </th>
            <th>
              Número de
              <br />
              Serie Entregado
            </th>
            {mostrarDimensiones && (
              <>
                <th>Largo</th>
                <th>Ancho</th>
                <th>Área</th>
                <th>Longitud</th>
              </>
            )}
            <th className="underline decoration-dotted">Cant.</th>
            <th className="underline decoration-dotted">H.H.</th>
            <th className="underline decoration-dotted">Cs. H.H.</th>
            <th className="underline decoration-dotted">Cs. Mat.</th>
            <th className="underline decoration-dotted">Cs. Total</th>
            <th>Cargo</th>
            <th className="underline decoration-dotted">Aplica</th>
            <th>Medida</th>
            <th>Remark</th>
            <th>Contenedor Donante</th>
            <th>Comentarios</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {danos.map((d) => {
            const activo = seleccionadoId === d.id;
            const marcado = marcadosIds.includes(d.id);
            const pendientes = d.comentarios.filter((c) => c.tipo === 'SOLICITA_CAMBIO').length;
            const ultimo = d.comentarios[d.comentarios.length - 1];
            const resuelto =
              d.comentarios.length > 0 && ultimo?.tipo === 'ACEPTADO';
            return (
              <tr
                key={d.id}
                className={cn(
                  'cursor-pointer',
                  activo && 'dms-row-selected',
                  marcado && 'dms-row-marcado'
                )}
                onClick={() => onSeleccionar(d)}
              >
                {mostrarMarcacion && (
                  <td className="text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="dms-check-dano"
                      checked={marcacionHabilitada && marcado}
                      disabled={!marcacionHabilitada}
                      onChange={() => {
                        if (!marcacionHabilitada) return;
                        onToggleMarcado?.(d.id);
                      }}
                      aria-label={`Marcar línea ${d.linea}`}
                      title={
                        marcacionHabilitada
                          ? undefined
                          : 'Aperture la estimación para marcar ítems'
                      }
                    />
                  </td>
                )}
                <td className="text-center">
                  <span
                    className={cn(
                      'dms-dano-check',
                      activo ? 'dms-dano-check--on' : 'dms-dano-check--off'
                    )}
                    aria-hidden
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                </td>
                <td className="whitespace-nowrap font-semibold text-rfs-navy">{d.comp}</td>
                <td className="text-center">{d.partNumber || '—'}</td>
                <td className="text-center">{d.ubicacion || '—'}</td>
                <td className="dms-cell-wrap text-[10px] font-semibold">{d.dano}</td>
                <td className="dms-cell-wrap max-w-[10rem] text-[10px] text-gray-600">
                  {d.obsAnalisis || '—'}
                </td>
                <td className="text-center text-gray-500">{d.metRep || '—'}</td>
                <td className="text-center font-semibold">{d.newMetRep || '—'}</td>
                <td className="text-center text-[10px] tabular-nums">{d.serieAnterior || '—'}</td>
                <td className="text-center text-[10px] tabular-nums">{d.serieEntregado || '—'}</td>
                {mostrarDimensiones && (
                  <>
                    <td className="text-right tabular-nums">
                      {d.largo ? d.largo.toFixed(2) : ''}
                    </td>
                    <td className="text-right tabular-nums">
                      {d.ancho ? d.ancho.toFixed(2) : ''}
                    </td>
                    <td className="text-right tabular-nums">
                      {d.area ? d.area.toFixed(2) : ''}
                    </td>
                    <td className="text-right tabular-nums">
                      {d.longitud ? d.longitud.toFixed(2) : ''}
                    </td>
                  </>
                )}
                <td className="text-right tabular-nums">{d.cantidad.toFixed(2)}</td>
                <td className="text-right tabular-nums">{d.horasHombre.toFixed(2)}</td>
                <td className="text-right tabular-nums">${formatMoney(d.csHoraHombre)}</td>
                <td className="text-right tabular-nums">${formatMoney(d.csMaterial)}</td>
                <td className="text-right font-semibold tabular-nums text-rfs-navy">
                  ${formatMoney(d.csTotal)}
                </td>
                <td className="text-center whitespace-nowrap">{d.cargo}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <select
                    className="dms-select dms-select-aplica"
                    value={d.aplica}
                    disabled={!editable}
                    onChange={(e) => onAplicaChange(d, e.target.value as AplicaDano)}
                  >
                    {APLICA_DANO.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="text-center">{d.medida || '—'}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <input
                    className="dms-input-inline"
                    defaultValue={d.remark}
                    key={`${d.id}-${d.remark}`}
                    placeholder="Remark…"
                    disabled={!editable}
                    onBlur={(e) => {
                      if (e.target.value !== d.remark) onRemarkChange(d, e.target.value);
                    }}
                  />
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <input
                    className="dms-input-inline w-32 text-center uppercase"
                    defaultValue={d.contenedorDonante}
                    key={`${d.id}-${d.contenedorDonante}`}
                    placeholder="Sin donante"
                    disabled={!editable}
                    onBlur={(e) => {
                      if (e.target.value !== d.contenedorDonante) {
                        onDonanteChange(d, e.target.value.toUpperCase());
                      }
                    }}
                  />
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className={cn(
                      'dms-btn-comentarios',
                      pendientes > 0 && 'dms-btn-comentarios--pendiente',
                      resuelto && 'dms-btn-comentarios--ok'
                    )}
                    onClick={() => onComentarios(d)}
                    title={
                      d.comentarios.length
                        ? `${d.comentarios.length} comentario(s) · ${pendientes} pendiente(s)`
                        : 'Sin comentarios · abrir para escribir a liquidaciones'
                    }
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span className="tabular-nums">{d.comentarios.length}</span>
                    {pendientes > 0 && <span className="dms-btn-comentarios-dot" />}
                  </button>
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="dms-icon-btn dms-icon-btn--azul"
                      title="Editar daño"
                      disabled={!editable}
                      onClick={() => onEditar(d)}
                    >
                      <PencilLine className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="dms-icon-btn dms-icon-btn--indigo"
                      title={`Ver ${d.fotos.length} foto(s)`}
                      onClick={() => onFotos(d)}
                    >
                      <Images className="h-3.5 w-3.5" />
                      <span className="ml-0.5 text-[10px] font-bold tabular-nums">
                        {d.fotos.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="dms-icon-btn dms-icon-btn--verde"
                      title={d.tieneVideo ? 'Ver video de inspección' : 'Sin video registrado'}
                      onClick={() => onVideo(d)}
                    >
                      <Video className="h-3.5 w-3.5" />
                      <span className="ml-0.5 text-[10px] font-bold">Video</span>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="dms-danos-total">
            <td colSpan={colspanAntesHh} className="text-right">
              TOTALES
            </td>
            <td className="text-right tabular-nums">{totales.horasHombre.toFixed(2)}</td>
            <td className="text-right tabular-nums">${formatMoney(totales.csHoraHombre)}</td>
            <td className="text-right tabular-nums">${formatMoney(totales.csMaterial)}</td>
            <td className="text-right tabular-nums">${formatMoney(totales.csTotal)}</td>
            <td colSpan={7} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
