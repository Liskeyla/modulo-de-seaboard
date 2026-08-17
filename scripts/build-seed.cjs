#!/usr/bin/env node
/**
 * Genera src/data/estimacionesSeed.json a partir del export real del DMS de producción
 * ("Reporte de Estimaciones | RFS - DMS Ecuador.xlsx").
 *
 * Uso: node scripts/build-seed.cjs "<ruta del .xlsx>"
 *
 * El generador es determinista (PRNG sembrado con el código de estimación) para que
 * dos ejecuciones produzcan exactamente el mismo seed.
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const XLSX_PATH =
  process.argv[2] ||
  'C:/Users/lmacias/Downloads/Reporte de Estimaciones  RFS - DMS Ecuador.xlsx';
const OUT_PATH = path.join(__dirname, '..', 'src', 'data', 'estimacionesSeed.json');

const FOTOS_DIR = '/uploads/estimaciones/fotos';
const FOTOS_DANO = [1, 2, 3, 4, 5, 6, 7];
const FOTOS_REPARADO = [8, 9, 10, 11, 12, 13];

/** Estimación destacada: sus daños y fotos replican la pantalla real de producción. */
const CODIGO_DESTACADO = 'ERSBM-2026-179105';

/** Filas PENDIENTE reales que se reetiquetan para poder demostrar los 5 estados. */
const CONVERSIONES_ESTADO = {
  'ERSBM-2026-179090': 'ENVIADO',
  'ERSBM-2026-179096': 'ENVIADO',
  'ERSBM-2026-179102': 'ENVIADO',
  'ERSBM-2026-179107': 'ENVIADO',
  'ERSBM-2026-179131': 'RECHAZADO',
  'ERSBM-2026-179132': 'RECHAZADO',
};

