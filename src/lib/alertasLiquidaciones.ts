import { TARIFAS } from '@/data/tarifas';
import {
  esAplicaRechazado,
  type DanoEstimacion,
  type Estimacion,
} from '@/types/estimacion';
import { resumenRetornoSeaboard } from '@/lib/seaboardFlow';

export type TipoAlertaLiquidaciones =
  | 'SIN_TARIFA'
  | 'MODIFICADO'
  | 'ITEM_RECHAZADO'
  | 'RECHAZO_TOTAL'
  | 'PENDIENTE_CAMBIO'
  | 'SOLICITUD_REVERSO';

export interface AlertaLiquidaciones {
  id: TipoAlertaLiquidaciones;
  /** Texto multilínea como en DMS (ej. Hay / daños sin / Tarifa). */
  lineas: string[];
  title: string;
}

/** Línea sin tarifa de catálogo o sin costos válidos (no rechazada). */
export function danoSinTarifa(d: DanoEstimacion) {
  if (esAplicaRechazado(d.aplica)) return false;
  const enCatalogo = TARIFAS.some(
    (t) =>
      t.comp.toUpperCase() === d.comp.toUpperCase() ||
      t.metRep.toUpperCase() === (d.partNumber || d.newMetRep || '').toUpperCase()
  );
  if (d.sinTarifa === true) return true;
  if (!String(d.partNumber || '').trim() && !enCatalogo) return true;
  if (d.horasHombre > 0 && d.csHoraHombre === 0 && d.csMaterial === 0 && d.csTotal === 0) {
    return true;
  }
  return false;
}

/** Alertas del estimado para la columna de Liquidaciones (izq. de Acciones). */
export function alertasLiquidaciones(e: Estimacion): AlertaLiquidaciones[] {
  const out: AlertaLiquidaciones[] = [];
  const sinTarifa = e.danos.filter(danoSinTarifa).length;
  if (sinTarifa > 0) {
    out.push({
      id: 'SIN_TARIFA',
      lineas: ['Hay', 'daños sin', 'Tarifa'],
      title: `${sinTarifa} línea(s) sin tarifa de catálogo o sin costos`,
    });
  }

  const modificados = e.danos.filter(
    (d) => !!d.edicionReciente && (d.edicionReciente.camposCambiados?.length ?? 0) > 0
  ).length;
  const retorno = resumenRetornoSeaboard(e);
  if (modificados > 0 || (retorno?.itemsModificados ?? 0) > 0) {
    const n = Math.max(modificados, retorno?.itemsModificados ?? 0);
    out.push({
      id: 'MODIFICADO',
      lineas: ['Hay', 'modifica-', 'ciones'],
      title: `${n} ítem(s) con cambios / modificaciones registradas`,
    });
  }

  if (retorno?.rechazoTotal) {
    out.push({
      id: 'RECHAZO_TOTAL',
      lineas: ['Rechazo', 'total', 'SBM'],
      title: 'Seaboard rechazó el estimado por completo',
    });
  } else if ((retorno?.itemsRechazados ?? 0) > 0) {
    out.push({
      id: 'ITEM_RECHAZADO',
      lineas: ['Ítems', 'rechaza-', 'dos SBM'],
      title: `${retorno!.itemsRechazados} ítem(s) rechazado(s) por Seaboard`,
    });
  }

  const pendientesCambio = e.danos.reduce(
    (acc, d) => acc + d.comentarios.filter((c) => c.tipo === 'SOLICITA_CAMBIO').length,
    0
  );
  if (pendientesCambio > 0) {
    out.push({
      id: 'PENDIENTE_CAMBIO',
      lineas: ['Cambios', 'pendien-', 'tes'],
      title: `${pendientesCambio} solicitud(es) de cambio pendientes`,
    });
  }

  if (e.estado === 'APROBADO') {
    const ultimaSolicitud = [...(e.comentariosSeaboard || [])]
      .reverse()
      .find((c) => c.accion === 'SOLICITAR_REVERSO');
    const ultimoReverso = [...(e.comentariosSeaboard || [])]
      .reverse()
      .find((c) => c.accion === 'REVERSAR');
    if (
      ultimaSolicitud &&
      (!ultimoReverso || String(ultimaSolicitud.fecha) >= String(ultimoReverso.fecha))
    ) {
      out.push({
        id: 'SOLICITUD_REVERSO',
        lineas: ['Solicita', 'reverso', 'SBM'],
        title: `Seaboard solicita reverso: ${ultimaSolicitud.comentario}`,
      });
    }
  }

  return out;
}
