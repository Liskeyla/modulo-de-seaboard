import type { ArchivoDano, DanoEstimacion, Estimacion, FotoDano } from '@/types/estimacion';
import { esFotoEsquema } from '@/lib/fotosDano';

const MONEDA = (n: number) => `$${n.toFixed(2)}`;

function descargarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Se libera en el siguiente tick para no cortar la descarga en Firefox.
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ------------------------------------------------------------------ fotos zip

export type GrupoFotos = 'TODAS' | 'DANO' | 'REPARADO';

export function fotosDe(est: Estimacion, grupo: GrupoFotos): FotoDano[] {
  const todas = est.danos.flatMap((d) => d.fotos).filter((f) => !esFotoEsquema(f.url));
  if (grupo === 'TODAS') return todas;
  return todas.filter((f) => f.tipo === grupo);
}

const ETIQUETA_GRUPO: Record<GrupoFotos, string> = {
  TODAS: 'TODAS',
  DANO: 'DANOS',
  REPARADO: 'REPARADOS',
};

/**
 * Empaqueta las fotos del estimado en un .zip real (descargado por el navegador).
 * Devuelve la cantidad de archivos incluidos.
 */
export async function descargarFotosZip(est: Estimacion, grupo: GrupoFotos): Promise<number> {
  const fotos = fotosDe(est, grupo);
  if (fotos.length === 0) return 0;

  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const carpeta = zip.folder(`${ETIQUETA_GRUPO[grupo]}_${est.codigo}`) ?? zip;

  const usados = new Set<string>();
  let indice = 1;

  await Promise.all(
    fotos.map(async (foto) => {
      const res = await fetch(foto.url);
      if (!res.ok) return;
      const buffer = await res.arrayBuffer();
      const base = foto.url.split('/').pop() ?? `foto_${indice}.jpg`;
      let nombre = `${est.contenedor}_${foto.tipo === 'DANO' ? 'DANO' : 'REPARADO'}_${base}`;
      while (usados.has(nombre)) {
        nombre = nombre.replace(/(\.\w+)$/, `_${indice}$1`);
        indice += 1;
      }
      usados.add(nombre);
      carpeta.file(nombre, buffer);
    })
  );

  const detalle = fotos
    .map(
      (f, i) =>
        `${String(i + 1).padStart(2, '0')}  ${f.tipo.padEnd(9)}  ${f.fecha}  ${f.descripcion}`
    )
    .join('\r\n');

  carpeta.file(
    'LEEME.txt',
    [
      `Estimado    : ${est.codigo}`,
      `Contenedor  : ${est.contenedor} (${est.codigoRfs} ${est.tipoContenedor})`,
      `Naviera     : ${est.naviera}`,
      `Tipo        : ${est.tipoEstimacion} · Actividad ${est.actividad}`,
      `Técnico     : ${est.tecnico}`,
      `Estado      : ${est.estado}`,
      `Grupo       : ${ETIQUETA_GRUPO[grupo]}`,
      `Archivos    : ${fotos.length}`,
      '',
      'Detalle de las evidencias incluidas:',
      detalle,
    ].join('\r\n')
  );

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  descargarBlob(blob, `Fotos_${ETIQUETA_GRUPO[grupo]}_${est.codigo}.zip`);
  return fotos.length;
}

/** Empaqueta un listado concreto de fotos (por ejemplo, las de una sola línea de daño). */
export async function descargarFotosListaZip(
  fotos: FotoDano[],
  codigo: string,
  contenedor: string
): Promise<number> {
  if (fotos.length === 0) return 0;
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const carpeta = zip.folder(`Fotos_${codigo}`) ?? zip;
  let indice = 1;
  const usados = new Set<string>();

  await Promise.all(
    fotos.map(async (foto) => {
      const res = await fetch(foto.url);
      if (!res.ok) return;
      const buffer = await res.arrayBuffer();
      const base = foto.descripcion.replace(/[^\w.\-]+/g, '_') || `foto_${indice}.jpg`;
      const ext = foto.url.match(/\.\w+$/)?.[0] ?? '.jpg';
      let nombre = base.includes('.') ? base : `${base}${ext}`;
      while (usados.has(nombre)) {
        nombre = nombre.replace(/(\.\w+)$/, `_${indice}$1`);
        indice += 1;
      }
      usados.add(nombre);
      carpeta.file(nombre, buffer);
    })
  );

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  descargarBlob(blob, `Fotos_${contenedor}_${codigo}.zip`);
  return fotos.length;
}