// ---------------------------------------------------------------- utilidades

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashCode(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const clean = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
const num = (v) => {
  const n = Number(String(clean(v)).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n) => Math.round(n * 100) / 100;
const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];

/** Suma un desplazamiento en minutos a una fecha "dd/mm/yyyy hh:mm:ss". */
function sumarMinutos(fecha, minutos) {
  const m = clean(fecha).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return clean(fecha);
  const d = new Date(
    Number(m[3]),
    Number(m[2]) - 1,
    Number(m[1]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6] || 0)
  );
  d.setMinutes(d.getMinutes() + minutos);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(
    d.getMinutes()
  )}:${p(d.getSeconds())}`;
}

// ---------------------------------------------------------------- catálogos

const CATALOGO_MAQUINA = [
  { comp: 'SVL-R54', part: 'RP', ubic: 'mzznn', dano: 'RN-REPAIR NECESSARY', medida: 'UN' },
  { comp: 'CTP-CTL', part: 'RP', ubic: 'ctrlp', dano: 'CN-CONTROLLER FAIL', medida: 'UN' },
  { comp: 'SEN-AMB', part: 'RN', ubic: 'senrb', dano: 'ER-ERROR MARK', medida: 'UN' },
  { comp: 'CMP-SCR', part: 'RP', ubic: 'compz', dano: 'NF-NOT FUNCTIONING', medida: 'UN' },
  { comp: 'FAN-EVA', part: 'RN', ubic: 'evapf', dano: 'BR-BROKEN', medida: 'UN' },
  { comp: 'MOD-DRV', part: 'RP', ubic: 'drvpn', dano: 'LO-LOOSE', medida: 'UN' },
  { comp: 'CBL-460', part: 'RP', ubic: 'cblpw', dano: 'CU-CUT', medida: 'MT' },
  { comp: 'PTI-CTL', part: 'MR', ubic: 'ptipn', dano: 'SI-SHORT INSPECTION', medida: 'UN' },
];

const CATALOGO_ESTRUCTURAL = [
  { comp: 'PNL-LAT', part: 'PX', ubic: 'LX7N', dano: 'HO-HOLE', medida: 'CM' },
  { comp: 'PSO-TBL', part: 'RN', ubic: 'FL2C', dano: 'BR-BROKEN', medida: 'CM' },
  { comp: 'PRT-DER', part: 'WW', ubic: 'DR1R', dano: 'DY-DIRTY', medida: 'UN' },
  { comp: 'TCH-PNL', part: 'PX', ubic: 'TX12', dano: 'DT-DENT', medida: 'CM' },
  { comp: 'ESQ-SUP', part: 'RN', ubic: 'CP4L', dano: 'CR-CRACKED', medida: 'UN' },
  { comp: 'RIL-TBL', part: 'PX', ubic: 'TR3C', dano: 'BE-BENT', medida: 'CM' },
  { comp: 'POC-ZZZ', part: 'PX', ubic: 'POCZZ', dano: 'HO-HOLE', medida: 'CM' },
];

const OBS_MAQUINA = [
  'Componente con marcación de error en controladora',
  'Se evidencia holgura en bornera de fuerza',
  'Lectura fuera de rango en prueba PTI',
  'Sin continuidad eléctrica en el arnés',
  'Ruido anormal durante ciclo de enfriamiento',
  'Aislamiento deteriorado por vibración',
];

const OBS_ESTRUCTURAL = [
  'Perforación pasante en panel lateral',
  'Tabla de piso astillada en zona de carga',
  'Golpe con deformación mayor a 30 mm',
  'Óxido con pérdida de material en esquinero',
  'Riel deformado impide fijación de tabla',
  'Requiere parche tipo overlap segun norma IICL',
];

const USUARIOS_LIQUIDACIONES = ['cesarvalencia', 'jdefaz', 'lmedina'];

const SOLICITUDES = [
  {
    mensaje:
      'Favor validar la tarifa aplicada: el costo de material no coincide con el catálogo vigente 2026.',
    campo: 'Cs. Mat.',
  },
  {
    mensaje: 'La cantidad registrada no corresponde a la evidencia fotográfica. Confirmar unidades.',
    campo: 'Cant.',
  },
  {
    mensaje: 'Este daño debe ir con cargo a Dueño, no a Línea. Revisar responsabilidad del ítem.',
    campo: 'Cargo',
  },
  {
    mensaje: 'Falta el número de serie del componente entregado, sin ese dato no se puede liquidar.',
    campo: 'Número de Serie Entregado',
  },
  {
    mensaje: 'Las horas hombre exceden el estándar para este método de reparación. Justificar.',
    campo: 'H.H.',
  },
  {
    mensaje: 'El método de reparación debe ser RP y no RN según la política de la naviera.',
    campo: 'New Met. Rep.',
  },
  {
    mensaje: 'Adjuntar foto del reparado, no se evidencia el trabajo terminado en el ítem.',
    campo: 'Fotos',
  },
];

const RESPUESTAS = [
  'Tarifa corregida según catálogo vigente. Se ajustó el costo de material del ítem.',
  'Confirmado en patio con el técnico: se actualizó la cantidad del ítem.',
  'Se reclasificó el cargo con la evidencia fotográfica adjunta.',
  'Número de serie cargado, el componente fue entregado a bodega.',
  'Horas justificadas: se requirió desmontaje completo para acceder al componente.',
  'Método de reparación actualizado conforme a la política de la naviera.',
  'Foto del reparado adjuntada al ítem.',
];

const CIERRES_OK = [
  'Cambio verificado. Ítem habilitado para facturación.',
  'Conforme con el ajuste, procede la liquidación del ítem.',
  'Validado contra catálogo. Sin observaciones adicionales.',
];

// ---------------------------------------------------------------- daños

function fotosDe(rnd, codigo, seccion, incluirReparado) {
  const fotos = [];
  const nDano = 1 + Math.floor(rnd() * 2);
  for (let i = 0; i < nDano; i += 1) {
    const n = pick(rnd, FOTOS_DANO);
    fotos.push({
      id: `${codigo}-fd-${seccion}-${i}-${n}`,
      url: `${FOTOS_DIR}/foto_${n}.jpg`,
      tipo: 'DANO',
      descripcion: 'Evidencia del daño registrado en inspección',
      fecha: '17/08/2026 08:48:02',
    });
  }
  if (incluirReparado) {
    const n = pick(rnd, FOTOS_REPARADO);
    fotos.push({
      id: `${codigo}-fr-${seccion}-${n}`,
      url: `${FOTOS_DIR}/foto_${n}.jpg`,
      tipo: 'REPARADO',
      descripcion: 'Evidencia del trabajo terminado',
      fecha: '17/08/2026 14:20:11',
    });
  }
  return fotos;
}

function comentariosDe(rnd, codigo, linea, tecnico, estado) {
  // Solo una parte de las líneas tiene conversación con liquidaciones.
  const dado = rnd();
  if (dado > 0.42) return [];

  const idx = Math.floor(rnd() * SOLICITUDES.length);
  const solicitud = SOLICITUDES[idx];
  const analista = pick(rnd, USUARIOS_LIQUIDACIONES);
  const base = `17/08/2026 1${Math.floor(rnd() * 5)}:${String(Math.floor(rnd() * 60)).padStart(2, '0')}`;
  const hilo = [
    {
      id: `${codigo}-l${linea}-c1`,
      usuario: analista,
      rol: 'LIQUIDACIONES',
      fecha: `${base}:12`,
      tipo: 'SOLICITA_CAMBIO',
      mensaje: solicitud.mensaje,
      campoAfectado: solicitud.campo,
    },
  ];

  // Las estimaciones que ya avanzaron en el flujo muestran el hilo resuelto.
  const avanzada = ['APROBADO', 'REPARADO'].includes(estado);
  if (avanzada || rnd() > 0.35) {
    hilo.push({
      id: `${codigo}-l${linea}-c2`,
      usuario: tecnico,
      rol: 'TECNICO',
      fecha: `${base}:48`,
      tipo: 'INFORMATIVO',
      mensaje: RESPUESTAS[idx],
    });
  }
  if (avanzada) {
    hilo.push({
      id: `${codigo}-l${linea}-c3`,
      usuario: analista,
      rol: 'LIQUIDACIONES',
      fecha: `${base}:59`,
      tipo: 'ACEPTADO',
      mensaje: pick(rnd, CIERRES_OK),
    });
  } else if (rnd() > 0.75) {
    hilo.push({
      id: `${codigo}-l${linea}-c3`,
      usuario: 'seaboard',
      rol: 'SEABOARD',
      fecha: `${base}:59`,
      tipo: 'RECHAZADO',
      mensaje:
        'No se acepta la justificación presentada. El ítem queda fuera de la liquidación hasta nueva revisión.',
    });
  }
  return hilo;
}

/** Reparte un monto en n partes con pesos aleatorios, cuadrando el residuo en la última. */
function repartir(rnd, total, n) {
  if (n <= 1) return [round2(total)];
  const pesos = Array.from({ length: n }, () => 0.5 + rnd());
  const suma = pesos.reduce((a, b) => a + b, 0);
  const partes = pesos.map((p) => round2((total * p) / suma));
  const dif = round2(total - partes.reduce((a, b) => a + b, 0));
  partes[partes.length - 1] = round2(partes[partes.length - 1] + dif);
  return partes;
}

function danosDestacado() {
  // Réplica exacta del "Listado de Daños" de ERSBM-2026-179105 en producción.
  const fotos = FOTOS_DANO.map((n) => ({
    id: `dst-fd-${n}`,
    url: `${FOTOS_DIR}/foto_${n}.jpg`,
    tipo: 'DANO',
    descripcion: 'Panel de control de drive — componentes R54 sueltos',
    fecha: '17/08/2026 08:48:02',
  })).concat(
    FOTOS_REPARADO.map((n) => ({
      id: `dst-fr-${n}`,
      url: `${FOTOS_DIR}/foto_${n}.jpg`,
      tipo: 'REPARADO',
      descripcion: 'Ajuste y fijación de bushing en panel de control',
      fecha: '17/08/2026 09:05:44',
    }))
  );

  return [
    {
      id: 'dst-l1',
      linea: 1,
      comp: 'SVL-R54',
      partNumber: 'RP',
      ubicacion: 'mzznn',
      dano: 'RN-REPAIR NECESSARY',
      obsAnalisis: 'R54 activos',
      metRep: '',
      newMetRep: 'RP',
      serieAnterior: 'N/A',
      serieEntregado: '',
      largo: 0,
      ancho: 0,
      area: 0,
      longitud: 0,
      cantidad: 1,
      horasHombre: 0.5,
      csHoraHombre: 20,
      csMaterial: 0,
      csTotal: 20,
      cargo: 'Línea',
      aplica: 'Aprobado Linea',
      medida: '',
      remark: '',
      contenedorDonante: '',
      tieneVideo: true,
      seccion: 'MAQUINA',
      fotos,
      comentarios: [
        {
          id: 'dst-l1-c1',
          usuario: 'cesarvalencia',
          rol: 'LIQUIDACIONES',
          fecha: '17/08/2026 09:14:22',
          tipo: 'SOLICITA_CAMBIO',
          mensaje:
            'El estimado llega como SVL pero el análisis indica bushing de drive control panel sueltos. Confirmar si aplica servicio o debe pasar a garantía antes de liquidar.',
          campoAfectado: 'Actividad',
        },
        {
          id: 'dst-l1-c2',
          usuario: 'maguilar',
          rol: 'TECNICO',
          fecha: '17/08/2026 09:41:07',
          tipo: 'INFORMATIVO',
          mensaje:
            'Revisado en patio: los R54 están activos y el bushing solo requiere reajuste, no reemplazo. Se mantiene SVL con 0.50 H.H.',
        },
        {
          id: 'dst-l1-c3',
          usuario: 'cesarvalencia',
          rol: 'LIQUIDACIONES',
          fecha: '17/08/2026 10:02:35',
          tipo: 'SOLICITA_CAMBIO',
          mensaje:
            'De acuerdo con el diagnóstico. Falta cargar la foto del reparado para cerrar el ítem y habilitar la facturación a la línea.',
          campoAfectado: 'Fotos',
        },
      ],
    },
  ];
}

function generarDanos(row, estado) {
  const codigo = clean(row.Codigo);
  if (codigo === CODIGO_DESTACADO) return danosDestacado();

  const rnd = mulberry32(hashCode(codigo));
  const esMaquina = clean(row['Tipo de Estimación']).toUpperCase().startsWith('M');
  const catalogo = esMaquina ? CATALOGO_MAQUINA : CATALOGO_ESTRUCTURAL;
  const observaciones = esMaquina ? OBS_MAQUINA : OBS_ESTRUCTURAL;

  const pvpHH = num(row['PVP Horas Hombre']);
  const pvpMat = num(row['PVP Materiales']);
  const hhTotal = num(row['Horas Hombre']);
  const total = num(row['PVP Total']);
  if (total === 0 && pvpHH === 0 && pvpMat === 0) return [];

  const nLineas = total < 25 ? 1 : total < 90 ? 2 : total < 220 ? 3 : 4;
  const n = Math.min(nLineas, catalogo.length);

  const partesHH = repartir(rnd, pvpHH, n);
  const partesMat = repartir(rnd, pvpMat, n);
  const partesHoras = repartir(rnd, hhTotal, n);

  const usados = new Set();
  const danos = [];
  for (let i = 0; i < n; i += 1) {
    let item = pick(rnd, catalogo);
    let intentos = 0;
    while (usados.has(item.comp) && intentos < 12) {
      item = pick(rnd, catalogo);
      intentos += 1;
    }
    usados.add(item.comp);

    const csHH = partesHH[i];
    const csMat = partesMat[i];
    const conMedidas = !esMaquina && item.medida === 'CM';
    const largo = conMedidas ? round2(20 + rnd() * 80) : 0;
    const ancho = conMedidas ? round2(15 + rnd() * 60) : 0;
    const reemplazo = item.part === 'RP' || item.part === 'RN';

    danos.push({
      id: `${codigo}-l${i + 1}`,
      linea: i + 1,
      comp: item.comp,
      partNumber: item.part,
      ubicacion: item.ubic,
      dano: item.dano,
      obsAnalisis: pick(rnd, observaciones),
      metRep: rnd() > 0.6 ? item.part : '',
      newMetRep: item.part,
      serieAnterior: reemplazo && esMaquina ? `SN-${Math.floor(rnd() * 900000 + 100000)}` : 'N/A',
      serieEntregado: reemplazo && esMaquina && rnd() > 0.4 ? `SN-${Math.floor(rnd() * 900000 + 100000)}` : '',
      largo,
      ancho,
      area: conMedidas ? round2((largo * ancho) / 10000) : 0,
      longitud: conMedidas ? round2(largo) : 0,
      cantidad: rnd() > 0.78 ? 2 : 1,
      horasHombre: partesHoras[i],
      csHoraHombre: csHH,
      csMaterial: csMat,
      csTotal: round2(csHH + csMat),
      cargo: clean(row.Actividad) === 'WTY' ? 'Garantía' : rnd() > 0.82 ? 'Dueño' : 'Línea',
      aplica:
        estado === 'RECHAZADO'
          ? 'Rechazado'
          : estado === 'ENVIADO'
            ? 'Pendiente Revisión'
            : clean(row.Actividad) === 'WTY'
              ? 'Aprobado Dueño'
              : 'Aprobado Linea',
      medida: item.medida,
      remark: rnd() > 0.72 ? pick(rnd, ['APLICAR PARCHE OVERLAP', 'LAVADO SIMPLE', 'PTI / SHORT PTI', 'REVISAR EN PATIO']) : '',
      contenedorDonante: reemplazo && rnd() > 0.88 ? `SMLU${Math.floor(rnd() * 9000000 + 1000000)}` : '',
      tieneVideo: rnd() > 0.55,
      seccion: esMaquina ? 'MAQUINA' : 'ESTRUCTURAL',
      fotos: fotosDe(rnd, codigo, i, ['APROBADO', 'REPARADO'].includes(estado)),
      comentarios: comentariosDe(rnd, codigo, i + 1, clean(row['Técnico de Estimación']), estado),
    });
  }
  return danos;
}

// ---------------------------------------------------------------- estimación

function construirEstimacion(row, index) {
  const codigo = clean(row.Codigo);
  const rnd = mulberry32(hashCode(`${codigo}-meta`));
  const estadoOriginal = clean(row.Estado).toUpperCase();
  const estado = CONVERSIONES_ESTADO[codigo] || estadoOriginal;
  const convertido = Boolean(CONVERSIONES_ESTADO[codigo]);

  const actividadRaw = clean(row.Actividad).toUpperCase();
  const actividad = ['WTY', 'SVL', 'DM'].includes(actividadRaw) ? actividadRaw : 'NO APLICA';

  const danos = generarDanos(row, estado);
  const tecnico = clean(row['Técnico de Estimación']);
  const fechaElab = clean(row['Fecha de Elaboración']);
  const fechaMod = clean(row['Fecha de modificación']);
  const modInvalida = fechaMod.startsWith('0001-01-01');

  const auditoria = [
    {
      id: `${codigo}-a1`,
      fecha: clean(row['Fecha GateIn']),
      usuario: 'sistema',
      accion: 'GATE IN',
      detalle: `Ingreso del contenedor ${clean(row.Contenedor)} a ${clean(row['Lugar de Estimación'])}`,
    },
    {
      id: `${codigo}-a2`,
      fecha: fechaElab,
      usuario: tecnico,
      accion: 'CREACIÓN DE ESTIMADO',
      detalle: `Estimado ${codigo} creado como tipo ${clean(row['Tipo de Estimación'])} con ${danos.length} línea(s) de daño`,
    },
  ];

  if (clean(row['Estado PTI'])) {
    auditoria.push({
      id: `${codigo}-a3`,
      fecha: clean(row['Fecha Fin PTI']),
      usuario: tecnico,
      accion: 'FIN DE PTI',
      detalle: `Prueba PTI finalizada con estado ${clean(row['Estado PTI'])}`,
    });
  }

  const comentariosSeaboard = [];
  const fechaEnvio = convertido ? sumarMinutos(fechaElab, 12) : clean(row['Fecha Envio']);
  const fechaAprobacion = convertido ? '' : clean(row['Fecha Aprobacion']);

  if (['ENVIADO', 'APROBADO', 'REPARADO', 'RECHAZADO'].includes(estado) && fechaEnvio) {
    comentariosSeaboard.push({
      id: `${codigo}-s1`,
      fecha: fechaEnvio,
      usuario: tecnico,
      accion: 'ENVIAR',
      comentario: 'Estimado enviado a aprobación de la naviera.',
    });
    auditoria.push({
      id: `${codigo}-a4`,
      fecha: fechaEnvio,
      usuario: tecnico,
      accion: 'ENVÍO A APROBACIÓN',
      detalle: `Enviado a ${clean(row.Naviera)} por un total de $${clean(row['PVP Total'])}`,
    });
  }

  if (['APROBADO', 'REPARADO'].includes(estado) && fechaAprobacion) {
    const aprobador = modInvalida ? 'seaboard' : clean(row['Usuario de Modificación']);
    comentariosSeaboard.push({
      id: `${codigo}-s2`,
      fecha: fechaAprobacion,
      usuario: aprobador,
      accion: 'APROBAR',
      comentario: 'Estimado aprobado sin novedades por la naviera.',
    });
    auditoria.push({
      id: `${codigo}-a5`,
      fecha: fechaAprobacion,
      usuario: aprobador,
      accion: 'APROBACIÓN',
      detalle: 'La naviera aprobó el estimado. Habilitado para reparación.',
    });
  }

  if (estado === 'REPARADO' && clean(row['Fecha de Reparación'])) {
    auditoria.push({
      id: `${codigo}-a6`,
      fecha: clean(row['Fecha de Reparación']),
      usuario: tecnico,
      accion: 'REPARACIÓN FINALIZADA',
      detalle: 'Trabajos ejecutados y evidencias de reparado cargadas.',
    });
  }

  if (estado === 'RECHAZADO') {
    comentariosSeaboard.push({
      id: `${codigo}-s2`,
      fecha: sumarMinutos(fechaEnvio, 45),
      usuario: 'seaboard',
      accion: 'RECHAZAR',
      comentario:
        'Estimado rechazado: los valores de material no coinciden con el catálogo vigente. Corregir y reenviar.',
    });
    auditoria.push({
      id: `${codigo}-a5`,
      fecha: sumarMinutos(fechaEnvio, 45),
      usuario: 'seaboard',
      accion: 'RECHAZO',
      detalle: 'La naviera rechazó el estimado. Requiere corrección del técnico.',
    });
  }

  const notas = [];
  const obs = clean(row['Análisis de observación']);
  if (obs) {
    notas.push({
      id: `${codigo}-n1`,
      fecha: fechaElab,
      usuario: tecnico,
      texto: obs,
    });
  }
  if (codigo === CODIGO_DESTACADO) {
    notas.push({ id: `${codigo}-n2`, fecha: '17/08/2026 08:53:31', usuario: tecnico, texto: 'RS4 activos' });
  }

  const enGarantia = actividad === 'WTY';
  const esMaquina = clean(row['Tipo de Estimación']).toUpperCase().startsWith('M');

  return {
    id: `est-${String(index + 1).padStart(3, '0')}`,
    codigo,
    semana: num(row.Semana),
    anio: num(row['Año']),
    estado,
    contenedor: clean(row.Contenedor),
    modeloMaquina: clean(row['Modelo Maquina']),
    codigoRfs: clean(row['Código RFS']),
    naviera: clean(row.Naviera),
    actividad,
    lugarEstimacion: clean(row['Lugar de Estimación']),
    lugarAsistencia: clean(row['Lugar de Asistencia']),
    fechaGateIn: clean(row['Fecha GateIn']),
    fechaElaboracion: fechaElab,
    fechaReparacion: convertido ? '' : clean(row['Fecha de Reparación']),
    tipoEstimacion: clean(row['Tipo de Estimación']),
    tecnico,
    horasHombre: num(row['Horas Hombre']),
    pvpHorasHombre: num(row['PVP Horas Hombre']),
    pvpMateriales: num(row['PVP Materiales']),
    pvpTotal: num(row['PVP Total']),
    estadoPti: clean(row['Estado PTI']),
    fechaFinPti: clean(row['Fecha Fin PTI']),
    enviarAprobacion: estado === 'PENDIENTE' ? 'NO' : 'SI',
    fechaEnvio,
    fechaAprobacion,
    fechaRevision: '',
    ediEnviadoOne: clean(row['EDI Enviado ONE']) || 'NO',
    fechaEnvioEdiOne: clean(row['Fecha Envio EDI ONE']),
    niveles: clean(row.Niveles),
    diasEstadia: num(row['Dias Estadia']),
    tipoDano: clean(row['Tipo de Daño']),
    analisisObservacion: obs,
    fechaModificacion: modInvalida ? '' : fechaMod.slice(0, 19),
    usuarioModificacion: clean(row['Usuario de Modificación']) === 'N/A' ? '' : clean(row['Usuario de Modificación']),
    sinDanos: danos.length === 0,
    buque: pick(rnd, ['SEABOARD OCEAN', 'SEABOARD GEMINI', 'ONE MADRID', 'SEABOARD PACER']),
    viaje: `V-${Math.floor(rnd() * 400 + 100)}${pick(rnd, ['N', 'S'])}`,
    tipoContenedor: esMaquina ? 'REEFER' : clean(row['Código RFS']).includes('DC') ? 'DRY' : 'REEFER',
    itinerarioSap: '',
    almacenSap: '',
    garantia: {
      enGarantia,
      proveedor: enGarantia ? clean(row['Modelo Maquina']) : '',
      fechaInicio: enGarantia ? '01/01/2026' : '',
      fechaFin: enGarantia ? '31/12/2026' : '',
      ordenGarantia: enGarantia ? `WTY-${clean(row.Codigo).slice(-6)}` : '',
      observacion: enGarantia
        ? 'Componente dentro del período de garantía del fabricante. No se factura a la línea.'
        : 'Este daño no tiene información de garantía asociada.',
    },
    inspeccion: {
      codigo: `INSP-${clean(row.Codigo).slice(-6)}`,
      fecha: clean(row['Fecha GateIn']),
      inspector: tecnico,
      resultado: danos.length === 0 ? 'SIN DAÑOS' : 'CON DAÑOS',
      observacion:
        obs || 'Inspección de ingreso ejecutada en patio sin observaciones adicionales.',
    },
    danos,
    notas,
    auditoria,
    comentariosSeaboard,
  };
}

// ---------------------------------------------------------------- main

const wb = XLSX.readFile(XLSX_PATH);
const ws = wb.Sheets[wb.SheetNames[0]];
const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
const headers = aoa[1].map((h) => clean(h));

const filas = aoa
  .slice(2)
  .filter((r) => clean(r[1]))
  .map((r) => {
    const o = {};
    headers.forEach((h, i) => {
      if (h && h !== 'Acciones') o[h] = clean(r[i]);
    });
    return o;
  });

const estimaciones = filas.map(construirEstimacion);

fs.writeFileSync(OUT_PATH, `${JSON.stringify(estimaciones, null, 2)}\n`, 'utf8');

const porEstado = estimaciones.reduce((acc, e) => {
  acc[e.estado] = (acc[e.estado] || 0) + 1;
  return acc;
}, {});
const totalDanos = estimaciones.reduce((a, e) => a + e.danos.length, 0);
const totalComentarios = estimaciones.reduce(
  (a, e) => a + e.danos.reduce((b, d) => b + d.comentarios.length, 0),
  0
);

console.log(`Seed escrito en ${OUT_PATH}`);
console.log(`  Estimaciones : ${estimaciones.length}`);
console.log(`  Por estado   : ${JSON.stringify(porEstado)}`);
console.log(`  Líneas daño  : ${totalDanos}`);
console.log(`  Comentarios  : ${totalComentarios}`);
console.log(`  Sin daños    : ${estimaciones.filter((e) => e.sinDanos).length}`);
