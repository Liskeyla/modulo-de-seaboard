import {
  TARIFA_HORA_HOMBRE_USD,
  type ResultadoCargaMasiva,
  type TarifaIicl,
  type TarifaIiclDraft,
  type TipoTarifa,
} from '@/types/tarifario';

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function costoHorasHombre(t: Pick<TarifaIicl, 'horasHombre' | 'omitirMultiplicacionHh'>) {
  if (t.omitirMultiplicacionHh) return 0;
  return round2((Number(t.horasHombre) || 0) * TARIFA_HORA_HOMBRE_USD);
}

export function costoTotal(t: Pick<TarifaIicl, 'horasHombre' | 'costoMaterial' | 'omitirMultiplicacionHh'>) {
  return round2((Number(t.costoMaterial) || 0) + costoHorasHombre(t));
}

export function asignacionMateriales(t: Pick<TarifaIicl, 'omitirAsignacionMateriales'>) {
  return t.omitirAsignacionMateriales ? 'NO' : 'SI';
}

export function formatUsd(n: number) {
  return `$ ${round2(n).toFixed(2)}`;
}

export function hoyIso() {
  return new Date().toISOString().slice(0, 10);
}

export function tarifaVacia(tipo: TipoTarifa): TarifaIiclDraft {
  return {
    tipo,
    componente: '',
    descripcionComponente: '',
    metodoReparacion: tipo === 'ASISTENCIA' ? 'AT' : 'RP',
    naviera: 'ONE',
    tipoContenedor: 'REEFER',
    descripcion: '',
    descripcionHl: '',
    descripcionBodeguero: '',
    largoMinimo: 0,
    largoMaximo: 0,
    areaMinima: 0,
    areaMaxima: 0,
    unidad: tipo === 'BOX' ? '19.5' : 'UN',
    codigoSap: '',
    partNumber: '',
    nombreUbicacion: '',
    marca: tipo === 'MAQUINA' ? 'Starcool' : '',
    ubicacion: '',
    horasHombre: 0,
    costoMaterial: 0,
    omitirMultiplicacionHh: false,
    omitirAsignacionMateriales: tipo === 'MAQUINA',
    materiales: [],
  };
}

export function validarTarifa(t: TarifaIiclDraft): string[] {
  const errores: string[] = [];
  if (!t.componente.trim()) errores.push('El campo "Componente" es obligatorio.');
  if (!t.descripcion.trim()) errores.push('El campo "Descripción" es obligatorio.');
  if (!t.naviera.trim()) errores.push('El campo "Naviera" es obligatorio.');
  if (t.tipo !== 'ASISTENCIA' && !t.metodoReparacion.trim()) {
    errores.push('El campo "Método de Reparación" es obligatorio.');
  }
  if (t.tipo === 'MAQUINA' && !t.partNumber.trim()) {
    errores.push('El campo "Part Number" es obligatorio.');
  }
  if (Number.isNaN(Number(t.horasHombre)) || Number(t.horasHombre) < 0) {
    errores.push('Horas Hombre debe ser un número válido y no negativo.');
  }
  if (Number.isNaN(Number(t.costoMaterial)) || Number(t.costoMaterial) < 0) {
    errores.push('Costo de Materiales debe ser un número válido y no negativo.');
  }
  t.materiales.forEach((m, i) => {
    if (!m.materialSap.trim()) errores.push(`Material ${i + 1}: "Material SAP" está vacío.`);
    if (Number.isNaN(Number(m.cantidad)) || Number(m.cantidad) < 0) {
      errores.push(`Material ${i + 1}: "Cantidad" debe ser un número válido.`);
    }
  });
  return errores;
}

export function claveTarifa(t: Pick<TarifaIicl, 'tipo' | 'componente' | 'metodoReparacion' | 'naviera' | 'partNumber' | 'descripcion'>) {
  const base = [t.tipo, t.naviera, t.componente].map((x) => String(x).trim().toUpperCase());
  if (t.tipo === 'MAQUINA') return [...base, String(t.partNumber).trim().toUpperCase()].join('|');
  return [...base, String(t.metodoReparacion).trim().toUpperCase(), String(t.descripcion).trim().toUpperCase()].join('|');
}

