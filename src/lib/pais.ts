export const PAISES = ['ECUADOR', 'PERU'] as const;
export type PaisOperacion = (typeof PAISES)[number];

export const PAISES_UI: {
  id: PaisOperacion;
  label: string;
  zona: string;
  locale: string;
}[] = [
  { id: 'ECUADOR', label: 'Ecuador', zona: 'America/Guayaquil', locale: 'es-EC' },
  { id: 'PERU', label: 'Perú', zona: 'America/Lima', locale: 'es-PE' },
];

export function metaPais(id: PaisOperacion) {
  return PAISES_UI.find((p) => p.id === id) ?? PAISES_UI[0];
}

/**
 * País de la estimación. El seed trae `pais`; si falta, se infiere del código.
 */
export function paisDe(e: { pais?: PaisOperacion; codigo: string }): PaisOperacion {
  if (e.pais) return e.pais;
  const digits = e.codigo.replace(/\D/g, '');
  const ultimo = Number(digits.slice(-1) || '1');
  return ultimo === 0 || ultimo === 5 ? 'PERU' : 'ECUADOR';
}
