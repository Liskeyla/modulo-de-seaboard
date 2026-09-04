import type { Estimacion } from '@/types/estimacion';
import type { MontoReparacion } from '@/types/montoReparacion';
import { fueEnviadoASeaboard } from '@/lib/seaboardFlow';

function norm(v: string | undefined | null) {
  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function tipoEstimacionNorm(tipo: string) {
  const t = norm(tipo);
  if (t.includes('BOX')) return 'BOX';
  if (t.includes('MAQUINA') || t.includes('MACHINE')) return 'MAQUINA';
  return t;
}

function clasificacionDeEstimacion(e: Estimacion): string {
  const tip = norm(e.tipoContenedor);
  if (tip.includes('REEFER') || tip.includes('RF')) return 'REEFER';
  if (tip.includes('DRY') || tip.includes('DC')) return 'DRY';
  // Por defecto reefer si hay modelo de máquina
  if (e.modeloMaquina) return 'REEFER';
  return tip;
}

function campoVacioOCoincide(regla: string, valor: string) {
  const r = norm(regla);
  if (!r) return true;
  const v = norm(valor);
  return v.includes(r) || r.includes(v);
}

/**
 * Evalúa si un estimado cumple una regla del catálogo Monto Reparación.
 */
export function estimadoCumpleMontoReparacion(
  e: Estimacion,
  regla: MontoReparacion
): boolean {
  if (!regla.activo) return false;

  const monto = Number(e.pvpTotal) || 0;
  if (monto < regla.valorMinimo || monto > regla.valorMaximo) return false;

  if (!campoVacioOCoincide(regla.naviera, e.naviera)) return false;

  const tipoEst = tipoEstimacionNorm(e.tipoEstimacion);
  const tipoRegla = tipoEstimacionNorm(regla.tipoEstimacion);
  if (tipoRegla && tipoEst !== tipoRegla) return false;

  if (regla.clasificacion) {
    const clasEst = clasificacionDeEstimacion(e);
    if (norm(regla.clasificacion) !== clasEst) return false;
  }

  if (!campoVacioOCoincide(regla.modeloMaquina, e.modeloMaquina || '')) return false;

  if (regla.actividad) {
    if (norm(regla.actividad) !== norm(e.actividad)) return false;
  }

  return true;
}

export function reglasAutoaprobacionParaEstimado(
  e: Estimacion,
  catalogo: MontoReparacion[]
): MontoReparacion[] {
  return catalogo.filter((r) => estimadoCumpleMontoReparacion(e, r));
}

/**
 * Estimado elegible para autoaprobación Liquidaciones → Seaboard:
 * cumple al menos una regla y aún no fue enviado a la bandeja.
 */
export function estimadoEsAutoaprobable(
  e: Estimacion,
  catalogo: MontoReparacion[]
): { ok: boolean; reglas: MontoReparacion[] } {
  if (fueEnviadoASeaboard(e)) return { ok: false, reglas: [] };
  if (!['PENDIENTE', 'RECHAZADO', 'REVERSADO'].includes(e.estado)) {
    return { ok: false, reglas: [] };
  }
  if (e.danos.length === 0) return { ok: false, reglas: [] };
  const reglas = reglasAutoaprobacionParaEstimado(e, catalogo);
  return { ok: reglas.length > 0, reglas };
}
