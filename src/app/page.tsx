import Link from 'next/link';
import Image from 'next/image';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col justify-between items-center p-6 bg-gradient-to-b from-indigo-50/50 via-white to-slate-50 text-slate-900 w-full max-w-full overflow-x-hidden">
      <div className="w-full flex-1" />

      {/* Contenedor central: Logo + Botones */}
      <div className="w-full max-w-md flex flex-col items-center text-center">
        {/* Logo oficial */}
        <div className="w-full bg-white p-5 sm:p-7 rounded-3xl border border-indigo-100 shadow-xl shadow-indigo-500/10 hover:shadow-indigo-500/15 transition-all">
          <div className="relative w-full h-24 sm:h-28">
            <Image
              src="/logo-full.png"
              alt="TESTCLM/CM - Policía Local y Municipal"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* Acciones principales */}
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3.5 w-full justify-center">
          <Link
            href="/login"
            className="w-full sm:flex-1 py-3.5 px-6 rounded-2xl font-bold bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 hover:border-slate-300 shadow-xs transition-all text-center flex items-center justify-center cursor-pointer active:scale-95"
          >
            Iniciar Sesión
          </Link>
          <Link
            href="/register"
            className="w-full sm:flex-1 py-3.5 px-6 rounded-2xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all text-center flex items-center justify-center cursor-pointer active:scale-95"
          >
            Solicitar Acceso
          </Link>
        </div>
      </div>

      <div className="w-full flex-1 flex items-end justify-center">
        <footer className="py-6 text-center text-xs text-slate-400 font-medium">
          <p>© {new Date().getFullYear()} TEST CLM/CM · Policía Local y Municipal</p>
        </footer>
      </div>
    </main>
  );
}
