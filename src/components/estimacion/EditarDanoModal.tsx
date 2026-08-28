'use client';

import { useEffect, useMemo, useState } from 'react';
import { Lock, PencilLine, Save } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import {
  APLICA_PENDIENTE,
  CARGOS_DANO,
  CARGO_DEFAULT,
  esAplicaRechazado,
  esItemAprobado,
  MSG_ITEM_APROBADO_BLOQUEADO,
  normalizarAplicaDano,
  normalizarCargoDano,
  snapshotDesdeDano,
  type AplicaDano,
  type CargoDano,
  type CampoSnapshotLinea,
  type DanoEstimacion,
} from '@/types/estimacion';
import { resumirCambiosAntesDespues } from '@/lib/cambioAntesDespues';
import { cn, toast } from '@/lib/utils';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Campos que el usuario SBM no puede modificar (datos de RFS / inspección). */
const CAMPOS_BLOQUEADOS: (keyof Formulario)[] = [
  'ubicacion',
  'obsAnalisis',
  'contenedorDonante',
  'serieAnterior',
  'serieEntregado',
];

/** Campos de costo/HH inhabilitados cuando el ítem está rechazado. */
const CAMPOS_COSTO_RECHAZO: (keyof Formulario)[] = [
  'horasHombre',
  'csHoraHombre',
  'csMaterial',
];

interface Formulario {
  comp: string;
  partNumber: string;
  ubicacion: string;
  dano: string;
  obsAnalisis: string;
  newMetRep: string;
  serieAnterior: string;
  serieEntregado: string;
  largo: string;
  ancho: string;
  cantidad: string;
  horasHombre: string;
  csHoraHombre: string;
  csMaterial: string;
  cargo: CargoDano;
  aplica: AplicaDano;
  medida: string;
  remark: string;
  contenedorDonante: string;
  comentarioSbm: string;
}

export type ComentariosEdicionDano = {
  sbm: string;
  rfs: string;
};

/** Comentarios de liquidador / RFS / técnico para mostrar solo lectura al usuario SBM. */
export function textoComentariosRfs(dano: DanoEstimacion): string {
  const relevantes = dano.comentarios.filter(
    (c) =>
      c.rol === 'LIQUIDACIONES' ||
      c.rol === 'RFS' ||
      c.rol === 'TECNICO' ||
      c.campoAfectado === 'Comentarios RFS'
  );
  if (relevantes.length === 0) {
    return 'Sin comentarios de RFS / liquidaciones en esta línea.';
  }
  return relevantes
    .map((c) => `[${c.fecha}] ${c.usuario} (${c.rol}): ${c.mensaje}`)
    .join('\n\n');
}

function desdeDano(d: DanoEstimacion): Formulario {
  return {
    comp: d.comp,
    partNumber: d.partNumber,
    ubicacion: d.ubicacion,
    dano: d.dano,
    obsAnalisis: d.obsAnalisis,
    newMetRep: d.newMetRep,
    serieAnterior: d.serieAnterior,
    serieEntregado: d.serieEntregado,
    largo: String(d.largo),
    ancho: String(d.ancho),
    cantidad: String(d.cantidad),
    horasHombre: String(d.horasHombre),
    csHoraHombre: String(d.csHoraHombre),
    csMaterial: String(d.csMaterial),
    cargo: normalizarCargoDano(d.cargo),
    aplica: normalizarAplicaDano(d.aplica),
    medida: d.medida,
    remark: d.remark,
    contenedorDonante: d.contenedorDonante,
    comentarioSbm: '',
  };
}

