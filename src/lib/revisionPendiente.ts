import type { AplicaDano, DanoEstimacion, Estimacion } from '@/types/estimacion';
import {
  APLICA_PENDIENTE,
  esItemRevisadoSbm,
  esRevisionParcialItems,
  itemsSinRevisionSbm,
  normalizarAplicaDano,
} from '@/types/estimacion';

/** Estados del estimado en los que ítems pendientes implican acción del usuario. */
const ESTADOS_ESTIMADO_REVISION_ITEMS = [
  'ENVIADO',
  'PENDIENTE',
  'RECHAZADO',
  'REVERSADO',
  'APROBADO',
] as const;

export function esItemPendienteRevision(aplica: string) {
  return !esItemRevisadoSbm(aplica);
}

export function contarItemsPendientesRevision(danos: DanoEstimacion[]) {
  return itemsSinRevisionSbm(danos).length;
}

/** El estimado tiene al menos un ítem sin Aprobar/Rechazar. */
export function estimadoTieneItemsPendientes(e: Estimacion) {
  return contarItemsPendientesRevision(e.danos) > 0;
}

/**
 * Debe resaltarse en listados: hay ítems por revisar y el estimado no está cerrado (REPARADO).
 */
export function estimadoRequiereRevisionItems(e: Estimacion) {
  if (e.estado === 'REPARADO' || e.sinDanos) return false;
  if (!estimadoTieneItemsPendientes(e)) return false;
  return ESTADOS_ESTIMADO_REVISION_ITEMS.includes(
    e.estado as (typeof ESTADOS_ESTIMADO_REVISION_ITEMS)[number]
  );
}

export function estimadoEsRevisionParcial(e: Estimacion) {
  return estimadoRequiereRevisionItems(e) && esRevisionParcialItems(e.danos);
}

export function tituloIndicadorRevisionEstimado(e: Estimacion) {
  const n = contarItemsPendientesRevision(e.danos);
  if (n === 0) return '';
  if (estimadoEsRevisionParcial(e)) {
    return `Revisión parcial: ${n} ítem(s) pendiente(s) de aprobar o rechazar`;
  }
  return `${n} ítem(s) pendiente(s) de revisión (aprobar o rechazar cada línea)`;
}

export function tituloIndicadorItemPendiente(estado: AplicaDano | string) {
  if (normalizarAplicaDano(estado) !== APLICA_PENDIENTE) return '';
  return 'Ítem pendiente de revisión · requiere aprobar o rechazar';
}
