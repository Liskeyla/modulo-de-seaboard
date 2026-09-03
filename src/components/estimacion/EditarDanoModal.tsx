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

/**
 * Campos que Seaboard Marine NUNCA puede editar, independientemente del estado del ítem.
 * Son campos de costo/técnica que solo gestiona Liquidaciones/RFS.
 */
const CAMPOS_SOLO_RFS: (keyof Formulario)[] = [
  'partNumber',
  'horasHombre',
  'csHoraHombre',
  'csMaterial',
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

export type RolEditorDano = 'seaboard' | 'liquidaciones' | 'coordinador' | 'dms';

/** Comentarios de liquidador / RFS / técnico / coordinador para mostrar solo lectura al usuario SBM. */
export function textoComentariosRfs(dano: DanoEstimacion): string {
  const relevantes = dano.comentarios.filter(
    (c) =>
      c.rol === 'LIQUIDACIONES' ||
      c.rol === 'RFS' ||
      c.rol === 'TECNICO' ||
      c.rol === 'COORDINADOR' ||
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
  rolEditor = 'seaboard',
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
  /** Define qué bloque de notas es editable (Seaboard vs RFS/liquidaciones). */
  rolEditor?: RolEditorDano;
}) {
  const [form, setForm] = useState<Formulario | null>(null);
  const [notaRfsNueva, setNotaRfsNueva] = useState('');

  const esEditorRfs = rolEditor === 'liquidaciones' || rolEditor === 'coordinador';
  const comentariosRfsHist = useMemo(
    () => (dano ? textoComentariosRfs(dano) : ''),
    [dano]
  );

  useEffect(() => {
    setForm(dano ? desdeDano(dano) : null);
    setNotaRfsNueva('');
  }, [dano, open]);

  if (!dano || !form) return null;

  const itemRechazado = esAplicaRechazado(form.aplica);
  const itemAprobado = esItemAprobado(form.aplica);
  const soloLectura = itemAprobado || itemRechazado;
  /** Liquidaciones/RFS: Motivo Seaboard bloqueado; Notas RFS editables. */
  const motivoSbmBloqueado = esEditorRfs || itemAprobado;
  const notasRfsEditables = esEditorRfs;
  const puedeGuardar = !itemAprobado || (esEditorRfs && notaRfsNueva.trim().length > 0);

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
    if (itemAprobado && !(esEditorRfs && notaRfsNueva.trim())) {
      return;
    }
    const largoFinal = mostrarDimensiones ? largo : dano.largo;
    const anchoFinal = mostrarDimensiones ? ancho : dano.ancho;
    const rechazado = esAplicaRechazado(form.aplica);
    // Ubicación, Obs. Análisis y Contenedor Donante quedan fijos (solo lectura SBM).
    // H.H., Cs. H.H., Cs. Mat. y Part Number son exclusivos de RFS/liquidaciones.
    const cambios: Partial<DanoEstimacion> = itemAprobado
      ? {}
      : {
          comp: form.comp.trim(),
          // Part Number: solo RFS/liquidaciones puede modificarlo
          partNumber: esEditorRfs ? form.partNumber.trim() : dano.partNumber,
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
          // H.H. y costos: solo RFS/liquidaciones puede modificarlos; Seaboard conserva los originales
          horasHombre: esEditorRfs ? (rechazado ? 0 : hh) : dano.horasHombre,
          csHoraHombre: esEditorRfs ? (rechazado ? 0 : csHH) : dano.csHoraHombre,
          csMaterial: esEditorRfs ? (rechazado ? 0 : csMat) : dano.csMaterial,
          cargo: form.cargo,
          aplica: form.aplica,
          medida: form.medida.trim(),
          remark: form.remark.trim(),
          contenedorDonante: dano.contenedorDonante,
        };
    if (!itemAprobado && rechazado) {
      cambios.csTotal = 0;
    }

    const antesSnap = snapshotDesdeDano(dano);
    const despuesSnap = snapshotDesdeDano({ ...dano, ...cambios });
    const camposCambiados = itemAprobado
      ? []
      : (Object.keys(despuesSnap) as CampoSnapshotLinea[]).filter(
          (k) => String(antesSnap[k] ?? '') !== String(despuesSnap[k] ?? '')
        );
    const resumenLegible =
      camposCambiados.length > 0
        ? resumirCambiosAntesDespues(antesSnap, despuesSnap, camposCambiados)
        : esEditorRfs
          ? 'Nota RFS / liquidaciones'
          : 'Sin cambios de campos (solo comentario SBM)';

    const sbm = esEditorRfs ? '' : form.comentarioSbm.trim();
    const rfs = esEditorRfs ? notaRfsNueva.trim() : '';

    if (camposCambiados.length > 0 && esEditorRfs && !rfs) {
      toast('Indique una nota en Notas de RFS / liquidaciones.', 'info');
      return;
    }
    if (camposCambiados.length > 0 && !esEditorRfs && !sbm) {
      toast('Indique el motivo del cambio en Motivo del cambio (Seaboard).', 'info');
      return;
    }
    if (camposCambiados.length === 0 && !sbm && !rfs) {
      toast(
        esEditorRfs
          ? 'Escriba una nota de RFS / liquidaciones para guardar.'
          : 'No hay cambios ni comentarios SBM para guardar.',
        'info'
      );
      return;
    }

    onGuardar(cambios, resumenLegible, { sbm, rfs });
  };

  const campoTexto = (
    label: string,
    key: keyof Formulario,
    props: { type?: string; step?: string; placeholder?: string } = {}
  ) => {
    const bloqueado =
      itemAprobado ||
      CAMPOS_BLOQUEADOS.includes(key) ||
      (itemRechazado && CAMPOS_COSTO_RECHAZO.includes(key)) ||
      (!esEditorRfs && CAMPOS_SOLO_RFS.includes(key));
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
        itemAprobado && !notasRfsEditables
          ? `Ítem aprobado · Línea ${String(dano.linea).padStart(2, '0')}`
          : `Editar Daño · Línea ${String(dano.linea).padStart(2, '0')}`
      }
      subtitle={
        esEditorRfs
          ? 'Vista RFS / liquidaciones · Notas RFS editables · Motivo Seaboard bloqueado'
          : itemAprobado
            ? esEditorRfs
              ? 'Bloqueado por aprobación · use Reversar ítems para modificar'
              : 'Bloqueado por aprobación · contacte liquidaciones para revertir el ítem'
            : 'Vista SBM · Los cambios quedan en el historial y como subfila del listado'
      }
      footer={
        <>
          <button
            type="button"
            className="dms-btn-action border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
            onClick={onClose}
          >
            {itemAprobado && !notasRfsEditables ? 'Cerrar' : 'Cancelar'}
          </button>
          {puedeGuardar && (
            <button type="button" className="dms-btn-primary px-4 py-2 text-sm" onClick={guardar}>
              <Save className="h-4 w-4" /> Guardar cambios
            </button>
          )}
        </>
      }
    >
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

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
            className={cn(
              'dms-input-sm h-auto border-sky-200',
              motivoSbmBloqueado ? 'bg-slate-100 text-slate-600' : 'bg-sky-50/50'
            )}
            value={form.comentarioSbm}
            disabled={motivoSbmBloqueado}
            readOnly={motivoSbmBloqueado}
            placeholder={
              esEditorRfs
                ? 'Solo el gestor Seaboard puede indicar el motivo del cambio'
                : 'Ej.: Se ajustó la cantidad según inspección en patio…'
            }
            onChange={(e) => set('comentarioSbm', e.target.value)}
          />
          <p className="mt-0.5 text-[10px] text-slate-400">
            {esEditorRfs
              ? 'Bloqueado para liquidaciones / RFS'
              : 'Este texto queda visible en el listado y en el historial.'}
          </p>
        </div>
        <div>
          <label className="dms-field-label">Notas de RFS / liquidaciones</label>
          {notasRfsEditables ? (
            <>
              {comentariosRfsHist && !comentariosRfsHist.startsWith('Sin comentarios') && (
                <div className="mb-1.5 max-h-24 overflow-y-auto rounded-md border border-emerald-100 bg-emerald-50/40 px-2 py-1.5 text-[10px] leading-snug whitespace-pre-wrap text-emerald-950">
                  {comentariosRfsHist}
                </div>
              )}
              <textarea
                rows={3}
                className="dms-input-sm h-auto border-emerald-200 bg-emerald-50/80 text-emerald-950"
                value={notaRfsNueva}
                placeholder="Escriba una nota para esta línea (RFS / liquidaciones)…"
                onChange={(e) => setNotaRfsNueva(e.target.value)}
              />
              <p className="mt-0.5 text-[10px] text-slate-400">
                Editable · queda en el historial de la línea
              </p>
            </>
          ) : (
            <>
              <textarea
                rows={3}
                className="dms-input-sm h-auto border-emerald-200 bg-emerald-50/80 text-emerald-950"
                value={comentariosRfsHist}
                disabled
                readOnly
              />
              <p className="mt-0.5 text-[10px] text-slate-400">Solo lectura</p>
            </>
          )}
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
        Al guardar, los campos que cambió se marcan en{' '}
        <strong className="text-emerald-600">verde</strong> en el listado.
      </p>
    </Modal>
  );
}