export function EditarDanoModal({
  open,
  dano,
  onClose,
  onGuardar,
  mostrarDimensiones = false,
}: {
  open: boolean;
  dano: DanoEstimacion | null;
  onClose: () => void;
  onGuardar: (
    cambios: Partial<DanoEstimacion>,
    resumen: string,
    comentarios: ComentariosEdicionDano
  ) => void;
  /** Solo estimados BOX editan Largo / Ancho (Área y Longitud se recalculan). */
  mostrarDimensiones?: boolean;
}) {
  const [form, setForm] = useState<Formulario | null>(null);

  const comentariosRfs = useMemo(
    () => (dano ? textoComentariosRfs(dano) : ''),
    [dano]
  );

  useEffect(() => {
    setForm(dano ? desdeDano(dano) : null);
  }, [dano]);

  if (!dano || !form) return null;

  const itemRechazado = esAplicaRechazado(form.aplica);
  const itemAprobado = esItemAprobado(form.aplica);
  const soloLectura = itemAprobado || itemRechazado;

  const set = <K extends keyof Formulario>(k: K, v: Formulario[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  const numero = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const csHH = itemRechazado ? 0 : round2(numero(form.csHoraHombre));
  const csMat = itemRechazado ? 0 : round2(numero(form.csMaterial));
  const hh = itemRechazado ? 0 : round2(numero(form.horasHombre));
  const largo = round2(numero(form.largo));
  const ancho = round2(numero(form.ancho));

  const guardar = () => {
    if (itemAprobado) {
      toast(MSG_ITEM_APROBADO_BLOQUEADO, 'info');
      return;
    }
    const largoFinal = mostrarDimensiones ? largo : dano.largo;
    const anchoFinal = mostrarDimensiones ? ancho : dano.ancho;
    const rechazado = esAplicaRechazado(form.aplica);
    // Ubicación, Obs. Análisis y Contenedor Donante quedan fijos (solo lectura SBM).
    const cambios: Partial<DanoEstimacion> = {
      comp: form.comp.trim(),
      partNumber: form.partNumber.trim(),
      ubicacion: dano.ubicacion,
      dano: form.dano.trim(),
      obsAnalisis: dano.obsAnalisis,
      newMetRep: form.newMetRep.trim(),
      serieAnterior: dano.serieAnterior,
      serieEntregado: dano.serieEntregado,
      largo: largoFinal,
      ancho: anchoFinal,
      area: mostrarDimensiones ? round2((largoFinal * anchoFinal) / 10000) : dano.area,
      longitud: mostrarDimensiones ? largoFinal : dano.longitud,
      cantidad: round2(numero(form.cantidad)) || 1,
      horasHombre: rechazado ? 0 : hh,
      csHoraHombre: rechazado ? 0 : csHH,
      csMaterial: rechazado ? 0 : csMat,
      cargo: form.cargo,
      aplica: form.aplica,
      medida: form.medida.trim(),
      remark: form.remark.trim(),
      contenedorDonante: dano.contenedorDonante,
    };
    if (rechazado) {
      cambios.csTotal = 0;
    }

    const antesSnap = snapshotDesdeDano(dano);
    const despuesSnap = snapshotDesdeDano({ ...dano, ...cambios });
    const camposCambiados = (Object.keys(despuesSnap) as CampoSnapshotLinea[]).filter(
      (k) => String(antesSnap[k] ?? '') !== String(despuesSnap[k] ?? '')
    );
    const resumenLegible =
      camposCambiados.length > 0
        ? resumirCambiosAntesDespues(antesSnap, despuesSnap, camposCambiados)
        : 'Sin cambios de campos (solo comentario SBM)';

    const sbm = form.comentarioSbm.trim();

    if (camposCambiados.length > 0 && !sbm) {
      toast('Indique el motivo del cambio en Comentarios línea SBM.', 'info');
      return;
    }

    if (camposCambiados.length === 0 && !sbm) {
      toast('No hay cambios ni comentarios SBM para guardar.', 'info');
      return;
    }

    onGuardar(cambios, resumenLegible, { sbm, rfs: '' });
  };

  const campoTexto = (
    label: string,
    key: keyof Formulario,
    props: { type?: string; step?: string; placeholder?: string } = {}
  ) => {
    const bloqueado =
      itemAprobado ||
      CAMPOS_BLOQUEADOS.includes(key) ||
      (itemRechazado && CAMPOS_COSTO_RECHAZO.includes(key));
    const valor =
      itemRechazado && CAMPOS_COSTO_RECHAZO.includes(key)
        ? '0'
        : (form[key] as string);
    const valorOriginal = String(
      (dano as unknown as Record<string, unknown>)[key] ?? ''
    );
    const cambioVsOriginal =
      !bloqueado && valorOriginal !== '' && String(valor) !== valorOriginal;
    return (
      <div>
        <label className="dms-field-label">{label}</label>
        <input
          className={cn(
            'dms-input-sm',
            bloqueado && 'bg-slate-100 text-slate-600',
            cambioVsOriginal && 'border-amber-400 bg-amber-50/60'
          )}
          value={valor}
          type={props.type ?? 'text'}
          step={props.step}
          placeholder={props.placeholder}
          disabled={bloqueado}
          readOnly={bloqueado}
          title={
            itemRechazado && CAMPOS_COSTO_RECHAZO.includes(key)
              ? 'Ítem rechazado: valor en $0 (no editable)'
              : undefined
          }
          onChange={(e) => {
            if (bloqueado) return;
            set(key, e.target.value as Formulario[typeof key]);
          }}
        />
        {cambioVsOriginal && (
          <p className="mt-0.5 text-[10px] tabular-nums text-amber-800">
            Antes: <span className="font-semibold line-through opacity-80">{valorOriginal}</span>
            {' → '}
            <span className="font-bold">{valor}</span>
          </p>
        )}
      </div>
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={itemAprobado ? <Lock className="h-4 w-4" /> : <PencilLine className="h-4 w-4" />}
      title={
        itemAprobado
          ? `Ítem aprobado · Línea ${String(dano.linea).padStart(2, '0')}`
          : `Editar Daño · Línea ${String(dano.linea).padStart(2, '0')}`
      }
      subtitle={
        itemAprobado
          ? 'Bloqueado por aprobación de línea · use Reversar ítems para modificar'
          : 'Vista SBM · Los cambios quedan en el historial y como subfila del listado'
      }
      footer={
        <>
          <button
            type="button"
            className="dms-btn-action border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
            onClick={onClose}
          >
            {itemAprobado ? 'Cerrar' : 'Cancelar'}
          </button>
          {!itemAprobado && (
            <button type="button" className="dms-btn-primary px-4 py-2 text-sm" onClick={guardar}>
              <Save className="h-4 w-4" /> Guardar cambios
            </button>
          )}
        </>
      }
    >
      {itemAprobado && (
        <div className="dms-item-bloqueado-aviso mb-3" role="status">
          <Lock className="h-4 w-4 shrink-0" aria-hidden />
          <span>{MSG_ITEM_APROBADO_BLOQUEADO}</span>
        </div>
      )}
      <div className={cn('grid gap-3 sm:grid-cols-3', itemAprobado && 'pointer-events-none opacity-90')}>
        {campoTexto('Comp.', 'comp')}
        {campoTexto('Part Number', 'partNumber')}
        {campoTexto('Ubicación', 'ubicacion')}
        {campoTexto('Daño', 'dano')}
        {campoTexto('New Met. Rep.', 'newMetRep')}
        {campoTexto('Medida', 'medida')}
        {campoTexto('N° Serie Anterior', 'serieAnterior')}
        {campoTexto('N° Serie Entregado', 'serieEntregado')}
        {campoTexto('Contenedor Donante', 'contenedorDonante', { placeholder: 'SMLU…' })}
        {mostrarDimensiones && (
          <>
            {campoTexto('Largo (cm)', 'largo', { type: 'number', step: '0.01' })}
            {campoTexto('Ancho (cm)', 'ancho', { type: 'number', step: '0.01' })}
          </>
        )}
        {campoTexto('Cantidad', 'cantidad', { type: 'number', step: '0.01' })}
        {campoTexto('H.H.', 'horasHombre', { type: 'number', step: '0.01' })}
        {campoTexto('Cs. H.H. ($)', 'csHoraHombre', { type: 'number', step: '0.01' })}
        {campoTexto('Cs. Mat. ($)', 'csMaterial', { type: 'number', step: '0.01' })}

        <div>
          <label className="dms-field-label">Cargo</label>
          <select
            className="dms-select"
            value={normalizarCargoDano(form.cargo)}
            disabled={soloLectura}
            onChange={(e) => set('cargo', e.target.value as CargoDano)}
          >
            {CARGOS_DANO.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="dms-field-label">Estado</label>
          <div
            className="dms-input-sm flex items-center bg-slate-50 text-[12px] font-semibold text-slate-700"
            title="El estado se define con Aprobar / Rechazar ítems, no desde aquí"
          >
            {normalizarAplicaDano(form.aplica) || APLICA_PENDIENTE}
          </div>
        </div>
        <div>
          <label className="dms-field-label">Cs. Total</label>
          <div className="dms-input-sm flex items-center bg-rfs-50 font-bold text-rfs-700">
            ${round2(csHH + csMat).toFixed(2)}
          </div>
          {itemRechazado && (
            <p className="mt-0.5 text-[10px] text-slate-400">
              Ítem rechazado: H.H. y costos en $0
            </p>
          )}
        </div>
      </div>

      <div className={cn('mt-3 grid gap-3 sm:grid-cols-2', itemAprobado && 'pointer-events-none opacity-90')}>
        <div>
          <label className="dms-field-label">Obs. Análisis</label>
          <textarea
            rows={3}
            className="dms-input-sm h-auto bg-slate-100 text-slate-600"
            value={form.obsAnalisis}
            disabled
            readOnly
          />
        </div>
        <div>
          <label className="dms-field-label">Remark</label>
          <textarea
            rows={3}
            className="dms-input-sm h-auto"
            value={form.remark}
            disabled={itemAprobado}
            readOnly={itemAprobado}
            onChange={(e) => set('remark', e.target.value)}
          />
        </div>
        <div>
          <label className="dms-field-label">Motivo del cambio (Seaboard)</label>
          <textarea
            rows={3}
            className="dms-input-sm h-auto border-sky-200 bg-sky-50/50"
            value={form.comentarioSbm}
            disabled={itemAprobado}
            readOnly={itemAprobado}
            placeholder="Ej.: Se ajustó la cantidad según inspección en patio…"
            onChange={(e) => set('comentarioSbm', e.target.value)}
          />
          <p className="mt-0.5 text-[10px] text-slate-400">
            Este texto queda visible en el listado y en el historial.
          </p>
        </div>
        <div>
          <label className="dms-field-label">Notas de RFS / liquidaciones</label>
          <textarea
            rows={3}
            className="dms-input-sm h-auto border-emerald-200 bg-emerald-50/80 text-emerald-950"
            value={comentariosRfs}
            disabled
            readOnly
          />
          <p className="mt-0.5 text-[10px] text-slate-400">Solo lectura</p>
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
        Al guardar, los campos que cambió se marcan en{' '}
        <strong className="text-emerald-600">verde</strong> en el listado.
      </p>
    </Modal>
  );
}
