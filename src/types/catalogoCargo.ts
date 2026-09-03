/** Catálogo de cargo (Liquidaciones): define reglas de envío / rechazo sin hardcode. */

export type EfectoEstadoCabecera = 'APROBADO' | 'ENVIADO' | 'RECHAZADO';
export type EfectoVistaLiquidaciones = 'APROBADO' | 'RECHAZADO';

export interface CatalogoCargo {
  id: string;
  /** Código único (ej. Cliente, Línea). */
  codigo: string;
  nombre: string;
  descripcion: string;
  activo: boolean;
  orden: number;
  /**
   * Si true: rechazar ítems de este cargo (con otros ítems aprobados)
   * no impide que el estimado quede APROBADO al enviar.
   * Caso típico: Cliente.
   */
  rechazoNoBloqueaAprobacion: boolean;
  /**
   * Estado de cabecera cuando hay rechazos de este cargo
   * y NO aplica la excepción (resto aprobado + solo cargos no-bloqueantes).
   */
  alRechazarEstadoCabecera: EfectoEstadoCabecera;
  /** Cómo lo ve / recibe liquidaciones en ese caso. */
  alRechazarVistaLiquidaciones: EfectoVistaLiquidaciones;
  /** Ítems de estimados con este cargo entran a reportería de ítems. */
  incluirEnReporteriaItems: boolean;
  fechaModificacion: string;
  usuarioModificacion: string;
}

export const CATALOGO_CARGO_SEED: CatalogoCargo[] = [
  {
    id: 'cargo-cliente',
    codigo: 'Cliente',
    nombre: 'Cliente',
    descripcion:
      'Cobro al cliente. Si Seaboard rechaza solo ítems Cliente y aprueba el resto, el estimado queda APROBADO; los ítems Cliente siguen Rechazado para cobro.',
    activo: true,
    orden: 1,
    rechazoNoBloqueaAprobacion: true,
    alRechazarEstadoCabecera: 'ENVIADO',
    alRechazarVistaLiquidaciones: 'RECHAZADO',
    incluirEnReporteriaItems: true,
    fechaModificacion: '',
    usuarioModificacion: 'sistema',
  },
  {
    id: 'cargo-linea',
    codigo: 'Línea',
    nombre: 'Línea',
    descripcion:
      'Responsabilidad línea / Seaboard. Un rechazo de este cargo (al enviar) deja el estimado ENVIADO y liquidaciones lo recibe como RECHAZADO.',
    activo: true,
    orden: 2,
    rechazoNoBloqueaAprobacion: false,
    alRechazarEstadoCabecera: 'ENVIADO',
    alRechazarVistaLiquidaciones: 'RECHAZADO',
    incluirEnReporteriaItems: true,
    fechaModificacion: '',
    usuarioModificacion: 'sistema',
  },
  {
    id: 'cargo-transportista',
    codigo: 'Transportista',
    nombre: 'Transportista',
    descripcion:
      'Cargo a transportista. Mismo tratamiento que Línea al rechazar (retorno a liquidaciones como RECHAZADO).',
    activo: true,
    orden: 3,
    rechazoNoBloqueaAprobacion: false,
    alRechazarEstadoCabecera: 'ENVIADO',
    alRechazarVistaLiquidaciones: 'RECHAZADO',
    incluirEnReporteriaItems: true,
    fechaModificacion: '',
    usuarioModificacion: 'sistema',
  },
  {
    id: 'cargo-rfs',
    codigo: 'RFS',
    nombre: 'RFS',
    descripcion:
      'Cargo interno RFS. Mismo tratamiento que Línea al rechazar.',
    activo: true,
    orden: 4,
    rechazoNoBloqueaAprobacion: false,
    alRechazarEstadoCabecera: 'ENVIADO',
    alRechazarVistaLiquidaciones: 'RECHAZADO',
    incluirEnReporteriaItems: true,
    fechaModificacion: '',
    usuarioModificacion: 'sistema',
  },
];

