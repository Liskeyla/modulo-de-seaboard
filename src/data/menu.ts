export interface MenuItem {
  href: string;
  label: string;
  icon: string;
  descripcion: string;
  /** Si se omite, visible para todos los roles. */
  roles?: Array<'dms' | 'seaboard' | 'liquidaciones' | 'coordinador'>;
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
        label: 'Aprobaciones de Estimados',
        icon: 'ClipboardCheck',
        descripcion: 'Enviar a SBM (Seaboard), reversar y eliminar',
        roles: ['liquidaciones'],
      },
      {
        href: '/reportes/items-dano',
        label: 'Reportería de ítems',
        icon: 'ListChecks',
        descripcion: 'Aprobados, rechazados y pendientes · auditoría por componente',
        roles: ['liquidaciones'],
      },
      {
        href: '/catalogos/cargos',
        label: 'Catálogo de cargo',
        icon: 'BookOpen',
        descripcion: 'Reglas de rechazo / envío por cargo (condiciones configurables)',
        roles: ['liquidaciones'],
      },
      {
        href: '/catalogos/monto-reparacion',
        label: 'Lista Monto Reparación',
        icon: 'DollarSign',
        descripcion: 'Rangos y condiciones de autoaprobación de estimados',
        roles: ['liquidaciones'],
      },
      {
        href: '/reportes/estimaciones',
        label: 'Reporte de Estimaciones Seaboard Marine',
        icon: 'FileBarChart',
        descripcion: 'Ver, modificar con histórico y devolver a liquidaciones',
        roles: ['seaboard', 'dms'],
      },
      {
        href: '/reportes/estimaciones',
        label: 'Estimaciones · Coordinador',
        icon: 'FileBarChart',
        descripcion: 'Crear y modificar estimados; Liquidaciones envía a la línea',
        roles: ['coordinador'],
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
