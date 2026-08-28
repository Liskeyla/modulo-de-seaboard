import type {
  CampoSnapshotLinea,
  ComentarioDano,
  DanoEstimacion,
  EdicionRecienteDano,
  HistorialAccionItem,
  SnapshotLineaDano,
  TipoAccionHistorialItem,
} from '@/types/estimacion';
import { normalizarAplicaDano, normalizarCargoDano } from '@/types/estimacion';
import { resumirCambiosAntesDespues } from '@/lib/cambioAntesDespues';

function uidHistorial() {
  return `ha-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Ordena "dd/mm/yyyy hh:mm[:ss]" cronológicamente (más reciente primero). */
export function timestampHistorial(fecha: string) {
  const m = fecha.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return 0;
  return new Date(
    Number(m[3]),
    Number(m[2]) - 1,
    Number(m[1]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6] ?? 0)
  ).getTime();
}

export function appendHistorialItem(
  historial: HistorialAccionItem[] | undefined,
  entrada: Omit<HistorialAccionItem, 'id'> & { id?: string }
): HistorialAccionItem[] {
  return [...(historial ?? []), { ...entrada, id: entrada.id ?? uidHistorial() }];
}

export function entradaCreacionItem(
  dano: DanoEstimacion,
  usuario: string,
  fecha: string
): HistorialAccionItem {
  return {
    id: uidHistorial(),
    fecha,
    usuario,
    tipo: 'CREACION',
    accion: 'Alta de ítem',
    cambio: `Línea ${dano.linea} · ${dano.comp} · ${dano.dano} · $${dano.csTotal.toFixed(2)}`,
    estadoNuevo: normalizarAplicaDano(dano.aplica),
  };
}

export function entradaAprobacionItem(
  dano: DanoEstimacion,
  usuario: string,
  fecha: string,
  comentario: string
): HistorialAccionItem {
  return {
    id: uidHistorial(),
    fecha,
    usuario,
    tipo: 'APROBACION',
    accion: 'Aprobación de ítem',
    cambio: 'Decisión Seaboard: ítem aprobado',
    estadoAnterior: normalizarAplicaDano(dano.aplica),
    estadoNuevo: 'Aprobado',
    comentario,
  };
}

export function entradaRechazoItem(
  dano: DanoEstimacion,
  usuario: string,
  fecha: string,
  comentario: string
): HistorialAccionItem {
  return {
    id: uidHistorial(),
    fecha,
    usuario,
    tipo: 'RECHAZO',
    accion: 'Rechazo de ítem',
    cambio: 'Decisión Seaboard: ítem rechazado · costos en $0',
    estadoAnterior: normalizarAplicaDano(dano.aplica),
    estadoNuevo: 'Rechazado',
    comentario,
  };
}

export function entradaReversaItem(
  dano: DanoEstimacion,
  usuario: string,
  fecha: string,
  comentario: string
): HistorialAccionItem {
  return {
    id: uidHistorial(),
    fecha,
    usuario,
    tipo: 'REVERSA',
    accion: 'Reversa de aprobación',
    cambio: 'Ítem devuelto a Pendiente de revisión para modificación',
    estadoAnterior: normalizarAplicaDano(dano.aplica),
    estadoNuevo: 'Pendiente de revisión',
    comentario,
  };
}

export function entradaComentarioItem(c: ComentarioDano): HistorialAccionItem {
  const esDecision = c.tipo === 'ACEPTADO' || c.tipo === 'RECHAZADO';
  return {
    id: c.id,
    fecha: c.fecha,
    usuario: c.usuario,
    tipo: esDecision ? (c.tipo === 'RECHAZADO' ? 'RECHAZO' : 'APROBACION') : 'COMENTARIO',
    accion: esDecision
      ? c.tipo === 'RECHAZADO'
        ? 'Rechazo de ítem'
        : 'Aprobación de ítem'
      : `Comentario · ${c.rol}`,
    cambio: c.campoAfectado
      ? `${c.campoAfectado}${c.valorAnterior ? `: ${c.valorAnterior}` : ''}${c.valorNuevo ? ` → ${c.valorNuevo}` : ''}`
      : c.mensaje,
    estadoAnterior: esDecision ? parseEstadoDeValor(c.valorAnterior) : undefined,
    estadoNuevo: esDecision ? parseEstadoDeValor(c.valorNuevo) : undefined,
    comentario: c.mensaje,
  };
}

function parseEstadoDeValor(valor?: string) {
  if (!valor) return undefined;
  const parte = valor.split(' · ')[0]?.trim();
  return parte ? normalizarAplicaDano(parte) : undefined;
}

export function entradaDesdeEdicionReciente(ed: EdicionRecienteDano): HistorialAccionItem {
  const estadoAnt = ed.snapshotAnterior?.aplica
    ? normalizarAplicaDano(ed.snapshotAnterior.aplica)
    : undefined;
  const estadoNue = ed.snapshot?.aplica ? normalizarAplicaDano(ed.snapshot.aplica) : undefined;
  const cargoAnt = ed.snapshotAnterior?.cargo
    ? normalizarCargoDano(ed.snapshotAnterior.cargo)
    : undefined;
  const cargoNue = ed.snapshot?.cargo ? normalizarCargoDano(ed.snapshot.cargo) : undefined;

  let tipo: TipoAccionHistorialItem = 'MODIFICACION';
  let accion = 'Modificación de ítem';
  if (estadoAnt && estadoNue && estadoAnt !== estadoNue && cargoAnt === cargoNue) {
    tipo = 'CAMBIO_ESTADO';
    accion = 'Cambio de estado';
  } else if (cargoAnt && cargoNue && cargoAnt !== cargoNue && estadoAnt === estadoNue) {
    tipo = 'CAMBIO_CARGO';
    accion = 'Cambio de cargo';
  }

  return {
    id: uidHistorial(),
    fecha: ed.fecha,
    usuario: ed.usuario,
    tipo,
    accion,
    cambio:
      ed.snapshotAnterior && ed.snapshot && ed.camposCambiados?.length
        ? resumirCambiosAntesDespues(ed.snapshotAnterior, ed.snapshot, ed.camposCambiados) ||
          ed.resumenCambios
        : ed.resumenCambios,
    estadoAnterior: estadoAnt !== estadoNue ? estadoAnt : undefined,
    estadoNuevo: estadoAnt !== estadoNue ? estadoNue : undefined,
    comentario: ed.comentarioSbm,
    camposCambiados: ed.camposCambiados,
    snapshotAnterior: ed.snapshotAnterior,
    snapshot: ed.snapshot,
  };
}

export function construirEntradaDesdeCambios(
  anterior: DanoEstimacion,
  actualizado: DanoEstimacion,
  usuario: string,
  fecha: string,
  etiqueta: string,
  opts?: { comentario?: string; edicionReciente?: EdicionRecienteDano }
): HistorialAccionItem {
  if (opts?.edicionReciente) {
    return entradaDesdeEdicionReciente(opts.edicionReciente);
  }

  const estadoAnt = normalizarAplicaDano(anterior.aplica);
  const estadoNue = normalizarAplicaDano(actualizado.aplica);
  const cargoAnt = normalizarCargoDano(anterior.cargo);
  const cargoNue = normalizarCargoDano(actualizado.cargo);

  let tipo: TipoAccionHistorialItem = 'MODIFICACION';
  let accion = 'Modificación de ítem';
  let cambio = etiqueta;

  if (estadoAnt !== estadoNue && cargoAnt === cargoNue) {
    tipo = 'CAMBIO_ESTADO';
    accion = 'Cambio de estado';
    cambio = `Estado: ${estadoAnt} → ${estadoNue}`;
  } else if (cargoAnt !== cargoNue && estadoAnt === estadoNue) {
    tipo = 'CAMBIO_CARGO';
    accion = 'Cambio de cargo';
    cambio = `Cargo: ${cargoAnt} → ${cargoNue}`;
  } else if (cargoAnt !== cargoNue && estadoAnt !== estadoNue) {
    cambio = `${etiqueta} · Cargo: ${cargoAnt} → ${cargoNue} · Estado: ${estadoAnt} → ${estadoNue}`;
  }

  return {
    id: uidHistorial(),
    fecha,
    usuario,
    tipo,
    accion,
    cambio,
    estadoAnterior: estadoAnt !== estadoNue ? estadoAnt : undefined,
    estadoNuevo: estadoAnt !== estadoNue ? estadoNue : undefined,
    comentario: opts?.comentario,
  };
}

/** Reconstruye historial a partir de comentarios y última edición (datos legacy). */
export function reconstruirHistorialItem(d: DanoEstimacion): HistorialAccionItem[] {
  const vistos = new Set<string>();
  const items: HistorialAccionItem[] = [];

  const push = (h: HistorialAccionItem) => {
    const key = `${h.fecha}|${h.tipo}|${h.cambio}|${h.comentario ?? ''}`;
    if (vistos.has(key)) return;
    vistos.add(key);
    items.push(h);
  };

  d.comentarios.forEach((c) => {
    if (c.tipo === 'ACEPTADO' || c.tipo === 'RECHAZADO' || c.campoAfectado === 'Estado') {
      push(entradaComentarioItem(c));
    }
  });

  if (d.edicionReciente) {
    push(entradaDesdeEdicionReciente(d.edicionReciente));
  }

  d.comentarios.forEach((c) => {
    if (c.tipo !== 'ACEPTADO' && c.tipo !== 'RECHAZADO') {
      push(entradaComentarioItem(c));
    }
  });

  items.sort((a, b) => timestampHistorial(b.fecha) - timestampHistorial(a.fecha));
  return items;
}

export function historialItemOrdenado(d: DanoEstimacion): HistorialAccionItem[] {
  const base =
    d.historialAcciones && d.historialAcciones.length > 0
      ? d.historialAcciones
      : reconstruirHistorialItem(d);
  return [...base].sort((a, b) => timestampHistorial(b.fecha) - timestampHistorial(a.fecha));
}
