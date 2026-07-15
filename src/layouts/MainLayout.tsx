'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { ToastHost } from '@/components/ui/ToastHost';
import { useAuthStore } from '@/store';
import { useEstimacionesStore } from '@/store/estimacionesStore';

export function MainLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { hydrate: hydrateAuth } = useAuthStore();
  const { hydrate: hydrateEst } = useEstimacionesStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    hydrateAuth();
    hydrateEst();
  }, [hydrateAuth, hydrateEst]);

  useEffect(() => {
    const token = localStorage.getItem('dms_estimaciones_token');
    if (!token && pathname !== '/login') {
      router.push('/login');
    }
  }, [pathname, router]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (pathname === '/login') {
    return (
      <>
        {children}
        <ToastHost />
      </>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header onMenuToggle={() => setSidebarOpen((v) => !v)} />
      <div className="relative flex flex-1">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="w-full flex-1 overflow-x-hidden px-3 py-4 md:px-5 md:py-6">
          <div className="dms-shell">{children}</div>
        </main>
      </div>
      <footer className="border-t border-[#001f42] bg-gradient-to-r from-[#002b5c] to-[#003d7a] px-4 py-3 text-center text-xs text-white/80">
        <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-2 sm:flex-row">
          <span>RFS - DMS Ecuador v3.0.3.40 · Estimaciones / Seaboard</span>
          <span>Desarrollado por Apptelink S.A.</span>
        </div>
      </footer>
      <ToastHost />
    </div>
  );
}
