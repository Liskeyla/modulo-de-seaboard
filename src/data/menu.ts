export interface MenuItem {
  href: string;
  label: string;
  icon: string;
  descripcion: string;
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
        label: 'Reporte de Estimaciones',
        icon: 'FileBarChart',
        descripcion: 'Consulta y envío a aprobación',
      },
      {
        href: '/aprobaciones/seaboard',
        label: 'Aprobaciones Seaboard',
        icon: 'ClipboardCheck',
        descripcion: 'Aprobar, rechazar o reversar',
      },
    ],
  },
];

export function grupoDeRuta(pathname: string): string | undefined {
  for (const g of MENU_GRUPOS) {
    if (g.items.some((i) => pathname === i.href || pathname.startsWith(i.href + '/'))) {
      return g.id;
    }
  }
  return undefined;
}
