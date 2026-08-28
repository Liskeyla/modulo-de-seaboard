import type {
  CampoSnapshotLinea,
  SnapshotLineaDano,
} from '@/types/estimacion';
import { formatMoney } from '@/lib/utils';

/** Campos de cantidad / montos / medidas (comparación numérica antes vs después). */
export const CAMPOS_VALOR_NUMERICO: CampoSnapshotLinea[] = [
  'cantidad',
  'horasHombre',
  'csHoraHombre',
  'csMaterial',
  'csTotal',
  'largo',
  'ancho',
  'area',
  'longitud',
];

const ETIQUETA_CAMPO: Record<CampoSnapshotLinea, string> = {
  comp: 'Comp.',
  partNumber: 'Part Number',
  ubicacion: 'Ubicación',
  dano: 'Daño',
  obsAnalisis: 'Obs. Análisis',
  metRep: 'Mét. Rep.',
  newMetRep: 'New Met. Rep.',
  serieAnterior: 'Serie anterior',
  serieEntregado: 'Serie entregado',
  largo: 'Largo',
  ancho: 'Ancho',
  area: 'Área',
  longitud: 'Longitud',
  cantidad: 'Cantidad',
  horasHombre: 'H.H.',
  csHoraHombre: 'Cs. H.H.',
  csMaterial: 'Cs. Mat.',
  csTotal: 'Cs. Total',
  cargo: 'Cargo',
  aplica: 'Estado',
  medida: 'Medida',
  remark: 'Remark',
  contenedorDonante: 'Contenedor donante',
};

export function etiquetaCampoSnapshot(campo: CampoSnapshotLinea) {
  return ETIQUETA_CAMPO[campo] ?? campo;
}

export function esCampoValorNumerico(campo: CampoSnapshotLinea) {
  return CAMPOS_VALOR_NUMERICO.includes(campo);
}

export function formatearValorCampo(
  campo: CampoSnapshotLinea,
  valor: string | number | undefined | null
): string {
  if (valor === undefined || valor === null || valor === '') return '—';
  if (typeof valor === 'number') {
    if (campo === 'csHoraHombre' || campo === 'csMaterial' || campo === 'csTotal') {
      return `$${formatMoney(valor)}`;
    }
    if (campo === 'cantidad') {
      const entero = Number.isInteger(valor);
      return entero ? String(valor) : valor.toFixed(2);
    }
    return valor.toFixed(2);
  }
  return String(valor);
}

/**
 * Texto legible de un cambio: «Cantidad: de 1 a 3 unidades».
 */
export function textoCambioCampo(
  campo: CampoSnapshotLinea,
  anterior: string | number | undefined | null,
  nuevo: string | number | undefined | null
): string {
  const etiqueta = etiquetaCampoSnapshot(campo);
  const a = formatearValorCampo(campo, anterior);
  const b = formatearValorCampo(campo, nuevo);
  if (campo === 'cantidad') {
    return `${etiqueta}: de ${a} a ${b} unidades`;
  }
  if (esCampoValorNumerico(campo)) {
    return `${etiqueta}: de ${a} a ${b}`;
  }
  return `${etiqueta}: «${a}» → «${b}»`;
}

/** Lista de pares antes/después para los campos indicados. */
export function paresAntesDespues(
  anterior: SnapshotLineaDano,
  actual: SnapshotLineaDano,
  campos: CampoSnapshotLinea[]
): { campo: CampoSnapshotLinea; etiqueta: string; antes: string; despues: string; texto: string }[] {
  return campos.map((campo) => {
    const antes = formatearValorCampo(campo, anterior[campo]);
    const despues = formatearValorCampo(campo, actual[campo]);
    return {
      campo,
      etiqueta: etiquetaCampoSnapshot(campo),
      antes,
      despues,
      texto: textoCambioCampo(campo, anterior[campo], actual[campo]),
    };
  });
}

/** Resumen compacto para historial / auditoría. */
export function resumirCambiosAntesDespues(
  anterior: SnapshotLineaDano,
  actual: SnapshotLineaDano,
  campos: CampoSnapshotLinea[]
): string {
  if (campos.length === 0) return '';
  return paresAntesDespues(anterior, actual, campos)
    .map((p) => p.texto)
    .join(' · ');
}

export function hayCambioDeValor(
  campos: CampoSnapshotLinea[] | undefined
): boolean {
  return Boolean(campos?.some((c) => esCampoValorNumerico(c)));
}
