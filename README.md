# Módulo Seaboard — Estimaciones DMS

Prototipo frontend del **Reporte de Estimaciones** (DMS), el **detalle del estimado** y las
**Aprobaciones Estimados Seaboard**. Los datos provienen del export real de producción
(71 estimaciones de la semana 34 / 2026) y el flujo de estados se persiste en `localStorage`.

Repositorio: [Liskeyla/modulo-de-seaboard](https://github.com/Liskeyla/modulo-de-seaboard)

## Módulos

| Módulo | Ruta | Descripción |
|--------|------|-------------|
| Login | `/login` | Acceso demo por rol |
| Reporte de Estimaciones | `/reportes/estimaciones` | 33 columnas de producción, filtros, actividad editable y acciones por fila |
| Detalle del Estimado | `/reportes/estimaciones/[codigo]` | Listado de daños, notas, evidencias, descargas y comentarios de liquidaciones |
| Aprobaciones Seaboard | `/aprobaciones/seaboard` | Aprobar / rechazar / reversar |

## Usuarios demo

| Usuario | Contraseña | Rol | Publica comentarios como |
|---------|------------|-----|--------------------------|
| `apptelink` | `admin123` | DMS | Supervisor |
| `seaboard` | `admin123` | Seaboard | Naviera |
| `cesarvalencia` | `admin123` | Liquidaciones | Liquidaciones |

El rol determina la etiqueta con la que se firman los comentarios del listado de daños y qué
botones de aprobación se muestran en el detalle.

## Datos

`src/data/estimacionesSeed.json` se genera a partir del export del DMS de producción:

```bash
node scripts/build-seed.cjs "ruta/Reporte de Estimaciones  RFS - DMS Ecuador.xlsx"
```

El generador es determinista: conserva los 71 registros reales, deriva las líneas de daño a partir
de los valores de PVP de cada fila y reetiqueta seis filas `PENDIENTE` como `ENVIADO` / `RECHAZADO`
para que los cinco estados sean visibles en la demo.

`ERSBM-2026-179105` (`SEKU9116736`) replica exactamente la pantalla de producción: una línea
`SVL-R54` por `$20.00`, la nota "RS4 activos" y las 13 fotos reales del contenedor.

## Trazabilidad con liquidaciones

Cada línea del listado de daños tiene una columna **Comentarios** que abre un hilo con:

- el usuario y la hora de cada intervención,
- el área que escribe (Liquidaciones, Técnico, Naviera, Supervisor),
- la intención del mensaje (Solicita cambio / Aceptado / Rechazado / Informativo),
- el **campo a modificar** cuando se solicita un cambio (Cs. Mat., Cant., Cargo, H.H., etc.).

Todo lo publicado se refleja además en **Historial de Actividad de Estimación**, junto con los
cambios de estado, de actividad y de tarifas, y se puede exportar a CSV.

## Descargas

El menú **Descargas** del detalle genera archivos reales en el navegador:

| Opción | Resultado |
|--------|-----------|
| Fotos (todas / daños / reparados) | `.zip` con las evidencias y un `LEEME.txt` de contexto |
| Informe de Estimado | Previsualización e impresión / *Guardar como PDF* |
| Informe sin Valores | Misma versión ocultando las columnas de costo |
| Historial de Actividad | Timeline en pantalla + export CSV |

Desde el reporte, **Descargar Data Log** genera el CSV de lecturas del reefer.

## Desarrollo local

```bash
npm install
npm run dev
```

Abrir: http://127.0.0.1:3040

> **Windows + OneDrive:** si el proyecto vive en una carpeta sincronizada por OneDrive,
> `next dev` y `next build` pueden fallar con `UNKNOWN: unknown error, read` (errno `-4094`)
> porque Node no puede leer los archivos marcados como "solo en la nube". La solución es copiar el
> proyecto a una ruta local (por ejemplo `C:\RFS-DMS\`) o marcar la carpeta como
> *Mantener siempre en este dispositivo* y esperar a que termine de descargarse.

## Build local de producción

```bash
npm run build
npm start
```

## Producción (Vercel)

1. Importar el repo en [vercel.com/new](https://vercel.com/new)
2. Framework: **Next.js** (auto-detectado)
3. Build Command: `npm run build`
4. Deploy

## Flujo de estados

```
PENDIENTE / RECHAZADO  →  Enviar Aprobación     →  ENVIADO
ENVIADO                →  Aprobar               →  APROBADO
ENVIADO                →  Rechazar + comentario →  RECHAZADO
APROBADO               →  Marcar Reparado       →  REPARADO
APROBADO / REPARADO    →  Reversar Aprobación   →  PENDIENTE
```

Los estimados solo son editables en `PENDIENTE`, `RECHAZADO` y `REVERSADO`; al aprobarse quedan en
solo lectura.

## Stack

- Next.js 15 (App Router)
- React 19 + Tailwind CSS
- Zustand (estado en memoria / localStorage)
- Lucide React
- JSZip (empaquetado de evidencias) · SheetJS (export a Excel)
