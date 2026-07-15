import type { Metadata } from 'next';
import './globals.css';
import { MainLayout } from '@/layouts/MainLayout';

export const metadata: Metadata = {
  title: 'RFS - DMS Ecuador | Estimaciones Seaboard',
  description:
    'Prototipo operativo: Reporte de Estimaciones y Aprobaciones Seaboard para RFS DMS Ecuador.',
  applicationName: 'RFS DMS Estimaciones',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <MainLayout>{children}</MainLayout>
      </body>
    </html>
  );
}
