'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Info,
  MessageSquare,
  Send,
  XCircle,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import type {
  DanoEstimacion,
  Estimacion,
  RolComentario,
  TipoComentario,
} from '@/types/estimacion';
import { cn, formatMoney } from '@/lib/utils';

/** Campos del daño sobre los que liquidaciones suele pedir una corrección. */
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
  SEABOARD: { label: 'Naviera', clase: 'dms-cmt-rol--nav' },
  SUPERVISOR: { label: 'Supervisor', clase: 'dms-cmt-rol--sup' },
};

/** El rol del comentario se deduce del usuario autenticado. */
export function rolDeUsuario(rolUsuario: string | undefined, username: string | undefined): RolComentario {
  if (rolUsuario === 'seaboard') return 'SEABOARD';
  if (rolUsuario === 'liquidaciones') return 'LIQUIDACIONES';
  if (username === 'apptelink') return 'SUPERVISOR';
  return 'TECNICO';
}

interface ComentariosDanoModalProps {
  open: boolean;
  estimacion: Estimacion;
  dano: DanoEstimacion | null;
  usuario: string;
  rol: RolComentario;
  onClose: () => void;
  onEnviar: (entrada: {
    tipo: TipoComentario;
    mensaje: string;
    campoAfectado?: string;
  }) => void;
}

export function ComentariosDanoModal({
  open,
  estimacion,
  dano,
  usuario,
  rol,
  onClose,
  onEnviar,
}: ComentariosDanoModalProps) {
  const [mensaje, setMensaje] = useState('');
  const [tipo, setTipo] = useState<TipoComentario>('SOLICITA_CAMBIO');
  const [campo, setCampo] = useState<string>('');
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setMensaje('');
      setCampo('');
      setTipo(rol === 'LIQUIDACIONES' ? 'SOLICITA_CAMBIO' : 'INFORMATIVO');
    }
  }, [open, rol]);

  useEffect(() => {
    if (open) finRef.current?.scrollIntoView({ block: 'end' });
  }, [open, dano?.comentarios.length]);

  const pendientes = useMemo(
    () => (dano?.comentarios ?? []).filter((c) => c.tipo === 'SOLICITA_CAMBIO').length,
    [dano]
  );

  if (!dano) return null;

  const puedeEnviar = mensaje.trim().length >= 3;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={<MessageSquare className="h-4 w-4" />}
      title={`Comentarios · Línea ${String(dano.linea).padStart(2, '0')} · ${dano.comp}`}
      subtitle={`${estimacion.codigo} · ${estimacion.contenedor} · Trazabilidad con liquidaciones`}
      footer={
        <>
          <button
            type="button"
            className="dms-btn-action border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
            onClick={onClose}
          >
            Cerrar
          </button>
          <button
            type="button"
            className="dms-btn-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!puedeEnviar}
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
            <Send className="h-4 w-4" /> Publicar comentario
          </button>
        </>
      }
    >
      <div className="dms-cmt-resumen">
        <div>
          <span className="dms-cmt-resumen-label">Daño</span>
          <p>{dano.dano}</p>
        </div>
        <div>
          <span className="dms-cmt-resumen-label">Ubicación</span>
          <p>{dano.ubicacion || '—'}</p>
        </div>
        <div>
          <span className="dms-cmt-resumen-label">Cant. / H.H.</span>
          <p>
            {dano.cantidad.toFixed(2)} / {dano.horasHombre.toFixed(2)}
          </p>
        </div>
        <div>
          <span className="dms-cmt-resumen-label">Cs. Total</span>
          <p className="font-bold text-rfs-700">${formatMoney(dano.csTotal)}</p>
        </div>
        <div>
          <span className="dms-cmt-resumen-label">Aplica</span>
          <p>{dano.aplica}</p>
        </div>
        <div>
          <span className="dms-cmt-resumen-label">Pendientes</span>
          <p className={pendientes > 0 ? 'font-bold text-rfsorange-600' : 'text-gray-500'}>
            {pendientes} solicitud(es)
          </p>
        </div>
      </div>

      <div className="dms-cmt-hilo">
        {dano.comentarios.length === 0 && (
          <p className="py-6 text-center text-xs text-gray-400">
            Sin comentarios todavía. Inicie la conversación con el área de liquidaciones.
          </p>
        )}
        {dano.comentarios.map((c) => {
          const metaTipo = META_TIPO[c.tipo];
          const metaRol = META_ROL[c.rol];
          const Icon = metaTipo.Icon;
          const propio = c.usuario === usuario;
          return (
            <article
              key={c.id}
              className={cn('dms-cmt-item', propio && 'dms-cmt-item--propio')}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className={cn('dms-cmt-rol', metaRol.clase)}>{metaRol.label}</span>
                <span className="text-[11px] font-bold text-gray-700">{c.usuario}</span>
                <span className="text-[10px] tabular-nums text-gray-400">{c.fecha}</span>
                <span className={cn('dms-cmt-tag ml-auto', metaTipo.clase)}>
                  <Icon className="h-3 w-3" />
                  {metaTipo.label}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-gray-700">{c.mensaje}</p>
              {c.campoAfectado && (
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-rfsorange-600">
                  Campo a modificar: <span className="text-gray-600">{c.campoAfectado}</span>
                </p>
              )}
            </article>
          );
        })}
        <div ref={finRef} />
      </div>

      <div className="dms-cmt-nuevo">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[9rem] flex-1">
            <label className="dms-field-label">Tipo de comentario</label>
            <select
              className="dms-select"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoComentario)}
            >
              {(Object.keys(META_TIPO) as TipoComentario[]).map((t) => (
                <option key={t} value={t}>
                  {META_TIPO[t].label}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[10rem] flex-1">
            <label className="dms-field-label">Campo a modificar</label>
            <select
              className="dms-select"
              value={campo}
              disabled={tipo !== 'SOLICITA_CAMBIO'}
              onChange={(e) => setCampo(e.target.value)}
            >
              <option value="">Sin campo específico</option>
              {CAMPOS_DANO.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[7rem]">
            <label className="dms-field-label">Publica como</label>
            <div className="dms-cmt-autor">
              <span className={cn('dms-cmt-rol', META_ROL[rol].clase)}>{META_ROL[rol].label}</span>
              <span className="truncate text-[11px] font-semibold text-gray-600">{usuario}</span>
            </div>
          </div>
        </div>
        <textarea
          rows={3}
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          placeholder="Escriba el detalle de lo que debe modificarse o confirmarse…"
          className="mt-2 w-full rounded-lg border border-gray-300 p-2.5 text-xs shadow-sm transition-colors focus:border-rfsorange-500 focus:outline-none focus:ring-2 focus:ring-rfsorange-500/20"
        />
        <p className="mt-1 text-[10px] text-gray-400">
          El comentario queda firmado con su usuario y hora, y se registra en el historial de
          actividad de la estimación.
        </p>
      </div>
    </Modal>
  );
}
