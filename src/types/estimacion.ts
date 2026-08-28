export type EstadoEstimacion =
  | 'PENDIENTE'
  | 'ENVIADO'
  | 'APROBADO'
  | 'RECHAZADO'
  | 'REPARADO'
  | 'REVERSADO';

export const ESTADOS_ESTIMACION: EstadoEstimacion[] = [
  'ENVIADO',
  'PENDIENTE',
  'APROBADO',
  'REPARADO',
  'RECHAZADO',
];

export const ACTIVIDADES = ['WTY', 'SVL', 'DM', 'NO APLICA'] as const;
export type Actividad = (typeof ACTIVIDADES)[number];

/** Estado de revisión a nivel de cada ítem de daño (no del estimado). */
export const APLICA_DANO = [
  'Pendiente de revisión',
  'Aprobado',
  'Rechazado',
] as const;
export type AplicaDano = (typeof APLICA_DANO)[number];

export const APLICA_PENDIENTE: AplicaDano = 'Pendiente de revisión';
/** Valores que asigna el gestor Seaboard al aprobar/rechazar ítems. */
export const APLICA_APROBADO_SBM: AplicaDano = 'Aprobado';
export const APLICA_RECHAZADO_SBM: AplicaDano = 'Rechazado';

/** Mapea etiquetas legacy (incl. «No Aplica») al estado vigente del ítem. */
const APLICA_LEGACY: Record<string, AplicaDano> = {
  'Pendiente Revisión': APLICA_PENDIENTE,
  'Pendiente de revisión': APLICA_PENDIENTE,
  'Aprobado por Linea SBM': APLICA_APROBADO_SBM,
  'Aprobado Linea': APLICA_APROBADO_SBM,
  'Aprobado Dueño': APLICA_APROBADO_SBM,
  Aprobado: APLICA_APROBADO_SBM,
  'Rechazado SBM': APLICA_RECHAZADO_SBM,
  Rechazado: APLICA_RECHAZADO_SBM,
  /** Eliminado por ambigüedad: vuelve a pendiente para forzar decisión. */
  'No Aplica': APLICA_PENDIENTE,
};

export function normalizarAplicaDano(aplica: string | undefined | null): AplicaDano {
  if (!aplica) return APLICA_PENDIENTE;
  const mapped = APLICA_LEGACY[aplica];
  if (mapped) return mapped;
  return (APLICA_DANO as readonly string[]).includes(aplica)
    ? (aplica as AplicaDano)
    : APLICA_PENDIENTE;
}

export function esAplicaRechazado(aplica: string) {
  return normalizarAplicaDano(aplica) === APLICA_RECHAZADO_SBM;
}

/** Al rechazar un ítem: H.H. y costos quedan en cero. */
export function valoresCeroPorRechazoItem() {
  return {
    horasHombre: 0,
    csHoraHombre: 0,
    csMaterial: 0,
    csTotal: 0,
  };
}

/** Ítem ya revisado por Seaboard (aprobado o rechazado). */
export function esItemRevisadoSbm(aplica: string) {
  const n = normalizarAplicaDano(aplica);
  return n === APLICA_APROBADO_SBM || n === APLICA_RECHAZADO_SBM;
}

/** Ítem aprobado: bloqueado para edición hasta que se reverse. */
export function esItemAprobado(aplica: string) {
  return normalizarAplicaDano(aplica) === APLICA_APROBADO_SBM;
}

export const MSG_ITEM_APROBADO_BLOQUEADO =
  'El ítem está aprobado y bloqueado. Para modificarlo debe reversarlo, editarlo y volver a enviarlo a revisión.';


/** A quién corresponde el cargo del ítem (independiente del estado de revisión). */
export const CARGOS_DANO = ['Cliente', 'Línea', 'Transportista', 'RFS'] as const;
export type CargoDano = (typeof CARGOS_DANO)[number];

export const CARGO_DEFAULT: CargoDano = 'Línea';

/** @deprecated El rechazo vive en el estado del ítem, no en el cargo. */
export const CARGO_RECHAZADO = 'Rechazado' as const;

const CARGO_LEGACY: Record<string, CargoDano> = {
  Cliente: 'Cliente',
  Línea: 'Línea',
  Linea: 'Línea',
  Transportista: 'Transportista',
  RFS: 'RFS',
  'Línea/RFS': 'Línea',
  Puerto: 'Transportista',
  Garantía: 'RFS',
  Dueño: 'Cliente',
  Rechazado: 'Línea',
};

export function normalizarCargoDano(cargo: string | undefined | null): CargoDano {
  if (!cargo) return CARGO_DEFAULT;
  return CARGO_LEGACY[cargo] ?? CARGO_DEFAULT;
}

