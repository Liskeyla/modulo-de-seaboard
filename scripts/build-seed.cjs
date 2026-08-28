#!/usr/bin/env node
/**
 * Genera src/data/estimacionesSeed.json a partir de los export del DMS:
 * Ecuador ("Reporte de Estimaciones | RFS - DMS Ecuador.xlsx")
 * y Perú ("Reporte de Estimaciones | DMS - RFS Perú.xlsx").
 *
 * Uso: node scripts/build-seed.cjs [xlsx-ecuador] [xlsx-peru]
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
const XLSX_PERU =
  process.argv[3] ||
  'C:/Users/lmacias/Downloads/Reporte de Estimaciones  DMS - RFS Perú.xlsx';
const OUT_PATH = path.join(__dirname, '..', 'src', 'data', 'estimacionesSeed.json');
const TARIFA_HH_PE = 6.8;

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

/** Componentes IICL tomados de los PDF de Callao. */
const CATALOGO_BOX_PE = [
  { comp: 'MSD', part: 'RP', ubic: 'FX2N', dano: 'BR-BROKEN', medida: 'UN' },
  { comp: 'RLA', part: 'SE', ubic: 'FX14', dano: 'PH-PUNCTURED', medida: 'CM' },
  { comp: 'DKK', part: 'RP', ubic: 'UL1N', dano: 'MS-MISSING', medida: 'UN' },
  { comp: 'DKA', part: 'RP', ubic: 'BX1N', dano: 'BR-BROKEN', medida: 'UN' },
  { comp: 'LBH', part: 'GS', ubic: 'DX23', dano: 'BT-BENT', medida: 'UN' },
  { comp: 'PIC', part: 'GS', ubic: 'RB3N', dano: 'BT-BENT', medida: 'CM' },
  { comp: 'PNL', part: 'PX', ubic: 'LX7N', dano: 'HO-HOLE', medida: 'CM' },
];

const BUQUES_EC = ['SEABOARD OCEAN', 'SEABOARD GEMINI', 'ONE MADRID', 'SEABOARD PACER'];
const BUQUES_PE = ['SEABOARD VICTORY', 'SEABOARD OCEAN', 'SEABOARD GEMINI'];

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

function fotoPe(codigoCorto, n, tipo, desc, fecha) {
  return {
    id: `pe-${codigoCorto}-${tipo}-${n}`,
    url: `${FOTOS_DIR}/pe_${codigoCorto}_${String(n).padStart(2, '0')}.jpg`,
    tipo,
    descripcion: desc,
    fecha,
  };
}

function fotoEc(codigoCorto, n, tipo, desc, fecha) {
  return {
    id: `ec-${codigoCorto}-${tipo}-${n}`,
    url: `${FOTOS_DIR}/ec_${codigoCorto}_${String(n).padStart(2, '0')}.jpg`,
    tipo,
    descripcion: desc,
    fecha,
  };
}

function lineaPdf(opts) {
  const {
    codigo,
    linea,
    comp,
    ubic,
    dano,
    met,
    desc,
    cant,
    largo = 0,
    ancho = 0,
    longitud = 0,
    hh,
    csHH,
    csMat,
    estado,
    fotos,
    partNumber,
    seccion,
    tieneVideo,
    archivos,
    medida,
  } = opts;
  const conMedidas = largo > 0 || ancho > 0 || longitud > 0;
  const long = longitud || (largo && !ancho ? largo : conMedidas ? round2(largo) : 0);
  return {
    id: `${codigo}-l${linea}`,
    linea,
    comp,
    partNumber: partNumber ?? '-',
    ubicacion: ubic,
    dano,
    obsAnalisis: desc,
    metRep: '',
    newMetRep: met,
    serieAnterior: 'N/A',
    serieEntregado: '',
    largo,
    ancho,
    area: largo && ancho ? round2((largo * ancho) / 10000) : 0,
    longitud: long,
    cantidad: cant,
    horasHombre: hh,
    csHoraHombre: csHH,
    csMaterial: csMat,
    csTotal: round2(csHH + csMat),
    cargo: 'Línea',
    aplica: estado === 'ENVIADO' ? 'Pendiente de revisión' : 'Aprobado',
    medida: medida || (conMedidas ? 'CM' : 'UN'),
    remark: '',
    contenedorDonante: '',
    tieneVideo: Boolean(tieneVideo),
    seccion: seccion || 'ESTRUCTURAL',
    fotos,
    comentarios: opts.comentarios || [],
    ...(archivos ? { archivos } : {}),
  };
}

