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

export const APLICA_DANO = [
  'Pendiente Revisión',
  'Aprobado por Linea SBM',
  'Rechazado SBM',
  'Aprobado Linea',
  'Rechazado',
  'No Aplica',
] as const;
export type AplicaDano = (typeof APLICA_DANO)[number];

/** Valores que asigna el gestor Seaboard al aprobar/rechazar ítems. */
export const APLICA_APROBADO_SBM: AplicaDano = 'Aprobado por Linea SBM';
export const APLICA_RECHAZADO_SBM: AplicaDano = 'Rechazado SBM';

export function esAplicaRechazado(aplica: string) {
  return aplica === 'Rechazado SBM' || aplica === 'Rechazado';
}

/** Ítem ya revisado por Seaboard (aprobado o rechazado por línea SBM). */
export function esItemRevisadoSbm(aplica: string) {
  return aplica === APLICA_APROBADO_SBM || aplica === APLICA_RECHAZADO_SBM;
}

export const CARGOS_DANO = ['Línea', 'Dueño', 'Garantía', 'Rechazado'] as const;
export type CargoDano = (typeof CARGOS_DANO)[number];

/** Cargo que se asigna al rechazar un ítem por línea SBM. */
export const CARGO_RECHAZADO: CargoDano = 'Rechazado';

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
  comentarios: ComentarioDano[];
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
  /** Operación del estimado. Si falta, se infiere del código. */
  pais?: 'ECUADOR' | 'PERU';
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

/** Líneas que aún no tienen decisión SBM (Aprobar/Rechazar ítems). */
export function itemsSinRevisionSbm(danos: DanoEstimacion[]) {
  return danos.filter((d) => !esItemRevisadoSbm(d.aplica));
}

/** Mensaje cuando intentan aprobar/enviar sin haber revisado los ítems de daño. */
export const MSG_ITEMS_SIN_APROBAR =
  'Debe aprobar los ítems de daño antes de enviar a liquidaciones RFS.\nIngrese al estimado, aperture la estimación y apruebe (o rechace) los ítems del listado de daños.';

export function hayItemsSinAprobar(danos: DanoEstimacion[]) {
  return itemsSinRevisionSbm(danos).length > 0;
}
