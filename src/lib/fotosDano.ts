/** Archivos de esquema/rayado/firma extraídos del PDF; no son fotos reales de daño. */
const FOTOS_ESQUEMA = new Set([
  'ec_179066_01.jpg',
  'ec_179066_02.jpg',
  'ec_179066_03.jpg',
  'ec_179066_04.jpg',
  'ec_179067_01.jpg',
  'ec_179067_02.jpg',
  'ec_179067_03.jpg',
  'ec_179067_04.jpg',
]);

/** True si la URL apunta a un esquema de ubicación (rayado), no a evidencia fotográfica. */
export function esFotoEsquema(url: string) {
  const nombre = String(url || '')
    .split(/[\\/]/)
    .pop()
    ?.toLowerCase();
  if (!nombre) return false;
  if (FOTOS_ESQUEMA.has(nombre)) return true;
  // Heurística: rayados suelen nombrarse explícitamente.
  return /rayado|scratch|esquema|diagrama/.test(nombre);
}

export function fotosRealesDano<T extends { url: string; tipo?: string }>(fotos: T[]): T[] {
  return fotos.filter((f) => f.tipo !== 'REPARADO' && !esFotoEsquema(f.url));
}
