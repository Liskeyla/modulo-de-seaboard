'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  CheckCircle2,
  Info,
  MessageSquare,
  Send,
  X,
  XCircle,
} from 'lucide-react';
import type {
  ComentarioDano,
  DanoEstimacion,
  RolComentario,
  TipoComentario,
} from '@/types/estimacion';
import { cn } from '@/lib/utils';

export const CAMPOS_DANO = [
  'Cs. Mat.',
  'Cs. H.H.',
  'H.H.',
  'Cant.',
  'Cargo',
  'Aplica',
  'New Met. Rep.',
  'Número de Serie Entregado',
  'Contenedor Donante',
  'Actividad',
  'Fotos',
  'Medida',
] as const;

const META_TIPO: Record<
  TipoComentario,
  { label: string; clase: string; Icon: typeof Info }
> = {
  SOLICITA_CAMBIO: {
    label: 'Solicita cambio',
    clase: 'dms-cmt-tag--cambio',
    Icon: AlertCircle,
  },
  ACEPTADO: { label: 'Aceptado', clase: 'dms-cmt-tag--aceptado', Icon: CheckCircle2 },
  RECHAZADO: { label: 'Rechazado', clase: 'dms-cmt-tag--rechazado', Icon: XCircle },
  INFORMATIVO: { label: 'Informativo', clase: 'dms-cmt-tag--info', Icon: Info },
};

const META_ROL: Record<RolComentario, { label: string; clase: string }> = {
  LIQUIDACIONES: { label: 'Liquidaciones', clase: 'dms-cmt-rol--liq' },
  TECNICO: { label: 'Técnico', clase: 'dms-cmt-rol--tec' },
  SEABOARD: { label: 'Línea SBM', clase: 'dms-cmt-rol--nav' },
  SUPERVISOR: { label: 'Supervisor', clase: 'dms-cmt-rol--sup' },
  RFS: { label: 'RFS', clase: 'dms-cmt-rol--rfs' },
};

/** El rol del comentario se deduce del usuario autenticado. */
export function rolDeUsuario(
  rolUsuario: string | undefined,
  username: string | undefined
): RolComentario {
  if (rolUsuario === 'seaboard') return 'SEABOARD';
  if (rolUsuario === 'liquidaciones') return 'LIQUIDACIONES';
  if (username === 'apptelink') return 'SUPERVISOR';
  return 'TECNICO';
}

/** Agrupa comentarios por usuario, manteniendo orden cronológico dentro de cada grupo. */
function comentariosPorUsuario(comentarios: ComentarioDano[]) {
  const orden: string[] = [];
  const mapa = new Map<string, ComentarioDano[]>();
  comentarios.forEach((c) => {
    if (!mapa.has(c.usuario)) {
      mapa.set(c.usuario, []);
      orden.push(c.usuario);
    }
    mapa.get(c.usuario)!.push(c);
  });
  return orden.map((usuario) => ({
    usuario,
    rol: mapa.get(usuario)![0].rol,
    items: mapa.get(usuario)!,
  }));
}

export type EntradaComentario = {
  tipo: TipoComentario;
  mensaje: string;
  campoAfectado?: string;
};

interface ComentariosDanoPopoverProps {
  open: boolean;
  anclaRef: React.RefObject<HTMLElement | null>;
  dano: DanoEstimacion;
  usuario: string;
  rol: RolComentario;
  soloLectura?: boolean;
  onClose: () => void;
  onEnviar: (entrada: EntradaComentario) => void;
}

