'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquare, Send, X } from 'lucide-react';
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
  'Estado',
  'New Met. Rep.',
  'Número de Serie Entregado',
  'Contenedor Donante',
  'Actividad',
  'Fotos',
  'Medida',
] as const;

const ROL_CORTO: Record<RolComentario, string> = {
  LIQUIDACIONES: 'Liquidaciones',
  TECNICO: 'Técnico',
  SEABOARD: 'Seaboard',
  SUPERVISOR: 'Supervisor',
  RFS: 'RFS',
  COORDINADOR: 'Coordinador',
};

const ROL_CLASE: Record<RolComentario, string> = {
  LIQUIDACIONES: 'dms-cmt-rol--liq',
  TECNICO: 'dms-cmt-rol--tec',
  SEABOARD: 'dms-cmt-rol--nav',
  SUPERVISOR: 'dms-cmt-rol--sup',
  RFS: 'dms-cmt-rol--rfs',
  COORDINADOR: 'dms-cmt-rol--coord',
};

/** El rol del comentario se deduce del usuario autenticado. */
export function rolDeUsuario(
  rolUsuario: string | undefined,
  _username?: string | undefined
): RolComentario {
  if (rolUsuario === 'seaboard') return 'SEABOARD';
  if (rolUsuario === 'liquidaciones') return 'LIQUIDACIONES';
  if (rolUsuario === 'dms') return 'RFS';
  if (rolUsuario === 'coordinador') return 'COORDINADOR';
  return 'SEABOARD';
}

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

function etiquetaTipo(tipo: TipoComentario): string | null {
  if (tipo === 'SOLICITA_CAMBIO') return 'Pendiente de respuesta';
  if (tipo === 'ACEPTADO') return 'Aceptado';
  if (tipo === 'RECHAZADO') return 'Rechazado';
  return null;
}

