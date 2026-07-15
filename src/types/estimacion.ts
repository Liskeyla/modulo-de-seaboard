export type EstadoEstimacion =
  | 'PENDIENTE'
  | 'ENVIADO'
  | 'APROBADO'
  | 'RECHAZADO'
  | 'REPARADO'
  | 'REVERSADO';

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
  actividad: string;
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
  comentariosSeaboard: ComentarioSeaboard[];
}
