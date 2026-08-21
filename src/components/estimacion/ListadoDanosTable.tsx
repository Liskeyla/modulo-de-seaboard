'use client';

import { Fragment, useRef, useState } from 'react';
import { CheckCircle2, ClipboardList, Images, MessageSquare, PencilLine, Video } from 'lucide-react';
import {
  ComentariosDanoPopover,
  type EntradaComentario,
} from '@/components/estimacion/ComentariosDanoModal';
import {
  APLICA_DANO,
  CARGOS_DANO,
  totalesDanos,
  type AplicaDano,
  type CampoSnapshotLinea,
  type CargoDano,
  type DanoEstimacion,
  type EdicionRecienteDano,
  type RolComentario,
} from '@/types/estimacion';
import { cn, formatMoney } from '@/lib/utils';

interface ListadoDanosTableProps {
  danos: DanoEstimacion[];
  seleccionadoId: string | null;
  editable: boolean;
  /** Permite cambiar Cargo / Aplica (estimado aperturado). */
  cargoAplicaEditable?: boolean;
  mostrarDimensiones?: boolean;
  mostrarMarcacion?: boolean;
  marcacionHabilitada?: boolean;
  marcadosIds?: string[];
  onToggleMarcado?: (danoId: string) => void;
  onToggleTodos?: (marcar: boolean) => void;
  onSeleccionar: (dano: DanoEstimacion) => void;
  onRemarkChange: (dano: DanoEstimacion, remark: string) => void;
  onDonanteChange: (dano: DanoEstimacion, donante: string) => void;
  onCargoChange?: (dano: DanoEstimacion, cargo: CargoDano) => void;
  onAplicaChange?: (dano: DanoEstimacion, aplica: AplicaDano) => void;
  onEditar: (dano: DanoEstimacion) => void;
  onFotos: (dano: DanoEstimacion) => void;
  onVideo: (dano: DanoEstimacion) => void;
  /** Usuario autenticado para el panel de comentarios. */
  comentarioUsuario?: string;
  comentarioRol?: RolComentario;
  comentariosSoloLectura?: boolean;
  onEnviarComentario?: (dano: DanoEstimacion, entrada: EntradaComentario) => void;
}

function celdaCambiada(edicion: EdicionRecienteDano, campo: CampoSnapshotLinea) {
  return Boolean(edicion.camposCambiados?.includes(campo));
}