/** Cobro del estimado (Liquidaciones): Cliente o Línea. */
export type TipoCobro = 'CLIENTE' | 'LINEA';

export function cargoDesdeTipoCobro(tipo: TipoCobro): CargoDano {
  return tipo === 'CLIENTE' ? 'Cliente' : 'Línea';
}

export function tipoCobroDesdeCargo(cargo: CargoDano): TipoCobro | undefined {
  if (cargo === 'Cliente') return 'CLIENTE';
  if (cargo === 'Línea') return 'LINEA';
  return undefined;
}

export function inferirTipoCobro(e: {
  tipoCobro?: TipoCobro;
  danos: { cargo: string; aplica?: string }[];
}): TipoCobro {
  if (e.tipoCobro === 'CLIENTE' || e.tipoCobro === 'LINEA') return e.tipoCobro;
  const vigentes = e.danos.filter((d) => !esAplicaRechazado(d.aplica ?? ''));
  if (vigentes.length === 0) return 'LINEA';
  const clientes = vigentes.filter(
    (d) => normalizarCargoDano(d.cargo) === 'Cliente'
  ).length;
  return clientes > vigentes.length / 2 ? 'CLIENTE' : 'LINEA';
}

/** Área funcional del autor del comentario, para la trazabilidad con liquidaciones. */
export type RolComentario = 'LIQUIDACIONES' | 'TECNICO' | 'SEABOARD' | 'SUPERVISOR' | 'RFS';

/** Intención del comentario: permite ver de un vistazo qué se pidió cambiar y si ya se resolvió. */
export type TipoComentario = 'SOLICITA_CAMBIO' | 'ACEPTADO' | 'RECHAZADO' | 'INFORMATIVO';

export interface ComentarioDano {
  id: string;
  usuario: string;
  rol: RolComentario;
  fecha: string;
  tipo: TipoComentario;
  mensaje: string;
  /** Campo del daño que el comentario pide modificar (ej. "Cs. Mat."). */
  campoAfectado?: string;
  valorAnterior?: string;
  valorNuevo?: string;
}

/** Última edición del ítem (subfila visible en el listado de daños). */
export interface SnapshotLineaDano {
  comp: string;
  partNumber: string;
  ubicacion: string;
  dano: string;
  obsAnalisis: string;
  metRep: string;
  newMetRep: string;
  serieAnterior: string;
  serieEntregado: string;
  cantidad: number;
  horasHombre: number;
  csHoraHombre: number;
  csMaterial: number;
  csTotal: number;
  cargo: string;
  aplica: string;
  medida: string;
  remark: string;
  contenedorDonante: string;
  largo?: number;
  ancho?: number;
  area?: number;
  longitud?: number;
}

export type CampoSnapshotLinea = keyof SnapshotLineaDano;

export interface EdicionRecienteDano {
  fecha: string;
  usuario: string;
  resumenCambios: string;
  comentarioSbm?: string;
  comentarioRfs?: string;
  /** Valores actuales tras la edición (opcional). */
  snapshot?: SnapshotLineaDano;
  /** Valores previos al cambio · se muestran en la fila «Antes» del listado. */
  snapshotAnterior?: SnapshotLineaDano;
  /** Campos que cambiaron (verde en la fila actual; resaltados en «Antes»). */
  camposCambiados?: CampoSnapshotLinea[];
}

/** Acción registrada sobre un ítem de daño (histórico completo). */
export type TipoAccionHistorialItem =
  | 'CREACION'
  | 'MODIFICACION'
  | 'CAMBIO_CARGO'
  | 'CAMBIO_ESTADO'
  | 'APROBACION'
  | 'RECHAZO'
  | 'REVERSA'
  | 'COMENTARIO';

export interface HistorialAccionItem {
  id: string;
  fecha: string;
  usuario: string;
  tipo: TipoAccionHistorialItem;
  /** Etiqueta de la acción (ej. «Aprobación de ítem»). */
  accion: string;
  /** Descripción del cambio realizado. */
  cambio: string;
  estadoAnterior?: string;
  estadoNuevo?: string;
  comentario?: string;
  camposCambiados?: CampoSnapshotLinea[];
  snapshotAnterior?: SnapshotLineaDano;
  snapshot?: SnapshotLineaDano;
}

export function snapshotDesdeDano(d: DanoEstimacion): SnapshotLineaDano {
  return {
    comp: d.comp,
    partNumber: d.partNumber,
    ubicacion: d.ubicacion,
    dano: d.dano,
    obsAnalisis: d.obsAnalisis,
    metRep: d.metRep,
    newMetRep: d.newMetRep,
    serieAnterior: d.serieAnterior,
    serieEntregado: d.serieEntregado,
    cantidad: d.cantidad,
    horasHombre: d.horasHombre,
    csHoraHombre: d.csHoraHombre,
    csMaterial: d.csMaterial,
    csTotal: d.csTotal,
    cargo: d.cargo,
    aplica: d.aplica,
    medida: d.medida,
    remark: d.remark,
    contenedorDonante: d.contenedorDonante,
    largo: d.largo,
    ancho: d.ancho,
    area: d.area,
    longitud: d.longitud,
  };
}

