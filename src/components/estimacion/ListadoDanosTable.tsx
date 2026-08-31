'use client';

import { Fragment, useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock3,
  Images,
  Lock,
  PencilLine,
  Video,
} from 'lucide-react';
import { BadgeEstadoItem } from '@/components/dms/IndicadoresRevision';
import { type EntradaComentario } from '@/components/estimacion/ComentariosDanoModal';
import {
  APLICA_APROBADO_SBM,
  CARGOS_DANO,
  esAplicaRechazado,
  esItemAprobado,
  esItemRevisadoSbm,
  MSG_ITEM_APROBADO_BLOQUEADO,
  normalizarAplicaDano,
  normalizarCargoDano,
  totalesDanos,
  type CampoSnapshotLinea,
  type CargoDano,
  type ComentarioDano,
  type DanoEstimacion,
  type EdicionRecienteDano,
  type RolComentario,
} from '@/types/estimacion';
import {
  esCampoValorNumerico,
  formatearValorCampo,
  hayCambioDeValor,
  paresAntesDespues,
} from '@/lib/cambioAntesDespues';
import { cn, formatMoney } from '@/lib/utils';

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
    case 'COORDINADOR':
      return 'Coordinador';
    default:
      return 'RFS';
  }
}

interface ListadoDanosTableProps {
  danos: DanoEstimacion[];
  seleccionadoId: string | null;
  editable: boolean;
  /** Permite cambiar el cargo del ítem (estimado aperturado). El estado no se edita aquí. */
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
  onEditar: (dano: DanoEstimacion) => void;
  onFotos: (dano: DanoEstimacion) => void;
  onVideo: (dano: DanoEstimacion) => void;
  /** Usuario autenticado para el panel de comentarios. */
  comentarioUsuario?: string;
  comentarioRol?: RolComentario;
  comentariosSoloLectura?: boolean;
  onEnviarComentario?: (dano: DanoEstimacion, entrada: EntradaComentario) => void;
  /** Oculta columna Acciones (previsualización solo lectura). */
  ocultarAcciones?: boolean;
  /**
   * Coordinador: no muestra «antes → después» ni subfila histórica por ítem;
   * solo un resumen de la última modificación.
   */
  ocultarAntesPorItem?: boolean;
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

/** Celda con valor actual; si cambió, muestra «antes → después». */
function CeldaAntesDespues({
  campo,
  valorActual,
  edicion,
  className,
  money = false,
}: {
  campo: CampoSnapshotLinea;
  valorActual: number | string;
  edicion?: EdicionRecienteDano;
  className?: string;
  money?: boolean;
}) {
  const cambio =
    edicion?.camposCambiados?.includes(campo) &&
    edicion.snapshotAnterior &&
    esCampoValorNumerico(campo);
  const actualTxt =
    typeof valorActual === 'number'
      ? money
        ? `$${formatMoney(valorActual)}`
        : campo === 'cantidad' && Number.isInteger(valorActual)
          ? String(valorActual)
          : valorActual.toFixed(2)
      : String(valorActual || '—');

  if (!cambio || !edicion?.snapshotAnterior) {
    return <td className={className}>{actualTxt}</td>;
  }

  const antesTxt = formatearValorCampo(campo, edicion.snapshotAnterior[campo]);
  return (
    <td
      className={cn(className, 'dms-celda-modificada')}
      title={`${antesTxt} → ${actualTxt}`}
    >
      <span className="dms-cmp-valores">
        <span className="dms-cmp-antes">{antesTxt}</span>
        <span className="dms-cmp-flecha" aria-hidden>
          →
        </span>
        <span className="dms-cmp-despues">{actualTxt}</span>
      </span>
    </td>
  );
}

/**
 * Segundo nivel desplegable: valores ANTES del cambio + comentario en columna de texto.
 */
function SubfilaHistorico({
  edicion,
  mostrarMarcacion,
  mostrarDimensiones,
  ocultarAcciones = false,
  colspanTotal,
}: {
  edicion: EdicionRecienteDano;
  mostrarMarcacion: boolean;
  mostrarDimensiones: boolean;
  ocultarAcciones?: boolean;
  colspanTotal: number;
}) {
  const s = edicion.snapshotAnterior;
  if (!s || !edicion.camposCambiados?.length) return null;

  const ch = (campo: CampoSnapshotLinea) =>
    cn(celdaCambiada(edicion, campo) && 'dms-celda-historico');
  const comentarioTexto =
    edicion.comentarioSbm?.trim() ||
    edicion.resumenCambios?.trim() ||
    '';
  const pares =
    edicion.snapshot && edicion.camposCambiados
      ? paresAntesDespues(s, edicion.snapshot, edicion.camposCambiados)
      : [];

  return (
    <>
      {pares.length > 0 && (
        <tr className="dms-dano-subfila-comparacion">
          <td colSpan={colspanTotal}>
            <div className="dms-antes-despues-barra">
              <span className="dms-antes-despues-barra__titulo">
                Antes → Después
              </span>
              <div className="dms-antes-despues-barra__chips">
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
              <span className="dms-antes-despues-barra__meta">
                {edicion.usuario} · {edicion.fecha}
              </span>
            </div>
          </td>
        </tr>
      )}
      <tr className="dms-dano-subfila-row" title="Registro anterior al cambio (segundo nivel)">
      {mostrarMarcacion && <td className="dms-dano-nivel2-indent" />}
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
      <td className="dms-cell-wrap max-w-[14rem] align-top">
        {comentarioTexto ? (
          <div className="dms-cmt-celda">
            <p className="dms-cmt-celda__meta">
              <span className="font-bold text-slate-700">Comentario</span>
              <span className="text-slate-400">
                · {edicion.usuario} · {edicion.fecha}
              </span>
            </p>
            <p className="dms-cmt-celda__texto" title={comentarioTexto}>
              {comentarioTexto}
            </p>
          </div>
        ) : (
          <span className="text-[10px] text-slate-400">
            {edicion.usuario} · {edicion.fecha}
          </span>
        )}
      </td>
      {!ocultarAcciones && <td />}
    </tr>
    </>
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
  onEditar,
  onFotos,
  onVideo,
  comentarioUsuario = 'usuario',
  comentarioRol = 'TECNICO',
  comentariosSoloLectura = true,
  onEnviarComentario: _onEnviarComentario,
  ocultarAcciones = false,
  ocultarAntesPorItem = false,
}: ListadoDanosTableProps) {
  const [antesExpandidoIds, setAntesExpandidoIds] = useState<Set<string>>(() => new Set());
  const totales = totalesDanos(danos);
  void comentarioUsuario;
  void comentarioRol;
  void comentariosSoloLectura;
  void _onEnviarComentario;
  const colspanAntesHh =
    (mostrarMarcacion ? 1 : 0) + 10 + (mostrarDimensiones ? 4 : 0) + 1;
  /** Columnas totales de la tabla (para barra Antes→Después a ancho completo). */
  const colspanTabla =
    (mostrarMarcacion ? 1 : 0) +
    1 + // check / ⓘ
    10 + // comp … serie
    (mostrarDimensiones ? 4 : 0) +
    1 + // cantidad
    4 + // HH + costos
    6 + // cargo … comentario
    (ocultarAcciones ? 0 : 1);

  /** Abre automáticamente el detalle Antes cuando hubo cambio de cantidad/valores. */
  useEffect(() => {
    if (ocultarAntesPorItem) {
      setAntesExpandidoIds(new Set());
      return;
    }
    const idsValor = danos
      .filter(
        (d) =>
          d.edicionReciente?.snapshotAnterior &&
          hayCambioDeValor(d.edicionReciente.camposCambiados)
      )
      .map((d) => d.id);
    if (idsValor.length === 0) return;
    setAntesExpandidoIds((prev) => {
      const next = new Set(prev);
      let cambio = false;
      idsValor.forEach((id) => {
        if (!next.has(id)) {
          next.add(id);
          cambio = true;
        }
      });
      return cambio ? next : prev;
    });
  }, [danos, ocultarAntesPorItem]);

  const idsPendientesRevision = danos
    .filter((d) => !esItemRevisadoSbm(d.aplica))
    .map((d) => d.id);
  const todosMarcados =
    marcacionHabilitada &&
    idsPendientesRevision.length > 0 &&
    idsPendientesRevision.every((id) => marcadosIds.includes(id));
  const algunosMarcados =
    marcacionHabilitada &&
    danos.some((d) => marcadosIds.includes(d.id)) &&
    !todosMarcados;

  function alternarAntes(id: string) {
    setAntesExpandidoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
                  aria-label="Marcar ítems pendientes de revisión"
                  title="Marca solo los ítems pendientes (los ya aprobados no se re-revisan)"
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
            <th className="underline decoration-dotted" title="Estado de revisión del ítem">
              Estado
            </th>
            <th>Medida</th>
            <th>Remark</th>
            <th>Contenedor Donante</th>
            <th className="min-w-[12rem]">Último comentario</th>
            {!ocultarAcciones && <th>Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {danos.map((d) => {
            const activo = seleccionadoId === d.id;
            const marcado = marcadosIds.includes(d.id);
            const ultimoCmt = ultimoComentarioDe(d);
            const pendientes = d.comentarios.filter((c) => c.tipo === 'SOLICITA_CAMBIO').length;
            const edicion = d.edicionReciente;
            const edicionParaComparar = ocultarAntesPorItem ? undefined : edicion;
            const tieneAntes =
              !ocultarAntesPorItem &&
              Boolean(edicion?.snapshotAnterior) &&
              Boolean(edicion?.camposCambiados?.length);
            const antesAbierto = tieneAntes && antesExpandidoIds.has(d.id);
            /** Resalta celdas modificadas; sin texto «antes → después» si ocultarAntesPorItem. */
            const mod = (campo: CampoSnapshotLinea) => claseCampoModificado(edicion, campo);
            const bloqueadoAprobado = esItemAprobado(d.aplica);
            const puedeEditarFila = editable && !bloqueadoAprobado;
            const puedeCargoFila = Boolean(cargoAplicaEditable && onCargoChange && !bloqueadoAprobado);
            const pendienteRevision = !esItemRevisadoSbm(d.aplica);
            return (
              <Fragment key={d.id}>
                <tr
                  className={cn(
                    'cursor-pointer',
                    activo && 'dms-row-selected',
                    marcado && 'dms-row-marcado',
                    edicion && 'dms-row-modificada',
                    antesAbierto && 'dms-row-nivel1-abierta',
                    bloqueadoAprobado && 'dms-row-item-bloqueado',
                    pendienteRevision && 'dms-row-pendiente-revision'
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
                  <td className="text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center justify-center gap-0.5">
                      {tieneAntes ? (
                        <button
                          type="button"
                          className="dms-dano-nivel-toggle"
                          title={
                            antesAbierto
                              ? 'Ocultar valores anteriores'
                              : 'Ver valores anteriores (Antes)'
                          }
                          aria-expanded={antesAbierto}
                          onClick={() => alternarAntes(d.id)}
                        >
                          {antesAbierto ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </button>
                      ) : (
                        <span className="inline-block w-3.5" aria-hidden />
                      )}
                      <span
                        className={cn(
                          'dms-dano-check',
                          activo || normalizarAplicaDano(d.aplica) === APLICA_APROBADO_SBM
                            ? 'dms-dano-check--on'
                            : pendienteRevision
                              ? 'dms-dano-check--pendiente'
                              : 'dms-dano-check--off'
                        )}
                        title={
                          pendienteRevision
                            ? 'Pendiente de revisión — requiere aprobar o rechazar'
                            : undefined
                        }
                        aria-hidden
                      >
                        {pendienteRevision ? (
                          <Clock3 className="h-4 w-4" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                      </span>
                    </div>
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
                      <CeldaAntesDespues
                        campo="largo"
                        valorActual={d.largo || 0}
                        edicion={edicionParaComparar}
                        className={cn('text-right tabular-nums', mod('largo'))}
                      />
                      <CeldaAntesDespues
                        campo="ancho"
                        valorActual={d.ancho || 0}
                        edicion={edicionParaComparar}
                        className={cn('text-right tabular-nums', mod('ancho'))}
                      />
                      <CeldaAntesDespues
                        campo="area"
                        valorActual={d.area || 0}
                        edicion={edicionParaComparar}
                        className={cn('text-right tabular-nums', mod('area'))}
                      />
                      <CeldaAntesDespues
                        campo="longitud"
                        valorActual={d.longitud || 0}
                        edicion={edicionParaComparar}
                        className={cn('text-right tabular-nums', mod('longitud'))}
                      />
                    </>
                  )}
                  <CeldaAntesDespues
                    campo="cantidad"
                    valorActual={d.cantidad}
                    edicion={edicionParaComparar}
                    className={cn('text-right tabular-nums', mod('cantidad'))}
                  />
                  <CeldaAntesDespues
                    campo="horasHombre"
                    valorActual={d.horasHombre}
                    edicion={edicionParaComparar}
                    className={cn(
                      'text-right tabular-nums',
                      mod('horasHombre'),
                      esAplicaRechazado(d.aplica) && 'text-slate-400'
                    )}
                  />
                  <CeldaAntesDespues
                    campo="csHoraHombre"
                    valorActual={d.csHoraHombre}
                    edicion={edicionParaComparar}
                    money
                    className={cn(
                      'text-right tabular-nums',
                      mod('csHoraHombre'),
                      esAplicaRechazado(d.aplica) && 'text-slate-400'
                    )}
                  />
                  <CeldaAntesDespues
                    campo="csMaterial"
                    valorActual={d.csMaterial}
                    edicion={edicionParaComparar}
                    money
                    className={cn(
                      'text-right tabular-nums',
                      mod('csMaterial'),
                      esAplicaRechazado(d.aplica) && 'text-slate-400'
                    )}
                  />
                  <CeldaAntesDespues
                    campo="csTotal"
                    valorActual={d.csTotal}
                    edicion={edicionParaComparar}
                    money
                    className={cn(
                      'text-right font-semibold tabular-nums text-rfs-navy',
                      mod('csTotal'),
                      esAplicaRechazado(d.aplica) && 'text-slate-400'
                    )}
                  />
                  <td
                    className={cn('text-center whitespace-nowrap', mod('cargo'))}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {puedeCargoFila ? (
                      <select
                        className="dms-select dms-select-actividad max-w-[9rem] text-[11px]"
                        value={normalizarCargoDano(d.cargo)}
                        title="A quién corresponde el cargo"
                        onChange={(e) =>
                          onCargoChange?.(d, e.target.value as CargoDano)
                        }
                      >
                        {CARGOS_DANO.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className="inline-flex items-center justify-center gap-1"
                        title={bloqueadoAprobado ? MSG_ITEM_APROBADO_BLOQUEADO : undefined}
                      >
                        {bloqueadoAprobado && (
                          <Lock className="h-3 w-3 shrink-0 text-emerald-700" aria-hidden />
                        )}
                        {normalizarCargoDano(d.cargo)}
                      </span>
                    )}
                  </td>
                  <td
                    className={cn('text-center whitespace-nowrap', mod('aplica'))}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <BadgeEstadoItem
                      estado={d.aplica}
                      compacto
                      className={bloqueadoAprobado ? 'opacity-90' : undefined}
                    />
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
                      disabled={!puedeEditarFila}
                      title={
                        bloqueadoAprobado
                          ? MSG_ITEM_APROBADO_BLOQUEADO
                          : !editable
                            ? 'Aperture la estimación para modificar ítems'
                            : undefined
                      }
                      onBlur={(e) => {
                        if (bloqueadoAprobado) return;
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
                    {ocultarAntesPorItem && edicion?.resumenCambios ? (
                      <div
                        className="mb-1 rounded border border-sky-200 bg-sky-50 px-1.5 py-1 text-[10px] leading-snug text-sky-950"
                        title={`${edicion.usuario} · ${edicion.fecha}`}
                      >
                        <span className="font-bold uppercase tracking-wide text-sky-800">
                          Última modificación
                        </span>
                        <span className="mt-0.5 block text-slate-700">
                          {edicion.resumenCambios}
                        </span>
                        <span className="mt-0.5 block text-[9px] text-slate-500">
                          {edicion.usuario} · {edicion.fecha}
                        </span>
                      </div>
                    ) : null}
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
                  {!ocultarAcciones && (
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="dms-icon-btn dms-icon-btn--azul"
                        title={
                          bloqueadoAprobado
                            ? 'Consultar ítem aprobado (solo lectura)'
                            : editable
                              ? 'Editar daño'
                              : 'Aperture la estimación para modificar ítems'
                        }
                        onClick={() => onEditar(d)}
                      >
                        {bloqueadoAprobado ? (
                          <Lock className="h-3.5 w-3.5" />
                        ) : (
                          <PencilLine className="h-3.5 w-3.5" />
                        )}
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
                  )}
                </tr>
                {antesAbierto && edicion && !ocultarAntesPorItem ? (
                  <SubfilaHistorico
                    edicion={edicion}
                    mostrarMarcacion={mostrarMarcacion}
                    mostrarDimensiones={mostrarDimensiones}
                    ocultarAcciones={ocultarAcciones}
                    colspanTotal={colspanTabla}
                  />
                ) : null}
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