function danosPdfPeru(codigo) {
  if (codigo === 'ERSBM-2026-121881') {
    return [
      lineaPdf({
        codigo,
        linea: 1,
        comp: 'MSD',
        ubic: 'FX2N',
        dano: 'BR-BROKEN',
        met: 'RP',
        desc: 'UNIT.NUMBER,PREFIX-RP',
        cant: 1,
        hh: 0.33,
        csHH: 2.21,
        csMat: 0.51,
        estado: 'REPARADO',
        fotos: [
          fotoPe('121881', 1, 'DANO', 'Prefijo / número de unidad dañado', '16/08/2026 08:10:53'),
          fotoPe('121881', 2, 'DANO', 'Detalle del componente MSD en FX2N', '16/08/2026 08:10:53'),
          fotoPe('121881', 3, 'DANO', 'Evidencia del daño BR en inspección Callao', '16/08/2026 08:10:53'),
          fotoPe('121881', 8, 'REPARADO', 'Reemplazo RP ejecutado', '16/08/2026 14:20:00'),
        ],
      }),
    ];
  }
  if (codigo === 'ERSBM-2026-121880') {
    return [
      lineaPdf({
        codigo,
        linea: 1,
        comp: 'RLA',
        ubic: 'FX14',
        dano: 'PH-PUNCTURED',
        met: 'SE',
        desc: 'TUNNEL RAIL-IT',
        cant: 1,
        largo: 15,
        hh: 0.25,
        csHH: 1.7,
        csMat: 6.3,
        estado: 'REPARADO',
        fotos: [
          fotoPe('121880', 1, 'DANO', 'Tunnel rail con perforación', '16/08/2026 08:04:59'),
          fotoPe('121880', 2, 'DANO', 'Detalle RLA en FX14', '16/08/2026 08:04:59'),
          fotoPe('121880', 8, 'REPARADO', 'Sección SE ejecutada en riel', '16/08/2026 14:10:00'),
        ],
      }),
      lineaPdf({
        codigo,
        linea: 2,
        comp: 'DKK',
        ubic: 'UL1N',
        dano: 'MS-MISSING',
        met: 'RP',
        desc: 'DRAIN VALVE(KAZOO)',
        cant: 1,
        hh: 0.2,
        csHH: 1.36,
        csMat: 6.0,
        estado: 'REPARADO',
        fotos: [
          fotoPe('121880', 4, 'DANO', 'Válvula de drenaje faltante', '16/08/2026 08:04:59'),
          fotoPe('121880', 5, 'DANO', 'Detalle DKK en UL1N', '16/08/2026 08:04:59'),
        ],
      }),
    ];
  }
  if (codigo === 'ERSBM-2026-121883') {
    return [
      lineaPdf({
        codigo,
        linea: 1,
        comp: 'DKA',
        ubic: 'BX1N',
        dano: 'BR-BROKEN',
        met: 'RP',
        desc: 'ASSEMBLE DRAIN VALVE-RP',
        cant: 2,
        hh: 0.4,
        csHH: 2.72,
        csMat: 17.0,
        estado: 'APROBADO',
        fotos: [
          fotoPe('121883', 1, 'DANO', 'Ensamble de válvula de drenaje roto', '16/08/2026 08:23:10'),
          fotoPe('121883', 2, 'DANO', 'Detalle DKA en BX1N', '16/08/2026 08:23:10'),
        ],
        comentarios: [
          {
            id: 'pe-121883-l1-c1',
            usuario: 'cesarvalencia',
            rol: 'LIQUIDACIONES',
            fecha: '16/08/2026 09:12:04',
            tipo: 'SOLICITA_CAMBIO',
            mensaje:
              'Confirmar si el ensamble DKA se factura a línea: el PDF de Callao indica cargo Línea y 2 unidades.',
            campoAfectado: 'Cargo',
          },
          {
            id: 'pe-121883-l1-c2',
            usuario: 'jgonzalez',
            rol: 'TECNICO',
            fecha: '16/08/2026 09:31:18',
            tipo: 'INFORMATIVO',
            mensaje:
              'Confirmado en patio Callao: dos válvulas de drenaje rotas, método RP. Se mantiene cargo a la línea.',
          },
        ],
      }),
      lineaPdf({
        codigo,
        linea: 2,
        comp: 'LBH',
        ubic: 'DX23',
        dano: 'BT-BENT',
        met: 'GS',
        desc: 'HANDLE-RP',
        cant: 2,
        hh: 0.66,
        csHH: 4.42,
        csMat: 12.06,
        estado: 'APROBADO',
        fotos: [
          fotoPe('121883', 3, 'DANO', 'Manija doblada', '16/08/2026 08:23:10'),
          fotoPe('121883', 4, 'DANO', 'Detalle LBH en DX23', '16/08/2026 08:23:10'),
        ],
      }),
      lineaPdf({
        codigo,
        linea: 3,
        comp: 'PIC',
        ubic: 'RB3N',
        dano: 'BT-BENT',
        met: 'GS',
        desc: 'PANEL SS-PT',
        cant: 1,
        largo: 100,
        ancho: 20,
        hh: 1.17,
        csHH: 7.96,
        csMat: 6.59,
        estado: 'APROBADO',
        fotos: [
          fotoPe('121883', 5, 'DANO', 'Panel SS doblado 100 x 20 cm', '16/08/2026 08:23:10'),
          fotoPe('121883', 6, 'DANO', 'Detalle PIC en RB3N', '16/08/2026 08:23:10'),
        ],
      }),
    ];
  }
  return null;
}

