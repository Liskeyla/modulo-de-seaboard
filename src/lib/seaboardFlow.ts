import {
  APLICA_APROBADO_SBM,
  esAplicaRechazado,
  esItemAprobado,
  normalizarAplicaDano,
  normalizarCargoDano,
  type EstadoEstimacion,
  type Estimacion,
} from '@/types/estimacion';
import type { CatalogoCargo, EfectoEstadoCabecera, EfectoVistaLiquidaciones } from '@/types/catalogoCargo';
import { CATALOGO_CARGO_SEED } from '@/types/catalogoCargo';

function cargoDeCatalogo(
  codigo: string,
  catalogo: CatalogoCargo[]
): CatalogoCargo | undefined {
  const n = String(codigo || '').trim().toLowerCase();
  return catalogo.find((c) => c.activo && c.codigo.toLowerCase() === n);
}

/**
 * Estado del estimado al enviar Seaboard → Liquidaciones RFS.
 * Reglas tomadas del catálogo de cargo (Liquidaciones).
 */
/** Ítem que Seaboard modificó (cantidad, costos, etc.) y Liquidaciones debe revalidar. */
export function itemModificadoPorLinea(d: {
  edicionReciente?: { camposCambiados?: string[] };
}) {
  return (d.edicionReciente?.camposCambiados?.length ?? 0) > 0;
}

export function estimadoConCambiosDeLinea(e: Estimacion) {
  return e.danos.some(itemModificadoPorLinea);
}

export function resolverEstadoEnvioALiquidaciones(
  danos: { cargo: string; aplica?: string; edicionReciente?: { camposCambiados?: string[] } }[],
  catalogoCargos: CatalogoCargo[] = CATALOGO_CARGO_SEED
): {
  estado: Extract<EstadoEstimacion, 'APROBADO' | 'ENVIADO' | 'RECHAZADO'>;
  paraLiquidaciones: EfectoVistaLiquidaciones;
  hayRechazos: boolean;
  soloRechazosCargoCliente: boolean;
  soloRechazosNoBloqueantes: boolean;
} {
  const hayRechazos = danos.some((d) => esAplicaRechazado(d.aplica ?? ''));
  const hayCambiosLinea = danos.some(itemModificadoPorLinea);
  /**
   * Si Seaboard cambió valores (ej. cantidad) y reenvía, Liquidaciones lo recibe
   * como RECHAZADO para poder ajustar e insistir a la línea.
   */
  if (hayCambiosLinea) {
    return {
      estado: 'RECHAZADO',
      paraLiquidaciones: 'RECHAZADO',
      hayRechazos,
      soloRechazosCargoCliente: false,
      soloRechazosNoBloqueantes: false,
    };
  }
  const todosAprobados =
    danos.length > 0 && danos.every((d) => esItemAprobado(d.aplica ?? ''));
  const rechazados = danos.filter((d) => esAplicaRechazado(d.aplica ?? ''));
  const aprobados = danos.filter((d) => esItemAprobado(d.aplica ?? ''));

  const rechazosNoBloqueantes =
    rechazados.length > 0 &&
    rechazados.every((d) => {
      const cat = cargoDeCatalogo(normalizarCargoDano(d.cargo), catalogoCargos);
      return Boolean(cat?.rechazoNoBloqueaAprobacion);
    }) &&
    aprobados.length > 0;

  /** Compat: flag histórico “solo Cliente”. */
  const soloRechazosCargoCliente =
    rechazosNoBloqueantes &&
    rechazados.every((d) => normalizarCargoDano(d.cargo) === 'Cliente');

  if (todosAprobados) {
    return {
      estado: 'APROBADO',
      paraLiquidaciones: 'APROBADO',
      hayRechazos: false,
      soloRechazosCargoCliente: false,
      soloRechazosNoBloqueantes: false,
    };
  }

  if (rechazosNoBloqueantes) {
    return {
      estado: 'APROBADO',
      paraLiquidaciones: 'APROBADO',
      hayRechazos: true,
      soloRechazosCargoCliente,
      soloRechazosNoBloqueantes: true,
    };
  }

  if (hayRechazos) {
    /** Si hay algún rechazo bloqueante, usa la regla del primer cargo bloqueante. */
    const bloqueante = rechazados.find((d) => {
      const cat = cargoDeCatalogo(normalizarCargoDano(d.cargo), catalogoCargos);
      return !cat?.rechazoNoBloqueaAprobacion;
    });
    const cat =
      (bloqueante &&
        cargoDeCatalogo(normalizarCargoDano(bloqueante.cargo), catalogoCargos)) ||
      catalogoCargos.find((c) => c.activo && !c.rechazoNoBloqueaAprobacion) ||
      CATALOGO_CARGO_SEED.find((c) => c.codigo === 'Línea');

    const estadoCabecera: EfectoEstadoCabecera =
      cat?.alRechazarEstadoCabecera ?? 'ENVIADO';
    const vistaLiq: EfectoVistaLiquidaciones =
      cat?.alRechazarVistaLiquidaciones ?? 'RECHAZADO';

    return {
      estado: estadoCabecera,
      paraLiquidaciones: vistaLiq,
      hayRechazos: true,
      soloRechazosCargoCliente: false,
      soloRechazosNoBloqueantes: false,
    };
  }

  return {
    estado: 'ENVIADO',
    paraLiquidaciones: 'RECHAZADO',
    hayRechazos: false,
    soloRechazosCargoCliente: false,
    soloRechazosNoBloqueantes: false,
  };
}

