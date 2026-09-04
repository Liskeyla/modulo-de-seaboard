/**
 * Catálogo "Monto Reparación" (Liquidaciones).
 * Define rangos y condiciones para autoaprobar estimados
 * y enviarlos al reporte / bandeja Seaboard.
 */

export type TipoEstimacionMonto = 'MÁQUINA' | 'BOX' | '';
export type ClasificacionMonto = 'Reefer' | 'Dry' | '';

export interface MontoReparacion {
  id: string;
  descripcion: string;
  valorMinimo: number;
  valorMaximo: number;
  naviera: string;
  tipoEstimacion: TipoEstimacionMonto | string;
  clasificacion: ClasificacionMonto | string;
  modeloMaquina: string;
  actividad: string;
  activo: boolean;
  fechaModificacion: string;
  usuarioModificacion: string;
}

function fila(
  id: string,
  descripcion: string,
  min: number,
  max: number,
  naviera: string,
  tipo: string,
  clasificacion: string,
  modelo: string,
  actividad: string
): MontoReparacion {
  return {
    id,
    descripcion,
    valorMinimo: min,
    valorMaximo: max,
    naviera,
    tipoEstimacion: tipo,
    clasificacion,
    modeloMaquina: modelo,
    actividad,
    activo: true,
    fechaModificacion: '',
    usuarioModificacion: 'sistema',
  };
}

const SB = 'SEABOARD MARINE LINE';
const MODELOS = ['DAIKIN', 'CARRIER', 'STARCOOL', 'THERMOKING'] as const;

/** Seed alineado al catálogo DMS «Lista Monto Reparación». */
export const MONTO_REPARACION_SEED: MontoReparacion[] = [
  // Seaboard · Máquina · por modelo · SVL / WTY / DM
  ...MODELOS.flatMap((modelo) => [
    fila(
      `mr-sb-maq-${modelo.toLowerCase()}-svl`,
      `AUTOAPROBACIÓN SEABOARD SVL`,
      0,
      0,
      SB,
      'MÁQUINA',
      'Reefer',
      modelo,
      'SVL'
    ),
    fila(
      `mr-sb-maq-${modelo.toLowerCase()}-wty`,
      `AUTOAPROBACIÓN SEABOARD WTY`,
      0,
      1000,
      SB,
      'MÁQUINA',
      'Reefer',
      modelo,
      'WTY'
    ),
    fila(
      `mr-sb-maq-${modelo.toLowerCase()}-dm`,
      `AUTOAPROBACIÓN SEABOARD DM`,
      0,
      0.01,
      SB,
      'MÁQUINA',
      'Reefer',
      modelo,
      'DM'
    ),
  ]),
  // Seaboard · BOX
  fila('mr-sb-box-svl', 'AUTOAPROBACIÓN SEABOARD SVL BOX', 0, 0, SB, 'BOX', 'Reefer', '', 'SVL'),
  fila('mr-sb-box-wty', 'AUTOAPROBACIÓN SEABOARD WTY BOX', 0, 150, SB, 'BOX', 'Reefer', '', 'WTY'),
  fila('mr-sb-box-dm', 'AUTOAPROBACIÓN SEABOARD DM BOX', 0, 0.01, SB, 'BOX', 'Reefer', '', 'DM'),
  // Generales / otros
  fila(
    'mr-auto-500-maq',
    'REPARACION AUTOMATICA $500 MAQ',
    0,
    500,
    SB,
    'MÁQUINA',
    'Reefer',
    '',
    'DM'
  ),
  fila(
    'mr-auto-150-box',
    'REPARACION AUTOMATICA $150 BOX',
    0,
    150,
    SB,
    'BOX',
    'Reefer',
    '',
    'DM'
  ),
  fila(
    'mr-one-maq-dm',
    'AUTOAPROBACIÓN ONE DM',
    0,
    500,
    'ONE',
    'MÁQUINA',
    'Reefer',
    '',
    'DM'
  ),
];