function danosPdfEcuador(codigo) {
  if (codigo === 'ERSBM-2026-179067') {
    return [
      lineaPdf({
        codigo,
        linea: 1,
        comp: 'POC',
        ubic: 'RB1N',
        dano: 'IR-IMPROPER REPAIR',
        met: 'PX',
        desc: 'PATCH EXTERIOR PANELS- STEEL WITH FOAM',
        cant: 1,
        largo: 20,
        ancho: 20,
        hh: 0.77,
        csHH: 6.93,
        csMat: 7.45,
        estado: 'APROBADO',
        fotos: [
          fotoEc('179067', 1, 'DANO', 'Parche exterior en panel de acero con foam', '17/08/2026 00:53:00'),
          fotoEc('179067', 2, 'DANO', 'Detalle POC en RB1N', '17/08/2026 00:53:00'),
          fotoEc('179067', 3, 'DANO', 'Medida 20 x 20 cm del parche', '17/08/2026 00:53:00'),
          fotoEc('179067', 5, 'DANO', 'Evidencia del daño IR en patio RFS 1', '17/08/2026 00:53:00'),
        ],
      }),
    ];
  }

  if (codigo === 'ERSBM-2026-179066') {
    const f = '17/08/2026 00:42:24';
    return [
      lineaPdf({
        codigo, linea: 1, comp: 'TFF-VERTICAL', ubic: 'FX1N', dano: 'LO-LOOSE', met: 'GS',
        desc: 'MISCELLANEOUS - BAFFLE VERTICAL (LATERAL)', cant: 1, hh: 1, csHH: 9, csMat: 13.35,
        estado: 'APROBADO', fotos: [fotoEc('179066', 1, 'DANO', 'Baffle vertical suelto', f)],
      }),
      lineaPdf({
        codigo, linea: 2, comp: 'TFF', ubic: 'FB23', dano: 'DT-DENT', met: 'GS',
        desc: 'MISCELLANEOUS - STRAIGHT BAFFLE PLATE', cant: 1, hh: 1, csHH: 9, csMat: 13.35,
        estado: 'APROBADO', fotos: [fotoEc('179066', 2, 'DANO', 'Placa baffle abollada', f)],
      }),
      lineaPdf({
        codigo, linea: 3, comp: 'DRP', ubic: 'BX1N', dano: 'MS-MISSING', met: 'RP',
        desc: 'MISCELLANEOUS - REPLACE TAPON GRANDE DRENAJE', cant: 2, hh: 0.5, csHH: 4.5, csMat: 6.68,
        estado: 'APROBADO', fotos: [fotoEc('179066', 3, 'DANO', 'Tapón grande de drenaje faltante', f)],
      }),
      lineaPdf({
        codigo, linea: 4, comp: 'PEP', ubic: 'DB3N', dano: 'BR-BROKEN', met: 'SN',
        desc: 'FRAME SECTION', cant: 1, longitud: 60, hh: 0.5, csHH: 4.5, csMat: 6.68,
        estado: 'APROBADO', fotos: [fotoEc('179066', 4, 'DANO', 'Sección de marco rota 60 cm', f)],
      }),
      lineaPdf({
        codigo, linea: 5, comp: 'GTA', ubic: 'DB3N', dano: 'CD-CUT/DAMAGED', met: 'SN',
        desc: 'DOOR PARTS - SECTION DOOR GASKET', cant: 1, longitud: 100, hh: 0.3, csHH: 2.7, csMat: 4.01,
        estado: 'APROBADO', fotos: [fotoEc('179066', 5, 'DANO', 'Empaque de puerta seccionado 100 cm', f)],
      }),
      lineaPdf({
        codigo, linea: 6, comp: 'PEP', ubic: 'DX23', dano: 'WT-WATERTIGHT', met: 'SE-LINEAL',
        desc: 'SEAL LINEAL', cant: 2, longitud: 720, hh: 2.88, csHH: 25.92, csMat: 38.45,
        estado: 'APROBADO', fotos: [fotoEc('179066', 6, 'DANO', 'Sello lineal 720 cm', f)],
      }),
      lineaPdf({
        codigo, linea: 7, comp: 'PIC-A', ubic: 'IXXX', dano: 'WT-WATERTIGHT', met: 'SE-LINEAL',
        desc: 'SEAL LINEAL', cant: 6, longitud: 1200, hh: 14.4, csHH: 129.6, csMat: 192.28,
        estado: 'APROBADO',
        fotos: [fotoEc('179066', 7, 'DANO', 'Sello lineal PIC-A 1200 cm', f), fotoEc('179066', 8, 'DANO', 'Detalle de sello lineal en IXXX', f)],
        comentarios: [
          {
            id: 'ec-179066-l7-c1',
            usuario: 'cesarvalencia',
            rol: 'LIQUIDACIONES',
            fecha: '17/08/2026 09:14:28',
            tipo: 'SOLICITA_CAMBIO',
            mensaje:
              'El sello lineal PIC-A concentra la mayor parte del estimado. Confirmar metros y cantidad (6) contra el anexo fotográfico.',
            campoAfectado: 'Cant.',
          },
          {
            id: 'ec-179066-l7-c2',
            usuario: 'rordonez',
            rol: 'TECNICO',
            fecha: '17/08/2026 09:28:11',
            tipo: 'INFORMATIVO',
            mensaje:
              'Confirmado en patio RFS 1: 6 tramos SE-LINEAL, 1200 cm. Se mantiene el ítem con cargo a la línea.',
          },
        ],
      }),
      lineaPdf({
        codigo, linea: 8, comp: 'GTA', ubic: 'DB3N', dano: 'CU-CUT', met: 'SN',
        desc: 'DOOR PARTS - SECTION DOOR GASKET', cant: 1, longitud: 50, hh: 0.3, csHH: 2.7, csMat: 4.01,
        estado: 'APROBADO', fotos: [],
      }),
      lineaPdf({
        codigo, linea: 9, comp: 'GTA', ubic: 'DB3N', dano: 'CD-CUT/DAMAGED', met: 'SE-LINEAL',
        desc: 'SEAL LINEAL', cant: 1, longitud: 50, hh: 0.12, csHH: 1.08, csMat: 1.6,
        estado: 'APROBADO', fotos: [],
      }),
      lineaPdf({
        codigo, linea: 10, comp: 'RLA', ubic: 'DG23', dano: 'WT-WATERTIGHT', met: 'SE-LINEAL',
        desc: 'SEAL LINEAL', cant: 1, longitud: 240, hh: 0.48, csHH: 4.32, csMat: 6.41,
        estado: 'APROBADO', fotos: [],
      }),
    ];
  }

  if (codigo === 'ERSBM-2026-179151') {
    const f = '17/08/2026 14:25:35';
    const seccion = 'MAQUINA';
    const estado = 'ENVIADO';
    return [
      lineaPdf({
        codigo, linea: 1, comp: 'CON', partNumber: '2233495', ubic: 'MQNN',
        dano: 'CO-CORRODED/RUSTY', met: 'RP', desc: 'DK - NW - COIL CONDENSER 2233495',
        cant: 1, hh: 3, csHH: 27, csMat: 520, estado, seccion, tieneVideo: true,
        fotos: [
          fotoEc('179151', 1, 'DANO', 'Coil condenser corroído', f),
          fotoEc('179151', 2, 'DANO', 'Detalle del coil 2233495', f),
        ],
        archivos: [
          {
            id: 'ec-179151-vid',
            url: '/uploads/estimaciones/videos/inspeccion-demo.mp4',
            clase: 'VIDEO',
            grupo: 'ESTIMACION',
            nombre: 'VID_20260817_141021.mp4',
            fecha: '17/08/2026 14:10:21',
          },
          {
            id: 'ec-179151-log',
            url: '',
            clase: 'DATALOG',
            grupo: 'ESTIMACION',
            nombre: 'BMOU9847955_260817A.V1a',
            fecha: '17/08/2026 14:10:21',
            sintetico: true,
          },
        ],
      }),
      lineaPdf({
        codigo, linea: 2, comp: 'DRYER', partNumber: '2179111', ubic: 'MQNN',
        dano: 'CO-CORRODED/RUSTY', met: 'RP',
        desc: 'DK - NW - DRYER ASSY DAIKIN, INDIA SAME AS 1241385 / 2139029 / 2179111 (FILTRO)',
        cant: 1, hh: 0.5, csHH: 4.5, csMat: 95, estado, seccion,
        fotos: [fotoEc('179151', 3, 'DANO', 'Dryer assembly corroído', f)],
      }),
      lineaPdf({
        codigo, linea: 3, comp: 'SYS', partNumber: 'NULL', ubic: 'MQNN',
        dano: 'RN-REPAIR NECESSARY', met: 'RP', desc: 'VACIO DE SISTEM',
        cant: 1, hh: 1, csHH: 9, csMat: 0, estado, seccion, fotos: [],
      }),
      lineaPdf({
        codigo, linea: 4, comp: 'PMI', partNumber: 'RP', ubic: 'MQNN',
        dano: 'RN-REPAIR NECESSARY', met: 'WD', desc: 'PALILLO DE SOLDADURA',
        cant: 2, hh: 0, csHH: 0, csMat: 8.5, estado, seccion, fotos: [],
      }),
      lineaPdf({
        codigo, linea: 5, comp: 'ECB', partNumber: '818831C', ubic: 'MQNN',
        dano: 'MS-MISSING/LOST', met: 'RP',
        desc: 'SC - NW - POWER CABLE 4X4.0MM2 818831A / 818830A / 818831C',
        cant: 8, hh: 0.4, csHH: 3.6, csMat: 184, estado, seccion,
        fotos: [fotoEc('179151', 5, 'DANO', 'Cable 460V corto / faltante', f)],
      }),
      lineaPdf({
        codigo, linea: 6, comp: 'RFA', partNumber: 'N/A', ubic: 'MQNN',
        dano: 'LF-LOW FLUID LEVEL', met: 'RP', desc: 'REFRIGERANTE R134A SML',
        cant: 1, hh: 0.25, csHH: 2.25, csMat: 110, estado, seccion,
        fotos: [fotoEc('179151', 6, 'DANO', 'Carga de refrigerante R134A', f)],
      }),
      lineaPdf({
        codigo, linea: 7, comp: 'JEY', partNumber: 'N/A', ubic: 'MQNN',
        dano: 'RN-REPAIR NECESSARY', met: 'AJ', desc: 'AMARRAS PLASTICAS',
        cant: 10, hh: 0, csHH: 0, csMat: 2.4, estado, seccion, fotos: [],
      }),
      lineaPdf({
        codigo, linea: 8, comp: 'EMI', partNumber: '22-50397-00', ubic: 'MQNN',
        dano: 'RN-REPAIR NECESSARY', met: 'RP', desc: 'CA - NW - SPLICE KIT, 22-50397-00',
        cant: 1, hh: 0.5, csHH: 4.5, csMat: 32, estado, seccion,
        fotos: [fotoEc('179151', 7, 'DANO', 'Splice kit para aislar cable 460V', f)],
      }),
      lineaPdf({
        codigo, linea: 9, comp: 'EPL', partNumber: '818559A', ubic: 'MQNN',
        dano: 'RN-REPAIR NECESSARY', met: 'RP', desc: 'SC - NW - POWER PLUG 818559A',
        cant: 1, hh: 0.5, csHH: 4.5, csMat: 78, estado, seccion,
        fotos: [fotoEc('179151', 8, 'DANO', 'Power plug de un solo uso', f)],
      }),
    ];
  }

  return null;
}

