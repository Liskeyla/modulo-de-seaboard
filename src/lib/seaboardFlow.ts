import {
  APLICA_APROBADO_SBM,
  esAplicaRechazado,
  esItemAprobado,
  normalizarAplicaDano,
  normalizarCargoDano,
  type EstadoEstimacion,
  type Estimacion,
} from '@/types/estimacion';

/**
 * Estado del estimado al enviar Seaboard → Liquidaciones RFS.
 *
 * - Todos aprobados → APROBADO
 * - Solo hay rechazos con cargo Cliente y el resto aprobado → APROBADO
 *   (Liquidaciones sigue viendo esos ítems como Rechazado para cobro/cliente)
 * - Cualquier rechazo de cargo no Cliente (o todo rechazado) → RECHAZADO
 */
export function resolverEstadoEnvioALiquidaciones(
  danos: { cargo: string; aplica?: string }[]
): {
  estado: Extract<EstadoEstimacion, 'APROBADO' | 'RECHAZADO'>;
  hayRechazos: boolean;
  soloRechazosCargoCliente: boolean;
} {
  const hayRechazos = danos.some((d) => esAplicaRechazado(d.aplica ?? ''));
  const todosAprobados =
    danos.length > 0 && danos.every((d) => esItemAprobado(d.aplica ?? ''));
  const rechazados = danos.filter((d) => esAplicaRechazado(d.aplica ?? ''));
  const aprobados = danos.filter((d) => esItemAprobado(d.aplica ?? ''));
  const soloRechazosCargoCliente =
    rechazados.length > 0 &&
    rechazados.every((d) => normalizarCargoDano(d.cargo) === 'Cliente') &&
    aprobados.length > 0;

  if (todosAprobados) {
    return { estado: 'APROBADO', hayRechazos: false, soloRechazosCargoCliente: false };
  }
  if (soloRechazosCargoCliente) {
    return { estado: 'APROBADO', hayRechazos: true, soloRechazosCargoCliente: true };
  }
  if (hayRechazos) {
    return { estado: 'RECHAZADO', hayRechazos: true, soloRechazosCargoCliente: false };
  }
  return { estado: 'RECHAZADO', hayRechazos: false, soloRechazosCargoCliente: false };
}

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
    ['PENDIENTE', 'RECHAZADO', 'REVERSADO', 'ENVIADO'].includes(e.estado) &&
    e.danos.length > 0
  );
}

/** Resumen visual de lo que devolvió Seaboard a Liquidaciones. */
export function resumenRetornoSeaboard(e: Estimacion) {
  if (!['APROBADO', 'RECHAZADO', 'REPARADO', 'ENVIADO'].includes(e.estado)) {
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
    .find((c) => c.accion === 'APROBAR' || c.accion === 'RECHAZAR' || c.accion === 'ENVIAR');

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
