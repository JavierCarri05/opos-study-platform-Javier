'use client'; // Indico a Next.js (App Router) que este componente se ejecuta en el navegador (Client Component), lo que nos permite usar hooks como useState.

import { useState } from 'react'; // Hook de React para gestionar estados locales (campos de texto, cargando, errores, etc.).
import Link from 'next/link'; // Componente de Next.js para la navegación optimizada entre páginas sin recargar la web.
import Image from 'next/image'; // Componente optimizado de Next.js para renderizar imágenes y logos.
import { useRouter } from 'next/navigation'; // Hook de Next.js para redirigir al usuario mediante código (ej: tras hacer login).
import { createClient } from '@/lib/supabase/client'; // Importo la función que inicializa el cliente de Supabase para el navegador.
import { AlertCircle, ArrowRight, Lock, Mail, Eye, EyeOff } from 'lucide-react'; // Importo iconos SVG vectoriales.

export default function LoginPage() {
  // --- HOOKS Y CLIENTE ---
  const router = useRouter(); // Instancia del router para redirecciones (/dashboard, /pending, etc.).
  const supabase = createClient(); // Inicialización del cliente web de Supabase para consultas a Auth y Base de Datos.

  // --- ESTADOS LOCALES DEL FORMULARIO ---
  const [email, setEmail] = useState(''); // Guarda el correo introducido en el input.
  const [password, setPassword] = useState(''); // Guarda la contraseña introducida.
  const [showPassword, setShowPassword] = useState(false); // Alterna la visibilidad de la contraseña (true = texto visible, false = puntos).
  const [errorMsg, setErrorMsg] = useState<string | null>(null); // Almacena el texto de error si las credenciales fallan o la cuenta no existe.
  const [loading, setLoading] = useState(false); // Indica si la petición está en curso (sirve para mostrar el spinner y desactivar el botón).

  // --- FUNCIÓN DE INICIO DE SESIÓN ---
  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // Evita que el formulario recargue la página completa al pulsar Enter o el botón.
    setErrorMsg(null); // Limpio cualquier mensaje de error anterior.
    setLoading(true); // Activo el estado de carga para bloquear el botón y evitar múltiples clics.

    try {
      // 1. Petición de autenticación a Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      // Si Supabase devuelve un error (ej: contraseña incorrecta), lo lanzo para capturarlo en el catch
      if (error) throw error;

      // 2. Si el login es correcto y hay datos de usuario
      if (data.user) {
        // Consulto la tabla 'profiles' para comprobar el estado de la cuenta (pending, approved, rejected) y su rol (admin, student)
        const { data: profile } = await supabase
          .from('profiles')
          .select('status, role')
          .eq('id', data.user.id) // Filtro por el ID único del usuario autenticado
          .single(); // Indico que solo espero un registro de resultado

        // 3. Compruebo el estado del usuario para decidir la redirección
        if (profile?.status === 'pending' || profile?.status === 'rejected') {
          // Si el usuario aún no ha sido aprobado por el administrador, lo mando a la pantalla de espera
          router.push('/pending');
        } else {
          // Si está aprobado (o es admin), lo redirijo al panel principal
          router.push('/dashboard');
        }
        router.refresh(); // Fuerza el refresco de las rutas del servidor para actualizar la sesión activa.
      }
    } catch (err: unknown) {
      // Manejo seguro de errores en TypeScript
      if (err instanceof Error) {
        setErrorMsg(err.message); // Capturo el mensaje explicativo de Supabase o JavaScript
      } else {
        setErrorMsg('Error al iniciar sesión. Revisa tus credenciales.');
      }
    } finally {
      setLoading(false); // Desactivo el estado de carga una vez finalizado todo el proceso (haya ido bien o mal).
    }
  };

  return (
    // CONTENEDOR PRINCIPAL: Ocupa el 100% del alto de pantalla (min-h-screen), centra el contenido y aplica fondo oscuro slate-950
    <div className="min-h-screen relative flex items-center justify-center p-4 bg-slate-950 text-slate-100 overflow-hidden select-none">
      
      {/* --- EFECTOS AMBIENTALES DE FONDO (GLOW / LUCES NEÓN) --- */}
      {/* Luz central índigo desenfocada */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
      {/* Luz azul en esquina inferior derecha */}
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-blue-500/15 rounded-full blur-[100px] pointer-events-none" />
      {/* Luz violeta en esquina superior izquierda */}
      <div className="absolute top-10 left-10 w-[300px] h-[300px] bg-violet-600/15 rounded-full blur-[100px] pointer-events-none" />

      {/* MALLA / PATRÓN CUADRICULADO EN EL FONDO CON MÁSCARA RADIAL */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* CONTENEDOR CENTRAL (Ancho máximo max-w-md = ~448px) */}
      <div className="relative w-full max-w-md z-10">
        
        {/* --- CABECERA DE LA PÁGINA (LOGO Y TÍTULOS) --- */}
        <div className="text-center mb-8">
        <div className="flex justify-center mb-3">
            {/* Contenedor redondeado con un zoom mayor (scale-125) para recortar los cuadritos de las esquinas */}
            <div className="relative w-38 h-38 rounded-3xl overflow-hidden hover:scale-105 transition-transform p-1">
              <Image
                src="/iconoapp.png"
                alt="TESTCLM/CM"
                fill
                className="object-contain p-1"
                priority
              />
            </div>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Acceso a TEST CLM/CM</h1>
          <p className="text-xs sm:text-sm font-medium text-slate-400 mt-1">Policía Local y Municipal</p>
        </div>

        {/* --- TARJETA DEL FORMULARIO (GLASSMORPHISM CARD) --- */}
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-slate-800/80 p-5 rounded-3xl shadow-2xl shadow-black/60 relative overflow-hidden">
          
          {/* Línea decorativa brillante en la parte superior del marco */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-80" />

          {/* MENSAJE DE ERROR: Solo se renderiza si errorMsg no es nulo */}
          {errorMsg && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-start gap-3 backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-200">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* FORMULARIO */}
          <form onSubmit={handleLogin} className="space-y-5">
            
            {/* CAMPO: CORREO ELECTRÓNICO */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Correo Electrónico
              </label>
              <div className="relative group">
                {/* Icono del sobre de correo: Cambia a color índigo cuando el usuario hace foco en el campo */}
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5 group-focus-within:text-indigo-400 transition-colors" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)} // Actualiza el estado 'email' con lo que escribe el usuario
                  placeholder="ejemplo@oposicion.es"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-sm transition-all"
                />
              </div>
            </div>

            {/* CAMPO: CONTRASEÑA */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Contraseña
              </label>
              <div className="relative group">
                {/* Icono de candado */}
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5 group-focus-within:text-indigo-400 transition-colors" />
                <input
                  type={showPassword ? 'text' : 'password'} // Alterna dinámicamente entre texto visible y asterisco/puntos
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)} // Actualiza el estado 'password'
                  placeholder="••••••••"
                  className="w-full pl-10 pr-11 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-sm transition-all"
                />
                
                {/* Botón para alternar visibilidad (Ojo / Ojo tachado) */}
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)} // Invierte el estado booleano
                  className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-white transition-colors cursor-pointer rounded-lg hover:bg-slate-800/60"
                  title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  tabIndex={-1} // Evita que la tecla TAB se pare en este botón
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* BOTÓN SUBMIT (ENTRAR) */}
            <button
              type="submit"
              disabled={loading} // Se deshabilita automáticamente mientras se procesa el inicio de sesión
              className="w-full py-3.5 px-4 rounded-xl font-bold bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 group cursor-pointer"
            >
              {loading ? (
                // Círculo giratorio (Spinner) mientras 'loading' es true
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                // Texto y flecha cuando no está cargando
                <>
                  <span>Entrar a la Plataforma</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* PIE DE TARJETA: ENLACE AL REGISTRO */}
          <div className="mt-6 pt-6 border-t border-slate-800/80 text-center text-sm text-slate-400">
            ¿No tienes cuenta aún?{' '}
            <Link href="/register" className="text-indigo-400 hover:text-indigo-300 font-bold hover:underline transition-colors">
              Solicitar registro
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}