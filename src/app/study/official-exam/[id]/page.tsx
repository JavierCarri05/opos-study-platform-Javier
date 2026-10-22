'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Sidebar } from '@/components/Sidebar';
import { Profile, OfficialExam, OfficialExamQuestion } from '@/lib/types';
import { getCachedUserProfile } from '@/lib/supabaseHelper';
import { 
  Clock, 
  Flag, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  RotateCcw,
  Award,
  BookOpen,
  ArrowLeft,
  Edit3,
  Save,
  X,
  Plus,
  Trash2,
  Check,
  Loader2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { QuestionChallengeModal } from '@/components/QuestionChallengeModal';

export default function TakeOfficialExamPage() {
  const params = useParams();
  const examId = params?.id as string;
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [exam, setExam] = useState<OfficialExam | null>(null);
  const [questions, setQuestions] = useState<OfficialExamQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados del examen
  const [examPhase, setExamPhase] = useState<'intro' | 'taking' | 'results'>('intro');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<number, boolean>>({});
  const [timeLeft, setTimeLeft] = useState<number>(0);

  // Resultados
  const [resultsData, setResultsData] = useState({
    correct: 0,
    incorrect: 0,
    blank: 0,
    netScore: 0,
  });

  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [challengeQuestion, setChallengeQuestion] = useState<any | null>(null);

  // Edición en vivo de preguntas oficiales (Solo Administrador)
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editQText, setEditQText] = useState('');
  const [editQOptions, setEditQOptions] = useState<string[]>([]);
  const [editQCorrect, setEditQCorrect] = useState(0);
  const [editQExp, setEditQExp] = useState('');
  const [isSavingQ, setIsSavingQ] = useState(false);

  const handleStartEdit = (q: OfficialExamQuestion) => {
    setEditingQuestionId(q.id);
    setEditQText(q.question_text);
    setEditQOptions(Array.isArray(q.options) ? [...q.options] : ['', '', '']);
    setEditQCorrect(q.correct_option ?? 0);
    setEditQExp(q.explanation || '');
  };

  const handleSaveEdit = async (qId: string) => {
    if (!editQText.trim()) {
      alert('El enunciado no puede estar vacío.');
      return;
    }
    if (editQOptions.some(o => !o.trim())) {
      alert('Todas las opciones de respuesta deben tener texto.');
      return;
    }

    setIsSavingQ(true);
    try {
      const { error } = await supabase
        .from('official_exam_questions')
        .update({
          question_text: editQText.trim(),
          options: editQOptions.map(o => o.trim()),
          correct_option: editQCorrect,
          explanation: editQExp.trim(),
        })
        .eq('id', qId);

      if (error) throw error;

      setQuestions(prev => prev.map(q => q.id === qId ? {
        ...q,
        question_text: editQText.trim(),
        options: editQOptions.map(o => o.trim()),
        correct_option: editQCorrect,
        explanation: editQExp.trim(),
      } : q));

      setEditingQuestionId(null);
    } catch (err: any) {
      alert('Error al guardar la pregunta: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsSavingQ(false);
    }
  };

  useEffect(() => {
    async function loadExam() {
      const [userProfRes, { data: exData }, { data: qData }] = await Promise.all([
        getCachedUserProfile(supabase),
        supabase.from('official_exams').select('*').eq('id', examId).single(),
        supabase
          .from('official_exam_questions')
          .select('*')
          .eq('exam_id', examId)
          .order('question_number', { ascending: true }),
      ]);

      if (!userProfRes?.user) {
        router.push('/login');
        return;
      }
      setProfile(userProfRes.profile);

      if (exData) {
        setExam(exData);
        setTimeLeft((exData.duration_minutes || 90) * 60);
      }
      if (qData) {
        setQuestions(qData);
      }
      setLoading(false);
    }
    loadExam();
  }, [examId]);

  // Temporizador
  useEffect(() => {
    if (examPhase !== 'taking' || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          finishExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [examPhase, timeLeft]);

  const startExam = () => {
    if (questions.length === 0) {
      alert('Este examen no tiene preguntas aún.');
      return;
    }
    setCurrentIndex(0);
    setSelectedAnswers({});
    setFlaggedQuestions({});
    setTimeLeft((exam?.duration_minutes || 90) * 60);
    setExamPhase('taking');
  };

  const handleSelectAnswer = (optionIdx: number) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [currentIndex]: optionIdx,
    }));
  };

  const toggleFlag = (index: number) => {
    setFlaggedQuestions(prev => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const finishExam = () => {
    let correct = 0;
    let incorrect = 0;
    let blank = 0;

    questions.forEach((q, idx) => {
      const userAns = selectedAnswers[idx];
      if (userAns === undefined) blank++;
      else if (userAns === q.correct_option) correct++;
      else incorrect++;
    });

    const penalty = incorrect * (exam?.penalty_ratio || 0.33);
    const rawNet = Math.max(0, correct - penalty);
    const netScore = questions.length > 0 ? (rawNet / questions.length) * 10 : 0;

    setResultsData({ correct, incorrect, blank, netScore });
    setExamPhase('results');

    if (netScore >= 5) {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentQ = questions[currentIndex];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
        Cargando examen oficial...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900 w-full max-w-full overflow-x-hidden">
      <Sidebar profile={profile} />

      <main className="flex-1 min-w-0 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-8 overflow-y-auto">
        {/* INTRODUCCIÓN AL EXAMEN */}
        {examPhase === 'intro' && exam && (
          <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 shadow-sm max-w-2xl mx-auto space-y-8 text-center">
            <div className="w-16 h-16 rounded-3xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
              <Award className="w-8 h-8" />
            </div>

            <div>
              <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-indigo-100 text-indigo-800">
                Convocatoria {exam.year}
              </span>
              <h1 className="text-3xl font-black text-slate-900 mt-3">
                {exam.title}
              </h1>
              {exam.description && (
                <p className="text-sm text-slate-500 mt-2">{exam.description}</p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs">
              <div>
                <span className="text-slate-400 block font-bold">Preguntas</span>
                <span className="text-base font-black text-slate-900">{questions.length}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-bold">Tiempo</span>
                <span className="text-base font-black text-slate-900">{exam.duration_minutes} min</span>
              </div>
              <div>
                <span className="text-slate-400 block font-bold">Penalización</span>
                <span className="text-base font-black text-rose-600">-{exam.penalty_ratio} / fallo</span>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => router.push('/study/official-exams')}
                className="px-5 py-3 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 font-bold text-xs"
              >
                Volver
              </button>
              <button
                onClick={startExam}
                className="flex-1 py-4 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white text-sm shadow-sm transition-all"
              >
                Comenzar Examen Oficial Ahora
              </button>
            </div>
          </div>
        )}

        {/* REALIZACIÓN EN VIVO */}
        {examPhase === 'taking' && currentQ && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-4">
                <span className="text-sm font-bold text-slate-900">
                  Pregunta {currentQ.question_number} de {questions.length}
                </span>
                <button
                  onClick={() => toggleFlag(currentIndex)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                    flaggedQuestions[currentIndex]
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Flag className="w-3.5 h-3.5" />
                  {flaggedQuestions[currentIndex] ? 'Revisión marcada' : 'Marcar para revisar'}
                </button>
                {profile?.role === 'admin' && (
                  <button
                    onClick={() => {
                      if (editingQuestionId === currentQ.id) setEditingQuestionId(null);
                      else handleStartEdit(currentQ);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{editingQuestionId === currentQ.id ? 'Cerrar Edición' : 'Editar Pregunta (Admin)'}</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-4">
                <div className={`px-4 py-1.5 rounded-xl border font-mono font-bold text-sm flex items-center gap-2 ${
                  timeLeft < 300
                    ? 'bg-rose-50 border-rose-300 text-rose-600 animate-pulse'
                    : 'bg-slate-100 border-slate-200 text-indigo-700'
                }`}>
                  <Clock className="w-4 h-4" />
                  {formatTime(timeLeft)}
                </div>

                <button
                  onClick={() => {
                    if (confirm('¿Deseas entregar el examen oficial?')) finishExam();
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
                >
                  Entregar Examen
                </button>
              </div>
            </div>

            {editingQuestionId === currentQ.id && profile?.role === 'admin' ? (
              <div className="bg-white border-2 border-indigo-300 rounded-3xl p-8 shadow-sm space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-indigo-100">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                      #{currentQ.question_number}
                    </span>
                    <div>
                      <h3 className="text-sm font-black text-slate-900">Editando Pregunta Oficial en Vivo</h3>
                      <p className="text-xs text-slate-500">Modifica enunciado, opciones o solución oficial</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingQuestionId(null)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Enunciado Oficial</label>
                  <textarea
                    rows={3}
                    value={editQText}
                    onChange={(e) => setEditQText(e.target.value)}
                    className="w-full p-3.5 rounded-2xl bg-slate-50 border border-slate-300 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold uppercase text-slate-700">
                      Opciones de Respuesta
                    </label>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Pulsa en &ldquo;Hacer correcta&rdquo; o en la letra para cambiar la respuesta
                    </span>
                  </div>

                  <div className="space-y-2">
                    {editQOptions.map((opt, oIdx) => {
                      const isCorr = editQCorrect === oIdx;
                      const letter = ['A', 'B', 'C', 'D', 'E'][oIdx] || `${oIdx + 1}`;
                      return (
                        <div
                          key={oIdx}
                          className={`flex items-center gap-2.5 p-2 rounded-xl border transition-all ${
                            isCorr
                              ? 'bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-500/20 shadow-xs'
                              : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setEditQCorrect(oIdx)}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs transition-all shrink-0 cursor-pointer ${
                              isCorr
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-white hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 border border-slate-300'
                            }`}
                            title={`Marcar Opción ${letter} como correcta`}
                          >
                            {isCorr ? <Check className="w-4 h-4 stroke-[3]" /> : letter}
                          </button>
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const updated = [...editQOptions];
                              updated[oIdx] = e.target.value;
                              setEditQOptions(updated);
                            }}
                            className="flex-1 bg-transparent border-0 px-2 text-xs sm:text-sm text-slate-900 focus:outline-none font-medium"
                          />
                          {isCorr ? (
                            <span className="text-[10px] font-black text-emerald-800 px-2.5 py-1 rounded-full bg-emerald-100 border border-emerald-300 shrink-0 shadow-2xs flex items-center gap-1">
                              <Check className="w-3 h-3 stroke-[3]" />
                              CORRECTA OFICIAL
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditQCorrect(oIdx)}
                              className="text-[10px] font-bold text-slate-500 hover:text-emerald-800 hover:bg-emerald-100/70 border border-slate-200 hover:border-emerald-300 bg-white px-2.5 py-1 rounded-full transition-all shrink-0 cursor-pointer flex items-center gap-1"
                              title={`Hacer que la Opción ${letter} sea la respuesta correcta`}
                            >
                              <span>Hacer correcta</span>
                            </button>
                          )}
                          {editQOptions.length > 2 && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = editQOptions.filter((_, i) => i !== oIdx);
                                setEditQOptions(updated);
                                if (editQCorrect === oIdx) setEditQCorrect(0);
                                else if (editQCorrect > oIdx) setEditQCorrect(prev => prev - 1);
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                              title="Eliminar opción"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {editQOptions.length < 5 && (
                    <button
                      type="button"
                      onClick={() => setEditQOptions([...editQOptions, ''])}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer pt-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Añadir opción</span>
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Criterio Oficial del Tribunal / Explicación
                  </label>
                  <textarea
                    rows={3}
                    value={editQExp}
                    onChange={(e) => setEditQExp(e.target.value)}
                    className="w-full p-3.5 rounded-2xl bg-slate-50 border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={isSavingQ}
                    onClick={() => setEditingQuestionId(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isSavingQ}
                    onClick={() => handleSaveEdit(currentQ.id)}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs shadow-md cursor-pointer flex items-center gap-1.5 active:scale-95"
                  >
                    {isSavingQ ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>{isSavingQ ? 'Guardando...' : 'Guardar Cambios Oficiales'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xs space-y-6">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-relaxed">
                  <span className="text-indigo-600 mr-2">{currentQ.question_number}.</span>
                  {currentQ.question_text}
                </h2>

                <div className="space-y-3">
                  {currentQ.options.map((optionText, optIdx) => {
                    const isSelected = selectedAnswers[currentIndex] === optIdx;
                    return (
                      <button
                        key={optIdx}
                        onClick={() => handleSelectAnswer(optIdx)}
                        className={`w-full p-4 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50 border-indigo-500 text-slate-900 ring-1 ring-indigo-500'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                          isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {['A', 'B', 'C', 'D', 'E'][optIdx] || `${optIdx + 1}`}
                        </span>
                        <span className="text-sm font-semibold mt-0.5 leading-relaxed">
                          {optionText}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center p-4 bg-white border border-slate-200 rounded-2xl">
              <button
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 text-sm font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </button>

              {currentIndex < questions.length - 1 ? (
                <button
                  onClick={() => setCurrentIndex(prev => prev + 1)}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  Siguiente
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (confirm('¿Finalizar y corregir el examen?')) finishExam();
                  }}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold cursor-pointer"
                >
                  Corregir Examen
                </button>
              )}
            </div>

            {/* Mapa de preguntas */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <span className="block text-xs font-bold uppercase text-slate-500 mb-3">
                Cuadrícula del examen oficial
              </span>
              <div className="flex flex-wrap gap-2">
                {questions.map((q, idx) => {
                  const isAnswered = selectedAnswers[idx] !== undefined;
                  const isFlagged = flaggedQuestions[idx];
                  const isCurrent = currentIndex === idx;

                  return (
                    <button
                      key={idx}
                      onClick={() => setCurrentIndex(idx)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                        isCurrent ? 'ring-2 ring-indigo-600 ring-offset-2' : ''
                      } ${
                        isFlagged
                          ? 'bg-amber-400 text-amber-950'
                          : isAnswered
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {q.question_number}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* RESULTADOS Y REVISIÓN CON PLANTILLA OFICIAL */}
        {examPhase === 'results' && (
          <div className="space-y-8">
            <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm text-center space-y-6">
              <div className="inline-flex p-4 rounded-3xl bg-indigo-50 border border-indigo-100 text-indigo-600">
                <Award className="w-10 h-10" />
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Nota Neta Oficial ({exam?.title})
                </span>
                <div className="text-5xl sm:text-6xl font-black text-slate-900 mt-2">
                  {resultsData.netScore.toFixed(2)}{' '}
                  <span className="text-2xl font-normal text-slate-400">/ 10</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <span className="text-xs font-bold text-emerald-800 block">Aciertos</span>
                  <span className="text-2xl font-black text-emerald-700">{resultsData.correct}</span>
                </div>
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200">
                  <span className="text-xs font-bold text-rose-800 block">Fallos (-{exam?.penalty_ratio})</span>
                  <span className="text-2xl font-black text-rose-700">{resultsData.incorrect}</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-xs font-bold text-slate-600 block">En blanco</span>
                  <span className="text-2xl font-black text-slate-700">{resultsData.blank}</span>
                </div>
              </div>

              <div className="flex justify-center gap-4 pt-4">
                <button
                  onClick={() => setExamPhase('intro')}
                  className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Repetir este Examen Oficial
                </button>
                <button
                  onClick={() => router.push('/study/official-exams')}
                  className="px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm"
                >
                  Volver a Exámenes Oficiales
                </button>
              </div>
            </div>

            {/* Revisión pregunta por pregunta */}
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                Plantilla Oficial de Corrección
              </h3>

              {questions.map((q, idx) => {
                const userAns = selectedAnswers[idx];
                const isCorrect = userAns === q.correct_option;
                const isBlank = userAns === undefined;

                return (
                  <div
                    key={q.id}
                    className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500">
                        Pregunta Nº {q.question_number}
                      </span>
                      {isBlank ? (
                        <span className="text-xs font-bold px-2.5 py-1 rounded bg-slate-100 text-slate-600">
                          No contestada
                        </span>
                      ) : isCorrect ? (
                        <span className="text-xs font-bold px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                          ✓ Acertada (+1)
                        </span>
                      ) : (
                        <span className="text-xs font-bold px-2.5 py-1 rounded bg-rose-100 text-rose-800 border border-rose-300">
                          ✗ Fallada (-{exam?.penalty_ratio})
                        </span>
                      )}
                    </div>

                    <h4 className="text-base font-bold text-slate-900">
                      {q.question_text}
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {q.options.map((optText, oIdx) => {
                        const isCorrectOption = q.correct_option === oIdx;
                        const isUserChoice = userAns === oIdx;

                        let style = 'bg-slate-50 border-slate-200 text-slate-600';
                        if (isCorrectOption) {
                          style = 'bg-emerald-50 border-emerald-400 text-emerald-900 font-bold';
                        } else if (isUserChoice && !isCorrectOption) {
                          style = 'bg-rose-50 border-rose-400 text-rose-900 font-bold';
                        }

                        return (
                          <div
                            key={oIdx}
                            className={`p-3 rounded-xl border text-xs flex items-center justify-between ${style}`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-bold">
                                {['A', 'B', 'C', 'D'][oIdx]}.
                              </span>
                              <span>{optText}</span>
                            </div>
                            {isCorrectOption && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            )}
                            {isUserChoice && !isCorrectOption && (
                              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                      <span className="font-bold text-indigo-700 block mb-1">
                        Criterio Oficial del Tribunal / Fundamento:
                      </span>
                      {q.explanation}
                    </div>

                    <div className="flex justify-end gap-2 pt-1 flex-wrap">
                      {profile?.role === 'admin' && (
                        <button
                          type="button"
                          onClick={() => {
                            if (editingQuestionId === q.id) setEditingQuestionId(null);
                            else handleStartEdit(q);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer shadow-2xs active:scale-95"
                          title="Editar enunciado, opciones y solución como administrador"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{editingQuestionId === q.id ? 'Cerrar Edición' : 'Editar Pregunta (Admin)'}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setChallengeQuestion({ ...q, _origin: 'official' });
                          setShowChallengeModal(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer shadow-2xs active:scale-95"
                      >
                        <Flag className="w-3.5 h-3.5 text-amber-600" />
                        <span>Impugnar esta pregunta</span>
                      </button>
                    </div>

                    {editingQuestionId === q.id && profile?.role === 'admin' && (
                      <div className="p-5 rounded-2xl bg-indigo-50/50 border-2 border-indigo-300 space-y-4 pt-4 mt-2">
                        <div className="flex items-center justify-between pb-2 border-b border-indigo-200">
                          <span className="text-xs font-black uppercase text-indigo-700 flex items-center gap-1.5">
                            <Edit3 className="w-4 h-4" />
                            Editando Pregunta Nº {q.question_number} (Admin)
                          </span>
                          <button
                            type="button"
                            onClick={() => setEditingQuestionId(null)}
                            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Enunciado Oficial</label>
                          <textarea
                            rows={3}
                            value={editQText}
                            onChange={(e) => setEditQText(e.target.value)}
                            className="w-full p-3 rounded-xl bg-white border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="block text-xs font-bold text-slate-700 uppercase">
                              Opciones de Respuesta
                            </label>
                            <span className="text-[11px] text-slate-500 font-medium">
                              Pulsa en &ldquo;Hacer correcta&rdquo; o en la letra para cambiar la respuesta
                            </span>
                          </div>

                          <div className="space-y-2">
                            {editQOptions.map((opt, oIdx) => {
                              const isCorr = editQCorrect === oIdx;
                              const letter = ['A', 'B', 'C', 'D', 'E'][oIdx] || `${oIdx + 1}`;
                              return (
                                <div
                                  key={oIdx}
                                  className={`flex items-center gap-2.5 p-2 rounded-xl border transition-all ${
                                    isCorr
                                      ? 'bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-500/20 shadow-xs'
                                      : 'bg-white border-slate-200 hover:border-slate-300'
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => setEditQCorrect(oIdx)}
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs transition-all shrink-0 cursor-pointer ${
                                      isCorr
                                        ? 'bg-emerald-600 text-white shadow-xs'
                                        : 'bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 border border-slate-200'
                                    }`}
                                    title={`Marcar Opción ${letter} como correcta`}
                                  >
                                    {isCorr ? <Check className="w-4 h-4 stroke-[3]" /> : letter}
                                  </button>
                                  <input
                                    type="text"
                                    value={opt}
                                    onChange={(e) => {
                                      const updated = [...editQOptions];
                                      updated[oIdx] = e.target.value;
                                      setEditQOptions(updated);
                                    }}
                                    className="flex-1 bg-transparent border-0 px-2 text-xs text-slate-900 focus:outline-none font-medium"
                                  />
                                  {isCorr ? (
                                    <span className="text-[10px] font-black text-emerald-800 px-2.5 py-1 rounded-full bg-emerald-100 border border-emerald-300 mr-2 shrink-0 flex items-center gap-1 shadow-2xs">
                                      <Check className="w-3 h-3 stroke-[3]" />
                                      CORRECTA
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setEditQCorrect(oIdx)}
                                      className="text-[10px] font-bold text-slate-500 hover:text-emerald-800 hover:bg-emerald-100/70 border border-slate-200 hover:border-emerald-300 bg-white px-2.5 py-1 rounded-full transition-all mr-2 shrink-0 cursor-pointer flex items-center gap-1"
                                      title={`Hacer que la Opción ${letter} sea la respuesta correcta`}
                                    >
                                      <span>Hacer correcta</span>
                                    </button>
                                  )}
                                  {editQOptions.length > 2 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = editQOptions.filter((_, i) => i !== oIdx);
                                        setEditQOptions(updated);
                                        if (editQCorrect === oIdx) setEditQCorrect(0);
                                        else if (editQCorrect > oIdx) setEditQCorrect(prev => prev - 1);
                                      }}
                                      className="p-1 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                                      title="Eliminar opción"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {editQOptions.length < 5 && (
                            <button
                              type="button"
                              onClick={() => setEditQOptions([...editQOptions, ''])}
                              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer pt-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>+ Añadir opción</span>
                            </button>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Criterio Oficial / Explicación
                          </label>
                          <textarea
                            rows={2}
                            value={editQExp}
                            onChange={(e) => setEditQExp(e.target.value)}
                            className="w-full p-3 rounded-xl bg-white border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                          />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-indigo-200">
                          <button
                            type="button"
                            disabled={isSavingQ}
                            onClick={() => setEditingQuestionId(null)}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            disabled={isSavingQ}
                            onClick={() => handleSaveEdit(q.id)}
                            className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs shadow-md cursor-pointer flex items-center gap-1.5 active:scale-95"
                          >
                            {isSavingQ ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Guardando...</span>
                              </>
                            ) : (
                              <>
                                <Save className="w-3.5 h-3.5" />
                                <span>Guardar Pregunta</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* Modal de Impugnación */}
        <QuestionChallengeModal
          isOpen={showChallengeModal}
          onClose={() => setShowChallengeModal(false)}
          question={challengeQuestion}
          user={profile}
        />
      </main>
    </div>
  );
}
