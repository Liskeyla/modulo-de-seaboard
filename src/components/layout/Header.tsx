'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  ChevronDown,
  Clock,
  LogOut,
  Menu,
  UserRound,
} from 'lucide-react';
import { Flag } from '@/components/ui/Flag';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/store';
import { useUiStore } from '@/store/uiStore';
import { metaPais, PAISES_UI, type PaisOperacion } from '@/lib/pais';
import { cn, toast } from '@/lib/utils';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

const NOTIFICACIONES = [
  {
    id: 1,
    texto: '3 estimaciones pendientes de revisión Seaboard.',
    tiempo: 'hace 8 min',
    tono: 'amber' as const,
  },
  {
    id: 2,
    texto: 'EST-2481 aprobada y enviada a liquidaciones RFS.',
    tiempo: 'hace 26 min',
    tono: 'emerald' as const,
  },
  {
    id: 3,
    texto: 'Liquidaciones solicitó cambio en 2 líneas de EST-2470.',
    tiempo: 'hace 1 h',
    tono: 'red' as const,
  },
];

const tonos = { amber: 'bg-amber-500', emerald: 'bg-emerald-500', red: 'bg-red-500' };

type CambioPaisPendiente = {
  pais: PaisOperacion;
  paso: 'aperturada_bloqueado' | 'visualizacion';
  resumen: string[];
  codigo: string;
};

