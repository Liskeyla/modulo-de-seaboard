'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { MenuLateral } from '@/components/layout/MenuLateral';
import { ToastHost } from '@/components/ui/ToastHost';
import { useAuthStore } from '@/store';
import { useEstimacionesStore } from '@/store/estimacionesStore';
import { useUiStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';

/** Shell alineado a layout-dms AppShell: login sin chrome; resto con menú lateral. */
export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const esLogin = pathname?.startsWith('/login') ?? false;

  return (
    <>
      {esLogin ? children : <ShellProtegido>{children}</ShellProtegido>}
      <ToastHost />
    </>
  );
}

function ShellProtegido({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, hydrate } = useAuthStore();
  const { hydrate: hydrateEst } = useEstimacionesStore();
  const { menuFijado, hidratadoUi, hidratarUi } = useUiStore();
  const [listo, setListo] = useState(false);

  useEffect(() => {
    hydrate();
    hydrateEst();
    if (!hidratadoUi) hidratarUi();
    setListo(true);
  }, [hydrate, hydrateEst, hidratadoUi, hidratarUi]);

  useEffect(() => {
    if (!listo) return;
    const token = localStorage.getItem('dms_estimaciones_token');
    if (!token) router.replace('/login');
  }, [listo, isAuthenticated, router]);

  if (!listo) return <PantallaCarga />;

  const token =
    typeof window !== 'undefined' ? localStorage.getItem('dms_estimaciones_token') : null;
  if (!token) return <PantallaCarga />;

  return (
    <div className="min-h-screen bg-dms-bg">
      <MenuLateral />
      <div
        className={cn(
          'min-h-screen transition-[margin] duration-300 ease-out',
          menuFijado && 'lg:ml-72'
        )}
      >
        {children}
      </div>
    </div>
  );
}

function PantallaCarga() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-dms-bg">
      <Image
        src="/brand/logo-rfs.jpg"
        alt="Road Feeder Services"
        width={1385}
        height={1080}
        priority
        className="h-auto w-28 animate-fade-in mix-blend-multiply"
      />
      <p className="flex items-center gap-2 text-sm font-medium text-rfs-700">
        <Loader2 className="h-4 w-4 animate-spin text-rfsorange-500" />
        Validando sesión…
      </p>
    </div>
  );
}
