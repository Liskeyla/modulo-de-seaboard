'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { FileBarChart, FileText, RefreshCw, SearchX, Send } from 'lucide-react';
import { DmsReportLayout } from '@/components/dms/DmsReportLayout';
import { DmsTableToolbar } from '@/components/dms/DmsTableToolbar';
import { EstadoEstimacionBadge } from '@/components/dms/EstadoEstimacionBadge';
import { ComentarioModal } from '@/components/aprobaciones/ComentarioModal';
import { useAuthStore } from '@/store';
import { useEstimacionesStore } from '@/store/estimacionesStore';
import type { Estimacion } from '@/types/estimacion';
import { cn, formatMoney, toast } from '@/lib/utils';

const NAVIERAS = ['Todas', 'SEABOARD MARINE LINE', 'ONE', 'HAPAG-LLOYD', 'MSC'];
const PATIOS = ['Todos', 'RFS 1', 'RFS 3'];
const CODIGOS_RFS = ['Todos', '40RC', '40HC'];
const TIPOS = ['Todos', 'MÁQUINA', 'BOX', 'ASISTENCIA'];
const ESTADOS = ['Todos', 'PENDIENTE', 'ENVIADO', 'APROBADO', 'RECHAZADO', 'REPARADO', 'REVERSADO'];
const APLICA = ['Todos', 'SI', 'NO'];

const EXCEL_HEADERS = [
  'Código', 'Semana', 'Año', 'Estado', 'Contenedor', 'Modelo Máquina', 'Código RFS', 'Naviera',
  'Actividad', 'Lugar Estimación', 'Lugar Asistencia', 'Fecha GateIn', 'Fecha Elaboración',
  'Fecha Reparación', 'Tipo Estimación', 'Técnico', 'Horas Hombre', 'PVP Horas Hombre',
  'PVP Materiales', 'PVP Total', 'Estado PTI', 'Fecha Fin PTI', 'Enviar Aprobación',
  'Fecha Envío', 'Fecha Aprobación', 'EDI Enviado ONE', 'Niveles', 'Días Estadía', 'Tipo Daño',
];

function rowToExcel(e: Estimacion) {
  return [
    e.codigo, e.semana, e.anio, e.estado, e.contenedor, e.modeloMaquina, e.codigoRfs, e.naviera,
    e.actividad, e.lugarEstimacion, e.lugarAsistencia, e.fechaGateIn, e.fechaElaboracion,
    e.fechaReparacion, e.tipoEstimacion, e.tecnico, e.horasHombre, e.pvpHorasHombre,
    e.pvpMateriales, e.pvpTotal, e.estadoPti, e.fechaFinPti, e.enviarAprobacion,
    e.fechaEnvio, e.fechaAprobacion, e.ediEnviadoOne, e.niveles, e.diasEstadia, e.tipoDano,
  ];
}