/**
 * Retorno Seaboard con ítems rechazados: cabecera puede quedar ENVIADO;
 * liquidaciones lo trata como RECHAZADO según catálogo / historial.
 */
export function esRetornoRechazadoALiquidaciones(e: Estimacion) {
  if (e.estado === 'RECHAZADO') return true;
  if (e.estado !== 'ENVIADO') return false;
  if (String(e.enviarAprobacion || '').toUpperCase() === 'SI') return false;
  const ultimo = [...e.comentariosSeaboard]
    .reverse()
    .find((c) => c.accion === 'APROBAR' || c.accion === 'RECHAZAR' || c.accion === 'ENVIAR');
  if (ultimo?.accion === 'RECHAZAR') return true;
  return e.danos.some((d) => esAplicaRechazado(d.aplica));
}

/**
 * Seaboard ya devolvió el estimado con cambios de ítem:
 * Liquidaciones lo trata como RECHAZADO (aunque la cabecera haya quedado APROBADO).
 */
export function esRetornoConCambiosALiquidaciones(e: Estimacion) {
  if (!estimadoConCambiosDeLinea(e)) return false;
  if (enBandejaSeaboard(e)) return false;
  return ['APROBADO', 'RECHAZADO', 'ENVIADO'].includes(e.estado);
}

/** Estado que debe ver liquidaciones en badge / filtros. */
export function estadoVisibleLiquidaciones(e: Estimacion): EstadoEstimacion {
  if (esRetornoConCambiosALiquidaciones(e)) return 'RECHAZADO';
  if (esRetornoRechazadoALiquidaciones(e) && e.estado === 'ENVIADO') {
    return 'RECHAZADO';
  }
  return e.estado;
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
    (e.estado === 'PENDIENTE' || e.estado === 'ENVIADO') &&
    !esRetornoRechazadoALiquidaciones(e)
  );
}

/** Liquidaciones puede enviar a SBM solo si la naviera es Seaboard y aún no está enviado (incl. tras reverso). */
export function puedePushASbm(e: Estimacion) {
  const retornoCambios = esRetornoConCambiosALiquidaciones(e);
  const yaEnviado =
    String(e.enviarAprobacion || '').toUpperCase() === 'SI' && !retornoCambios;
  const estadosOk =
    ['PENDIENTE', 'RECHAZADO', 'REVERSADO', 'ENVIADO'].includes(e.estado) ||
    (e.estado === 'APROBADO' && retornoCambios);
  return (
    esNavieraSeaboard(e.naviera) &&
    !yaEnviado &&
    estadosOk &&
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
  const rechazoTotal =
    (e.estado === 'RECHAZADO' || esRetornoRechazadoALiquidaciones(e)) &&
    !estimadoConCambiosDeLinea(e);
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