function SubfilaEdicion({
  edicion,
  mostrarMarcacion,
  mostrarDimensiones,
}: {
  edicion: EdicionRecienteDano;
  mostrarMarcacion: boolean;
  mostrarDimensiones: boolean;
}) {
  const s = edicion.snapshot;
  if (!s) return null;
  const ch = (campo: CampoSnapshotLinea) =>
    cn(celdaCambiada(edicion, campo) && 'dms-celda-cambiada');
  const colspanNotas = (mostrarMarcacion ? 1 : 0) + 22 + (mostrarDimensiones ? 4 : 0);

  return (
    <>
      <tr className="dms-dano-subfila-row">
        {mostrarMarcacion && <td className="bg-amber-50/80" />}
        <td className="bg-amber-50/80 text-center text-[9px] font-bold uppercase tracking-wide text-amber-700">
          Δ
        </td>
        <td className={cn('whitespace-nowrap font-semibold', ch('comp'))}>{s.comp}</td>
        <td className={cn('text-center', ch('partNumber'))}>{s.partNumber || '—'}</td>
        <td className={cn('text-center', ch('ubicacion'))}>{s.ubicacion || '—'}</td>
        <td className={cn('dms-cell-wrap text-[10px] font-semibold', ch('dano'))}>{s.dano}</td>
        <td className={cn('dms-cell-wrap max-w-[10rem] text-[10px]', ch('obsAnalisis'))}>
          {s.obsAnalisis || '—'}
        </td>
        <td className={cn('text-center text-gray-500', ch('metRep'))}>{s.metRep || '—'}</td>
        <td className={cn('text-center font-semibold', ch('newMetRep'))}>{s.newMetRep || '—'}</td>
        <td className={cn('text-center text-[10px] tabular-nums', ch('serieAnterior'))}>
          {s.serieAnterior || '—'}
        </td>
        <td className={cn('text-center text-[10px] tabular-nums', ch('serieEntregado'))}>
          {s.serieEntregado || '—'}
        </td>
        {mostrarDimensiones && (
          <>
            <td className={cn('text-right tabular-nums', ch('largo'))}>
              {s.largo ? s.largo.toFixed(2) : ''}
            </td>
            <td className={cn('text-right tabular-nums', ch('ancho'))}>
              {s.ancho ? s.ancho.toFixed(2) : ''}
            </td>
            <td className={cn('text-right tabular-nums', ch('area'))}>
              {s.area ? s.area.toFixed(2) : ''}
            </td>
            <td className={cn('text-right tabular-nums', ch('longitud'))}>
              {s.longitud ? s.longitud.toFixed(2) : ''}
            </td>
          </>
        )}
        <td className={cn('text-right tabular-nums', ch('cantidad'))}>{s.cantidad.toFixed(2)}</td>
        <td className={cn('text-right tabular-nums', ch('horasHombre'))}>
          {s.horasHombre.toFixed(2)}
        </td>
        <td className={cn('text-right tabular-nums', ch('csHoraHombre'))}>
          ${formatMoney(s.csHoraHombre)}
        </td>
        <td className={cn('text-right tabular-nums', ch('csMaterial'))}>
          ${formatMoney(s.csMaterial)}
        </td>
        <td className={cn('text-right font-semibold tabular-nums', ch('csTotal'))}>
          ${formatMoney(s.csTotal)}
        </td>
        <td className={cn('text-center whitespace-nowrap', ch('cargo'))}>{s.cargo}</td>
        <td className={cn('text-center whitespace-nowrap text-[11px] font-semibold', ch('aplica'))}>
          {s.aplica}
        </td>
        <td className={cn('text-center', ch('medida'))}>{s.medida || '—'}</td>
        <td className={cn('dms-cell-wrap max-w-[8rem] text-[10px]', ch('remark'))}>
          {s.remark || '—'}
        </td>
        <td className={cn('text-center text-[10px] uppercase', ch('contenedorDonante'))}>
          {s.contenedorDonante || '—'}
        </td>
        <td className="bg-amber-50/50 text-[10px] text-amber-900">
          {edicion.comentarioSbm ? <span title={edicion.comentarioSbm}>SBM ✓</span> : '—'}
        </td>
        <td className="bg-amber-50/50 text-[9px] text-amber-800">
          {edicion.usuario}
          <br />
          <span className="tabular-nums opacity-80">{edicion.fecha}</span>
        </td>
      </tr>
      {(edicion.comentarioSbm || edicion.comentarioRfs) && (
        <tr className="dms-dano-subfila-notas">
          <td colSpan={colspanNotas}>
            <div className="flex flex-wrap gap-2 px-2 py-1.5">
              {edicion.comentarioSbm && (
                <div className="dms-dano-cmt-sbm max-w-xl">
                  <span className="dms-dano-cmt-label text-sky-700">SBM:</span>
                  {edicion.comentarioSbm}
                </div>
              )}
              {edicion.comentarioRfs && (
                <div className="dms-dano-cmt-rfs max-w-xl">
                  <span className="dms-dano-cmt-label text-emerald-700">RFS:</span>
                  {edicion.comentarioRfs}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function CeldaComentarios({
  dano,
  abierto,
  onToggle,
  onClose,
  usuario,
  rol,
  soloLectura,
  onEnviar,
}: {
  dano: DanoEstimacion;
  abierto: boolean;
  onToggle: () => void;
  onClose: () => void;
  usuario: string;
  rol: RolComentario;
  soloLectura: boolean;
  onEnviar?: (entrada: EntradaComentario) => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const pendientes = dano.comentarios.filter((c) => c.tipo === 'SOLICITA_CAMBIO').length;
  const resuelto =
    dano.comentarios.length > 0 &&
    dano.comentarios.some((c) => c.tipo === 'ACEPTADO') &&
    pendientes === 0;

  return (
    <td className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        type="button"
        className={cn(
          'dms-btn-comentarios',
          pendientes > 0 && 'dms-btn-comentarios--pendiente',
          resuelto && 'dms-btn-comentarios--ok'
        )}
        onClick={onToggle}
        title={
          dano.comentarios.length
            ? `${dano.comentarios.length} comentario(s) · ${pendientes} pendiente(s)`
            : 'Sin comentarios'
        }
      >
        <MessageSquare className="h-3.5 w-3.5" />
        <span className="tabular-nums">{dano.comentarios.length}</span>
        {pendientes > 0 && <span className="dms-btn-comentarios-dot" />}
      </button>
      <ComentariosDanoPopover
        open={abierto}
        anclaRef={btnRef}
        dano={dano}
        usuario={usuario}
        rol={rol}
        soloLectura={soloLectura}
        onClose={onClose}
        onEnviar={(entrada) => onEnviar?.(entrada)}
      />
    </td>
  );
}

export function ListadoDanosTable({
  danos,
  seleccionadoId,
  editable,
  cargoAplicaEditable = false,
  mostrarDimensiones = false,
  mostrarMarcacion = false,
  marcacionHabilitada = false,
  marcadosIds = [],
  onToggleMarcado,
  onToggleTodos,
  onSeleccionar,
  onRemarkChange,
  onDonanteChange: _onDonanteChange,
  onCargoChange,
  onAplicaChange,
  onEditar,
  onFotos,
  onVideo,
  comentarioUsuario = 'usuario',
  comentarioRol = 'TECNICO',
  comentariosSoloLectura = true,
  onEnviarComentario,
}: ListadoDanosTableProps) {
  const [comentariosAbiertoId, setComentariosAbiertoId] = useState<string | null>(null);
  const totales = totalesDanos(danos);
  const colspanAntesHh =
    (mostrarMarcacion ? 1 : 0) + 10 + (mostrarDimensiones ? 4 : 0) + 1;
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
                  ref={(el) => {
                    if (el) el.indeterminate = algunosMarcados;
                  }}
                  onChange={(e) => onToggleTodos?.(e.target.checked)}
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
            const resuelto = d.comentarios.length > 0 && ultimo?.tipo === 'ACEPTADO';
            const edicion =
              d.edicionReciente && d.edicionReciente.snapshot ? d.edicionReciente : undefined;
            return (
              <Fragment key={d.id}>
                <tr
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
                        checked={marcado}
                        onChange={() => onToggleMarcado?.(d.id)}
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
                  <td
                    className="text-center whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {cargoAplicaEditable && onCargoChange ? (
                      <select
                        className="dms-select dms-select-actividad max-w-[6.5rem] text-[11px]"
                        value={d.cargo || 'Línea'}
                        title="Cargo (editable con estimado aperturado)"
                        onChange={(e) =>
                          onCargoChange(d, e.target.value as CargoDano)
                        }
                      >
                        {CARGOS_DANO.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    ) : (
                      d.cargo || 'Línea'
                    )}
                  </td>
                  <td
                    className="text-center whitespace-nowrap text-[11px] font-semibold text-black"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {cargoAplicaEditable && onAplicaChange ? (
                      <select
                        className="dms-select dms-select-actividad max-w-[11rem] text-[11px]"
                        value={d.aplica || 'Pendiente Revisión'}
                        title="Aplica (editable con estimado aperturado)"
                        onChange={(e) =>
                          onAplicaChange(d, e.target.value as AplicaDano)
                        }
                      >
                        {APLICA_DANO.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    ) : (
                      d.aplica || 'Pendiente Revisión'
                    )}
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
                  <td className="text-center text-[10px] uppercase text-slate-600">
                    {d.contenedorDonante || '—'}
                  </td>
                  <CeldaComentarios
                    dano={d}
                    abierto={comentariosAbiertoId === d.id}
                    onToggle={() =>
                      setComentariosAbiertoId((prev) => (prev === d.id ? null : d.id))
                    }
                    onClose={() => setComentariosAbiertoId(null)}
                    usuario={comentarioUsuario}
                    rol={comentarioRol}
                    soloLectura={comentariosSoloLectura}
                    onEnviar={(entrada) => onEnviarComentario?.(d, entrada)}
                  />
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="dms-icon-btn dms-icon-btn--azul"
                        title={
                          editable
                            ? 'Editar daño'
                            : 'Aperture la estimación para modificar ítems'
                        }
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
                        title={d.tieneVideo ? 'Ver video' : 'Sin video'}
                        onClick={() => onVideo(d)}
                      >
                        <Video className="h-3.5 w-3.5" />
                        <span className="ml-0.5 text-[10px] font-bold">Video</span>
                      </button>
                    </div>
                  </td>
                </tr>
                {edicion && (
                  <SubfilaEdicion
                    edicion={edicion}
                    mostrarMarcacion={mostrarMarcacion}
                    mostrarDimensiones={mostrarDimensiones}
                  />
                )}
              </Fragment>
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
