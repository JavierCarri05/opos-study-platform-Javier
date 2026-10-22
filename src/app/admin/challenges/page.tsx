'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Sidebar } from '@/components/Sidebar';
import { Profile, QuestionChallenge, ChallengeStatus } from '@/lib/types';
import { 
  Flag, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Filter, 
  Edit3, 
  Trash2, 
  Save, 
  X, 
  AlertTriangle, 
  Check, 
  BookOpen, 
  User, 
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  HelpCircle,
  Award
} from 'lucide-react';

export default function AdminChallengesPage() {
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [challenges, setChallenges] = useState<QuestionChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);

  // Filtros
  const [statusFilter, setStatusFilter] = useState<'all' | ChallengeStatus>('pending');
  const [originFilter, setOriginFilter] = useState<'all' | 'bank' | 'official' | 'flashcard'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Edición rápida de la pregunta desde la impugnación
  const [editingChallengeId, setEditingChallengeId] = useState<string | null>(null);
  const [editQuestionText, setEditQuestionText] = useState('');
  const [editOptions, setEditOptions] = useState<string[]>([]);
  const [editCorrectOption, setEditCorrectOption] = useState<number>(0);
  const [editExplanation, setEditExplanation] = useState('');
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);

  // Respuesta / Resolución del admin
  const [resolvingChallengeId, setResolvingChallengeId] = useState<string | null>(null);
  const [adminResponseText, setAdminResponseText] = useState('');
  const [isSavingResolution, setIsSavingResolution] = useState(false);

  const fetchChallenges = async () => {
    setLoading(true);
    setTableMissing(false);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (prof?.role !== 'admin') {
      router.push('/dashboard');
      return;
    }
    setProfile(prof);

    try {
      const { data, error } = await supabase
        .from('question_challenges')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('schema cache') || error.message?.includes('does not exist')) {
          setTableMissing(true);
          setChallenges([]);
        } else {
          throw error;
        }
      } else if (data) {
        setChallenges(data as QuestionChallenge[]);
      }
    } catch (err: any) {
      console.error('Error fetching question challenges:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChallenges();
  }, []);

  // Actualizar estado de una impugnación
  const handleUpdateStatus = async (
    id: string, 
    newStatus: ChallengeStatus, 
    customResponse?: string
  ) => {
    try {
      const updatePayload: any = {
        status: newStatus,
        resolved_at: newStatus !== 'pending' ? new Date().toISOString() : null,
      };

      if (customResponse !== undefined) {
        updatePayload.admin_response = customResponse;
      }

      const { error } = await supabase
        .from('question_challenges')
        .update(updatePayload)
        .eq('id', id);

      if (error) throw error;

      setChallenges(prev =>
        prev.map(c => (c.id === id ? { ...c, ...updatePayload } : c))
      );
      setResolvingChallengeId(null);
      setAdminResponseText('');
    } catch (err: any) {
      alert('Error al actualizar el estado: ' + (err.message || 'Error desconocido'));
    }
  };

  // Eliminar impugnación
  const handleDeleteChallenge = async (id: string) => {
    if (!confirm('¿Deseas eliminar permanentemente esta impugnación?')) return;
    try {
      const { error } = await supabase
        .from('question_challenges')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setChallenges(prev => prev.filter(c => c.id !== id));
    } catch (err: any) {
      alert('Error al eliminar impugnación: ' + (err.message || 'Error desconocido'));
    }
  };

  // Abrir editor en vivo de la pregunta impugnada
  const handleStartEdit = (challenge: QuestionChallenge) => {
    setEditingChallengeId(challenge.id);
    setEditQuestionText(challenge.question_text || '');
    setEditOptions(
      challenge.options && challenge.options.length > 0
        ? [...challenge.options]
        : ['', '', '']
    );
    setEditCorrectOption(challenge.correct_option ?? 0);
    setEditExplanation(challenge.explanation || '');
  };

  // Guardar corrección directa en la base de datos (questions u official_exam_questions)
  const handleSaveQuestionCorrection = async (challenge: QuestionChallenge) => {
    if (!editQuestionText.trim()) {
      alert('El enunciado no puede estar vacío.');
      return;
    }
    if (editOptions.some(o => !o.trim())) {
      alert('Todas las opciones deben tener texto.');
      return;
    }

    try {
      setIsSavingQuestion(true);
      // 1. Actualizar la pregunta en su tabla oficial o flashcard
      if (challenge.question_type === 'flashcard') {
        const { error: fError } = await supabase
          .from('flashcards')
          .update({
            front_text: editQuestionText.trim(),
            back_text: editExplanation.trim(),
          })
          .eq('id', challenge.question_id);
        if (fError) console.warn('Error al actualizar flashcard:', fError);
      } else {
        const isOfficial = challenge.question_type === 'official';
        const targetTable = isOfficial ? 'official_exam_questions' : 'questions';

        const { error: qError } = await supabase
          .from(targetTable)
          .update({
            question_text: editQuestionText.trim(),
            options: editOptions.map(o => o.trim()),
            correct_option: editCorrectOption,
            explanation: editExplanation.trim(),
          })
          .eq('id', challenge.question_id);

        if (qError) {
          console.warn('Error al actualizar tabla origen (puede que haya cambiado el id):', qError);
        }
      }

      // 2. Actualizar también el snapshot y marcar la impugnación como resuelta
      const { error: cError } = await supabase
        .from('question_challenges')
        .update({
          question_text: editQuestionText.trim(),
          options: editOptions.map(o => o.trim()),
          correct_option: editCorrectOption,
          explanation: editExplanation.trim(),
          status: 'resolved',
          admin_response: 'Pregunta corregida directamente en la base de datos.',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', challenge.id);

      if (cError) throw cError;

      setChallenges(prev =>
        prev.map(c =>
          c.id === challenge.id
            ? {
                ...c,
                question_text: editQuestionText.trim(),
                options: editOptions.map(o => o.trim()),
                correct_option: editCorrectOption,
                explanation: editExplanation.trim(),
                status: 'resolved',
                admin_response: 'Pregunta corregida directamente en la base de datos.',
                resolved_at: new Date().toISOString(),
              }
            : c
        )
      );

      setEditingChallengeId(null);
      alert('¡Pregunta corregida y guardada con éxito! La impugnación ha sido marcada como resuelta.');
    } catch (err: any) {
      alert('Error al guardar la corrección: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsSavingQuestion(false);
    }
  };

  // Métricas y conteos
  const counts = useMemo(() => {
    return {
      total: challenges.length,
      pending: challenges.filter(c => c.status === 'pending').length,
      resolved: challenges.filter(c => c.status === 'resolved').length,
      dismissed: challenges.filter(c => c.status === 'dismissed').length,
    };
  }, [challenges]);

  // Filtrado de impugnaciones
  const filteredChallenges = useMemo(() => {
    return challenges.filter(c => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (originFilter !== 'all' && c.question_type !== originFilter) return false;

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const inQuestion = c.question_text?.toLowerCase().includes(query) ?? false;
        const inReason = c.reason.toLowerCase().includes(query);
        const inUser = (c.user_email?.toLowerCase().includes(query) || c.user_name?.toLowerCase().includes(query)) ?? false;
        const inResponse = c.admin_response?.toLowerCase().includes(query) ?? false;
        if (!inQuestion && !inReason && !inUser && !inResponse) return false;
      }

      return true;
    });
  }, [challenges, statusFilter, originFilter, searchTerm]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900 w-full max-w-full overflow-x-hidden">
      <Sidebar profile={profile} />

      <main className="flex-1 min-w-0 max-w-7xl w-full mx-auto p-4 sm:p-8 space-y-8 overflow-y-auto">
        {/* Cabecera Principal */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 flex items-center gap-1.5">
                <Flag className="w-3.5 h-3.5 fill-amber-700/20" />
                Gestión Docente
              </span>
              {counts.pending > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-600 text-white animate-pulse">
                  {counts.pending} pendiente{counts.pending === 1 ? '' : 's'}
                </span>
              )}
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight mt-2">
              Impugnaciones de Preguntas
            </h1>
            <p className="text-sm font-semibold text-slate-500 mt-1">
              Revisa, argumenta y corrige los fallos reportados por los alumnos en la rueda de preguntas y exámenes oficiales.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchChallenges}
              disabled={loading}
              className="px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold shadow-2xs flex items-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>
          </div>
        </div>

        {/* ALERTA: TABLA PENDIENTE DE CREACIÓN EN SUPABASE */}
        {tableMissing && (
          <div className="p-6 rounded-3xl bg-amber-50 border-2 border-amber-300 text-amber-950 space-y-3 shadow-sm">
            <div className="flex items-center gap-2.5 text-amber-900 font-extrabold text-base">
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
              <span>Tabla de impugnaciones pendiente de crear en Supabase</span>
            </div>
            <p className="text-xs sm:text-sm text-amber-800 leading-relaxed">
              La tabla <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono font-bold">public.question_challenges</code> aún no existe en tu base de datos de Supabase. Hemos creado el script listo para ejecutar.
            </p>
            <div className="p-3 bg-white/80 rounded-xl border border-amber-200 text-xs text-slate-700 font-medium">
              Abre el <strong>SQL Editor</strong> en tu panel de Supabase y ejecuta el archivo: <span className="font-bold text-indigo-700">create_question_challenges.sql</span>
            </div>
          </div>
        )}

        {/* Tarjetas de Contadores / Métricas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`p-5 rounded-3xl border text-left transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-indigo-50/80 border-indigo-300 shadow-sm ring-2 ring-indigo-500/20'
                : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
            }`}
          >
            <span className="text-xs font-bold text-slate-500 block">Total Impugnaciones</span>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
              {counts.total}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={`p-5 rounded-3xl border text-left transition-all cursor-pointer ${
              statusFilter === 'pending'
                ? 'bg-amber-50 border-amber-300 shadow-sm ring-2 ring-amber-500/20'
                : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
            }`}
          >
            <span className="text-xs font-bold text-amber-700 flex items-center justify-between">
              <span>Pendientes</span>
              {counts.pending > 0 && <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />}
            </span>
            <div className="text-2xl sm:text-3xl font-black text-amber-900 mt-1">
              {counts.pending}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('resolved')}
            className={`p-5 rounded-3xl border text-left transition-all cursor-pointer ${
              statusFilter === 'resolved'
                ? 'bg-emerald-50 border-emerald-300 shadow-sm ring-2 ring-emerald-500/20'
                : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
            }`}
          >
            <span className="text-xs font-bold text-emerald-700 block">Resueltas / Corregidas</span>
            <div className="text-2xl sm:text-3xl font-black text-emerald-900 mt-1">
              {counts.resolved}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('dismissed')}
            className={`p-5 rounded-3xl border text-left transition-all cursor-pointer ${
              statusFilter === 'dismissed'
                ? 'bg-slate-100 border-slate-300 shadow-sm ring-2 ring-slate-400/20'
                : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
            }`}
          >
            <span className="text-xs font-bold text-slate-500 block">Descartadas</span>
            <div className="text-2xl sm:text-3xl font-black text-slate-700 mt-1">
              {counts.dismissed}
            </div>
          </button>
        </div>

        {/* Barra de Filtros y Búsqueda */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por enunciado, alumno o argumentación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Origen:</span>
              <select
                value={originFilter}
                onChange={(e) => setOriginFilter(e.target.value as any)}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="all">Todos los orígenes</option>
                <option value="bank">Banco Propio</option>
                <option value="official">Examen Oficial</option>
                <option value="flashcard">Flashcards</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Estado:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="all">Todos los estados</option>
                <option value="pending">Pendientes ({counts.pending})</option>
                <option value="resolved">Resueltas ({counts.resolved})</option>
                <option value="dismissed">Descartadas ({counts.dismissed})</option>
              </select>
            </div>
          </div>
        </div>

        {/* Listado de Impugnaciones */}
        {loading ? (
          <div className="py-20 text-center text-slate-400 space-y-3">
            <div className="w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs sm:text-sm font-semibold">Cargando impugnaciones...</p>
          </div>
        ) : filteredChallenges.length === 0 ? (
          <div className="p-12 text-center bg-white border border-dashed border-slate-200 rounded-3xl space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900">
              No hay impugnaciones en esta vista
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {statusFilter === 'pending'
                ? '¡Genial! Todas las impugnaciones han sido revisadas o resueltas.'
                : 'No se encontraron avisos que coincidan con los filtros aplicados.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredChallenges.map((challenge) => {
              const isEditingThis = editingChallengeId === challenge.id;
              const isResolvingThis = resolvingChallengeId === challenge.id;

              return (
                <div
                  key={challenge.id}
                  className={`bg-white border rounded-3xl p-6 sm:p-8 shadow-xs transition-all space-y-6 ${
                    challenge.status === 'pending'
                      ? 'border-amber-200 shadow-amber-500/5'
                      : challenge.status === 'resolved'
                      ? 'border-emerald-200'
                      : 'border-slate-200 opacity-90'
                  }`}
                >
                  {/* Cabecera de la Tarjeta */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                        challenge.question_type === 'official'
                          ? 'bg-purple-100 text-purple-800'
                          : challenge.question_type === 'flashcard'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-indigo-100 text-indigo-800'
                      }`}>
                        {challenge.question_type === 'official' ? (
                          <>
                            <Award className="w-3.5 h-3.5" />
                            Examen Oficial
                          </>
                        ) : challenge.question_type === 'flashcard' ? (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            Flashcard
                          </>
                        ) : (
                          <>
                            <BookOpen className="w-3.5 h-3.5" />
                            Banco Propio
                          </>
                        )}
                      </span>

                      <span className={`px-2.5 py-1 rounded-xl text-xs font-black uppercase tracking-wider ${
                        challenge.status === 'pending'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : challenge.status === 'resolved'
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-slate-100 text-slate-700 border border-slate-300'
                      }`}>
                        {challenge.status === 'pending'
                          ? '● Pendiente'
                          : challenge.status === 'resolved'
                          ? '✓ Resuelta'
                          : '✕ Descartada'}
                      </span>

                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{challenge.user_name || challenge.user_email || 'Alumno'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{new Date(challenge.created_at).toLocaleString('es-ES')}</span>
                    </div>
                  </div>

                  {/* Argumentación del Alumno (Destacada) */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/70 border border-amber-200 text-amber-950 space-y-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                      <Flag className="w-3.5 h-3.5 text-amber-600" />
                      Argumentación de la Impugnación por el Alumno:
                    </span>
                    <p className="text-xs sm:text-sm font-semibold leading-relaxed whitespace-pre-line text-slate-900">
                      «{challenge.reason}»
                    </p>
                  </div>

                  {/* Si el admin ha dejado una respuesta/resolución previa */}
                  {challenge.admin_response && !isResolvingThis && (
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
                      <span className="font-bold text-slate-800">Resolución del profesor:</span>
                      <p className="leading-relaxed">{challenge.admin_response}</p>
                    </div>
                  )}

                  {/* Formulario de Respuesta / Resolución */}
                  {isResolvingThis && (
                    <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-3 animate-in fade-in">
                      <label className="block text-xs font-bold uppercase text-indigo-900">
                        Respuesta / Nota de Resolución
                      </label>
                      <textarea
                        rows={2}
                        value={adminResponseText}
                        onChange={(e) => setAdminResponseText(e.target.value)}
                        placeholder="Ej. Corregida opción C en base al Art. 116.2 CE..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-indigo-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium leading-relaxed"
                        autoFocus
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setResolvingChallengeId(null)}
                          className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(challenge.id, 'resolved', adminResponseText.trim())}
                          className="px-4 py-1.5 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Guardar y Marcar Resuelta</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Detalle o Editor de la Pregunta Impugnada */}
                  {isEditingThis ? (
                    /* MODO EDICIÓN EN VIVO */
                    <div className="p-5 rounded-3xl bg-slate-50 border-2 border-indigo-300 space-y-4 animate-in fade-in">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                        <span className="text-xs font-black uppercase text-indigo-700 flex items-center gap-1.5">
                          <Edit3 className="w-4 h-4" />
                          Corregir Pregunta en la Base de Datos
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingChallengeId(null)}
                          className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Enunciado */}
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-slate-700">Enunciado</label>
                        <textarea
                          rows={3}
                          value={editQuestionText}
                          onChange={(e) => setEditQuestionText(e.target.value)}
                          className="w-full p-3 rounded-xl bg-white border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                        />
                      </div>

                      {/* Opciones */}
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-700">
                          Opciones de respuesta (Marca el botón de la opción correcta):
                        </label>
                        <div className="space-y-2">
                          {editOptions.map((opt, oIdx) => {
                            const isCorr = editCorrectOption === oIdx;
                            return (
                              <div
                                key={oIdx}
                                className={`flex items-center gap-2 p-1.5 rounded-xl border transition-all ${
                                  isCorr ? 'bg-emerald-50 border-emerald-400' : 'bg-white border-slate-200'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => setEditCorrectOption(oIdx)}
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs transition-all shrink-0 cursor-pointer ${
                                    isCorr
                                      ? 'bg-emerald-600 text-white shadow-2xs'
                                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                  }`}
                                  title="Marcar como correcta"
                                >
                                  {isCorr ? <Check className="w-4 h-4 stroke-[3]" /> : ['A', 'B', 'C', 'D'][oIdx]}
                                </button>
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) => {
                                    const next = [...editOptions];
                                    next[oIdx] = e.target.value;
                                    setEditOptions(next);
                                  }}
                                  className="flex-1 bg-transparent border-0 px-2 text-xs text-slate-900 focus:outline-none font-medium"
                                />
                                {isCorr && (
                                  <span className="text-[10px] font-bold text-emerald-700 px-2 py-0.5 rounded-full bg-emerald-100 mr-2 shrink-0">
                                    CORRECTA
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Fundamento legal */}
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-slate-700">
                          Fundamento Legal / Explicación del fallo
                        </label>
                        <textarea
                          rows={2}
                          value={editExplanation}
                          onChange={(e) => setEditExplanation(e.target.value)}
                          className="w-full p-3 rounded-xl bg-white border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                          placeholder="Art. de ley o justificación..."
                        />
                      </div>

                      {/* Botones de acción del editor */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                        <button
                          type="button"
                          onClick={() => setEditingChallengeId(null)}
                          disabled={isSavingQuestion}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={isSavingQuestion}
                          onClick={() => handleSaveQuestionCorrection(challenge)}
                          className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs shadow-md cursor-pointer flex items-center gap-1.5 active:scale-95"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{isSavingQuestion ? 'Guardando en BD...' : 'Guardar Corrección y Resolver'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* MODO VISTA PREVIA */
                    <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-3.5">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Pregunta Registrada:
                      </div>

                      <h4 className="text-sm sm:text-base font-bold text-slate-900 leading-relaxed">
                        {challenge.question_text || 'Enunciado no disponible'}
                      </h4>

                      {/* Opciones */}
                      {challenge.options && challenge.options.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {challenge.options.map((opt, oIdx) => {
                            const isCorr = challenge.correct_option === oIdx;
                            return (
                              <div
                                key={oIdx}
                                className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                                  isCorr
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                                    : 'bg-white border-slate-200 text-slate-700'
                                }`}
                              >
                                <span className={`w-5 h-5 rounded-md flex items-center justify-center font-black text-[10px] shrink-0 ${
                                  isCorr ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {['A', 'B', 'C', 'D'][oIdx]}
                                </span>
                                <span className="truncate flex-1">{opt}</span>
                                {isCorr && (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Fundamento legal */}
                      {challenge.explanation && (
                        <div className="pt-2 text-xs text-slate-600 border-t border-slate-200/60 leading-relaxed">
                          <strong className="text-indigo-700 font-bold">Fundamento legal registrado: </strong>
                          {challenge.explanation}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Barra de Acciones de la Impugnación */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Botón Corregir Pregunta en Vivo */}
                      {!isEditingThis && (
                        <button
                          type="button"
                          onClick={() => handleStartEdit(challenge)}
                          className="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95"
                          title="Abrir editor para corregir directamente esta pregunta"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Corregir Pregunta en Vivo</span>
                        </button>
                      )}

                      {/* Botón Resolver con Nota */}
                      {challenge.status === 'pending' && !isResolvingThis && (
                        <button
                          type="button"
                          onClick={() => {
                            setResolvingChallengeId(challenge.id);
                            setAdminResponseText('');
                          }}
                          className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Marcar Resuelta</span>
                        </button>
                      )}

                      {/* Botón Descartar */}
                      {challenge.status !== 'dismissed' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(challenge.id, 'dismissed')}
                          className="px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                          title="Descartar si la pregunta es correcta"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Descartar</span>
                        </button>
                      )}

                      {/* Botón Reabrir / Pendiente */}
                      {challenge.status !== 'pending' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(challenge.id, 'pending')}
                          className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>Reabrir</span>
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteChallenge(challenge.id)}
                      className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-xl transition-colors cursor-pointer self-end sm:self-center"
                      title="Eliminar este aviso de impugnación"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
