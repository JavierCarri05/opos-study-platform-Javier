import Link from 'next/link';
import Image from 'next/image';

export default function HomePage() {
  return (
    // CONTENEDOR PRINCIPAL: Aplicamos el fondo oscuro (bg-slate-950) para unificar el diseño
    <main className="min-h-screen relative flex flex-col justify-between items-center p-6 bg-slate-950 text-slate-100 w-full max-w-full overflow-x-hidden select-none">
      
      {/* --- EFECTOS AMBIENTALES DE FONDO (GLOW) --- */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-blue-500/15 rounded-full blur-[100px] pointer-events-none" />

      {/* MALLA DECORATIVA SUTIL EN EL FONDO */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      <div className="w-full flex-1" />

      {/* --- CONTENEDOR CENTRAL: Más ancho (max-w-lg) para que luzca bien el logo y el texto juntos --- */}
      <div className="relative w-full max-w-lg flex flex-col items-center bg-slate-900/80 border border-slate-800/80 p-8 sm:p-10 rounded-3xl shadow-2xl z-10">
        
        {/* Línea superior con destello */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-80" />

        {/* --- LOGO COMPLETO --- */}
        <div className="w-full mb-8 flex justify-center">
          <div className="relative w-full h-40 sm:h-52 transition-transform hover:scale-105 duration-300">
            <Image
              src="/logo-full.jpg"
              alt="TEST CLM/CM - Policía Local y Municipal"
              fill
              className="object-contain p-2"
              priority
            />
          </div>
        </div>

        {/* --- BOTONES DE ACCIÓN --- */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
          {/* Botón secundario oscuro */}
          <Link
            href="/login"
            className="w-full sm:w-1/2 py-3.5 px-6 rounded-xl font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 shadow-md transition-all text-center flex items-center justify-center cursor-pointer active:scale-95"
          >
            Iniciar Sesión
          </Link>
          
          {/* Botón principal degradado */}
          <Link
            href="/register"
            className="w-full sm:w-1/2 py-3.5 px-6 rounded-xl font-bold bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all text-center flex items-center justify-center cursor-pointer active:scale-95"
          >
            Solicitar Acceso
          </Link>
        </div>
      </div>

      {/* FOOTER */}
      <div className="w-full flex-1 flex items-end justify-center z-10">
        <footer className="py-6 text-center text-xs text-slate-500 font-medium">
          <p>© {new Date().getFullYear()} TEST CLM/CM · Policía Local y Municipal</p>
        </footer>
      </div>
    </main>
  );
}