'use client';

import { Fragment, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  History,
  Images,
  MessageSquare,
  PencilLine,
  Send,
  Trash2,
  Video,
} from 'lucide-react';
import { type EntradaComentario } from '@/components/estimacion/ComentariosDanoModal';
import {
  APLICA_APROBADO_SBM,
  APLICA_DANO,
  CARGOS_DANO,
  esAplicaRechazado,
  totalesDanos,
  type AplicaDano,
  type CampoSnapshotLinea,
  type CargoDano,
  type ComentarioDano,
  type DanoEstimacion,
  type EdicionRecienteDano,
  type RolComentario,
} from '@/types/estimacion';
import { cn, formatMoney } from '@/lib/utils';

const ETIQUETA_CAMPO: Partial<Record<CampoSnapshotLinea, string>> = {
  comp: 'Comp.',
  partNumber: 'Part Number',
  ubicacion: 'Ubicación',
  dano: 'Daño',
  obsAnalisis: 'Obs. Análisis',
  metRep: 'Met. Rep.',
  newMetRep: 'New Met. Rep.',
  serieAnterior: 'Nº Serie Anterior',
  serieEntregado: 'Nº Serie Entregado',
  cantidad: 'Cant.',
  horasHombre: 'H.H.',
  csHoraHombre: 'Cs. H.H.',
  csMaterial: 'Cs. Mat.',
  csTotal: 'Cs. Total',
  cargo: 'Cargo',
  aplica: 'Aplica',
  medida: 'Medida',
  remark: 'Remark',
  contenedorDonante: 'Contenedor Donante',
  largo: 'Largo',
  ancho: 'Ancho',
  area: 'Área',
  longitud: 'Longitud',
};

function ultimoComentarioDe(dano: DanoEstimacion): ComentarioDano | null {
  if (!dano.comentarios.length) return null;
  return [...dano.comentarios].sort((a, b) => a.fecha.localeCompare(b.fecha, 'es')).at(-1) ?? null;
}

function etiquetaRolCorto(rol: RolComentario) {
  switch (rol) {
    case 'SEABOARD':
      return 'Seaboard';
    case 'LIQUIDACIONES':
      return 'Liquidaciones';
    case 'TECNICO':
      return 'Técnico';
    case 'SUPERVISOR':
      return 'Supervisor';
    default:
      return 'RFS';
  }
}

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
  /** Eliminar línea de daño (Liquidaciones / edición aperturada). */
  onEliminar?: (dano: DanoEstimacion) => void;
  onFotos: (dano: DanoEstimacion) => void;
  onVideo: (dano: DanoEstimacion) => void;
  /** Usuario autenticado para el panel de comentarios. */
  comentarioUsuario?: string;
  comentarioRol?: RolComentario;
  comentariosSoloLectura?: boolean;
  onEnviarComentario?: (dano: DanoEstimacion, entrada: EntradaComentario) => void;
  /** Abre el Historial de Actividad (comentarios anteriores). */
  onVerHistorial?: () => void;
}

function celdaCambiada(edicion: EdicionRecienteDano, campo: CampoSnapshotLinea) {
  return Boolean(edicion.camposCambiados?.includes(campo));
}

function claseCampoModificado(
  edicion: EdicionRecienteDano | undefined,
  campo: CampoSnapshotLinea
) {
  return edicion && celdaCambiada(edicion, campo) ? 'dms-celda-modificada' : undefined;
}

function fmtCelda(valor: string | number | undefined | null, money = false) {
  if (valor === undefined || valor === null || valor === '') return '—';
  if (typeof valor === 'number') {
    return money ? `$${formatMoney(valor)}` : valor.toFixed(2);
  }
  return String(valor);
}

/**
 * Fila histórica: valores ANTES del cambio.
 * La fila principal muestra el valor actual (en verde si cambió).
 */