export interface FotoDano {
  id: string;
  url: string;
  tipo: 'DANO' | 'REPARADO';
  descripcion: string;
  fecha: string;
  /** La foto de inspección ya fue importada a la línea del estimado. */
  importada?: boolean;
}

/** Clasificación del adjunto, igual que el combo "Tipo Archivo" del DMS. */
export type GrupoArchivo = 'ESTIMACION' | 'REPARADO';
export type ClaseArchivo = 'IMAGEN' | 'VIDEO' | 'DATALOG' | 'PDF';

export interface ArchivoDano {
  id: string;
  url: string;
  clase: ClaseArchivo;
  grupo: GrupoArchivo;
  nombre: string;
  fecha: string;
  /** Data log de demostración generado al vuelo; no hay blob persistido. */
  sintetico?: boolean;
}

export interface DanoEstimacion {
  id: string;
  linea: number;
  comp: string;
  partNumber: string;
  ubicacion: string;
  dano: string;
  obsAnalisis: string;
  metRep: string;
  newMetRep: string;
  serieAnterior: string;
  serieEntregado: string;
  fechaAceptacion?: string;
  ncGenerada?: string;
  montoNc?: number;
  largo: number;
  ancho: number;
  area: number;
  longitud: number;
  cantidad: number;
  horasHombre: number;
  csHoraHombre: number;
  csMaterial: number;
  csTotal: number;
  cargo: CargoDano;
  aplica: AplicaDano;
  medida: string;
  remark: string;
  contenedorDonante: string;
  tieneVideo: boolean;
  /** Marca la línea como estructural (BOX) o de máquina, igual que en el DMS de producción. */
  seccion: 'MAQUINA' | 'ESTRUCTURAL';
  fotos: FotoDano[];
  /** Videos, data logs y PDF. Si es undefined, el panel muestra un data log de ejemplo. */
  archivos?: ArchivoDano[];
  archivosReversados?: ArchivoDano[];
  /** Marca explícita: la línea no tiene tarifa de catálogo. */
  sinTarifa?: boolean;
  comentarios: ComentarioDano[];
  /** Histórico completo de acciones sobre el ítem. */
  historialAcciones?: HistorialAccionItem[];
  /** Resumen de la última edición (subfila de color en el listado). */
  edicionReciente?: EdicionRecienteDano;
}

export interface NotaEstimacion {
  id: string;
  fecha: string;
  usuario: string;
  texto: string;
}

export interface EventoAuditoria {
  id: string;
  fecha: string;
  usuario: string;
  accion: string;
  detalle: string;
  /** Snapshot del listado de daños asociado al evento (detalle expandible). */
  lineas?: LineaHistorialDano[];
}

/** Columnas clave del cuadro de daños para el historial. */
export interface LineaHistorialDano {
  linea: number;
  comp: string;
  partNumber: string;
  ubicacion: string;
  dano: string;
  newMetRep: string;
  cantidad: number;
  horasHombre: number;
  csHoraHombre: number;
  csMaterial: number;
  csTotal: number;
  cargo: string;
  aplica: string;
  remark: string;
}

export function aLineaHistorial(d: DanoEstimacion): LineaHistorialDano {
  return {
    linea: d.linea,
    comp: d.comp,
    partNumber: d.partNumber,
    ubicacion: d.ubicacion,
    dano: d.dano,
    newMetRep: d.newMetRep,
    cantidad: d.cantidad,
    horasHombre: d.horasHombre,
    csHoraHombre: d.csHoraHombre,
    csMaterial: d.csMaterial,
    csTotal: d.csTotal,
    cargo: d.cargo,
    aplica: d.aplica,
    remark: d.remark,
  };
}

export interface InfoGarantia {
  enGarantia: boolean;
  proveedor: string;
  fechaInicio: string;
  fechaFin: string;
  ordenGarantia: string;
  observacion: string;
}

export interface InfoInspeccion {
  codigo: string;
  fecha: string;
  inspector: string;
  resultado: string;
  observacion: string;
}

export interface ComentarioSeaboard {
  id: string;
  fecha: string;
  usuario: string;
  accion: 'APROBAR' | 'RECHAZAR' | 'REVERSAR' | 'ENVIAR';
  comentario: string;
}