function AccionesEstimacion({
  row,
  onEnviar,
  onReversar,
}: {
  row: Estimacion;
  onEnviar: () => void;
  onReversar: () => void;
}) {
  if (row.sinDanos) {
    return (
      <button type="button" className="dms-btn-action dms-btn-sin-danos">
        No hay Daños
      </button>
    );
  }

  const acciones = [];
  if (row.estado !== 'PENDIENTE' || row.pvpTotal > 0 || row.tipoEstimacion) {
    if (['APROBADO', 'REPARADO', 'ENVIADO'].includes(row.estado)) {
      acciones.push(
        <button
          key="pdf-p"
          type="button"
          className="dms-btn-action dms-btn-pdf"
          onClick={() => toast('Generando PDF Preliminar…', 'info')}
        >
          PDF Preliminar
        </button>
      );
    }
    if (['APROBADO', 'REPARADO'].includes(row.estado)) {
      acciones.push(
        <button
          key="pdf-f"
          type="button"
          className="dms-btn-action dms-btn-pdf"
          onClick={() => toast('Generando PDF Final…', 'info')}
        >
          PDF Final
        </button>
      );
    }
    if (row.estado === 'APROBADO') {
      acciones.push(
        <button
          key="nota"
          type="button"
          className="dms-btn-action dms-btn-info"
          onClick={() => toast('Abriendo Nota Naviera…', 'info')}
        >
          Ver Nota Naviera
        </button>
      );
    }
    acciones.push(
      <button
        key="ver"
        type="button"
        className="dms-btn-action dms-btn-ver"
        onClick={() => toast(`Detalle: ${row.codigo}`, 'info')}
      >
        Ver
      </button>
    );
    if (row.estado === 'PENDIENTE' && row.pvpTotal === 0) {
      acciones.push(
        <button
          key="info"
          type="button"
          className="dms-btn-action dms-btn-info"
          onClick={() => toast(row.analisisObservacion || 'Sin información adicional', 'info')}
        >
          Información
        </button>
      );
    }
    acciones.push(
      <button
        key="del"
        type="button"
        className="dms-btn-action dms-btn-eliminar"
        onClick={() => toast('Eliminar — solo prototipo', 'info')}
      >
        Eliminar
      </button>
    );
    if (row.estado === 'PENDIENTE' && row.naviera.toUpperCase().includes('SEABOARD')) {
      acciones.push(
        <button key="env" type="button" className="dms-btn-action dms-btn-ver" onClick={onEnviar}>
          Enviar Aprobación
        </button>
      );
    }
    if (row.estado === 'APROBADO') {
      acciones.push(
        <button key="rev" type="button" className="dms-btn-action dms-btn-reversar" onClick={onReversar}>
          Reversar Aprobación
        </button>
      );
    }
  }

  return <div className="dms-actions-stack">{acciones}</div>;
}