function SubfilaHistorico({
  edicion,
  mostrarMarcacion,
  mostrarDimensiones,
}: {
  edicion: EdicionRecienteDano;
  mostrarMarcacion: boolean;
  mostrarDimensiones: boolean;
}) {
  const s = edicion.snapshotAnterior;
  if (!s || !edicion.camposCambiados?.length) return null;

  const ch = (campo: CampoSnapshotLinea) =>
    cn(celdaCambiada(edicion, campo) && 'dms-celda-historico');
  const colspan = (mostrarMarcacion ? 1 : 0) + 22 + (mostrarDimensiones ? 4 : 0);

  return (
    <>
      <tr className="dms-dano-subfila-row" title="Registro anterior al cambio">
        {mostrarMarcacion && <td />}
        <td className="text-center">
          <span className="dms-badge-antes">Antes</span>
        </td>
        <td className={cn('whitespace-nowrap', ch('comp'))}>{fmtCelda(s.comp)}</td>
        <td className={cn('text-center', ch('partNumber'))}>{fmtCelda(s.partNumber)}</td>
        <td className={cn('text-center', ch('ubicacion'))}>{fmtCelda(s.ubicacion)}</td>
        <td className={cn('dms-cell-wrap text-[10px]', ch('dano'))}>{fmtCelda(s.dano)}</td>
        <td className={cn('dms-cell-wrap max-w-[10rem] text-[10px]', ch('obsAnalisis'))}>
          {fmtCelda(s.obsAnalisis)}
        </td>
        <td className={cn('text-center', ch('metRep'))}>{fmtCelda(s.metRep)}</td>
        <td className={cn('text-center', ch('newMetRep'))}>{fmtCelda(s.newMetRep)}</td>
        <td className={cn('text-center text-[10px] tabular-nums', ch('serieAnterior'))}>
          {fmtCelda(s.serieAnterior)}
        </td>
        <td className={cn('text-center text-[10px] tabular-nums', ch('serieEntregado'))}>
          {fmtCelda(s.serieEntregado)}
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
        <td className={cn('text-right tabular-nums', ch('cantidad'))}>
          {s.cantidad.toFixed(2)}
        </td>
        <td className={cn('text-right tabular-nums', ch('horasHombre'))}>
          {s.horasHombre.toFixed(2)}
        </td>
        <td className={cn('text-right tabular-nums', ch('csHoraHombre'))}>
          {fmtCelda(s.csHoraHombre, true)}
        </td>
        <td className={cn('text-right tabular-nums', ch('csMaterial'))}>
          {fmtCelda(s.csMaterial, true)}
        </td>
        <td className={cn('text-right tabular-nums', ch('csTotal'))}>
          {fmtCelda(s.csTotal, true)}
        </td>
        <td className={cn('text-center whitespace-nowrap', ch('cargo'))}>{fmtCelda(s.cargo)}</td>
        <td className={cn('text-center whitespace-nowrap text-[11px]', ch('aplica'))}>
          {fmtCelda(s.aplica)}
        </td>
        <td className={cn('text-center', ch('medida'))}>{fmtCelda(s.medida)}</td>
        <td className={cn('dms-cell-wrap max-w-[8rem] text-[10px]', ch('remark'))}>
          {fmtCelda(s.remark)}
        </td>
        <td className={cn('text-center text-[10px] uppercase', ch('contenedorDonante'))}>
          {fmtCelda(s.contenedorDonante)}
        </td>
        <td colSpan={2} className="text-[10px] text-slate-500">
          {edicion.usuario} · {edicion.fecha}
        </td>
      </tr>
      {edicion.comentarioSbm ? (
        <tr className="dms-dano-subfila-notas">
          <td colSpan={colspan}>
            <div className="dms-dano-motivo">
              <span className="dms-dano-motivo-label">Motivo del cambio (Seaboard)</span>
              <p className="dms-dano-motivo-texto">{edicion.comentarioSbm}</p>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

/** Último comentario en texto + cambios de Seaboard; el resto va al Historial. */
function SubfilaComentarioYCambios({
  dano,
  edicion,
  mostrarMarcacion,
  mostrarDimensiones,
  puedeComentar,
  onEnviar,
  onVerHistorial,
}: {
  dano: DanoEstimacion;
  edicion?: EdicionRecienteDano;
  mostrarMarcacion: boolean;
  mostrarDimensiones: boolean;
  puedeComentar: boolean;
  onEnviar?: (entrada: EntradaComentario) => void;
  onVerHistorial?: () => void;
}) {
  const [borrador, setBorrador] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const ultimo = useMemo(() => ultimoComentarioDe(dano), [dano]);
  const anteriores = Math.max(0, dano.comentarios.length - (ultimo ? 1 : 0));
  const campos =
    edicion?.camposCambiados?.map((c) => ETIQUETA_CAMPO[c] ?? c).filter(Boolean) ?? [];
  const colspan = (mostrarMarcacion ? 1 : 0) + 22 + (mostrarDimensiones ? 4 : 0);

  const hayCambios = campos.length > 0;
  const hayComentario = Boolean(ultimo);
  /** Solo bajo ítems con cambios o comentarios (el resto se ve en Historial). */
  if (!hayCambios && !hayComentario) return null;

  function publicar() {
    const texto = borrador.trim();
    if (texto.length < 3 || !onEnviar) return;
    onEnviar({ tipo: 'INFORMATIVO', mensaje: texto });
    setBorrador('');
    setMostrarForm(false);
  }

  return (
    <tr className="dms-dano-subfila-comentario">
      <td colSpan={colspan}>
        <div className="dms-dano-cmt-bloque">
          {hayCambios && (
            <div className="dms-dano-cambios-sbm">
              <span className="dms-dano-cambios-sbm__label">Cambios Seaboard</span>
              <p className="dms-dano-cambios-sbm__texto">
                {edicion?.usuario} modificó:{' '}
                <strong>{campos.join(', ')}</strong>
                {edicion?.fecha ? ` · ${edicion.fecha}` : ''}
              </p>
              {edicion?.resumenCambios && (
                <p className="dms-dano-cambios-sbm__resumen">{edicion.resumenCambios}</p>
              )}
            </div>
          )}

          {ultimo ? (
            <div
              className={cn(
                'dms-dano-ultimo-cmt',
                ultimo.tipo === 'SOLICITA_CAMBIO' && 'dms-dano-ultimo-cmt--pendiente',
                ultimo.rol === 'SEABOARD' && 'dms-dano-ultimo-cmt--sbm'
              )}
            >
              <div className="dms-dano-ultimo-cmt__meta">
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                <span className="font-bold">{ultimo.usuario}</span>
                <span className="dms-dano-ultimo-cmt__rol">
                  {etiquetaRolCorto(ultimo.rol)}
                </span>
                <span className="tabular-nums text-slate-400">{ultimo.fecha}</span>
                <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Último comentario
                </span>
              </div>
              <p className="dms-dano-ultimo-cmt__texto">{ultimo.mensaje}</p>
              {ultimo.campoAfectado &&
                ultimo.campoAfectado !== 'Motivo del cambio' &&
                ultimo.campoAfectado !== 'Comentarios línea SBM' && (
                  <p className="mt-1 text-[11px] font-medium text-amber-800">
                    Campo: {ultimo.campoAfectado}
                  </p>
                )}
            </div>
          ) : null}

          <div className="dms-dano-cmt-acciones">
            {anteriores > 0 && (
              <button
                type="button"
                className="dms-dano-cmt-link"
                onClick={onVerHistorial}
                title="Ver todos los comentarios y cambios en el Historial"
              >
                <History className="h-3.5 w-3.5" />
                {anteriores} comentario{anteriores === 1 ? '' : 's'} anterior
                {anteriores === 1 ? '' : 'es'} · ver Historial
              </button>
            )}
            {anteriores === 0 && onVerHistorial && (hayCambios || hayComentario) && (
              <button type="button" className="dms-dano-cmt-link" onClick={onVerHistorial}>
                <History className="h-3.5 w-3.5" /> Ver Historial de actividad
              </button>
            )}
            {puedeComentar && !mostrarForm && (
              <button
                type="button"
                className="dms-dano-cmt-link"
                onClick={() => setMostrarForm(true)}
              >
                <MessageSquare className="h-3.5 w-3.5" /> Agregar comentario
              </button>
            )}
          </div>

          {puedeComentar && mostrarForm && (
            <div className="dms-dano-cmt-form">
              <textarea
                rows={2}
                className="dms-cmt-input"
                value={borrador}
                placeholder="Escriba un comentario sobre este ítem…"
                onChange={(e) => setBorrador(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    publicar();
                  }
                }}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="dms-btn-primary px-3 py-1.5 text-xs disabled:opacity-40"
                  disabled={borrador.trim().length < 3}
                  onClick={publicar}
                >
                  <Send className="h-3.5 w-3.5" /> Publicar
                </button>
                <button
                  type="button"
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  onClick={() => {
                    setMostrarForm(false);
                    setBorrador('');
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </td>
    </tr>
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
  onEliminar,
  onFotos,
  onVideo,
  comentarioUsuario = 'usuario',
  comentarioRol = 'TECNICO',
  comentariosSoloLectura = true,
  onEnviarComentario,
  onVerHistorial,
}: ListadoDanosTableProps) {
  const totales = totalesDanos(danos);
  void comentarioUsuario;
  void comentarioRol;
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
            <th className="min-w-[12rem]">Último comentario</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {danos.map((d) => {
            const activo = seleccionadoId === d.id;
            const marcado = marcadosIds.includes(d.id);
            const ultimoCmt = ultimoComentarioDe(d);
            const pendientes = d.comentarios.filter((c) => c.tipo === 'SOLICITA_CAMBIO').length;
            const edicion = d.edicionReciente;
            const mod = (campo: CampoSnapshotLinea) => claseCampoModificado(edicion, campo);
            return (
              <Fragment key={d.id}>
                <tr
                  className={cn(
                    'cursor-pointer',
                    activo && 'dms-row-selected',
                    marcado && 'dms-row-marcado',
                    edicion && 'dms-row-modificada'
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
                        activo || d.aplica === APLICA_APROBADO_SBM
                          ? 'dms-dano-check--on'
                          : 'dms-dano-check--off'
                      )}
                      aria-hidden
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                  </td>
                  <td className={cn('whitespace-nowrap font-semibold text-rfs-navy', mod('comp'))}>
                    {d.comp}
                  </td>
                  <td className={cn('text-center', mod('partNumber'))}>{d.partNumber || '—'}</td>
                  <td className={cn('text-center', mod('ubicacion'))}>{d.ubicacion || '—'}</td>
                  <td className={cn('dms-cell-wrap text-[10px] font-semibold', mod('dano'))}>
                    {d.dano}
                  </td>
                  <td
                    className={cn(
                      'dms-cell-wrap max-w-[10rem] text-[10px] text-gray-600',
                      mod('obsAnalisis')
                    )}
                  >
                    {d.obsAnalisis || '—'}
                  </td>
                  <td className={cn('text-center text-gray-500', mod('metRep'))}>
                    {d.metRep || '—'}
                  </td>
                  <td className={cn('text-center font-semibold', mod('newMetRep'))}>
                    {d.newMetRep || '—'}
                  </td>
                  <td className={cn('text-center text-[10px] tabular-nums', mod('serieAnterior'))}>
                    {d.serieAnterior || '—'}
                  </td>
                  <td className={cn('text-center text-[10px] tabular-nums', mod('serieEntregado'))}>
                    {d.serieEntregado || '—'}
                  </td>
                  {mostrarDimensiones && (
                    <>
                      <td className={cn('text-right tabular-nums', mod('largo'))}>
                        {d.largo ? d.largo.toFixed(2) : ''}
                      </td>
                      <td className={cn('text-right tabular-nums', mod('ancho'))}>
                        {d.ancho ? d.ancho.toFixed(2) : ''}
                      </td>
                      <td className={cn('text-right tabular-nums', mod('area'))}>
                        {d.area ? d.area.toFixed(2) : ''}
                      </td>
                      <td className={cn('text-right tabular-nums', mod('longitud'))}>
                        {d.longitud ? d.longitud.toFixed(2) : ''}
                      </td>
                    </>
                  )}
                  <td className={cn('text-right tabular-nums', mod('cantidad'))}>
                    {d.cantidad.toFixed(2)}
                  </td>
                  <td
                    className={cn(
                      'text-right tabular-nums',
                      mod('horasHombre'),
                      esAplicaRechazado(d.aplica) && 'text-slate-400'
                    )}
                  >
                    {d.horasHombre.toFixed(2)}
                  </td>
                  <td
                    className={cn(
                      'text-right tabular-nums',
                      mod('csHoraHombre'),
                      esAplicaRechazado(d.aplica) && 'text-slate-400'
                    )}
                  >
                    ${formatMoney(d.csHoraHombre)}
                  </td>
                  <td
                    className={cn(
                      'text-right tabular-nums',
                      mod('csMaterial'),
                      esAplicaRechazado(d.aplica) && 'text-slate-400'
                    )}
                  >
                    ${formatMoney(d.csMaterial)}
                  </td>
                  <td
                    className={cn(
                      'text-right font-semibold tabular-nums text-rfs-navy',
                      mod('csTotal'),
                      esAplicaRechazado(d.aplica) && 'text-slate-400'
                    )}
                  >
                    ${formatMoney(d.csTotal)}
                  </td>
                  <td
                    className={cn('text-center whitespace-nowrap', mod('cargo'))}
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
                    className={cn(
                      'text-center whitespace-nowrap text-[11px] font-semibold text-black',
                      mod('aplica')
                    )}
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
                  <td className={cn('text-center', mod('medida'))}>{d.medida || '—'}</td>
                  <td
                    className={cn(mod('remark'))}
                    onClick={(e) => e.stopPropagation()}
                  >
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
                  <td
                    className={cn(
                      'text-center text-[10px] uppercase text-slate-600',
                      mod('contenedorDonante')
                    )}
                  >
                    {d.contenedorDonante || '—'}
                  </td>
                  <td
                    className={cn(
                      'dms-cell-wrap max-w-[14rem] align-top',
                      pendientes > 0 && 'bg-amber-50/80'
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {ultimoCmt ? (
                      <div className="dms-cmt-celda">
                        <p className="dms-cmt-celda__meta">
                          <span className="font-bold text-slate-800">
                            {etiquetaRolCorto(ultimoCmt.rol)}
                          </span>
                          <span className="text-slate-400">· {ultimoCmt.fecha}</span>
                        </p>
                        <p className="dms-cmt-celda__texto" title={ultimoCmt.mensaje}>
                          {ultimoCmt.mensaje}
                        </p>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400">Sin comentarios</span>
                    )}
                  </td>
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
                      {onEliminar && (
                        <button
                          type="button"
                          className="dms-icon-btn dms-icon-btn--rojo"
                          title={
                            editable
                              ? 'Eliminar ítem de daño'
                              : 'Aperture la estimación para eliminar ítems'
                          }
                          onClick={() => onEliminar(d)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
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
                {edicion?.snapshotAnterior && edicion.camposCambiados?.length ? (
                  <SubfilaHistorico
                    edicion={edicion}
                    mostrarMarcacion={mostrarMarcacion}
                    mostrarDimensiones={mostrarDimensiones}
                  />
                ) : null}
                <SubfilaComentarioYCambios
                  dano={d}
                  edicion={edicion}
                  mostrarMarcacion={mostrarMarcacion}
                  mostrarDimensiones={mostrarDimensiones}
                  puedeComentar={!comentariosSoloLectura}
                  onEnviar={(entrada) => onEnviarComentario?.(d, entrada)}
                  onVerHistorial={onVerHistorial}
                />
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
