import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';
import { MainLayout } from '@/layouts/MainLayout';

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'RFS - DMS Ecuador | Gestor Seaboard Marine',
  description:
    'Plataforma del gestor Seaboard: ver, comentar, modificar estimados y enviar a liquidaciones RFS.',
  applicationName: 'Gestor Seaboard · RFS DMS',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={montserrat.variable}>
      <body className={montserrat.className}>
        <MainLayout>{children}</MainLayout>
      </body>
    </html>
  );
}