function generarDanos(row, estado) {
  const codigo = clean(row.Codigo);
  if (codigo === CODIGO_DESTACADO) return danosDestacado();
  const dePdfEc = danosPdfEcuador(codigo);
  if (dePdfEc) return dePdfEc;
  const dePdf = danosPdfPeru(codigo);
  if (dePdf) return dePdf;

  const rnd = mulberry32(hashCode(codigo));
  const esMaquina = clean(row['Tipo de Estimación']).toUpperCase().startsWith('M');
  const catalogo = row._pais === 'PERU'
    ? esMaquina
      ? CATALOGO_MAQUINA
      : CATALOGO_BOX_PE
    : esMaquina
      ? CATALOGO_MAQUINA
      : CATALOGO_ESTRUCTURAL;
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
      cargo: clean(row.Actividad) === 'WTY' ? 'RFS' : rnd() > 0.82 ? 'Cliente' : 'Línea',
      aplica:
        estado === 'RECHAZADO'
          ? 'Rechazado'
          : estado === 'ENVIADO'
            ? 'Pendiente de revisión'
            : 'Aprobado',
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
    buque:
      clean(row.Nave) && clean(row.Nave) !== '-'
        ? clean(row.Nave)
        : pick(rnd, row._pais === 'PERU' ? BUQUES_PE : BUQUES_EC),
    viaje:
      clean(row.Viaje) && clean(row.Viaje) !== '-'
        ? clean(row.Viaje)
        : `V-${Math.floor(rnd() * 400 + 100)}${pick(rnd, ['N', 'S'])}`,
    tipoContenedor:
      clean(row.Tipo) ||
      (esMaquina ? 'REEFER' : clean(row['Código RFS']).includes('DC') ? 'DRY' : 'REEFER'),
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
    pais: row._pais === 'PERU' ? 'PERU' : 'ECUADOR',
  };
}

