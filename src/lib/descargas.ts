import type { DanoEstimacion, Estimacion, FotoDano } from '@/types/estimacion';

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
  const todas = est.danos.flatMap((d) => d.fotos);
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

// ------------------------------------------------------------------ data log

/** Genera el data log del reefer como CSV, tal como lo entrega el DMS de producción. */
export function descargarDataLog(est: Estimacion) {
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

  // El BOM permite que Excel reconozca los acentos al abrir el CSV.
  const blob = new Blob([`\ufeff${encabezado.join('\r\n')}${filas.join('\r\n')}`], {
    type: 'text/csv;charset=utf-8',
  });
  descargarBlob(blob, `DataLog_${est.contenedor}_${est.codigo}.csv`);
  return filas.length - 1;
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

function tablaDanos(danos: DanoEstimacion[], conValores: boolean) {
  const columnas = conValores
    ? ['#', 'Comp.', 'Ubic.', 'Daño', 'Met. Rep.', 'Cant.', 'H.H.', 'Cs. H.H.', 'Cs. Mat.', 'Cs. Total', 'Cargo']
    : ['#', 'Comp.', 'Ubic.', 'Daño', 'Met. Rep.', 'Cant.', 'Cargo', 'Observación'];

  const cuerpo = danos
    .map((d) => {
      const celdas = conValores
        ? [
            String(d.linea).padStart(2, '0'),
            d.comp,
            d.ubicacion,
            d.dano,
            d.newMetRep,
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

  const pie = conValores
    ? `<tr class="tot"><td colspan="6">TOTALES</td><td>${totales.hh.toFixed(2)}</td><td>${MONEDA(
        totales.cshh
      )}</td><td>${MONEDA(totales.mat)}</td><td>${MONEDA(totales.total)}</td><td></td></tr>`
    : '';

  return `<table class="grid"><thead><tr>${columnas
    .map((c) => `<th>${escapar(c)}</th>`)
    .join('')}</tr></thead><tbody>${cuerpo || `<tr><td colspan="${columnas.length}">Sin daños registrados</td></tr>`}</tbody><tfoot>${pie}</tfoot></table>`;
}

export type VarianteInforme = 'ESTIMADO' | 'PRELIMINAR' | 'FINAL';

const TITULO_VARIANTE: Record<VarianteInforme, string> = {
  ESTIMADO: 'Informe de Estimado',
  PRELIMINAR: 'Informe Preliminar de Estimado',
  FINAL: 'Informe Final de Estimado',
};

/** Construye el HTML del Informe de Estimado, con o sin columnas de costo. */
export function construirInformeHtml(
  est: Estimacion,
  conValores: boolean,
  variante: VarianteInforme = 'ESTIMADO'
) {
  const titulo = TITULO_VARIANTE[variante];
  const fotos = fotosDe(est, 'TODAS').slice(0, 9);
  const galeria = fotos.length
    ? `<div class="fotos">${fotos
        .map(
          (f) =>
            `<figure><img src="${f.url}" alt="${escapar(f.descripcion)}"/><figcaption>${
              f.tipo === 'DANO' ? 'Daño' : 'Reparado'
            } · ${escapar(f.fecha)}</figcaption></figure>`
        )
        .join('')}</div>`
    : '<p class="muted">Sin evidencias fotográficas cargadas.</p>';

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
  header{display:flex;align-items:center;gap:14px;border-bottom:3px solid #152483;padding-bottom:12px;margin-bottom:16px}
  header img{height:44px;width:auto;border-radius:4px}
  .titulo{flex:1}
  .titulo h1{margin:0;font-size:17px;color:#152483;letter-spacing:-.02em}
  .titulo p{margin:2px 0 0;font-size:11px;color:#6b7280}
  .sello{border:2px solid #152483;color:#152483;font-weight:800;font-size:11px;padding:6px 12px;border-radius:6px;text-transform:uppercase}
  .sello.sv{border-color:#f16e26;color:#f16e26}
  h2{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#152483;margin:18px 0 6px;padding-bottom:4px;border-bottom:1px solid #e5e7eb}
  .cols{display:grid;grid-template-columns:1fr 1fr;gap:0 22px}
  table{width:100%;border-collapse:collapse}
  .datos th{text-align:left;width:42%;padding:3px 6px;color:#6b7280;font-weight:600;background:#f9fafb;border:1px solid #e5e7eb;white-space:nowrap}
  .datos td{padding:3px 6px;border:1px solid #e5e7eb;font-weight:600}
  .grid th{background:#152483;color:#fff;padding:5px 4px;font-size:9.5px;text-transform:uppercase;letter-spacing:.03em;border:1px solid #152483}
  .grid td{padding:4px;border:1px solid #e5e7eb;text-align:center}
  .grid tbody tr:nth-child(even){background:#f9fafb}
  .grid .tot td{background:#eef1fb;font-weight:800;color:#152483}
  .fotos{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
  .fotos figure{margin:0;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden}
  .fotos img{width:100%;height:120px;object-fit:cover;display:block}
  .fotos figcaption{font-size:8.5px;padding:3px 5px;color:#6b7280;background:#f9fafb}
  .notas{margin:0;padding-left:16px}
  .notas li{margin-bottom:5px}
  .muted{color:#9ca3af;font-style:italic}
  .firmas{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:34px;text-align:center}
  .firmas div{border-top:1px solid #374151;padding-top:5px;font-size:9.5px;color:#4b5563}
  footer{margin-top:20px;border-top:1px solid #e5e7eb;padding-top:6px;font-size:8.5px;color:#9ca3af;display:flex;justify-content:space-between}
  @page{size:A4;margin:12mm}
  @media print{body{padding:0}.fotos{break-inside:avoid}}
</style></head>
<body><div class="hoja">
  <header>
    <img src="/brand/logo-rfs.jpg" alt="RFS"/>
    <div class="titulo">
      <h1>${escapar(titulo)} ${escapar(est.codigo)}</h1>
      <p>${escapar(est.contenedor)} · ${escapar(est.codigoRfs)} ${escapar(est.tipoContenedor)} · ${escapar(
        est.naviera
      )}</p>
    </div>
    <span class="sello${conValores ? '' : ' sv'}">${conValores ? est.estado : 'Sin valores'}</span>
  </header>

  <div class="cols">
    <div>
      <h2>Datos del estimado</h2>
      <table class="datos">
        ${filaDato('Código', est.codigo)}
        ${filaDato('Semana / Año', `${est.semana} / ${est.anio}`)}
        ${filaDato('Estado', est.estado)}
        ${filaDato('Tipo de estimación', est.tipoEstimacion)}
        ${filaDato('Actividad', est.actividad)}
        ${filaDato('Técnico', est.tecnico)}
        ${filaDato('Lugar de estimación', est.lugarEstimacion)}
        ${filaDato('Niveles', est.niveles)}
      </table>
    </div>
    <div>
      <h2>Contenedor e itinerario</h2>
      <table class="datos">
        ${filaDato('Contenedor', est.contenedor)}
        ${filaDato('Modelo de máquina', est.modeloMaquina)}
        ${filaDato('Buque / Viaje', `${est.buque} · ${est.viaje}`)}
        ${filaDato('Fecha Gate In', est.fechaGateIn)}
        ${filaDato('Fecha de elaboración', est.fechaElaboracion)}
        ${filaDato('Días de estadía', String(est.diasEstadia))}
        ${filaDato('Estado PTI', est.estadoPti)}
        ${filaDato('Almacén SAP', est.almacenSap)}
      </table>
    </div>
  </div>

  <h2>Listado de daños</h2>
  ${tablaDanos(est.danos, conValores)}

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

  <h2>Evidencias fotográficas</h2>
  ${galeria}

  <div class="firmas">
    <div>Técnico estimador<br/><strong>${escapar(est.tecnico)}</strong></div>
    <div>Supervisor de patio</div>
    <div>Representante ${escapar(est.naviera)}</div>
  </div>

  <footer>
    <span>RFS — DMS Ecuador · Documento generado el ${new Date().toLocaleString('es-EC')}</span>
    <span>${escapar(est.codigo)} · ${escapar(variante)}${conValores ? '' : ' · SIN VALORES'}</span>
  </footer>
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