/** Panel flotante (no pantalla/modal) con comentarios agrupados por usuario. */
export function ComentariosDanoPopover({
  open,
  anclaRef,
  dano,
  usuario,
  rol,
  soloLectura = false,
  onClose,
  onEnviar,
}: ComentariosDanoPopoverProps) {
  const [mensaje, setMensaje] = useState('');
  const [tipo, setTipo] = useState<TipoComentario>('INFORMATIVO');
  const [campo, setCampo] = useState('');
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setMensaje('');
      setCampo('');
      setTipo(rol === 'LIQUIDACIONES' ? 'SOLICITA_CAMBIO' : 'INFORMATIVO');
    }
  }, [open, rol]);

  useLayoutEffect(() => {
    if (!open || !anclaRef.current) {
      setPos(null);
      return;
    }
    const rect = anclaRef.current.getBoundingClientRect();
    const ancho = Math.min(352, window.innerWidth - 16);
    let left = rect.right - ancho;
    if (left < 8) left = 8;
    let top = rect.bottom + 6;
    if (top + 320 > window.innerHeight) {
      top = Math.max(8, rect.top - 326);
    }
    setPos({ top, left });
  }, [open, anclaRef, dano.id, dano.comentarios.length]);

  useEffect(() => {
    if (!open) return;
    function alClickFuera(e: MouseEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (anclaRef.current?.contains(t)) return;
      onClose();
    }
    function alEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    function alScroll() {
      onClose();
    }
    document.addEventListener('mousedown', alClickFuera);
    document.addEventListener('keydown', alEscape);
    window.addEventListener('scroll', alScroll, true);
    return () => {
      document.removeEventListener('mousedown', alClickFuera);
      document.removeEventListener('keydown', alEscape);
      window.removeEventListener('scroll', alScroll, true);
    };
  }, [open, onClose, anclaRef]);

  const porUsuario = useMemo(
    () => comentariosPorUsuario(dano.comentarios),
    [dano.comentarios]
  );
  const pendientes = useMemo(
    () => dano.comentarios.filter((c) => c.tipo === 'SOLICITA_CAMBIO').length,
    [dano.comentarios]
  );

  if (!open || !pos || typeof document === 'undefined') return null;

  const puedeEnviar = mensaje.trim().length >= 3;

  return createPortal(
    <div
      ref={panelRef}
      className="dms-cmt-popover"
      style={{ top: pos.top, left: pos.left }}
      role="dialog"
      aria-label={`Comentarios línea ${dano.linea}`}
    >
      <header className="dms-cmt-popover-header">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-bold text-rfs-700">
            <MessageSquare className="h-3.5 w-3.5 shrink-0" />
            Comentarios · L{String(dano.linea).padStart(2, '0')} · {dano.comp}
          </p>
          <p className="mt-0.5 truncate text-[10px] text-slate-500">
            {dano.comentarios.length} comentario(s)
            {pendientes > 0 ? ` · ${pendientes} pendiente(s)` : ''}
          </p>
        </div>
        <button
          type="button"
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          onClick={onClose}
          aria-label="Cerrar comentarios"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      <div className="dms-cmt-popover-body">
        {porUsuario.length === 0 ? (
          <p className="px-3 py-5 text-center text-[11px] text-slate-400">
            Sin comentarios todavía.
          </p>
        ) : (
          porUsuario.map((grupo) => {
            const metaRol = META_ROL[grupo.rol];
            return (
              <section key={grupo.usuario} className="dms-cmt-usuario">
                <div className="dms-cmt-usuario-cabecera">
                  <span className={cn('dms-cmt-rol', metaRol.clase)}>{metaRol.label}</span>
                  <span className="text-[11px] font-bold text-slate-800">{grupo.usuario}</span>
                  <span className="ml-auto text-[10px] tabular-nums text-slate-400">
                    {grupo.items.length} msg
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {grupo.items.map((c) => {
                    const metaTipo = META_TIPO[c.tipo];
                    const Icon = metaTipo.Icon;
                    return (
                      <li key={c.id} className="dms-cmt-usuario-msg">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={cn('dms-cmt-tag', metaTipo.clase)}>
                            <Icon className="h-2.5 w-2.5" />
                            {metaTipo.label}
                          </span>
                          <span className="text-[10px] tabular-nums text-slate-400">{c.fecha}</span>
                        </div>
                        <p className="mt-1 text-[11px] leading-snug text-slate-700">{c.mensaje}</p>
                        {c.campoAfectado && (
                          <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-rfsorange-600">
                            Campo: {c.campoAfectado}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })
        )}
      </div>

      {!soloLectura && (
        <div className="dms-cmt-popover-nuevo">
          <div className="flex flex-wrap gap-1.5">
            <select
              className="dms-select min-w-0 flex-1 text-[11px]"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoComentario)}
            >
              {(Object.keys(META_TIPO) as TipoComentario[]).map((t) => (
                <option key={t} value={t}>
                  {META_TIPO[t].label}
                </option>
              ))}
            </select>
            <select
              className="dms-select min-w-0 flex-1 text-[11px]"
              value={campo}
              disabled={tipo !== 'SOLICITA_CAMBIO'}
              onChange={(e) => setCampo(e.target.value)}
            >
              <option value="">Campo…</option>
              {CAMPOS_DANO.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-1.5 flex gap-1.5">
            <textarea
              rows={2}
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder={`Comentar como ${usuario}…`}
              className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-[11px] focus:border-rfsorange-500 focus:outline-none focus:ring-1 focus:ring-rfsorange-500/30"
            />
            <button
              type="button"
              className="dms-btn-primary shrink-0 self-end px-2.5 py-2 text-xs disabled:opacity-40"
              disabled={!puedeEnviar}
              title="Publicar"
              onClick={() => {
                onEnviar({
                  tipo,
                  mensaje: mensaje.trim(),
                  campoAfectado: tipo === 'SOLICITA_CAMBIO' && campo ? campo : undefined,
                });
                setMensaje('');
                setCampo('');
              }}
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
