export interface MenuItem {
  href: string;
  label: string;
  icon: string;
  descripcion: string;
  /** Si se omite, visible para todos los roles. */
  roles?: Array<'dms' | 'seaboard' | 'liquidaciones'>;
}

export interface MenuGrupo {
  id: string;
  titulo: string;
  icon: string;
  items: MenuItem[];
}

export const MENU_GRUPOS: MenuGrupo[] = [
  {
    id: 'estimaciones',
    titulo: 'Estimaciones',
    icon: 'FileBarChart',
    items: [
      {
        href: '/reportes/estimaciones',
        label: 'Reporte de Estimaciones Seaboard Marine',
        icon: 'FileBarChart',
        descripcion: 'Ver, comentar, modificar y enviar a liquidaciones',
      },
      {
        href: '/aprobaciones/seaboard',
        label: 'Aprobaciones Seaboard',
        icon: 'ClipboardCheck',
        descripcion: 'Bandeja de estimados ENVIADO · decisión a liquidaciones',
        roles: ['dms', 'seaboard'],
      },
    ],
  },
];

export function menuParaRol(rol: string | undefined): MenuGrupo[] {
  const r = rol ?? 'dms';
  return MENU_GRUPOS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.roles || i.roles.includes(r as 'dms')),
  })).filter((g) => g.items.length > 0);
}

export function grupoDeRuta(pathname: string): string | undefined {
  for (const g of MENU_GRUPOS) {
    if (g.items.some((i) => pathname === i.href || pathname.startsWith(i.href + '/'))) {
      return g.id;
    }
  }
  return undefined;
}