function leerFilas(xlsxPath) {
  const wb = XLSX.readFile(xlsxPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
  const headers = aoa[1].map((h) => clean(h));
  return aoa
    .slice(2)
    .map((r) => {
      const o = {};
      headers.forEach((h, i) => {
        if (h && h !== 'Acciones') o[h] = clean(r[i]);
      });
      return o;
    })
    .filter((o) => clean(o.Codigo).startsWith('ERSBM'));
}

function fmtFechaIso(v) {
  const s = clean(v);
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!iso) return s;
  const p = (n) => String(n).padStart(2, '0');
  return `${iso[3]}/${iso[2]}/${iso[1]} ${p(iso[4])}:${iso[5]}:${iso[6] || '00'}`;
}

function semanaDe(fecha) {
  const m = clean(fecha).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return 33;
  const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function diasEntre(a, b) {
  const pa = clean(a).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  const pb = clean(b).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!pa || !pb) return 0;
  const da = new Date(Number(pa[3]), Number(pa[2]) - 1, Number(pa[1]));
  const db = new Date(Number(pb[3]), Number(pb[2]) - 1, Number(pb[1]));
  return Math.max(0, Math.round((db - da) / 86400000));
}

function tipoEstimacionPe(v) {
  const t = clean(v)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return t.startsWith('M') ? 'MÁQUINA' : 'BOX';
}

