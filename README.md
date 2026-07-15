# Módulo Seaboard — Estimaciones DMS

Prototipo frontend del **Reporte de Estimaciones** (DMS) y **Aprobaciones Estimados Seaboard**, con datos de ejemplo y flujo de estados sincronizado en `localStorage`.

Repositorio: [Liskeyla/modulo-de-seaboard](https://github.com/Liskeyla/modulo-de-seaboard)

## Módulos

| Módulo | Ruta | Descripción |
|--------|------|-------------|
| Login | `/login` | Acceso demo por rol |
| Reporte de Estimaciones | `/reportes/estimaciones` | Filtros, tabla y envío a aprobación |
| Aprobaciones Seaboard | `/aprobaciones/seaboard` | Aprobar / rechazar / reversar |

## Usuarios demo

| Usuario | Contraseña | Rol |
|---------|------------|-----|
| `apptelink` | `admin123` | DMS — Reporte de estimaciones |
| `seaboard` | `admin123` | Seaboard — Aprobaciones |

## Desarrollo local

```bash
npm install
npm run dev
```

Abrir: http://127.0.0.1:3040

## Producción (Vercel)

1. Importar el repo en [vercel.com/new](https://vercel.com/new)
2. Framework: **Next.js** (auto-detectado)
3. Build Command: `npm run build`
4. Deploy

O con CLI:

```bash
npm i -g vercel
vercel
```

Cada push a `main` desplegará producción automáticamente.

## Build local de producción

```bash
npm run build
npm start
```

## Flujo de estados

```
PENDIENTE  →  Enviar Aprobación  →  ENVIADO
ENVIADO    →  Aprobar            →  APROBADO
ENVIADO    →  Rechazar + comentario →  RECHAZADO
ENVIADO    →  Reversar + comentario →  REVERSADO
APROBADO   →  Reversar Aprobación   →  PENDIENTE
```

## Stack

- Next.js 15 (App Router)
- React 19 + Tailwind CSS
- Zustand (estado en memoria / localStorage)
- Lucide React
