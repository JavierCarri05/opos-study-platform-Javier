'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Sidebar } from '@/components/Sidebar';
import { Profile, OfficialExam } from '@/lib/types';
import { getCachedUserProfile } from '@/lib/supabaseHelper';
import { 
  Award, 
  Clock, 
  ArrowRight, 
  BookOpen, 
  Sparkles, 
  Calendar,
  CheckCircle2,
  FileQuestion,
  ArrowDownAZ,
  Search,
  X,
  Edit3,
} from 'lucide-react';

export default function OfficialExamsHubPage() {
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Ordenador de exámenes oficiales: Por antigüedad (más nuevos primero) o Por orden alfabético
  const [examSortBy, setExamSortBy] = useState<'year' | 'alpha'>('year');
  const [examSearch, setExamSearch] = useState('');

  const sortedExams = useMemo(() => {
    let list = [...exams];
    if (examSearch.trim()) {
      const q = examSearch.toLowerCase().trim();
      list = list.filter(ex => 
        (ex.title && ex.title.toLowerCase().includes(q)) || 
        String(ex.year).includes(q) ||
        (ex.description && ex.description.toLowerCase().includes(q))
      );
    }

    return list.sort((a, b) => {
      if (examSortBy === 'year') {
        const yearDiff = (b.year || 0) - (a.year || 0);
        if (yearDiff !== 0) return yearDiff;
        return (a.title || '').localeCompare(b.title || '', 'es', { sensitivity: 'base' });
      } else {
        const titleDiff = (a.title || '').localeCompare(b.title || '', 'es', { sensitivity: 'base' });
        if (titleDiff !== 0) return titleDiff;
        return (b.year || 0) - (a.year || 0);
      }
    });
  }, [exams, examSortBy, examSearch]);

  useEffect(() => {
    async function loadData() {
      const [userProfRes, { data }] = await Promise.all([
        getCachedUserProfile(supabase),
        supabase
          .from('official_exams')
          .select('*, official_exam_questions(count)')
          .order('year', { ascending: false }),
      ]);

      if (!userProfRes?.user) {
        router.push('/login');
        return;
      }
      const prof = userProfRes.profile;
      if (prof?.status !== 'approved' && prof?.role !== 'admin') {
        router.push('/pending');
        return;
      }
      setProfile(prof);

      if (data) {
        setExams(data);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900 w-full max-w-full overflow-x-hidden">
      <Sidebar profile={profile} />

      <main className="flex-1 min-w-0 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-8 space-y-8 overflow-y-auto">
        {/* Cabecera */}
        <div className="border-b border-slate-200 pb-6">
          <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5 mb-1">
            <Award className="w-4 h-4" />
            Convocatorias Oficiales
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Exámenes Oficiales
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Realiza los exámenes completos de años anteriores tal y como se formularon en las pruebas oficiales.
          </p>
        </div>

        {loading ? (
          <div className="p-16 text-center text-slate-400">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Cargando exámenes oficiales...
          </div>
        ) : exams.length === 0 ? (
          <div className="p-16 rounded-3xl bg-white border border-dashed border-slate-300 text-center space-y-3">
            <Award className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-lg font-bold text-slate-900">No hay exámenes oficiales disponibles</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Aún no se ha publicado ninguna convocatoria oficial en esta sección.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Barra de control: Ordenador en 2 categorías y Buscador */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Convocatorias ({sortedExams.length})
                </span>
                <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-lg shadow-2xs">
                  {examSortBy === 'year' ? '📅 Más nuevos primero' : '🔤 Orden A-Z'}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                {/* Selector de ordenación en 2 categorías */}
                <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 shadow-2xs border border-slate-200/70">
                  <button
                    type="button"
                    onClick={() => setExamSortBy('year')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      examSortBy === 'year'
                        ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80 font-black'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                    title="Ordenar por antigüedad (los más nuevos primero según el año)"
                  >
                    <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Por Antigüedad</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExamSortBy('alpha')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      examSortBy === 'alpha'
                        ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80 font-black'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                    title="Ordenar por orden alfabético (A-Z)"
                  >
                    <ArrowDownAZ className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Por Orden Alfabético</span>
                  </button>
                </div>

                {/* Buscador rápido */}
                <div className="relative w-full sm:w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar convocatoria..."
                    value={examSearch}
                    onChange={(e) => setExamSearch(e.target.value)}
                    className="w-full pl-8.5 pr-8 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs font-medium"
                  />
                  {examSearch && (
                    <button
                      type="button"
                      onClick={() => setExamSearch('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {sortedExams.length === 0 ? (
              <div className="p-12 rounded-3xl bg-white border border-dashed border-slate-300 text-center space-y-2">
                <p className="text-sm font-bold text-slate-800">No se encontraron convocatorias</p>
                <p className="text-xs text-slate-400">
                  No hay exámenes que coincidan con los términos de búsqueda "{examSearch}".
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sortedExams.map((exam) => {
              const qCount = exam.official_exam_questions?.[0]?.count || 0;

              return (
                <div
                  key={exam.id}
                  className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs hover:border-indigo-300 transition-all flex flex-col justify-between space-y-6"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold px-2.5 py-1 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Convocatoria {exam.year}
                      </span>
                      <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {exam.duration_minutes} min
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 leading-snug">
                      {exam.title}
                    </h3>

                    {exam.description && (
                      <p className="text-xs text-slate-500 line-clamp-2">
                        {exam.description}
                      </p>
                    )}
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
                      <span className="flex items-center gap-1">
                        <FileQuestion className="w-4 h-4 text-indigo-600" />
                        {qCount} preguntas completas
                      </span>
                      <span>Penalización: -{exam.penalty_ratio}</span>
                    </div>

                    <a
                      href={`/study/official-exam/${exam.id}`}
                      className="w-full py-3 px-4 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white text-xs shadow-sm flex items-center justify-center gap-2 transition-all"
                    >
                      Empezar Examen Oficial
                      <ArrowRight className="w-4 h-4" />
                    </a>

                    {profile?.role === 'admin' && (
                      <a
                        href={`/admin/official-exams?examId=${exam.id}`}
                        className="w-full py-2.5 px-4 rounded-xl font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs shadow-2xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                        title="Organizar, controlar y editar las preguntas de este examen"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                        <span>Organizar y Editar Preguntas (Admin)</span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