const TOTALES_PDF_PE = {
  'ERSBM-2026-121880': { hh: 0.45, pvpHH: 3.06, pvpMat: 12.3, total: 15.36, modelo: '', nave: 'SEABOARD VICTORY' },
  'ERSBM-2026-121881': {
    hh: 0.33,
    pvpHH: 2.21,
    pvpMat: 0.51,
    total: 2.72,
    modelo: 'LX10F11B3',
    nave: 'SEABOARD VICTORY',
  },
  'ERSBM-2026-121883': { hh: 2.23, pvpHH: 15.1, pvpMat: 35.65, total: 50.75, modelo: '', nave: 'SEABOARD VICTORY' },
};

function normalizarPeru(row) {
  const codigo = clean(row.Codigo);
  const estadoRaw = clean(row.Estado).toLowerCase();
  const estado = estadoRaw.includes('ejecutado') ? 'REPARADO' : 'APROBADO';
  const tipoEst = tipoEstimacionPe(row['Tipo de Estimación']);
  const total = num(row['Costo Total']);
  const pdf = TOTALES_PDF_PE[codigo];
  const pvpHH = pdf ? pdf.pvpHH : tipoEst === 'MÁQUINA' ? round2(total * 0.75) : round2(total * 0.28);
  const pvpMat = pdf ? pdf.pvpMat : round2(total - pvpHH);
  const hh = pdf ? pdf.hh : round2(pvpHH / TARIFA_HH_PE);
  const gate = fmtFechaIso(row['Fecha GateIn']);
  const elab = fmtFechaIso(row['Fecha de Elaboración']);
  const envio = clean(row['Fecha Envio Aprobación']) || elab;
  const danosPdf = danosPdfPeru(codigo);
  const obs = danosPdf ? danosPdf.map((d) => d.obsAnalisis).join(' · ') : '';

  return {
    _pais: 'PERU',
    Codigo: codigo,
    Semana: semanaDe(elab),
    Año: 2026,
    Estado: estado,
    Contenedor: clean(row.Contenedor),
    'Modelo Maquina': pdf ? pdf.modelo : '',
    'Código RFS': clean(row.Tipo),
    Naviera: clean(row.Naviera),
    Actividad: tipoEst === 'MÁQUINA' ? 'SVL' : 'DM',
    'Lugar de Estimación': clean(row.Patio) || 'CALLAO',
    'Lugar de Asistencia': '',
    'Fecha GateIn': gate,
    'Fecha de Elaboración': elab,
    'Fecha de Reparación': estado === 'REPARADO' ? envio : '',
    'Tipo de Estimación': tipoEst,
    'Técnico de Estimación': 'jgonzalez',
    'Horas Hombre': hh,
    'PVP Horas Hombre': pvpHH,
    'PVP Materiales': pvpMat,
    'PVP Total': pdf ? pdf.total : total,
    'Estado PTI': tipoEst === 'MÁQUINA' ? 'DM' : '',
    'Fecha Fin PTI': tipoEst === 'MÁQUINA' ? elab : '',
    'Enviar Aprobacion': 'SI',
    'Fecha Envio': envio,
    'Fecha Aprobacion': envio,
    'EDI Enviado ONE': 'NO',
    'Fecha Envio EDI ONE': '',
    Niveles: '',
    'Dias Estadia': diasEntre(gate, elab),
    'Tipo de Daño': tipoEst === 'BOX' ? 'Estructural' : 'Máquina',
    'Análisis de observación': obs,
    'Fecha de modificación': envio,
    'Usuario de Modificación': 'julio.vega',
    Nave: pdf ? pdf.nave : clean(row.Nave),
    Viaje: clean(row.Viaje),
    Tipo: clean(row.Tipo),
  };
}

