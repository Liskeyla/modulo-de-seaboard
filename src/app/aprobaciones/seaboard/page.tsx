'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store';
import { toast } from '@/lib/utils';
import AprobacionesSeaboardPage from '@/views/AprobacionesSeaboardPage';

/**
 * Seaboard Marine decide Aprobar/Rechazar desde el detalle del estimado
 * (botón Enviar a Aprobación → informe). Esta lista queda solo para DMS.
 */
export default function AprobacionesSeaboardRoute() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user?.rol === 'seaboard') {
      toast(
        'Seaboard decide desde el detalle del estimado.\nAbra el estimado y pulse Enviar a Aprobación.',
        'info'
      );
      router.replace('/reportes/estimaciones');
    }
  }, [user?.rol, router]);

  if (user?.rol === 'seaboard') {
    return null;
  }

  return <AprobacionesSeaboardPage />;
}