export function aplicarCargaMasiva(
  actuales: TarifaIicl[],
  filas: TarifaIiclDraft[],
  uidFn: () => string
): { next: TarifaIicl[]; resultado: ResultadoCargaMasiva } {
  const next = actuales.map((t) => ({ ...t, materiales: [...t.materiales] }));
  const index = new Map(next.map((t, i) => [claveTarifa(t), i]));
  const errores: string[] = [];
  let insertados = 0;
  let actualizados = 0;

  filas.forEach((fila, idx) => {
    const filaN = idx + 2;
    const errs = validarTarifa(fila);
    if (errs.length) {
      errores.push(`Fila ${filaN}: ${errs.join(' ')}`);
      return;
    }
    const key = claveTarifa(fila);
    const hit = index.get(key);
    if (hit != null) {
      const prev = next[hit];
      next[hit] = {
        ...prev,
        ...fila,
        id: prev.id,
        materiales: prev.materiales,
        fechaActualizacion: hoyIso(),
      };
      actualizados += 1;
    } else {
      const created: TarifaIicl = {
        ...tarifaVacia(fila.tipo),
        ...fila,
        id: uidFn(),
        fechaActualizacion: hoyIso(),
        materiales: [],
      };
      index.set(key, next.length);
      next.push(created);
      insertados += 1;
    }
  });

  return { next, resultado: { insertados, actualizados, errores } };
}

export function headersTabla(tipo: TipoTarifa): string[] {
  if (tipo === 'BOX') {
    return [
      'Componente',
      'Descripción Componente',
      'Largo Mínimo',
      'Largo Máximo',
      'Área Mínima',
      'Área Máxima',
      'Unidad',
      'Tipo Contenedor',
      'Naviera',
      'Descripción HL',
      'Descripción',
      'Método de Reparación',
      'Costo Material',
      'Horas Hombre',
      'Costo Horas Hombre',
      'Costo Total',
      'Asignación Materiales',
    ];
  }
  if (tipo === 'MAQUINA') {
    return [
      'Componente',
      'Descripción Componente',
      'Reparación',
      'Código SAP',
      'Part Number',
      'Nombre Ubicación',
      'Marca',
      'Naviera',
      'Descripción',
      'Método de Reparación',
      'Costo Material',
      'Horas Hombre',
      'Costo Horas Hombre',
      'Costo Total',
      'Asignación Materiales',
    ];
  }
  return [
    'Componente',
    'Descripción Componente',
    'Naviera',
    'Tipo Contenedor',
    'Descripción',
    'Método',
    'Costo Material',
    'Horas Hombre',
    'Costo Horas Hombre',
    'Costo Total',
    'Asignación Materiales',
  ];
}

export function filaExcel(t: TarifaIicl): (string | number)[] {
  const hh = costoHorasHombre(t);
  const total = costoTotal(t);
  const asig = asignacionMateriales(t);
  if (t.tipo === 'BOX') {
    return [
      t.componente,
      t.descripcionComponente,
      t.largoMinimo,
      t.largoMaximo,
      t.areaMinima,
      t.areaMaxima,
      t.unidad,
      t.tipoContenedor,
      t.naviera,
      t.descripcionHl,
      t.descripcion,
      t.metodoReparacion,
      round2(t.costoMaterial),
      t.horasHombre,
      hh,
      total,
      asig,
    ];
  }
  if (t.tipo === 'MAQUINA') {
    return [
      t.componente,
      t.descripcionComponente,
      t.codigoSap,
      t.codigoSap,
      t.partNumber,
      t.nombreUbicacion,
      t.marca,
      t.naviera,
      t.descripcion,
      t.metodoReparacion,
      round2(t.costoMaterial),
      t.horasHombre,
      hh,
      total,
      asig,
    ];
  }
  return [
    t.componente,
    t.descripcionComponente,
    t.naviera,
    t.tipoContenedor,
    t.descripcion,
    t.metodoReparacion,
    round2(t.costoMaterial),
    t.horasHombre,
    hh,
    total,
    asig,
  ];
}