/** Cabecera blanca RFS (misma estructura que layout-dms). */
export function Header({ title, subtitle }: HeaderProps) {
  const router = useRouter();
  const { menuAbierto, alternarMenu, pais, setPais, guardiaSesion, avisoVisualizacion } =
    useUiStore();
  const { user, logout } = useAuthStore();

  const paisFijo =
    (user?.rol === 'liquidaciones' || user?.rol === 'coordinador') && user.pais
      ? user.pais
      : null;

  useEffect(() => {
    if (paisFijo && pais !== paisFijo) {
      setPais(paisFijo);
    }
  }, [paisFijo, pais, setPais]);

  const [menuActivo, setMenuActivo] = useState<'notificaciones' | 'usuario' | 'pais' | null>(null);
  const [cambioPais, setCambioPais] = useState<CambioPaisPendiente | null>(null);
  const [pendientes, setPendientes] = useState(NOTIFICACIONES);
  const [hora, setHora] = useState<string | null>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const { zona, locale } = metaPais(pais);
    const actualizar = () =>
      setHora(
        new Date().toLocaleTimeString(locale, {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: zona,
        })
      );
    actualizar();
    const id = setInterval(actualizar, 30_000);
    return () => clearInterval(id);
  }, [pais]);

  useEffect(() => {
    function alClickFuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setMenuActivo(null);
      }
    }
    function alEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuActivo(null);
    }
    document.addEventListener('mousedown', alClickFuera);
    document.addEventListener('keydown', alEscape);
    return () => {
      document.removeEventListener('mousedown', alClickFuera);
      document.removeEventListener('keydown', alEscape);
    };
  }, []);

  function salir() {
    logout();
    router.replace('/login');
  }

  function aplicarCambioPais(nuevo: PaisOperacion) {
    setPais(nuevo);
    setCambioPais(null);
    toast(
      `Operación ${metaPais(nuevo).label}\nSe muestran los estimados de ese país.`,
      'success'
    );
    router.push('/reportes/estimaciones');
  }

  function solicitarCambioPais(nuevo: PaisOperacion) {
    if (paisFijo) {
      toast(
        `Su usuario está asignado a ${metaPais(paisFijo).label}.\nSolo ve el reporte de ese país.`,
        'info'
      );
      setMenuActivo(null);
      return;
    }
    if (nuevo === pais) {
      setMenuActivo(null);
      return;
    }
    setMenuActivo(null);
    const guardia = useUiStore.getState().guardiaSesion;
    if (guardia) {
      // Primero: no se puede cambiar país con estimado aperturado.
      setCambioPais({
        pais: nuevo,
        paso: 'aperturada_bloqueado',
        resumen: [],
        codigo: guardia.codigo,
      });
      return;
    }
    const aviso = useUiStore.getState().avisoVisualizacion;
    if (aviso) {
      setCambioPais({
        pais: nuevo,
        paso: 'visualizacion',
        resumen: [],
        codigo: aviso.codigo,
      });
      return;
    }
    setPais(nuevo);
    toast(
      `Operación ${metaPais(nuevo).label}\nSe muestran los estimados de ese país.`,
      'success'
    );
  }

  function soloVisualizacionYCambiarPais() {
    if (!cambioPais) return;
    useUiStore.getState().avisoVisualizacion?.confirmarSoloVisualizacion();
    toast('Salida registrada como solo visualización.', 'info');
    aplicarCambioPais(cambioPais.pais);
  }

  const iniciales = (user?.nombre ?? user?.username ?? 'U').charAt(0).toUpperCase();

  return (
    <>
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 text-slate-800 shadow-sm backdrop-blur-md">
      <div className="flex h-16 items-center justify-between gap-3 px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/reportes/estimaciones"
            className="flex shrink-0 items-center gap-2.5 transition hover:opacity-90"
            aria-label="Road Feeder Services · Inicio"
          >
            <Image
              src="/brand/logo-rfs.jpg"
              alt="RFS · Road Feeder Services"
              width={1385}
              height={1080}
              className="h-9 w-12 object-contain"
              priority
            />
            <span className="hidden min-w-0 sm:block">
              <span className="block text-[13px] font-extrabold leading-tight text-rfs-700">
                Road Feeder Services
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-rfsorange-600">
                <Flag pais={pais} className="h-2.5 w-4" />
                {metaPais(pais).label}
              </span>
            </span>
          </Link>

          <button
            type="button"
            onClick={alternarMenu}
            aria-expanded={menuAbierto}
            aria-controls="menu-principal"
            className="flex items-center gap-2 rounded-lg bg-rfs-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-rfs-800 active:scale-[0.98]"
          >
            <Menu className="h-4 w-4" />
            <span className="hidden sm:inline">Menú</span>
          </button>

          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold tracking-wide text-rfs-700 sm:text-base">
              {title}
            </h1>
            {subtitle && (
              <p className="hidden truncate text-[10px] text-slate-500 sm:block">{subtitle}</p>
            )}
          </div>
        </div>

        <div ref={contenedorRef} className="flex items-center gap-1.5 sm:gap-2">
          <span className="hidden items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600 2xl:inline-flex">
            <Clock className="h-3.5 w-3.5 text-rfsorange-500" />
            {hora ?? '--:--'}
            <span className="text-slate-400">{metaPais(pais).zona}</span>
          </span>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                if (paisFijo) {
                  toast(
                    `Operación fija: ${metaPais(paisFijo).label} (Aprobaciones de Estimados).`,
                    'info'
                  );
                  return;
                }
                setMenuActivo((m) => (m === 'pais' ? null : 'pais'));
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-rfs-50 px-2.5 py-1.5 text-xs font-semibold text-rfs-700 ring-1 ring-rfs-100 transition hover:bg-rfs-100"
              aria-expanded={menuActivo === 'pais'}
              aria-haspopup="listbox"
              title={
                paisFijo
                  ? `País fijo · ${metaPais(paisFijo).label}`
                  : 'Filtrar por país de operación'
              }
            >
              <Flag pais={pais} className="h-3 w-[18px]" />
              {metaPais(pais).label}
              {!paisFijo && (
                <ChevronDown
                  className={cn(
                    'h-3.5 w-3.5 text-rfs-700 transition-transform',
                    menuActivo === 'pais' && 'rotate-180'
                  )}
                />
              )}
            </button>

            {menuActivo === 'pais' && !paisFijo && (
              <div
                role="listbox"
                className="absolute right-0 z-40 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-xl animate-fade-up"
              >
                <p className="border-b border-slate-100 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  País de operación
                </p>
                {PAISES_UI.map((opcion) => (
                  <button
                    key={opcion.id}
                    type="button"
                    role="option"
                    aria-selected={pais === opcion.id}
                    onClick={() => solicitarCambioPais(opcion.id)}
                    className={cn(
                      'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition hover:bg-rfs-50',
                      pais === opcion.id && 'bg-rfs-50 font-semibold text-rfs-700'
                    )}
                  >
                    <Flag pais={opcion.id} className="h-3.5 w-5" />
                    {opcion.label}
                    {pais === opcion.id && (
                      <span className="ml-auto text-[10px] font-bold uppercase text-rfsorange-600">
                        Activo
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() =>
                setMenuActivo((m) => (m === 'notificaciones' ? null : 'notificaciones'))
              }
              className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 active:scale-[0.98]"
              aria-label={`Notificaciones (${pendientes.length} sin leer)`}
              aria-expanded={menuActivo === 'notificaciones'}
            >
              <Bell className="h-5 w-5" />
              {pendientes.length > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rfsorange-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rfsorange-500 ring-2 ring-white" />
                </span>
              )}
            </button>

            {menuActivo === 'notificaciones' && (
              <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-xl animate-fade-up">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-bold text-rfs-700">Notificaciones</p>
                  <span className="rounded-full bg-rfsorange-50 px-2 py-0.5 text-[10px] font-bold text-rfsorange-600">
                    {pendientes.length} sin leer
                  </span>
                </div>
                {pendientes.length > 0 ? (
                  <>
                    <ul className="max-h-72 overflow-y-auto">
                      {pendientes.map((n) => (
                        <li key={n.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setPendientes((lista) => lista.filter((x) => x.id !== n.id));
                              toast(`Notificación leída: ${n.texto}`, 'success');
                            }}
                            className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-rfs-50"
                          >
                            <span
                              className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', tonos[n.tono])}
                            />
                            <span>
                              <span className="block text-xs leading-snug text-slate-700">
                                {n.texto}
                              </span>
                              <span className="mt-0.5 block text-[11px] text-slate-400">
                                {n.tiempo}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="border-t border-slate-100 p-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setPendientes([]);
                          toast('Todas las notificaciones marcadas como leídas.', 'success');
                        }}
                        className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        <CheckCheck className="h-4 w-4" />
                        Marcar todas como leídas
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="px-4 py-8 text-center">
                    <CheckCheck className="mx-auto h-7 w-7 text-emerald-500" />
                    <p className="mt-2 text-xs text-slate-500">Estás al día.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuActivo((m) => (m === 'usuario' ? null : 'usuario'))}
              className="flex h-9 items-center gap-2 rounded-lg px-1.5 pr-2 transition hover:bg-slate-100 active:scale-[0.98]"
              aria-expanded={menuActivo === 'usuario'}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rfsorange-500 text-[11px] font-bold text-white">
                {iniciales}
              </span>
              <span className="hidden text-left lg:block">
                <span className="block text-[10px] leading-tight text-slate-400">Bienvenido,</span>
                <span className="block text-xs font-semibold leading-tight text-slate-800">
                  {user?.nombre?.split(' ')[0] ?? 'Invitado'}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-slate-400 transition-transform',
                  menuActivo === 'usuario' && 'rotate-180'
                )}
              />
            </button>

            {menuActivo === 'usuario' && (
              <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-xl animate-fade-up">
                <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-bold text-rfs-700">{user?.nombre}</p>
                  <p className="text-xs text-slate-500">{user?.username}</p>
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                    <Flag pais={pais} className="h-2.5 w-4" />
                    {paisFijo
                      ? `Fijo · ${metaPais(pais).label}`
                      : `Operación ${metaPais(pais).label}`}
                  </p>
                  {user?.rol === 'liquidaciones' && (
                    <p className="mt-1.5 text-[11px] text-amber-700">
                      Aprobaciones de Estimados · solo su país
                    </p>
                  )}
                  {user?.rol === 'coordinador' && (
                    <p className="mt-1.5 text-[11px] text-sky-700">
                      Coordinador · crea y modifica; Liquidaciones envía a la línea
                    </p>
                  )}
                </div>
                <div className="p-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuActivo(null);
                      toast(`${user?.nombre} · ${user?.rol}`, 'info');
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <UserRound className="h-4 w-4 text-slate-400" /> Mi perfil
                  </button>
                </div>
                <div className="border-t border-slate-100 p-1.5">
                  <button
                    type="button"
                    onClick={salir}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" /> Cerrar sesión
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>

    <Modal
      open={cambioPais?.paso === 'aperturada_bloqueado'}
      onClose={() => setCambioPais(null)}
      size="sm"
      icon={<AlertTriangle className="h-4 w-4" />}
      title="No puede cambiar de país"
      subtitle={
        cambioPais
          ? `Estimación ${cambioPais.codigo} aperturada`
          : undefined
      }
      footer={
        <button
          type="button"
          className="dms-btn-primary px-4 py-2 text-sm"
          onClick={() => setCambioPais(null)}
        >
          Entendido
        </button>
      }
    >
      <div className="space-y-2 text-sm leading-relaxed text-gray-600">
        <p>
          No puede cambiar de país mientras el estimado{' '}
          <strong>{cambioPais?.codigo ?? guardiaSesion?.codigo}</strong> esté{' '}
          <strong>aperturado</strong>.
        </p>
        <p>
          Primero debe <strong>cerrar la estimación</strong>, revisar ítems y
          enviar a liquidaciones RFS si corresponde. Luego podrá cambiar de país.
        </p>
      </div>
    </Modal>

    <Modal
      open={cambioPais?.paso === 'visualizacion'}
      onClose={() => setCambioPais(null)}
      size="md"
      icon={<AlertTriangle className="h-4 w-4" />}
      title="¿Cambiar país de operación?"
      subtitle={
        cambioPais
          ? `${cambioPais.codigo} · De ${metaPais(pais).label} a ${metaPais(cambioPais.pais).label}`
          : undefined
      }
      footer={
        <>
          <button
            type="button"
            className="dms-btn-action border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
            onClick={() => setCambioPais(null)}
          >
            Quedarme
          </button>
          <button
            type="button"
            className="dms-btn-action border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700"
            onClick={soloVisualizacionYCambiarPais}
          >
            Solo visualicé · Cambiar país
          </button>
          <button
            type="button"
            className="dms-btn-enviar px-4 py-2 text-sm"
            onClick={() => {
              setCambioPais(null);
              toast(
                'Continúe la revisión: apruebe o rechace los ítems y luego envíe a liquidaciones RFS.',
                'info'
              );
            }}
          >
            Continuar revisión / decisión
          </button>
        </>
      }
    >
      <div className="space-y-3 text-sm leading-relaxed text-gray-600">
        <p>
          Está visualizando el estimado{' '}
          <strong>{cambioPais?.codigo ?? avisoVisualizacion?.codigo}</strong>. Se espera que{' '}
          <strong>apruebe o rechace los ítems de daño</strong> y luego{' '}
          <strong>envíe la decisión a liquidaciones RFS</strong>.
        </p>
        {(avisoVisualizacion?.itemsPendientes ?? 0) > 0 && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Aún hay <strong>{avisoVisualizacion?.itemsPendientes}</strong> ítem(s) sin revisar.
          </p>
        )}
        <p className="text-xs text-slate-500">
          Si solo ingresó a consultar, pulse <strong>Solo visualicé · Cambiar país</strong>.
        </p>
      </div>
    </Modal>
    </>
  );
}
