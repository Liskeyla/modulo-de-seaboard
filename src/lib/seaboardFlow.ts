import {
  APLICA_APROBADO_SBM,
  esAplicaRechazado,
  normalizarAplicaDano,
  type Estimacion,
} from '@/types/estimacion';

/** Naviera Seaboard (única que sube al reporte / bandeja SBM). */
export function esNavieraSeaboard(naviera: string) {
  return naviera.toUpperCase().includes('SEABOARD');
}

/** Enviado a SBM y aún sin decisión final (bandeja Seaboard). */
export function enBandejaSeaboard(e: Estimacion) {
  return (
    esNavieraSeaboard(e.naviera) &&
    e.enviarAprobacion === 'SI' &&
    (e.estado === 'PENDIENTE' || e.estado === 'ENVIADO')
  );
}

/** Liquidaciones puede enviar a SBM solo si la naviera es Seaboard y aún no está enviado (incl. tras reverso). */
export function puedePushASbm(e: Estimacion) {
  const yaEnviado = String(e.enviarAprobacion || '').toUpperCase() === 'SI';
  return (
    esNavieraSeaboard(e.naviera) &&
    !yaEnviado &&
    ['PENDIENTE', 'RECHAZADO', 'REVERSADO'].includes(e.estado) &&
    e.danos.length > 0
  );
}

/** Resumen visual de lo que devolvió Seaboard a Liquidaciones. */
export function resumenRetornoSeaboard(e: Estimacion) {
  if (!['APROBADO', 'RECHAZADO', 'REPARADO'].includes(e.estado)) {
    return null;
  }
  const itemsModificados = e.danos.filter(
    (d) =>
      !!d.edicionReciente &&
      (/seaboard|apptelink/i.test(d.edicionReciente.usuario) ||
        (d.edicionReciente.camposCambiados?.length ?? 0) > 0)
  ).length;
  const itemsRechazados = e.danos.filter((d) => esAplicaRechazado(d.aplica)).length;
  const itemsAprobados = e.danos.filter(
    (d) => normalizarAplicaDano(d.aplica) === APLICA_APROBADO_SBM
  ).length;
  const rechazoTotal = e.estado === 'RECHAZADO';
  const ultimo = [...e.comentariosSeaboard]
    .reverse()
    .find((c) => c.accion === 'APROBAR' || c.accion === 'RECHAZAR');

  return {
    rechazoTotal,
    itemsModificados,
    itemsRechazados,
    itemsAprobados,
    comentario: ultimo?.comentario ?? '',
    fecha: ultimo?.fecha || e.fechaAprobacion || e.fechaModificacion,
    usuario: ultimo?.usuario ?? e.usuarioModificacion,
  };
}
