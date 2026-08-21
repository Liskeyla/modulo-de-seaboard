'use client';

import { useEffect, useMemo, useState } from 'react';
import { PencilLine, Save } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import {
  CARGOS_DANO,
  type AplicaDano,
  type CargoDano,
  type DanoEstimacion,
} from '@/types/estimacion';
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
    cargo: d.cargo,
    aplica: d.aplica,
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

  const set = <K extends keyof Formulario>(k: K, v: Formulario[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  const numero = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const csHH = round2(numero(form.csHoraHombre));
  const csMat = round2(numero(form.csMaterial));
  const largo = round2(numero(form.largo));
  const ancho = round2(numero(form.ancho));

  const guardar = () => {
    const largoFinal = mostrarDimensiones ? largo : dano.largo;
    const anchoFinal = mostrarDimensiones ? ancho : dano.ancho;
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
      horasHombre: round2(numero(form.horasHombre)),
      csHoraHombre: csHH,
      csMaterial: csMat,
      cargo: form.cargo,
      medida: form.medida.trim(),
      remark: form.remark.trim(),
      contenedorDonante: dano.contenedorDonante,
    };

    const difs: string[] = [];
    (Object.keys(cambios) as (keyof DanoEstimacion)[]).forEach((k) => {
      const antes = dano[k];
      const ahora = cambios[k];
      if (String(antes ?? '') !== String(ahora ?? '') && k !== 'area' && k !== 'longitud') {
        difs.push(`${String(k)}: «${antes ?? ''}» → «${ahora ?? ''}»`);
      }
    });

    const sbm = form.comentarioSbm.trim();

    if (difs.length > 0 && !sbm) {
      toast('Indique el motivo del cambio en Comentarios línea SBM.', 'info');
      return;
    }

    if (difs.length === 0 && !sbm) {
      toast('No hay cambios ni comentarios SBM para guardar.', 'info');
      return;
    }

    onGuardar(
      cambios,
      difs.length ? difs.join(' · ') : 'Sin cambios de campos (solo comentario SBM)',
      { sbm, rfs: '' }
    );
  };

  const campoTexto = (
    label: string,
    key: keyof Formulario,
    props: { type?: string; step?: string; placeholder?: string } = {}
  ) => {
    const bloqueado = CAMPOS_BLOQUEADOS.includes(key);
    return (
      <div>
        <label className="dms-field-label">{label}</label>
        <input
          className={cn('dms-input-sm', bloqueado && 'bg-slate-100 text-slate-600')}
          value={form[key] as string}
          type={props.type ?? 'text'}
          step={props.step}
          placeholder={props.placeholder}
          disabled={bloqueado}
          readOnly={bloqueado}
          onChange={(e) => {
            if (bloqueado) return;
            set(key, e.target.value as Formulario[typeof key]);
          }}
        />
      </div>
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={<PencilLine className="h-4 w-4" />}
      title={`Editar Daño · Línea ${String(dano.linea).padStart(2, '0')}`}
      subtitle="Vista SBM · Los cambios quedan en el historial y como subfila del listado"
      footer={
        <>
          <button
            type="button"
            className="dms-btn-action border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button type="button" className="dms-btn-primary px-4 py-2 text-sm" onClick={guardar}>
            <Save className="h-4 w-4" /> Guardar cambios
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
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
            value={form.cargo}
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
          <label className="dms-field-label">Aplica</label>
          <div className="dms-input-sm flex items-center bg-slate-50 font-semibold text-black">
            {form.aplica}
          </div>
          <p className="mt-1 text-[10px] text-slate-400">
            Se actualiza solo con Aprobar / Rechazar ítems.
          </p>
        </div>
        <div>
          <label className="dms-field-label">Cs. Total</label>
          <div className="dms-input-sm flex items-center bg-rfs-50 font-bold text-rfs-700">
            ${round2(csHH + csMat).toFixed(2)}
          </div>
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
            onChange={(e) => set('remark', e.target.value)}
          />
        </div>
        <div>
          <label className="dms-field-label">Comentarios línea SBM</label>
          <textarea
            rows={3}
            className="dms-input-sm h-auto border-sky-200 bg-sky-50/50"
            value={form.comentarioSbm}
            placeholder="Explique los cambios realizados (usuario SBM)…"
            onChange={(e) => set('comentarioSbm', e.target.value)}
          />
        </div>
        <div>
          <label className="dms-field-label">Comentarios RFS</label>
          <textarea
            rows={3}
            className="dms-input-sm h-auto border-emerald-200 bg-emerald-50/80 text-emerald-950"
            value={comentariosRfs}
            disabled
            readOnly
          />
          <p className="mt-0.5 text-[10px] text-slate-400">
            Solo lectura · Comentarios del liquidador / RFS
          </p>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        Si modifica campos del ítem, indique el motivo en Comentarios línea SBM. Los cambios se
        mostrarán como subfila del listado, resaltando las columnas modificadas.
      </p>
    </Modal>
  );
}
