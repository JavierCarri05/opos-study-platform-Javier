import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: 'TESTCLM/CM - Policía Local y Municipal',
  description: 'Plataforma avanzada de preparación de oposiciones para Policía Local y Municipal (Castilla-La Mancha y Comunidad de Madrid). Simulacros oficiales y memorización activa (Anki).',
  icons: {
    icon: '/logo-icon.png',
    apple: '/logo-icon.png',
  },
};

import { SecurityGuard } from '@/components/SecurityGuard';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={`${inter.className} min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-indigo-600 selection:text-white w-full max-w-full overflow-x-hidden`}>
        <SecurityGuard />
        {children}
      </body>
    </html>
  );
}