function ordenCronologico(comentarios: ComentarioDano[]) {
  return [...comentarios].sort((a, b) => {
    const ta = a.fecha;
    const tb = b.fecha;
    return ta.localeCompare(tb, 'es');
  });
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

/**
 * Panel de comentarios simplificado: hilo legible (quién · cuándo · mensaje)
 * y un solo campo para escribir.
 */
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
  const [solicitaCambio, setSolicitaCambio] = useState(false);
  const [campo, setCampo] = useState('');
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setMensaje('');
      setCampo('');
      setSolicitaCambio(rol === 'LIQUIDACIONES');
    }
  }, [open, rol]);

  useLayoutEffect(() => {
    if (!open || !anclaRef.current) {
      setPos(null);
      return;
    }
    function actualizarPosicion() {
      if (!anclaRef.current) return;
      const rect = anclaRef.current.getBoundingClientRect();
      const ancho = Math.min(380, window.innerWidth - 16);
      let left = rect.right - ancho;
      if (left < 8) left = 8;
      let top = rect.bottom + 6;
      if (top + 420 > window.innerHeight) {
        top = Math.max(8, rect.top - 426);
      }
      setPos({ top, left });
    }
    actualizarPosicion();
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
    /** No cerrar al scrollear el hilo de comentarios; solo reposicionar si se mueve el ancla. */
    function alScroll(e: Event) {
      const target = e.target;
      if (target instanceof Node && panelRef.current?.contains(target)) return;
      if (!anclaRef.current) {
        onClose();
        return;
      }
      const rect = anclaRef.current.getBoundingClientRect();
      const ancho = Math.min(380, window.innerWidth - 16);
      let left = rect.right - ancho;
      if (left < 8) left = 8;
      let top = rect.bottom + 6;
      if (top + 420 > window.innerHeight) {
        top = Math.max(8, rect.top - 426);
      }
      // Si el ancla salió de la ventana, cerrar; si no, mantener abierto y mover el panel.
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        onClose();
        return;
      }
      setPos({ top, left });
    }
    document.addEventListener('mousedown', alClickFuera);
    document.addEventListener('keydown', alEscape);
    window.addEventListener('scroll', alScroll, true);
    window.addEventListener('resize', alScroll);
    return () => {
      document.removeEventListener('mousedown', alClickFuera);
      document.removeEventListener('keydown', alEscape);
      window.removeEventListener('scroll', alScroll, true);
      window.removeEventListener('resize', alScroll);
    };
  }, [open, onClose, anclaRef]);

  const hilo = useMemo(() => ordenCronologico(dano.comentarios), [dano.comentarios]);
  const pendientes = useMemo(
    () => dano.comentarios.filter((c) => c.tipo === 'SOLICITA_CAMBIO').length,
    [dano.comentarios]
  );

  useEffect(() => {
    if (!open || !listaRef.current) return;
    listaRef.current.scrollTop = listaRef.current.scrollHeight;
  }, [open, hilo.length]);

  if (!open || !pos || typeof document === 'undefined') return null;

  const puedeEnviar = mensaje.trim().length >= 3;
  const esLiq = rol === 'LIQUIDACIONES';

  function publicar() {
    if (!puedeEnviar) return;
    onEnviar({
      tipo: solicitaCambio ? 'SOLICITA_CAMBIO' : 'INFORMATIVO',
      mensaje: mensaje.trim(),
      campoAfectado: solicitaCambio && campo ? campo : undefined,
    });
    setMensaje('');
    setCampo('');
    if (!esLiq) setSolicitaCambio(false);
  }

  return createPortal(
    <div
      ref={panelRef}
      className="dms-cmt-popover"
      style={{ top: pos.top, left: pos.left, width: Math.min(380, window.innerWidth - 16) }}
      role="dialog"
      aria-label={`Comentarios línea ${dano.linea}`}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <header className="dms-cmt-popover-header">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
            <MessageSquare className="h-4 w-4 shrink-0 text-rfs-700" />
            Comentarios
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Línea {String(dano.linea).padStart(2, '0')} · {dano.comp}
            {pendientes > 0 ? (
              <span className="ml-1.5 font-semibold text-amber-700">
                · {pendientes} pendiente{pendientes === 1 ? '' : 's'}
              </span>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          onClick={onClose}
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div ref={listaRef} className="dms-cmt-popover-body">
        {hilo.length === 0 ? (
          <div className="dms-cmt-vacio">
            <MessageSquare className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 font-medium text-slate-600">Aún no hay comentarios</p>
            <p className="mt-0.5 text-slate-400">
              Escriba abajo para dejar una nota sobre este ítem.
            </p>
          </div>
        ) : (
          hilo.map((c) => {
            const propio =
              c.usuario === usuario ||
              c.usuario.includes(`(${usuario})`) ||
              c.usuario.startsWith(`${usuario} `);
            const etiqueta = etiquetaTipo(c.tipo);
            return (
              <article
                key={c.id}
                className={cn(
                  'dms-cmt-burbuja',
                  c.tipo === 'SOLICITA_CAMBIO' && 'dms-cmt-burbuja--pendiente',
                  propio && 'dms-cmt-burbuja--propia'
                )}
              >
                <div className="dms-cmt-burbuja-meta">
                  <span className="dms-cmt-avatar" aria-hidden>
                    {iniciales(c.usuario)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                      <span className="truncate text-[12px] font-bold text-slate-800">
                        {c.usuario}
                      </span>
                      <span className={cn('dms-cmt-rol', ROL_CLASE[c.rol])}>
                        {ROL_CORTO[c.rol]}
                      </span>
                    </div>
                    <p className="text-[10px] tabular-nums text-slate-400">{c.fecha}</p>
                  </div>
                  {etiqueta && (
                    <span
                      className={cn(
                        'dms-cmt-estado',
                        c.tipo === 'SOLICITA_CAMBIO' && 'dms-cmt-estado--pendiente',
                        c.tipo === 'ACEPTADO' && 'dms-cmt-estado--ok',
                        c.tipo === 'RECHAZADO' && 'dms-cmt-estado--no'
                      )}
                    >
                      {etiqueta}
                    </span>
                  )}
                </div>
                <p className="dms-cmt-burbuja-texto">{c.mensaje}</p>
                {c.campoAfectado &&
                  c.tipo === 'SOLICITA_CAMBIO' &&
                  c.campoAfectado !== 'Motivo del cambio' &&
                  c.campoAfectado !== 'Comentarios línea SBM' && (
                    <p className="dms-cmt-burbuja-campo">Campo: {c.campoAfectado}</p>
                  )}
              </article>
            );
          })
        )}
      </div>

      {!soloLectura && (
        <div className="dms-cmt-popover-nuevo">
          {(esLiq || solicitaCambio) && (
            <label className="dms-cmt-opcion">
              <input
                type="checkbox"
                checked={solicitaCambio}
                onChange={(e) => setSolicitaCambio(e.target.checked)}
              />
              <span>Pedir un cambio en este ítem</span>
            </label>
          )}
          {solicitaCambio && (
            <select
              className="dms-select mb-1.5 w-full text-[12px]"
              value={campo}
              onChange={(e) => setCampo(e.target.value)}
            >
              <option value="">¿Qué campo? (opcional)</option>
              {CAMPOS_DANO.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          {!esLiq && !solicitaCambio && (
            <button
              type="button"
              className="dms-cmt-link-opcion"
              onClick={() => setSolicitaCambio(true)}
            >
              + Pedir un cambio en un campo
            </button>
          )}
          <div className="flex items-end gap-2">
            <textarea
              rows={2}
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  publicar();
                }
              }}
              placeholder="Escriba su comentario…"
              className="dms-cmt-input"
            />
            <button
              type="button"
              className="dms-btn-primary shrink-0 px-3 py-2.5 text-sm disabled:opacity-40"
              disabled={!puedeEnviar}
              title="Enviar comentario"
              onClick={publicar}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 text-[10px] text-slate-400">
            Enter para enviar · Shift+Enter para nueva línea
          </p>
        </div>
      )}
      {soloLectura && (
        <p className="border-t border-slate-100 px-3 py-2 text-center text-[11px] text-slate-400">
          Solo lectura · no puede publicar comentarios
        </p>
      )}
    </div>,
    document.body
  );
}
