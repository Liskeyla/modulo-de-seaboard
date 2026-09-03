export const TIPOS_TARIFA = ['BOX', 'MAQUINA', 'ASISTENCIA'] as const;
export type TipoTarifa = (typeof TIPOS_TARIFA)[number];

export const NAVIERAS_EC = [
  'ONE',
  'MSC',
  'MAERSK',
  'HAPAG-LLOYD',
  'CMA CGM',
  'EVERGREEN',
  'SEABOARD MARINE',
] as const;

export const MARCAS_MAQUINA = ['Starcool', 'Carrier', 'DAIKIN', 'Thermo King'] as const;

export const TIPOS_CONTENEDOR = ['REEFER', 'DRY'] as const;
export type TipoContenedor = (typeof TIPOS_CONTENEDOR)[number];

export const UNIDADES_MEDIDA = ['19.5', 'CMS', 'UN', 'CM', 'MT', 'KG'] as const;

/** Tarifa HH usada en DMS Ecuador (0.25 h → $2.50). */
export const TARIFA_HORA_HOMBRE_USD = 10;

export interface MaterialTarifa {
  id: string;
  materialSap: string;
  cantidad: number;
}

export interface TarifaIicl {
  id: string;
  tipo: TipoTarifa;
  componente: string;
  descripcionComponente: string;
  metodoReparacion: string;
  naviera: string;
  tipoContenedor: TipoContenedor;
  descripcion: string;
  descripcionHl: string;
  descripcionBodeguero: string;
  largoMinimo: number;
  largoMaximo: number;
  areaMinima: number;
  areaMaxima: number;
  unidad: string;
  codigoSap: string;
  partNumber: string;
  nombreUbicacion: string;
  marca: string;
  ubicacion: string;
  horasHombre: number;
  costoMaterial: number;
  omitirMultiplicacionHh: boolean;
  omitirAsignacionMateriales: boolean;
  materiales: MaterialTarifa[];
  fechaActualizacion: string;
}

export interface TarifaIiclDraft extends Omit<TarifaIicl, 'id' | 'fechaActualizacion'> {
  id?: string;
}

export interface ResultadoCargaMasiva {
  insertados: number;
  actualizados: number;
  errores: string[];
}

export const LABELS_TIPO: Record<TipoTarifa, string> = {
  BOX: 'Tarifa Box',
  MAQUINA: 'Tarifa de Máquina',
  ASISTENCIA: 'Asistencias Técnicas',
};

export const TITULOS_FORM: Record<TipoTarifa, { nuevo: string; editar: string }> = {
  BOX: {
    nuevo: 'Registrar Tarifa de Reparación Box',
    editar: 'Editar Tarifa de Reparación Box',
  },
  MAQUINA: {
    nuevo: 'Registrar Tarifa de Reparación Máquina',
    editar: 'Editar Tarifa de Reparación Máquina',
  },
  ASISTENCIA: {
    nuevo: 'Registrar Nueva Asistencia Técnica',
    editar: 'Editar Asistencia Técnica',
  },
};
