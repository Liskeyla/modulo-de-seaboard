import * as XLSX from 'xlsx';
import {
  TARIFA_HORA_HOMBRE_USD,
  TIPOS_TARIFA,
  type TarifaIiclDraft,
  type TipoContenedor,
  type TipoTarifa,
} from '@/types/tarifario';

const HEADERS_CARGA = [
  'Tipo',
  'Componente',
  'DescripcionComponente',
  'MetodoReparacion',
  'Naviera',
  'TipoContenedor',
  'Descripcion',
  'DescripcionHL',
  'DescripcionBodeguero',
  'LargoMinimo',
  'LargoMaximo',
  'AreaMinima',
  'AreaMaxima',
  'Unidad',
  'CodigoSap',
  'PartNumber',
  'NombreUbicacion',
  'Marca',
  'Ubicacion',
  'HorasHombre',
  'CostoMaterial',
  'OmitirMultiplicacionHH',
  'OmitirAsignacionMateriales',
] as const;

function normHeader(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

const ALIAS: Record<string, (typeof HEADERS_CARGA)[number]> = {
  tipo: 'Tipo',
  tipotarifa: 'Tipo',
  componente: 'Componente',
  descripcioncomponente: 'DescripcionComponente',
  desccomponente: 'DescripcionComponente',
  metodoreparacion: 'MetodoReparacion',
  metodo: 'MetodoReparacion',
  naviera: 'Naviera',
  tipocontenedor: 'TipoContenedor',
  clasificacion: 'TipoContenedor',
  descripcion: 'Descripcion',
  descripcionhl: 'DescripcionHL',
  descripcionbodeguero: 'DescripcionBodeguero',
  largominimo: 'LargoMinimo',
  largomaximo: 'LargoMaximo',
  areaminima: 'AreaMinima',
  areamaxima: 'AreaMaxima',
  unidad: 'Unidad',
  unidadmedida: 'Unidad',
  codigosap: 'CodigoSap',
  sap: 'CodigoSap',
  partnumber: 'PartNumber',
  nombreubicacion: 'NombreUbicacion',
  marca: 'Marca',
  ubicacion: 'Ubicacion',
  horashombre: 'HorasHombre',
  hh: 'HorasHombre',
  costomaterial: 'CostoMaterial',
  costodemateriales: 'CostoMaterial',
  precio: 'CostoMaterial',
  omitirmultiplicacionhh: 'OmitirMultiplicacionHH',
  omitirasignacionmateriales: 'OmitirAsignacionMateriales',
};

function leerCelda(row: Record<string, unknown>, header: string): string {
  const wanted = normHeader(header);
  for (const [k, v] of Object.entries(row)) {
    const mapped = ALIAS[normHeader(k)];
    if (normHeader(k) === wanted || mapped === header) return String(v ?? '').trim();
  }
  return '';
}

function num(v: string) {
  if (!v) return 0;
  const n = Number(String(v).replace(',', '.').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function siNo(v: string) {
  const s = v.trim().toUpperCase();
  return s === 'SI' || s === 'S' || s === 'YES' || s === '1' || s === 'TRUE';
}

function parseTipo(v: string): TipoTarifa | null {
  const s = v.trim().toUpperCase();
  if (s === 'BOX' || s.includes('BOX')) return 'BOX';
  if (s === 'MAQUINA' || s.includes('MAQ')) return 'MAQUINA';
  if (s === 'ASISTENCIA' || s.includes('ASIST')) return 'ASISTENCIA';
  return (TIPOS_TARIFA as readonly string[]).includes(s) ? (s as TipoTarifa) : null;
}

function filaEjemploPlantilla(tipo: TipoTarifa): (string | number)[] {
  if (tipo === 'BOX') {
    return [
      'BOX', 'PHP', 'PIN HUB', 'RP', 'ONE', 'REEFER', 'DOOR PARTS - REPLACE PIN HUB',
      '', '', 0, 0, 0, 0, '19.5', '', '', '', '', '', 0.25, 5.06, 'NO', 'NO',
    ];
  }
  if (tipo === 'MAQUINA') {
    return [
      'MAQUINA', 'ECB', 'POWER CABLE', 'RP', 'ONE', 'REEFER', 'SC - NW - POWER CABLE 4X4.0MM2',
      '', '', 0, 0, 0, 0, 'UN', 'RFSCONSD00374', 'B18831C', '', 'Starcool', '', 0.05, 11.2, 'NO', 'SI',
    ];
  }
  return [
    'ASISTENCIA', 'PTI', 'PRE-TRIP INSPECTION', 'AT', 'ONE', 'REEFER', 'Short PTI + pre-cool',
    '', '', 0, 0, 0, 0, 'UN', '', '', '', '', '', 1, 15, 'NO', 'SI',
  ];
}

export function descargarPlantillaCarga(tipo?: TipoTarifa) {
  const tipos: TipoTarifa[] = tipo ? [tipo] : ['BOX', 'MAQUINA', 'ASISTENCIA'];
  const rows = tipos.map((t) => filaEjemploPlantilla(t));
  const ws = XLSX.utils.aoa_to_sheet([
    [...HEADERS_CARGA],
    ...rows,
    [],
    ['Notas'],
    ['Tipo debe ser BOX, MAQUINA o ASISTENCIA.'],
    [`HorasHombre se multiplica por $${TARIFA_HORA_HOMBRE_USD.toFixed(2)} (tarifa HH Ecuador) salvo OmitirMultiplicacionHH = SI.`],
    ['CostoMaterial es el precio de materiales en USD. Costo Total = CostoMaterial + Costo Horas Hombre.'],
    ['Si el componente + naviera (+ part number en máquina) ya existe, se actualiza el precio.'],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Tarifario');
  XLSX.writeFile(wb, `plantilla-tarifario-iicl-ecuador${tipo ? `-${tipo.toLowerCase()}` : ''}.xlsx`);
}

export function parseArchivoTarifario(buffer: ArrayBuffer): TarifaIiclDraft[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
  return json
    .map((row) => {
      const tipo = parseTipo(leerCelda(row, 'Tipo'));
      if (!tipo) return null;
      const componente = leerCelda(row, 'Componente');
      if (!componente) return null;
      const tipoCont: TipoContenedor =
        leerCelda(row, 'TipoContenedor').toUpperCase().includes('DRY') ? 'DRY' : 'REEFER';
      const draft: TarifaIiclDraft = {
        tipo,
        componente,
        descripcionComponente: leerCelda(row, 'DescripcionComponente'),
        metodoReparacion: leerCelda(row, 'MetodoReparacion') || (tipo === 'ASISTENCIA' ? 'AT' : 'RP'),
        naviera: leerCelda(row, 'Naviera') || 'ONE',
        tipoContenedor: tipoCont,
        descripcion: leerCelda(row, 'Descripcion'),
        descripcionHl: leerCelda(row, 'DescripcionHL'),
        descripcionBodeguero: leerCelda(row, 'DescripcionBodeguero'),
        largoMinimo: num(leerCelda(row, 'LargoMinimo')),
        largoMaximo: num(leerCelda(row, 'LargoMaximo')),
        areaMinima: num(leerCelda(row, 'AreaMinima')),
        areaMaxima: num(leerCelda(row, 'AreaMaxima')),
        unidad: leerCelda(row, 'Unidad') || (tipo === 'BOX' ? '19.5' : 'UN'),
        codigoSap: leerCelda(row, 'CodigoSap'),
        partNumber: leerCelda(row, 'PartNumber'),
        nombreUbicacion: leerCelda(row, 'NombreUbicacion'),
        marca: leerCelda(row, 'Marca'),
        ubicacion: leerCelda(row, 'Ubicacion'),
        horasHombre: num(leerCelda(row, 'HorasHombre')),
        costoMaterial: num(leerCelda(row, 'CostoMaterial')),
        omitirMultiplicacionHh: siNo(leerCelda(row, 'OmitirMultiplicacionHH')),
        omitirAsignacionMateriales: siNo(leerCelda(row, 'OmitirAsignacionMateriales')),
        materiales: [],
      };
      return draft;
    })
    .filter((row): row is TarifaIiclDraft => row != null);
}