// ---------------------------------------------------------------- main

const FILA_179151 = {
  _pais: 'ECUADOR',
  Codigo: 'ERSBM-2026-179151',
  Semana: 34,
  Año: 2026,
  Estado: 'ENVIADO',
  Contenedor: 'BMOU9847955',
  'Modelo Maquina': 'DAIKIN',
  'Código RFS': '40RC',
  Naviera: 'SEABOARD MARINE LINE',
  Actividad: 'DM',
  'Lugar de Estimación': 'RFS 1',
  'Lugar de Asistencia': '',
  'Fecha GateIn': '17/08/2026 14:10:21',
  'Fecha de Elaboración': '17/08/2026 14:25:35',
  'Fecha de Reparación': '',
  'Tipo de Estimación': 'MÁQUINA',
  'Técnico de Estimación': 'rpontes',
  'Horas Hombre': 6.15,
  'PVP Horas Hombre': 55.35,
  'PVP Materiales': 1030.4,
  'PVP Total': 1085.75,
  'Estado PTI': 'DM',
  'Fecha Fin PTI': '17/08/2026 14:10:21',
  'Enviar Aprobacion': 'SI',
  'Fecha Envio': '17/08/2026 14:25:35',
  'Fecha Aprobacion': '',
  'EDI Enviado ONE': 'NO',
  'Fecha Envio EDI ONE': '',
  Niveles: '',
  'Dias Estadia': 0,
  'Tipo de Daño': 'Máquina',
  'Análisis de observación':
    'reemplazar coil condenser x corroido , vacío al sistema , reemplazar , x soldar coil condenser x reemplazo , completar carga x reemplazo coil condenser , ajuste, completar cable 460v x corto , insular cable 460v x completar , reemplazar plug x un solo uso',
  'Fecha de modificación': '',
  'Usuario de Modificación': 'rpontes',
  Tipo: '45R1',
};

const filasEc = [
  ...leerFilas(XLSX_PATH).map((r) => ({ ...r, _pais: 'ECUADOR' })),
  FILA_179151,
];
const filasPe = leerFilas(XLSX_PERU).map(normalizarPeru);

const estimaciones = [...filasEc, ...filasPe].map((row, index) => construirEstimacion(row, index));

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

const porPais = estimaciones.reduce((acc, e) => {
  acc[e.pais] = (acc[e.pais] || 0) + 1;
  return acc;
}, {});

console.log(`Seed escrito en ${OUT_PATH}`);
console.log(`  Estimaciones : ${estimaciones.length}`);
console.log(`  Por país     : ${JSON.stringify(porPais)}`);
console.log(`  Por estado   : ${JSON.stringify(porEstado)}`);
console.log(`  Líneas daño  : ${totalDanos}`);
console.log(`  Comentarios  : ${totalComentarios}`);
console.log(`  Sin daños    : ${estimaciones.filter((e) => e.sinDanos).length}`);
