import { redirect } from 'next/navigation';
import Image from 'next/image';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/Sidebar';
import { Profile, Topic, ExamAttempt } from '@/lib/types';
import { 
  Clock, 
  Sparkles, 
  FileText, 
  BarChart, 
  ArrowRight,
  Layers,
  GraduationCap,
  Award
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profile?.status !== 'approved' && profile?.role !== 'admin') {
    redirect('/pending');
  }

  // Ejecutar las consultas en paralelo para máxima velocidad y evitar cascadas de latencia
  const [
    { data: topics },
    { data: attempts },
    { count: bankQuestionsCount },
    { count: officialQuestionsCount },
  ] = await Promise.all([
    supabase
      .from('topics')
      .select('*, subtopics(*, questions(count))')
      .order('order_index', { ascending: true }),
    supabase
      .from('exam_attempts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('questions')
      .select('*', { count: 'exact', head: true }),
    supabase
      .from('official_exam_questions')
      .select('*', { count: 'exact', head: true }),
  ]);

  const totalBankQ = bankQuestionsCount ?? 0;
  const totalOfficialQ = officialQuestionsCount ?? 0;
  const totalQuestions = totalBankQ + totalOfficialQ;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900 w-full max-w-full overflow-x-hidden">
      <Sidebar profile={profile} />

      <main className="flex-1 min-w-0 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-8 space-y-8 overflow-y-auto">
        {/* Banner Bienvenida */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-50 via-white to-purple-50 border border-indigo-100 p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="relative z-10 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
                <GraduationCap className="w-3.5 h-3.5" />
                Alumno Autorizado
              </span>
              <span className="text-xs font-semibold text-slate-500 bg-white/80 border border-slate-200/80 px-2.5 py-0.5 rounded-full">
                Policía Local y Municipal · CLM / CM
              </span>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Bienvenido, {profile.full_name || profile.email}
            </h1>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Tienes a tu disposición {topics?.length || 0} temas estructurados y {totalQuestions} preguntas con justificación legal oficial.
              {totalOfficialQ > 0 && (
                <span className="block text-xs text-indigo-700/80 font-semibold mt-1">
                  ({totalBankQ} del banco propio + {totalOfficialQ} de exámenes oficiales)
                </span>
              )}
            </p>
          </div>
          <div className="relative w-24 h-24 md:w-28 md:h-28 shrink-0 hidden sm:flex items-center justify-center p-2 bg-white/80 backdrop-blur-xs rounded-3xl border border-indigo-100 shadow-xs hover:shadow-md transition-all">
            <div className="relative w-full h-full">
              <Image
                src="/logo-icon.png"
                alt="Logo Oposiciones"
                fill
                className="object-contain hover:scale-105 transition-transform"
                priority
              />
            </div>
          </div>
        </div>

        {/* Modalidades de Estudio */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            Elige tu modalidad de entrenamiento
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Modo Exámenes Oficiales */}
            <div className="rounded-3xl bg-white border border-slate-200 p-6 sm:p-7 hover:border-indigo-300 transition-all hover:shadow-md flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mb-5">
                  <Award className="w-6 h-6" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">Exámenes Oficiales</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                  Practica con convocatorias reales de Policía Local y Municipal ordenadas cronológicamente y por ayuntamiento.
                </p>
                <div className="flex flex-wrap gap-1.5 mb-6">
                  <span className="text-[11px] px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 font-semibold">
                    🏛️ Convocatorias reales
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 font-semibold">
                    📅 Orden por año
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 font-semibold">
                    🎯 Corrección oficial
                  </span>
                </div>
              </div>

              <a
                href="/study/official-exams"
                className="w-full py-3.5 px-4 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm"
              >
                Ver Exámenes Oficiales
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            {/* Modo Anki (Test) */}
            <div className="rounded-3xl bg-white border border-slate-200 p-6 sm:p-7 hover:border-purple-300 transition-all hover:shadow-md flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center mb-5">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">Modo Anki (Test)</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                  Repaso espaciado de preguntas tipo test: feedback inmediato con fundamento legal e intervalos de 1, 3, 10, 20 y 30 días.
                </p>
                <div className="flex flex-wrap gap-1.5 mb-6">
                  <span className="text-[11px] px-2 py-0.5 rounded-lg bg-purple-50 text-purple-700 font-semibold">
                    ⚡ Feedback inmediato
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-lg bg-purple-50 text-purple-700 font-semibold">
                    📅 1, 3, 10, 20, 30 días
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-lg bg-purple-50 text-purple-700 font-semibold">
                    🏛️ Banco + Oficiales
                  </span>
                </div>
              </div>

              <a
                href="/study/anki"
                className="w-full py-3.5 px-4 rounded-xl font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/20 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm"
              >
                Iniciar Anki Test
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            {/* Modo Flashcards */}
            <div className="rounded-3xl bg-white border border-slate-200 p-6 sm:p-7 hover:border-indigo-300 transition-all hover:shadow-md flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mb-5">
                  <Layers className="w-6 h-6" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">Modo Flashcards</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                  Memorización activa de plazos, artículos y definiciones con anverso/reverso y el mismo algoritmo Anki (1, 3, 10, 20 y 30 días).
                </p>
                <div className="flex flex-wrap gap-1.5 mb-6">
                  <span className="text-[11px] px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 font-semibold">
                    🔄 Tarjetas reversibles
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 font-semibold">
                    🧠 Repaso espaciado
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 font-semibold">
                    ⏱️ Plazos y conceptos
                  </span>
                </div>
              </div>

              <a
                href="/study/flashcards"
                className="w-full py-3.5 px-4 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm"
              >
                Repasar Flashcards
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </section>

        {/* Estructura del Temario: Enlace directo a la zona de contenidos */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Estructura del Temario
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              {topics?.length || 0} Temas cargados
            </span>
          </div>

          <a
            href="/study/contents"
            className="group block p-6 sm:p-7 rounded-3xl bg-white border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                    Explorar Temario Completo y Zona de Contenidos
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Accede a todos los bloques, temas oficiales y batería completa de preguntas organizadas.
                  </p>
                </div>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 flex items-center justify-center transition-all shrink-0">
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </a>
        </section>
      </main>
    </div>
  );
}