export interface Estimacion {
  id: string;
  codigo: string;
  semana: number;
  anio: number;
  estado: EstadoEstimacion;
  contenedor: string;
  modeloMaquina: string;
  codigoRfs: string;
  naviera: string;
  actividad: Actividad;
  lugarEstimacion: string;
  lugarAsistencia: string;
  fechaGateIn: string;
  fechaElaboracion: string;
  fechaReparacion: string;
  tipoEstimacion: string;
  tecnico: string;
  horasHombre: number;
  pvpHorasHombre: number;
  pvpMateriales: number;
  pvpTotal: number;
  estadoPti: string;
  fechaFinPti: string;
  enviarAprobacion: string;
  fechaEnvio: string;
  fechaAprobacion: string;
  fechaRevision: string;
  ediEnviadoOne: string;
  fechaEnvioEdiOne: string;
  niveles: string;
  diasEstadia: number;
  tipoDano: string;
  analisisObservacion: string;
  fechaModificacion: string;
  usuarioModificacion: string;
  sinDanos: boolean;
  buque: string;
  viaje: string;
  tipoContenedor: string;
  itinerarioSap: string;
  almacenSap: string;
  garantia: InfoGarantia;
  inspeccion: InfoInspeccion;
  danos: DanoEstimacion[];
  notas: NotaEstimacion[];
  auditoria: EventoAuditoria[];
  comentariosSeaboard: ComentarioSeaboard[];
  /** Liquidaciones validó el estimado (habilita push a SBM si es Seaboard). */
  validadoLiquidaciones?: boolean;
  fechaValidacionLiquidaciones?: string;
  /** Cobro del estimado: Cliente o Línea (Liquidaciones). */
  tipoCobro?: TipoCobro;
  /** Operación del estimado. Si falta, se infiere del código. */
  pais?: 'ECUADOR' | 'PERU';
  /**
   * Si el estimado se generó desde ítems rechazados de otro registro,
   * referencia al código original (histórico, no se reutiliza).
   */
  codigoOrigen?: string;
  estimadoOrigenId?: string;
}

export function totalesDanos(danos: DanoEstimacion[]) {
  return danos.reduce(
    (acc, d) => ({
      horasHombre: acc.horasHombre + d.horasHombre,
      csHoraHombre: acc.csHoraHombre + d.csHoraHombre,
      csMaterial: acc.csMaterial + d.csMaterial,
      csTotal: acc.csTotal + d.csTotal,
    }),
    { horasHombre: 0, csHoraHombre: 0, csMaterial: 0, csTotal: 0 }
  );
}

export function contarComentariosPendientes(danos: DanoEstimacion[]) {
  return danos.reduce(
    (acc, d) => acc + d.comentarios.filter((c) => c.tipo === 'SOLICITA_CAMBIO').length,
    0
  );
}

/** Líneas que aún no tienen decisión de estado (Aprobar/Rechazar ítems). */
export function itemsSinRevisionSbm(danos: DanoEstimacion[]) {
  return danos.filter((d) => !esItemRevisadoSbm(d.aplica));
}

/** Hay ítems pendientes y otros ya aprobados: la línea solo re-revisa lo modificado. */
export function esRevisionParcialItems(danos: DanoEstimacion[]) {
  const pendientes = itemsSinRevisionSbm(danos);
  if (pendientes.length === 0) return false;
  return danos.some((d) => esItemAprobado(d.aplica));
}

/** Mensaje cuando intentan aprobar el estimado sin haber definido el estado de cada ítem. */
export const MSG_ITEMS_SIN_APROBAR =
  'Debe definir el estado de cada ítem de daño (Pendiente de revisión → Aprobado o Rechazado) antes de decidir el estimado.\nIngrese al estimado, aperture la estimación y resuelva los ítems del listado de daños.';

export const MSG_REVISION_PARCIAL =
  'Revisión parcial: solo debe aprobar o rechazar el/los ítem(s) pendiente(s). Los ítems ya aprobados no requieren nueva revisión.';

/** Mensaje contextual según si la revisión es total o solo de ítems modificados. */
export function mensajeRevisionItemsPendientes(danos: DanoEstimacion[]) {
  const pendientes = itemsSinRevisionSbm(danos);
  if (pendientes.length === 0) return null;
  const lineas = pendientes.map((d) => String(d.linea).padStart(2, '0')).join(', ');
  if (esRevisionParcialItems(danos)) {
    return `${MSG_REVISION_PARCIAL}\nPendiente(s): línea(s) ${lineas}.`;
  }
  return `${MSG_ITEMS_SIN_APROBAR}\nPendiente(s): línea(s) ${lineas}.`;
}

export function hayItemsSinAprobar(danos: DanoEstimacion[]) {
  return itemsSinRevisionSbm(danos).length > 0;
}