export default function ReporteEstimacionesPage() {
  const { user } = useAuthStore();
  const { estimaciones, enviarAprobacion, reversarAprobacion } = useEstimacionesStore();

  const [desde, setDesde] = useState('2026-06-29');
  const [hasta, setHasta] = useState('2026-07-03');
  const [naviera, setNaviera] = useState('Todas');
  const [codigoRfs, setCodigoRfs] = useState('Todos');
  const [patio, setPatio] = useState('Todos');
  const [tipo, setTipo] = useState('Todos');
  const [estado, setEstado] = useState('Todos');
  const [aplica, setAplica] = useState('Todos');
  const [completas, setCompletas] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [parametro, setParametro] = useState('contenedor');
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [filtroActivo, setFiltroActivo] = useState(false);
  const [reversarId, setReversarId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!filtroActivo && !busqueda && !search) {
      return estimaciones.filter((e) => {
        if (patio !== 'Todos' && e.lugarEstimacion !== patio) return false;
        return true;
      });
    }
    return estimaciones.filter((e) => {
      if (naviera !== 'Todas' && e.naviera !== naviera) return false;
      if (codigoRfs !== 'Todos' && e.codigoRfs !== codigoRfs) return false;
      if (patio !== 'Todos' && e.lugarEstimacion !== patio) return false;
      if (tipo !== 'Todos' && e.tipoEstimacion !== tipo) return false;
      if (estado !== 'Todos' && e.estado !== estado) return false;
      if (aplica !== 'Todos' && e.enviarAprobacion !== aplica) return false;
      if (completas && e.estado === 'PENDIENTE' && e.pvpTotal === 0) return false;
      if (busqueda) {
        const q = busqueda.toLowerCase();
        if (parametro === 'contenedor' && !e.contenedor.toLowerCase().includes(q)) return false;
        if (parametro === 'estimacion' && !e.codigo.toLowerCase().includes(q)) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const hay =
          e.contenedor.toLowerCase().includes(q) ||
          e.codigo.toLowerCase().includes(q) ||
          e.tecnico.toLowerCase().includes(q) ||
          e.naviera.toLowerCase().includes(q);
        if (!hay) return false;
      }
      return true;
    });
  }, [
    estimaciones,
    naviera,
    codigoRfs,
    patio,
    tipo,
    estado,
    aplica,
    completas,
    busqueda,
    parametro,
    search,
    filtroActivo,
  ]);

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const excelRows = filtered.map(rowToExcel);
  const from = filtered.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, filtered.length);

  return (
    <>
      <DmsReportLayout
        title="Reporte de Estimaciones"
        subtitle="Consulta operativa DMS · Envío a aprobación Seaboard"
        heroIcon={<FileBarChart className="h-5 w-5" />}
        infoMessage={
          <span>
            <strong>Filtros:</strong> Seleccione un depósito (p. ej. RFS 1) y pulse Filtrar para afinar
            la vista. Use Enviar Aprobación en estimaciones Seaboard en estado PENDIENTE.
          </span>
        }
        filtros={[
          { label: 'Desde', type: 'date', value: desde, onChange: (v) => setDesde(String(v)) },
          { label: 'Hasta', type: 'date', value: hasta, onChange: (v) => setHasta(String(v)) },
          {
            label: 'Naviera',
            type: 'select',
            value: naviera,
            onChange: (v) => setNaviera(String(v)),
            options: NAVIERAS,
          },
          {
            label: 'Código RFS',
            type: 'select',
            value: codigoRfs,
            onChange: (v) => setCodigoRfs(String(v)),
            options: CODIGOS_RFS,
          },
          {
            label: 'Lugar de Estimación',
            type: 'select',
            value: patio,
            onChange: (v) => setPatio(String(v)),
            options: PATIOS,
          },
          {
            label: 'Tipo de estimación',
            type: 'select',
            value: tipo,
            onChange: (v) => setTipo(String(v)),
            options: TIPOS,
          },
          {
            label: 'Estado de estimación',
            type: 'select',
            value: estado,
            onChange: (v) => setEstado(String(v)),
            options: ESTADOS,
          },
          {
            label: 'Aplica',
            type: 'select',
            value: aplica,
            onChange: (v) => setAplica(String(v)),
            options: APLICA,
          },
          {
            label: 'Estimaciones completas',
            type: 'toggle',
            value: completas,
            onChange: (v) => setCompletas(Boolean(v)),
          },
        ]}
        onFiltrar={() => {
          setFiltroActivo(true);
          setPage(1);
          toast('Filtros aplicados.', 'success');
        }}
        buscador={{
          termino: busqueda,
          onTerminoChange: setBusqueda,
          parametro,
          onParametroChange: setParametro,
          onBuscar: () => {
            setPage(1);
            toast('Búsqueda actualizada.', 'info');
          },
        }}
        opcionesRelacionadas={
          <div className="space-y-1">
            <span className="dms-link-option dms-link-option--disabled">
              <RefreshCw className="h-3 w-3" /> Generar Estimados desde Inspecciones
            </span>
            <span className="dms-link-option dms-link-option--disabled">
              <FileText className="h-3 w-3" /> Generar Nueva Estimación Box
            </span>
            <span className="dms-link-option dms-link-option--disabled">
              <FileText className="h-3 w-3" /> Generar Nueva Estimación Máquina
            </span>
            <Link href="/aprobaciones/seaboard" className="dms-link-option">
              <Send className="h-3 w-3" /> Aprobaciones Estimados Seaboard
            </Link>
          </div>
        }
      >
        <div className="dms-table-legend">
          <span className="dms-table-legend-item">
            <span className="dms-table-legend-dot bg-amber-400" /> Pendiente
          </span>
          <span className="dms-table-legend-item">
            <span className="dms-table-legend-dot bg-teal-500" /> Enviado
          </span>
          <span className="dms-table-legend-item">
            <span className="dms-table-legend-dot bg-blue-500" /> Aprobado
          </span>
          <span className="dms-table-legend-item">
            <span className="dms-table-legend-dot bg-red-500" /> Rechazado
          </span>
          <span className="dms-table-legend-item">
            <span className="dms-table-legend-dot bg-purple-500" /> Reversado
          </span>
        </div>

        <DmsTableToolbar
          search={search}
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          pageSize={pageSize}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
          excelFilename="Reporte de Estimaciones RFS - DMS Ecuador.xlsx"
          excelHeaders={EXCEL_HEADERS}
          excelRows={excelRows}
          totalCount={filtered.length}
        />

        {paginated.length === 0 ? (
          <div className="dms-empty-state">
            <div className="dms-empty-icon">
              <SearchX className="h-7 w-7" />
            </div>
            <p className="text-sm font-semibold text-gray-700">Sin resultados</p>
            <p className="mt-1 max-w-sm text-xs text-gray-500">
              Ajuste los filtros o seleccione un patio para visualizar estimaciones.
            </p>
          </div>
        ) : (
          <div className="dms-table-scroll">
            <table className="dms-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Semana</th>
                  <th>Año</th>
                  <th>Estado</th>
                  <th>Contenedor</th>
                  <th>Modelo Máquina</th>
                  <th>Código RFS</th>
                  <th>Naviera</th>
                  <th>Actividad</th>
                  <th>Lugar Estimación</th>
                  <th>Lugar Asistencia</th>
                  <th>Fecha GateIn</th>
                  <th>Fecha Elaboración</th>
                  <th>Fecha Reparación</th>
                  <th>Tipo</th>
                  <th>Técnico</th>
                  <th>HH</th>
                  <th>PVP HH</th>
                  <th>PVP Mat.</th>
                  <th>PVP Total</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className="dms-cell-container-code">{row.codigo}</span>
                    </td>
                    <td className="text-center tabular-nums">{row.semana}</td>
                    <td className="text-center tabular-nums">{row.anio}</td>
                    <td>
                      <EstadoEstimacionBadge estado={row.estado} />
                    </td>
                    <td className="font-semibold text-rfs-navy">{row.contenedor}</td>
                    <td className="text-xs">{row.modeloMaquina || '—'}</td>
                    <td>{row.codigoRfs || '—'}</td>
                    <td className="text-[11px]">{row.naviera}</td>
                    <td>
                      <select className="dms-select h-8 min-w-[4.5rem] text-[10px]" defaultValue={row.actividad}>
                        <option>{row.actividad}</option>
                      </select>
                    </td>
                    <td>{row.lugarEstimacion}</td>
                    <td className="text-xs text-gray-500">{row.lugarAsistencia || '—'}</td>
                    <td className="text-[11px] tabular-nums">{row.fechaGateIn}</td>
                    <td className="text-[11px] tabular-nums">{row.fechaElaboracion}</td>
                    <td className="text-[11px] tabular-nums text-gray-500">
                      {row.fechaReparacion || '—'}
                    </td>
                    <td>{row.tipoEstimacion}</td>
                    <td className="text-xs">{row.tecnico}</td>
                    <td className="text-right tabular-nums">{formatMoney(row.horasHombre)}</td>
                    <td className="text-right tabular-nums">{formatMoney(row.pvpHorasHombre)}</td>
                    <td className="text-right tabular-nums">{formatMoney(row.pvpMateriales)}</td>
                    <td className="text-right font-semibold tabular-nums text-rfs-navy">
                      {formatMoney(row.pvpTotal)}
                    </td>
                    <td>
                      <AccionesEstimacion
                        row={row}
                        onEnviar={() => {
                          enviarAprobacion([row.id], user?.username ?? 'apptelink');
                          toast(
                            `Estimación ${row.codigo} enviada a aprobación Seaboard.`,
                            'success'
                          );
                        }}
                        onReversar={() => setReversarId(row.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="dms-pagination">
          <span className="dms-pagination-info">
            Mostrando {from} a {to} de {filtered.length.toLocaleString('es-EC')} registros
          </span>
          <div className="dms-pagination-nav">
            <button
              type="button"
              className="dms-pagination-btn dms-pagination-btn--nav"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                className={cn(
                  'dms-pagination-btn dms-pagination-btn--page',
                  page === n && 'dms-pagination-btn--active',
                  n === Math.min(totalPages, 5) && page >= totalPages && 'dms-pagination-btn--last'
                )}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              className="dms-pagination-btn dms-pagination-btn--nav dms-pagination-btn--last"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </button>
          </div>
        </div>
      </DmsReportLayout>

      <ComentarioModal
        open={!!reversarId}
        title="Reversar Aprobación"
        subtitle="La estimación volverá a estado PENDIENTE"
        label="Motivo del reverso"
        confirmLabel="Reversar"
        confirmClass="dms-btn-reversar"
        onClose={() => setReversarId(null)}
        onConfirm={(comentario) => {
          if (reversarId) {
            reversarAprobacion(reversarId, user?.username ?? 'apptelink', comentario);
            toast('Aprobación reversada. Estado actualizado a PENDIENTE.', 'success');
          }
          setReversarId(null);
        }}
      />
    </>
  );
}