export function descargarDesdeUrl(url: string, nombre: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ------------------------------------------------------------------ data log

export function nombreDataLog(contenedor: string, fechaElaboracion: string) {
  const m = fechaElaboracion.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  const yymmdd = m ? `${m[3].slice(2)}${m[2]}${m[1]}` : '260817';
  return `${contenedor}_${yymmdd}A.V1a`;
}

/** CSV del data log de máquina, listo para descargar o previsualizar. */
export function construirDataLogCsv(est: Estimacion): string {
  const filas: string[] = [
    'Fecha;Hora;Setpoint (C);Supply (C);Return (C);Ambiente (C);Humedad (%);Estado;Alarma',
  ];
  const base = new Date(2026, 7, 16, 4, 0, 0);
  for (let i = 0; i < 96; i += 1) {
    const t = new Date(base.getTime() + i * 15 * 60 * 1000);
    const p = (n: number) => String(n).padStart(2, '0');
    const setpoint = -18;
    const oscilacion = Math.sin(i / 6) * 0.8;
    const supply = setpoint + oscilacion;
    const ret = setpoint + oscilacion + 1.4;
    const ambiente = 27 + Math.sin(i / 12) * 3;
    const humedad = 62 + Math.round(Math.cos(i / 8) * 6);
    const alarma = i === 61 ? 'AL21 SENSOR AMBIENTE' : '';
    filas.push(
      [
        `${p(t.getDate())}/${p(t.getMonth() + 1)}/${t.getFullYear()}`,
        `${p(t.getHours())}:${p(t.getMinutes())}`,
        setpoint.toFixed(1),
        supply.toFixed(1),
        ret.toFixed(1),
        ambiente.toFixed(1),
        String(humedad),
        alarma ? 'ALARMA' : 'OPERANDO',
        alarma,
      ].join(';')
    );
  }

  const encabezado = [
    `Data Log;${est.contenedor}`,
    `Estimado;${est.codigo}`,
    `Maquina;${est.modeloMaquina}`,
    `Naviera;${est.naviera}`,
    `Deposito;${est.lugarEstimacion}`,
    `Generado;${new Date().toLocaleString('es-EC')}`,
    '',
  ];

  return `${encabezado.join('\r\n')}${filas.join('\r\n')}`;
}

/** Genera el data log del reefer como CSV, tal como lo entrega el DMS de producción. */
export function descargarDataLog(est: Estimacion, nombre?: string) {
  const csv = construirDataLogCsv(est);
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
  descargarBlob(blob, nombre ?? `DataLog_${est.contenedor}_${est.codigo}.csv`);
  return csv.split('\r\n').length - 8;
}

export async function descargarDataLogsZip(
  est: Estimacion,
  archivos: ArchivoDano[]
): Promise<number> {
  const logs = archivos.filter((a) => a.clase === 'DATALOG');
  if (logs.length === 0) return 0;

  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();

  await Promise.all(
    logs.map(async (a) => {
      if (a.sintetico || !a.url) {
        zip.file(`${a.nombre}.csv`, `\ufeff${construirDataLogCsv(est)}`);
        return;
      }
      const res = await fetch(a.url);
      if (!res.ok) return;
      zip.file(a.nombre, await res.arrayBuffer());
    })
  );

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  descargarBlob(blob, `DataLogs_${est.contenedor}_${est.codigo}.zip`);
  return logs.length;
}

// ------------------------------------------------------------------ informes

const escapar = (s: string) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

function filaDato(label: string, valor: string) {
  return `<tr><th>${escapar(label)}</th><td>${escapar(valor || '—')}</td></tr>`;
}

/** BOX lleva dimensiones (Largo/Ancho/Área/Longitud); MÁQUINA no. */
export function esEstimacionBox(tipoEstimacion: string) {
  return tipoEstimacion.toUpperCase().includes('BOX');
}

function fmtDim(n: number) {
  return n && n > 0 ? n.toFixed(2) : '';
}

function tablaDanos(danos: DanoEstimacion[], conValores: boolean, incluirDimensiones: boolean) {
  const dims = incluirDimensiones ? (['Largo', 'Ancho', 'Área', 'Longitud'] as const) : [];
  const columnas = conValores
    ? ['#', 'Comp.', 'Ubic.', 'Daño', 'Met. Rep.', ...dims, 'Cant.', 'H.H.', 'Cs. H.H.', 'Cs. Mat.', 'Cs. Total', 'Cargo']
    : ['#', 'Comp.', 'Ubic.', 'Daño', 'Met. Rep.', ...dims, 'Cant.', 'Cargo', 'Observación'];

  const cuerpo = danos
    .map((d) => {
      const dimCeldas = incluirDimensiones
        ? [fmtDim(d.largo), fmtDim(d.ancho), fmtDim(d.area), fmtDim(d.longitud)]
        : [];
      const celdas = conValores
        ? [
            String(d.linea).padStart(2, '0'),
            d.comp,
            d.ubicacion,
            d.dano,
            d.newMetRep,
            ...dimCeldas,
            d.cantidad.toFixed(2),
            d.horasHombre.toFixed(2),
            MONEDA(d.csHoraHombre),
            MONEDA(d.csMaterial),
            MONEDA(d.csTotal),
            d.cargo,
          ]
        : [
            String(d.linea).padStart(2, '0'),
            d.comp,
            d.ubicacion,
            d.dano,
            d.newMetRep,
            ...dimCeldas,
            d.cantidad.toFixed(2),
            d.cargo,
            d.obsAnalisis,
          ];
      return `<tr>${celdas.map((c) => `<td>${escapar(c)}</td>`).join('')}</tr>`;
    })
    .join('');

  const totales = danos.reduce(
    (a, d) => ({
      hh: a.hh + d.horasHombre,
      cshh: a.cshh + d.csHoraHombre,
      mat: a.mat + d.csMaterial,
      total: a.total + d.csTotal,
    }),
    { hh: 0, cshh: 0, mat: 0, total: 0 }
  );

  // #…Met.Rep. (+ dims) + Cant.  →  colspan hasta antes de H.H.
  const colspanAntesHh = 5 + dims.length + 1;
  const pie = conValores
    ? `<tr class="tot"><td colspan="${colspanAntesHh}">TOTALES</td><td>${totales.hh.toFixed(2)}</td><td>${MONEDA(
        totales.cshh
      )}</td><td>${MONEDA(totales.mat)}</td><td>${MONEDA(totales.total)}</td><td></td></tr>`
    : '';

  return `<table class="grid"><thead><tr>${columnas
    .map((c) => `<th>${escapar(c)}</th>`)
    .join('')}</tr></thead><tbody>${cuerpo || `<tr><td colspan="${columnas.length}">Sin daños registrados</td></tr>`}</tbody><tfoot>${pie}</tfoot></table>`;
}

export type VarianteInforme = 'ESTIMADO' | 'PRELIMINAR' | 'FINAL';

const TITULO_VARIANTE: Record<VarianteInforme, string> = {
  ESTIMADO: 'ESTIMADO DE REPARACIÓN',
  PRELIMINAR: 'INFORME PRELIMINAR DE ESTIMADO',
  FINAL: 'INFORME FINAL DE ESTIMADO',
};

function codigoTipoDano(dano: string) {
  const m = String(dano || '')
    .trim()
    .toUpperCase()
    .match(/^([A-Z]{1,3})(?:[-/\s]|$)/);
  return m ? m[1] : '';
}

/** Anexo fotográfico segmentado por línea de daño, al estilo del EIR (dms-web). */
function anexoFotograficoHtml(est: Estimacion) {
  const bloquesDano = est.danos
    .map((d) => {
      const fotos = d.fotos.filter((f) => f.tipo === 'DANO');
      if (fotos.length === 0) return '';
      const codigo = codigoTipoDano(d.dano);
      return `<article class="anexo-card anexo-card--dano">
  <header class="anexo-card-head">
    <span class="anexo-card-title">Daño ${d.linea} — ${escapar(codigo ? `${codigo} · ${d.dano}` : d.dano)} · ${escapar(d.comp)} · ${escapar(d.ubicacion || '—')}</span>
    <span class="anexo-tag anexo-tag--dano">Daño</span>
  </header>
  <div class="anexo-photos">
    ${fotos
      .map(
        (f) =>
          `<figure class="anexo-photo"><img src="${f.url}" alt="${escapar(f.descripcion)}"/><figcaption>${escapar(f.descripcion || f.fecha)}</figcaption></figure>`
      )
      .join('')}
  </div>
  <footer class="anexo-card-foot">
    Método: ${escapar(d.newMetRep || d.metRep || '—')} · Cantidad: ${d.cantidad.toFixed(2)} · Cargo: ${escapar(d.cargo)} · H.H.: ${d.horasHombre.toFixed(2)}
  </footer>
</article>`;
    })
    .filter(Boolean)
    .join('');

  const bloquesReparado = est.danos
    .map((d) => {
      const fotos = d.fotos.filter((f) => f.tipo === 'REPARADO');
      if (fotos.length === 0) return '';
      return `<article class="anexo-card anexo-card--ok">
  <header class="anexo-card-head">
    <span class="anexo-card-title">Reparado · Línea ${d.linea} — ${escapar(d.comp)} · ${escapar(d.ubicacion || '—')}</span>
    <span class="anexo-tag anexo-tag--ok">Reparado</span>
  </header>
  <div class="anexo-photos">
    ${fotos
      .map(
        (f) =>
          `<figure class="anexo-photo"><img src="${f.url}" alt="${escapar(f.descripcion)}"/><figcaption>${escapar(f.descripcion || f.fecha)}</figcaption></figure>`
      )
      .join('')}
  </div>
  <footer class="anexo-card-foot">
    Método: ${escapar(d.newMetRep || d.metRep || '—')} · Cantidad: ${d.cantidad.toFixed(2)} · Cargo: ${escapar(d.cargo)}
  </footer>
</article>`;
    })
    .filter(Boolean)
    .join('');

  if (!bloquesDano && !bloquesReparado) {
    return `<section class="anexo">
  <h2 class="anexo-titulo">ANEXO FOTOGRÁFICO</h2>
  <p class="muted" style="text-align:center">Fotografías subidas a la estimación — sin evidencias registradas.</p>
</section>`;
  }

  return `<section class="anexo">
  <h2 class="anexo-titulo">ANEXO FOTOGRÁFICO</h2>
  ${
    bloquesDano
      ? `<h3 class="anexo-subtitulo">Fotos de Daños</h3><div class="anexo-visual">${bloquesDano}</div>`
      : ''
  }
  ${
    bloquesReparado
      ? `<h3 class="anexo-subtitulo">Fotos de Reparación</h3><div class="anexo-visual">${bloquesReparado}</div>`
      : ''
  }
</section>`;
}

/** Construye el HTML del Informe de Estimado, con o sin columnas de costo. */
export function construirInformeHtml(
  est: Estimacion,
  conValores: boolean,
  variante: VarianteInforme = 'ESTIMADO'
) {
  const titulo = TITULO_VARIANTE[variante];
  const anexo = anexoFotograficoHtml(est);

  const notas = est.notas.length
    ? `<ul class="notas">${est.notas
        .map((n) => `<li><strong>${escapar(n.usuario)}</strong> · ${escapar(n.fecha)}<br/>${escapar(n.texto)}</li>`)
        .join('')}</ul>`
    : '<p class="muted">Sin notas de estimación.</p>';

  const observaciones = est.danos
    .flatMap((d) =>
      d.comentarios.map(
        (c) =>
          `<li><strong>Línea ${d.linea}</strong> · ${escapar(c.rol)} · ${escapar(c.usuario)} · ${escapar(
            c.fecha
          )}<br/>${escapar(c.mensaje)}</li>`
      )
    )
    .join('');

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"/>
<title>${escapar(titulo)} ${escapar(est.codigo)}${conValores ? '' : ' (sin valores)'}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:Montserrat,'Segoe UI',Arial,sans-serif;margin:0;padding:24px;color:#111827;background:#fff;font-size:11px}
  .hoja{max-width:960px;margin:0 auto}
  header.doc{display:flex;align-items:flex-start;gap:14px;border-bottom:3px solid #152483;padding-bottom:12px;margin-bottom:14px}
  header.doc img{height:52px;width:auto;border-radius:4px}
  .titulo{flex:1}
  .titulo .brand{margin:0;font-size:11px;font-weight:800;color:#152483;letter-spacing:.04em}
  .titulo h1{margin:2px 0 0;font-size:16px;color:#152483;letter-spacing:-.02em}
  .titulo p{margin:2px 0 0;font-size:10.5px;color:#6b7280}
  .meta-box{text-align:right;min-width:9rem}
  .meta-box .codigo{display:block;font-family:ui-monospace,Consolas,monospace;font-weight:800;font-size:12px;color:#152483}
  .sello{display:inline-block;margin-top:6px;border:2px solid #152483;color:#152483;font-weight:800;font-size:10px;padding:4px 10px;border-radius:6px;text-transform:uppercase}
  .sello.sv{border-color:#f16e26;color:#f16e26}
  h2{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#152483;margin:16px 0 6px;padding-bottom:4px;border-bottom:1px solid #e5e7eb}
  .cols{display:grid;grid-template-columns:1fr 1fr;gap:0 22px}
  table{width:100%;border-collapse:collapse}
  .datos th{text-align:left;width:42%;padding:3px 6px;color:#6b7280;font-weight:600;background:#f9fafb;border:1px solid #e5e7eb;white-space:nowrap}
  .datos td{padding:3px 6px;border:1px solid #e5e7eb;font-weight:600}
  .grid th{background:#152483;color:#fff;padding:5px 4px;font-size:9.5px;text-transform:uppercase;letter-spacing:.03em;border:1px solid #152483}
  .grid td{padding:4px;border:1px solid #e5e7eb;text-align:center}
  .grid tbody tr:nth-child(even){background:#f9fafb}
  .grid .tot td{background:#eef1fb;font-weight:800;color:#152483}
  .notas{margin:0;padding-left:16px}
  .notas li{margin-bottom:5px}
  .muted{color:#9ca3af;font-style:italic}
  .firmas{display:grid;grid-template-columns:repeat(2,1fr);gap:40px;margin-top:40px;text-align:center}
  .firmas div{border-top:1px solid #374151;padding-top:6px;font-size:10px;color:#4b5563}
  footer.doc-foot{margin-top:20px;border-top:1px solid #e5e7eb;padding-top:6px;font-size:8.5px;color:#9ca3af;display:flex;justify-content:space-between}
  .anexo{break-before:page;page-break-before:always;padding-top:8px}
  .anexo-titulo{text-align:center;font-size:14px;letter-spacing:.12em;color:#152483;border:none;margin:8px 0 14px;padding:0}
  .anexo-subtitulo{text-align:center;font-size:12px;font-weight:700;color:#374151;margin:10px 0 12px;border:none;padding:0;text-transform:none;letter-spacing:0}
  .anexo-visual{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .anexo-card{border:1px solid #e5e7eb;border-top:3px solid #94a3b8;border-radius:8px;background:#fff;overflow:hidden;break-inside:avoid;page-break-inside:avoid}
  .anexo-card--dano{border-top-color:#ef4444;background:#fef7f7}
  .anexo-card--ok{border-top-color:#22c55e;background:#f7fef9}
  .anexo-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;padding:8px 10px;border-bottom:1px solid #e5e7eb;background:rgba(255,255,255,.7)}
  .anexo-card-title{font-size:10px;font-weight:700;color:#111827;line-height:1.35}
  .anexo-tag{flex-shrink:0;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;padding:2px 7px;border-radius:999px}
  .anexo-tag--dano{background:#fee2e2;color:#b91c1c}
  .anexo-tag--ok{background:#dcfce7;color:#15803d}
  .anexo-photos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;padding:8px}
  .anexo-photo{margin:0;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;background:#fff;aspect-ratio:4/3}
  .anexo-photo img{width:100%;height:100%;object-fit:cover;display:block}
  .anexo-photo figcaption{display:none}
  .anexo-card-foot{padding:6px 10px 8px;font-size:9px;color:#6b7280;border-top:1px solid #e5e7eb;background:rgba(255,255,255,.65)}
  @page{size:A4;margin:12mm}
  @media print{
    body{padding:0}
    .anexo{break-before:page;page-break-before:always}
    .anexo-card{break-inside:avoid;page-break-inside:avoid}
  }
  @media (max-width:720px){
    .cols,.anexo-visual{grid-template-columns:1fr}
  }
</style></head>
<body><div class="hoja">
  <header class="doc">
    <img src="/brand/logo-rfs.jpg" alt="RFS"/>
    <div class="titulo">
      <p class="brand">RFS · ROAD FEEDER SERVICES</p>
      <h1>${escapar(titulo)}</h1>
      <p>Vía Perimetral Km.22 s/n y Vía a Daule · Tlf: 3731590 · RUC: 0992455454001</p>
    </div>
    <div class="meta-box">
      <span class="codigo">${escapar(est.codigo)}</span>
      <span class="sello${conValores ? '' : ' sv'}">${conValores ? escapar(est.estado) : 'Sin valores'}</span>
    </div>
  </header>

  <div class="cols">
    <div>
      <h2>Datos del estimado</h2>
      <table class="datos">
        ${filaDato('Línea / Naviera', est.naviera)}
        ${filaDato('Fecha estimado', est.fechaElaboracion)}
        ${filaDato('Contenedor', est.contenedor)}
        ${filaDato('CNTR / Tipo', `${est.codigoRfs} ${est.tipoContenedor}`)}
        ${filaDato('Tipo de estimación', est.tipoEstimacion)}
        ${filaDato('Actividad', est.actividad)}
        ${filaDato('Estado', est.estado)}
        ${filaDato('Inspector', est.tecnico)}
      </table>
    </div>
    <div>
      <h2>Contenedor e itinerario</h2>
      <table class="datos">
        ${filaDato('Modelo / máquina', est.modeloMaquina)}
        ${filaDato('Buque / Viaje', `${est.buque} · ${est.viaje}`)}
        ${filaDato('Lugar de estimación', est.lugarEstimacion)}
        ${filaDato('Fecha Gate In', est.fechaGateIn)}
        ${filaDato('Fecha de reparación', est.fechaReparacion)}
        ${filaDato('Días de estadía', String(est.diasEstadia))}
        ${filaDato('Estado PTI', est.estadoPti)}
        ${filaDato('Semana / Año', `${est.semana} / ${est.anio}`)}
      </table>
    </div>
  </div>

  <h2>Listado de daños · ${escapar(est.tipoEstimacion || 'BOX')}</h2>
  ${tablaDanos(est.danos, conValores, esEstimacionBox(est.tipoEstimacion))}

  ${
    conValores
      ? `<h2>Resumen de valores</h2>
  <table class="datos" style="max-width:340px">
    ${filaDato('PVP Horas Hombre', MONEDA(est.pvpHorasHombre))}
    ${filaDato('PVP Materiales', MONEDA(est.pvpMateriales))}
    ${filaDato('PVP Total', MONEDA(est.pvpTotal))}
    ${filaDato('Horas Hombre', est.horasHombre.toFixed(2))}
  </table>`
      : ''
  }

  <h2>Notas de estimación</h2>
  ${notas}

  ${
    observaciones
      ? `<h2>Observaciones de liquidaciones</h2><ul class="notas">${observaciones}</ul>`
      : ''
  }

  <div class="firmas">
    <div>Elaborado<br/><strong>${escapar(est.tecnico)}</strong></div>
    <div>Aprobado<br/><strong>${escapar(est.naviera)}</strong></div>
  </div>

  <footer class="doc-foot">
    <span>RFS — DMS · Documento generado el ${new Date().toLocaleString('es-EC')}</span>
    <span>${escapar(est.codigo)} · ${escapar(variante)}${conValores ? '' : ' · SIN VALORES'}</span>
  </footer>

  ${anexo}
</div></body></html>`;
}

/**
 * Envía el informe a la cola de impresión del navegador mediante un iframe oculto,
 * de modo que el usuario pueda guardarlo como PDF sin dependencias adicionales.
 */
export function imprimirInforme(html: string) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const lanzar = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    // El iframe se retira después del diálogo de impresión.
    setTimeout(() => iframe.remove(), 60000);
  };

  // Se espera a que carguen logo y fotos para que salgan en el PDF.
  if (iframe.contentWindow?.document.readyState === 'complete') {
    setTimeout(lanzar, 400);
  } else {
    iframe.onload = () => setTimeout(lanzar, 400);
  }
}

/** Exporta el historial de actividad del estimado como CSV. */
export function descargarHistorialCsv(est: Estimacion) {
  const filas = ['Fecha;Usuario;Acción;Detalle'];
  est.auditoria.forEach((ev) => {
    filas.push(
      [ev.fecha, ev.usuario, ev.accion, ev.detalle.replace(/;/g, ',')].join(';')
    );
  });
  est.danos.forEach((d) => {
    d.comentarios.forEach((c) => {
      filas.push(
        [
          c.fecha,
          c.usuario,
          `COMENTARIO ${c.rol} (${c.tipo.replace('_', ' ')})`,
          `Línea ${d.linea} · ${d.comp}${c.campoAfectado ? ` · Campo: ${c.campoAfectado}` : ''} · ${c.mensaje.replace(/;/g, ',')}`,
        ].join(';')
      );
    });
  });

  const blob = new Blob([`\ufeff${filas.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  descargarBlob(blob, `Historial_${est.codigo}.csv`);
  return filas.length - 1;
}
