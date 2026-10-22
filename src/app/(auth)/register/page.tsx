'use client'; // Define este archivo como un "Client Component" en Next.js, lo que permite usar interactividad y hooks de React (useState, useRouter) en el navegador.

import { useState } from 'react'; // Hook para crear variables de estado que, al cambiar, actualizan la interfaz automáticamente.
import Link from 'next/link'; // Componente de Next.js para navegar entre páginas de forma rápida sin recargar el navegador.
import Image from 'next/image'; // Componente de Next.js que optimiza las imágenes (peso, tamaño y formato) automáticamente.
import { useRouter } from 'next/navigation'; // Hook para realizar redirecciones mediante código (ej. llevar al usuario a otra ruta).
import { createClient } from '@/lib/supabase/client'; // Importa la función configurada para conectarse a tu base de datos Supabase desde el cliente.
import { AlertCircle, CheckCircle2, ArrowRight, Lock, Mail, User, Eye, EyeOff } from 'lucide-react'; // Paquete de iconos vectoriales ligeros.

export default function RegisterPage() {
  // --- HOOKS Y CLIENTE ---
  const router = useRouter(); // Instanciamos el enrutador para poder usar router.push() si fuera necesario.
  const supabase = createClient(); // Iniciamos la conexión con Supabase para manejar la autenticación.
  
  // --- ESTADOS LOCALES ---
  // Cada useState controla el valor de un campo del formulario o de la interfaz.
  const [fullName, setFullName] = useState(''); // Guarda el nombre introducido.
  const [email, setEmail] = useState(''); // Guarda el correo introducido.
  const [password, setPassword] = useState(''); // Guarda la contraseña.
  const [showPassword, setShowPassword] = useState(false); // Alterna entre true/false para mostrar el texto de la contraseña o los asteriscos.
  const [errorMsg, setErrorMsg] = useState<string | null>(null); // Guarda el mensaje de error si el registro falla (ej. "El correo ya existe").
  const [success, setSuccess] = useState(false); // Si es true, oculta el formulario y muestra el mensaje verde de éxito.
  const [loading, setLoading] = useState(false); // Si es true, muestra la animación de carga en el botón y lo desactiva.

  // --- FUNCIÓN DE REGISTRO ---
  // Se ejecuta al hacer clic en "Enviar Solicitud" (submit del formulario).
  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // Evita que la página haga un refresco completo tradicional al enviar el formulario.
    setErrorMsg(null); // Limpia cualquier mensaje de error de un intento anterior.
    setLoading(true); // Activa el estado de carga (spinner).

    try {
      // Petición a Supabase para crear un usuario nuevo.
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName, // Guarda el nombre completo del usuario en los metadatos de Supabase Auth.
          },
        },
      });

      // Si Supabase devuelve un error (por ejemplo. contraseña muy corta), lanza la excepción para capturarla abajo.
      if (error) throw error;
      
      // Si el registro es correcto, cambiamos success a true para renderizar la pantalla de confirmación.
      setSuccess(true);
      
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message); // Si es un error estándar, mostramos su mensaje.
      } else {
        setErrorMsg('Error al tramitar la solicitud de registro.'); // Mensaje de seguridad genérico.
      }
    } finally {
      setLoading(false); // Independientemente de si hubo éxito o error, apagamos el spinner de carga al terminar.
    }
  };

  return (
    // CONTENEDOR PRINCIPAL: Ahora usa overflow-x-hidden (permite scroll vertical) y py-12 para dar espacio al hacer scroll
    <div className="min-h-screen relative flex items-center justify-center py-12 px-4 bg-slate-950 text-slate-100 overflow-x-hidden select-none">
      
      {/* --- EFECTOS AMBIENTALES DE FONDO (GLOW) --- */}
      {/* Círculos desenfocados (blur-[120px]) que crean los resplandores de luz de fondo. pointer-events-none evita que interfieran con los clics. */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-blue-500/15 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-10 left-10 w-[300px] h-[300px] bg-violet-600/15 rounded-full blur-[100px] pointer-events-none" />

      {/* MALLA DECORATIVA SUTIL EN EL FONDO */}
      {/* Dibuja una cuadrícula fina en el fondo y le aplica una máscara radial para que se desvanezca hacia los bordes. */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* CONTENEDOR CENTRAL DEL CONTENIDO (Ancho máximo max-w-md = ~448px) */}
      <div className="relative w-full max-w-md z-10 my-auto">
        
        {/* --- CABECERA / LOGO --- */}
        <div className="text-center mb-8">
        <div className="flex justify-center mb-3">
            {/* Contenedor redondeado con un zoom mayor (scale-125) para recortar los cuadritos de las esquinas */}
            <div className="relative w-26 h-26 rounded-3xl overflow-hidden hover:scale-105 transition-transform p-1">
              <Image
                src="/iconoapp.png"
                alt="TESTCLM/CM"
                fill
                className="object-contain p-1"
                priority
              />
            </div>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Solicitud de Acceso</h1>
          <p className="text-xs sm:text-sm font-medium text-slate-400 mt-1">TEST CLM/CM · Policía Local y Municipal</p>
        </div>

        {/* --- TARJETA DEL FORMULARIO (Glassmorphism) --- */}
        {/* el backdrop-blur-2xl y colores semitransparentes (bg-slate-900/80) para crear el efecto cristal. */}
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-slate-800/80 p-6 sm:p-8 rounded-3xl shadow-2xl shadow-black/60 relative overflow-hidden">
          
          {/* LÍNEA SUPERIOR CON DESTELLO DE COLOR */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-80" />

          {/* RENDERIZADO CONDICIONAL: Dependiendo del estado 'success', mostramos el formulario o el mensaje de éxito */}
          {success ? (
            
            // --- PANTALLA DE ÉXITO (Solo visible si success === true tras un registro correcto) ---
            <div className="text-center py-4 space-y-4 animate-in fade-in zoom-in duration-300">
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-400 shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-white">¡Solicitud recibida con éxito!</h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Tu cuenta ha sido creada y se encuentra en estado{' '}
                <span className="font-bold text-amber-400">pendiente de aprobación</span>.
                El administrador validará tu perfil para autorizar tu acceso.
              </p>
              <div className="pt-4">
                <Link
                  href="/login"
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition-colors border border-slate-700"
                >
                  Ir a Iniciar Sesión
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

          ) : (
            
            // --- PANTALLA DE FORMULARIO (Visible mientras success === false) ---
            <>
              {/* CARTEL DE ERROR: Se muestra solo si errorMsg contiene algún texto */}
              {errorMsg && (
                <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-start gap-3 backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-200">
                  <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* FORMULARIO ASÍNCRONO */}
              <form onSubmit={handleRegister} className="space-y-6">
                
                {/* CAMPO: NOMBRE COMPLETO */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Nombre Completo
                  </label>
                  <div className="relative group">
                    {/* Icono izquierdo, se ilumina al interactuar con el campo (group-focus-within) */}
                    <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5 group-focus-within:text-indigo-400 transition-colors" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)} // Actualiza la variable 'fullName' al escribir
                      placeholder="Ej. Laura Gómez Martín"
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-sm transition-all"
                    />
                  </div>
                </div>

                {/* CAMPO: CORREO ELECTRÓNICO */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Correo Electrónico
                  </label>
                  <div className="relative group">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5 group-focus-within:text-indigo-400 transition-colors" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
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
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5 group-focus-within:text-indigo-400 transition-colors" />
                    <input
                      type={showPassword ? 'text' : 'password'} // Alterna dinámicamente entre texto y oculto basándose en el estado.
                      required
                      minLength={6} // 6 caracteres como mínimo para validación HTML.
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full pl-10 pr-11 py-3 rounded-xl bg-slate-950/60 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-sm transition-all"
                    />
                    {/* boton para mostrar/ocultar la contraseña */}
                    <button
                      type="button"
                      onClick={() => setShowPassword(prev => !prev)} // Invierte el valor actual de showPassword
                      className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-white transition-colors cursor-pointer rounded-lg hover:bg-slate-800/60"
                      title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                      tabIndex={-1} // Evita enfocar el botón al navegar por el formulario con la tecla Tabulador
                    >
                      {/* cambio la visibilidad de la contraseña */}
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* CAJA DE INFORMACIÓN / AVISO */}
                <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 leading-relaxed shadow-inner flex gap-3 items-start">
                  <span className="text-base leading-none shrink-0">ℹ️</span>
                  <span>Al registrarte, tu cuenta quedará en estado <strong className="text-white font-bold">pendiente</strong> hasta que el administrador autorice tu acceso.</span>
                </div>

                {/* BOTÓN REGISTRAR / ENVIAR MÁS PEQUEÑO */}
                {/* Cambios: w-3/4 (ocupa 75% de ancho), mx-auto (lo centra), py-2.5 (menos alto), text-sm (texto más pequeño) */}
                <button
                  type="submit"
                  disabled={loading} // Se apaga mientras la petición está en progreso para evitar clics dobles.
                  className="w-3/4 mx-auto py-2.5 px-4 rounded-xl text-sm font-bold bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 group cursor-pointer"
                >
                  {loading ? (
                    // Spinner animado (CSS nativo con Tailwind animate-spin) visible si loading es true
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    // Texto y flecha visible cuando está en reposo
                    <>
                      <span>Enviar Solicitud</span>
                      {/* La flecha hace un pequeño movimiento a la derecha al hacer hover sobre el botón */}
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </form>

              {/* PIE DE TARJETA CON ENLACE AL LOGIN */}
              <div className="mt-6 pt-6 border-t border-slate-800/80 text-center text-sm text-slate-400">
                ¿Ya tienes una cuenta aprobada?{' '}
                <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-bold hover:underline transition-colors">
                  Iniciar sesión
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}