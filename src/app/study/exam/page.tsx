'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Sidebar } from '@/components/Sidebar';
import { Profile, Topic, Block } from '@/lib/types';
import { 
  Clock, 
  Flag, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown, 
  ChevronUp,
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  Award, 
  BookOpen, 
  Boxes, 
  SlidersHorizontal, 
  Zap, 
  ArrowLeft, 
  Check, 
  Sparkles, 
  AlertCircle, 
  HelpCircle, 
  FileText, 
  BarChart3, 
  CheckSquare, 
  Layers, 
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { QuestionChallengeModal } from '@/components/QuestionChallengeModal';
import { 
  getCachedUserProfile, 
  getCachedTopicsAndBlocks, 
  getQuestionCountsSummary 
} from '@/lib/supabaseHelper';

export default function CustomExamPage() {
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Datos de temario y conteos
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [bankCountsBySubtopic, setBankCountsBySubtopic] = useState<Record<string, number>>({});
  const [officialCountsBySubtopic, setOfficialCountsBySubtopic] = useState<Record<string, number>>({});
  const [bankUnclassifiedCount, setBankUnclassifiedCount] = useState(0);
  const [officialUnclassifiedCount, setOfficialUnclassifiedCount] = useState(0);

  // Estados de fase del examen: 'config' | 'taking' | 'results'
  const [examPhase, setExamPhase] = useState<'config' | 'taking' | 'results'>('config');

  // Selección de bloques, temas y subapartados (idéntico al Modo Anki)
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({});
  const [expandedTopicSubtopics, setExpandedTopicSubtopics] = useState<Record<string, boolean>>({});
  const [selectedSubtopicIds, setSelectedSubtopicIds] = useState<Record<string, string[]>>({});
  const [includeUnclassified, setIncludeUnclassified] = useState(false);

  // Filtros de configuración
  const [questionSource, setQuestionSource] = useState<'all' | 'custom' | 'official'>('all');
  const [questionCount, setQuestionCount] = useState<25 | 50 | 80>(50);
  const [timeMode, setTimeMode] = useState<'standard' | '30' | '45' | '60' | '90' | 'custom' | 'none'>('standard');
  const [customTimeMinutes, setCustomTimeMinutes] = useState<number>(45);

  // Estado del examen en curso
  const [examQuestions, setExamQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<number, boolean>>({});
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [initialTimeSeconds, setInitialTimeSeconds] = useState<number>(0);
  const [startTime, setStartTime] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Resultados finales
  const [resultsData, setResultsData] = useState<{
    correct: number;
    incorrect: number;
    blank: number;
    penalty: number;
    netScore: number;
    elapsedSeconds: number;
  }>({
    correct: 0,
    incorrect: 0,
    blank: 0,
    penalty: 0,
    netScore: 0,
    elapsedSeconds: 0,
  });

  // Filtro en vista de resultados
  const [resultsFilter, setResultsFilter] = useState<'all' | 'incorrect' | 'correct' | 'blank'>('all');

  // Modal de impugnación / reporte de pregunta
  const [challengeQuestion, setChallengeQuestion] = useState<any | null>(null);

  // Carga inicial optimizada con caché
  useEffect(() => {
    async function init() {
      try {
        const [userProfRes, { blocks: blocksData, topics: topicsData }, countsSummary] = await Promise.all([
          getCachedUserProfile(supabase),
          getCachedTopicsAndBlocks(supabase),
          getQuestionCountsSummary(supabase),
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

        if (blocksData) {
          setBlocks(blocksData);
          const expBlocksMap: Record<string, boolean> = { unassigned: false };
          blocksData.forEach((b: any) => { expBlocksMap[b.id] = false; });
          setExpandedBlocks(expBlocksMap);
        }

        if (topicsData) {
          setTopics(topicsData);
          // Por defecto seleccionar todos los temas para facilitar un simulacro global
          setSelectedTopics(topicsData.map(t => t.id));
          const allSubMap: Record<string, string[]> = {};
          topicsData.forEach(t => {
            if (t.subtopics) allSubMap[t.id] = t.subtopics.map((s: any) => s.id);
          });
          setSelectedSubtopicIds(allSubMap);
        }

        if (countsSummary) {
          setBankCountsBySubtopic(countsSummary.bankCounts || {});
          setOfficialCountsBySubtopic(countsSummary.officialCounts || {});
          setBankUnclassifiedCount(countsSummary.bankUnclassified || 0);
          setOfficialUnclassifiedCount(countsSummary.officialUnclassified || 0);
        }
      } catch (err) {
        console.error('Error al inicializar Examen Personalizado:', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Temporizador en vivo
  useEffect(() => {
    if (examPhase !== 'taking' || timeMode === 'none' || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          finishExam(true); // Terminar automáticamente al agotar el tiempo
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [examPhase, timeLeft, timeMode]);

  // Funciones auxiliares de conteo
  const getSubtopicQuestionsCount = (subtopicId: string): number => {
    const bank = bankCountsBySubtopic[subtopicId] || 0;
    const official = officialCountsBySubtopic[subtopicId] || 0;
    if (questionSource === 'custom') return bank;
    if (questionSource === 'official') return official;
    return bank + official;
  };

  const getTopicQuestionsCount = (topic: Topic): number => {
    if (!topic.subtopics || topic.subtopics.length === 0) return 0;
    return topic.subtopics.reduce((acc, st: any) => acc + getSubtopicQuestionsCount(st.id), 0);
  };

  const getBlockQuestionsCount = (bTopics: Topic[]): number => {
    return bTopics.reduce((acc, t) => acc + getTopicQuestionsCount(t), 0);
  };

  const getUnclassifiedCount = (): number => {
    if (questionSource === 'custom') return bankUnclassifiedCount;
    if (questionSource === 'official') return officialUnclassifiedCount;
    return bankUnclassifiedCount + officialUnclassifiedCount;
  };

  // Total de preguntas disponibles en la selección actual
  const totalAvailableQuestions = useMemo(() => {
    let total = 0;
    topics.forEach(t => {
      if (selectedTopics.includes(t.id)) {
        const specificSubs = selectedSubtopicIds[t.id];
        if (specificSubs && specificSubs.length > 0) {
          specificSubs.forEach(subId => {
            total += getSubtopicQuestionsCount(subId);
          });
        } else {
          total += getTopicQuestionsCount(t);
        }
      }
    });
    if (includeUnclassified) {
      total += getUnclassifiedCount();
    }
    return total;
  }, [topics, selectedTopics, selectedSubtopicIds, includeUnclassified, questionSource, bankCountsBySubtopic, officialCountsBySubtopic, bankUnclassifiedCount, officialUnclassifiedCount]);

  // Toggles de selección
  const toggleBlockExpand = (bId: string) => {
    setExpandedBlocks(prev => ({ ...prev, [bId]: !prev[bId] }));
  };

  const toggleTopicSubtopicExpand = (topicId: string) => {
    setExpandedTopicSubtopics(prev => ({ ...prev, [topicId]: !prev[topicId] }));
  };

  const toggleEntireBlock = (blockId: string) => {
    const blockTopics = topics.filter(t => t.block_id === blockId);
    const blockTopicIds = blockTopics.map(t => t.id);
    const allSelected = blockTopicIds.length > 0 && blockTopicIds.every(id => selectedTopics.includes(id));

    if (allSelected) {
      setSelectedTopics(prev => prev.filter(id => !blockTopicIds.includes(id)));
      setSelectedSubtopicIds(prev => {
        const copy = { ...prev };
        blockTopicIds.forEach(id => delete copy[id]);
        return copy;
      });
    } else {
      setSelectedTopics(prev => Array.from(new Set([...prev, ...blockTopicIds])));
      setSelectedSubtopicIds(prev => {
        const copy = { ...prev };
        blockTopics.forEach(t => {
          if (t.subtopics) copy[t.id] = t.subtopics.map((s: any) => s.id);
        });
        return copy;
      });
    }
  };

  const toggleUnassignedBlock = () => {
    const unassignedTopics = topics.filter(t => !t.block_id);
    const unassignedTopicIds = unassignedTopics.map(t => t.id);
    const allSelected = unassignedTopicIds.length > 0 && unassignedTopicIds.every(id => selectedTopics.includes(id));

    if (allSelected) {
      setSelectedTopics(prev => prev.filter(id => !unassignedTopicIds.includes(id)));
      setSelectedSubtopicIds(prev => {
        const copy = { ...prev };
        unassignedTopicIds.forEach(id => delete copy[id]);
        return copy;
      });
    } else {
      setSelectedTopics(prev => Array.from(new Set([...prev, ...unassignedTopicIds])));
      setSelectedSubtopicIds(prev => {
        const copy = { ...prev };
        unassignedTopics.forEach(t => {
          if (t.subtopics) copy[t.id] = t.subtopics.map((s: any) => s.id);
        });
        return copy;
      });
    }
  };

  const toggleTopic = (topicId: string) => {
    const topic = topics.find(t => t.id === topicId);
    const allSubIds = topic?.subtopics ? topic.subtopics.map((s: any) => s.id) : [];

    if (selectedTopics.includes(topicId)) {
      setSelectedTopics(prev => prev.filter(id => id !== topicId));
      setSelectedSubtopicIds(prev => {
        const copy = { ...prev };
        delete copy[topicId];
        return copy;
      });
    } else {
      setSelectedTopics(prev => [...prev, topicId]);
      setSelectedSubtopicIds(prev => ({ ...prev, [topicId]: allSubIds }));
    }
  };

  const toggleSubtopic = (topicId: string, subtopicId: string) => {
    const topic = topics.find(t => t.id === topicId);
    const allSubIds = topic?.subtopics ? topic.subtopics.map((s: any) => s.id) : [];
    const currentSelected = selectedSubtopicIds[topicId] || (selectedTopics.includes(topicId) ? allSubIds : []);

    let nextSelected: string[];
    if (currentSelected.includes(subtopicId)) {
      nextSelected = currentSelected.filter(id => id !== subtopicId);
    } else {
      nextSelected = [...currentSelected, subtopicId];
    }

    setSelectedSubtopicIds(prev => ({ ...prev, [topicId]: nextSelected }));

    if (nextSelected.length > 0 && !selectedTopics.includes(topicId)) {
      setSelectedTopics(prev => [...prev, topicId]);
    } else if (nextSelected.length === 0 && selectedTopics.includes(topicId)) {
      setSelectedTopics(prev => prev.filter(id => id !== topicId));
    }
  };

  const hasAnySelected = selectedTopics.length > 0 || (includeUnclassified && getUnclassifiedCount() > 0);
  const toggleSelectAll = () => {
    if (hasAnySelected) {
      setSelectedTopics([]);
      setSelectedSubtopicIds({});
      setIncludeUnclassified(false);
    } else {
      setSelectedTopics(topics.map(t => t.id));
      const allSubMap: Record<string, string[]> = {};
      topics.forEach(t => {
        if (t.subtopics) allSubMap[t.id] = t.subtopics.map((s: any) => s.id);
      });
      setSelectedSubtopicIds(allSubMap);
      setIncludeUnclassified(true);
    }
  };

  // Etiqueta descriptiva para la procedencia de cada pregunta
  const formatQuestionSourceLabel = (q: any, isOfficial: boolean): string => {
    const examPrefix = isOfficial
      ? `Examen Oficial: ${q.official_exams?.title || 'Convocatoria'} (${q.official_exams?.year || ''}) - Pregunta ${q.question_number || ''} · `
      : '';

    if (!q.subtopics) {
      return isOfficial
        ? `Examen Oficial: ${q.official_exams?.title || 'Convocatoria'} (${q.official_exams?.year || ''}) - Pregunta ${q.question_number || ''}`
        : 'Pregunta de Banco Libre (Sin Tema)';
    }

    const topicOrder = q.subtopics?.topics?.order_index ? `Tema ${q.subtopics.topics.order_index}: ` : (q.subtopics?.order_index ? `Tema ${q.subtopics.order_index}: ` : '');
    const topicTitle = q.subtopics?.topics?.title || q.subtopics?.title || '';
    const isSpecialSub = q.subtopics?.title && q.subtopics.title.toLowerCase() !== 'general';
    const subtopicSuffix = isSpecialSub ? ` · ⚡ ${q.subtopics.title}` : '';

    return `${examPrefix}${topicOrder}${topicTitle}${subtopicSuffix}`;
  };

  // Iniciar examen
  const startExam = async (presetQuestions?: any[]) => {
    if (presetQuestions && presetQuestions.length > 0) {
      // Reintento de preguntas específicas (falladas / en blanco)
      const count = presetQuestions.length;
      let calculatedSeconds = 0;
      if (timeMode === 'standard') calculatedSeconds = count * 60;
      else if (timeMode === 'custom') calculatedSeconds = Math.max(1, customTimeMinutes) * 60;
      else if (timeMode !== 'none') calculatedSeconds = parseInt(timeMode, 10) * 60;

      setExamQuestions(presetQuestions);
      setCurrentIndex(0);
      setSelectedAnswers({});
      setFlaggedQuestions({});
      setTimeLeft(calculatedSeconds);
      setInitialTimeSeconds(calculatedSeconds);
      setStartTime(Date.now());
      setExamPhase('taking');
      return;
    }

    if (selectedTopics.length === 0 && (!includeUnclassified || getUnclassifiedCount() === 0)) {
      alert('Debes seleccionar al menos un bloque, tema o las preguntas libres para configurar el examen.');
      return;
    }

    setLoading(true);
    try {
      const matchingSubtopicIds = topics
        .filter(t => selectedTopics.includes(t.id))
        .flatMap(t => {
          const specificSubs = selectedSubtopicIds[t.id];
          if (specificSubs && specificSubs.length > 0) {
            return specificSubs;
          }
          return t.subtopics?.map((st: any) => st.id) || [];
        });

      let combinedList: any[] = [];

      // 1. Preguntas de banco propio
      if (questionSource === 'all' || questionSource === 'custom') {
        let customList: any[] = [];
        if (matchingSubtopicIds.length > 0) {
          const { data: bySub } = await supabase
            .from('questions')
            .select('id, subtopic_id, question_text, options, correct_option, explanation, subtopics(id, title, topic_id, topics(id, title, order_index, block_id))')
            .in('subtopic_id', matchingSubtopicIds)
            .limit(2000);
          if (bySub) customList.push(...bySub);
        }

        if (includeUnclassified) {
          const { data: generalQ } = await supabase
            .from('questions')
            .select('id, subtopic_id, question_text, options, correct_option, explanation')
            .is('subtopic_id', null)
            .limit(200);
          if (generalQ) customList.push(...generalQ);
        }

        const uniqueCustom = Array.from(new Map(customList.map(q => [q.id, q])).values());
        combinedList.push(...uniqueCustom.map(q => ({
          ...q,
          _origin: 'custom',
          _sourceLabel: formatQuestionSourceLabel(q, false),
        })));
      }

      // 2. Preguntas de exámenes oficiales
      if (questionSource === 'all' || questionSource === 'official') {
        let officialList: any[] = [];
        if (matchingSubtopicIds.length > 0) {
          const { data: bySub } = await supabase
            .from('official_exam_questions')
            .select('id, subtopic_id, question_number, question_text, options, correct_option, explanation, official_exams(title, year), subtopics(id, title, topic_id, topics(id, title, order_index, block_id))')
            .in('subtopic_id', matchingSubtopicIds)
            .limit(2000);
          if (bySub) officialList.push(...bySub);
        }

        if (includeUnclassified) {
          const { data: unclassOff } = await supabase
            .from('official_exam_questions')
            .select('id, subtopic_id, question_number, question_text, options, correct_option, explanation, official_exams(title, year)')
            .is('subtopic_id', null)
            .limit(200);
          if (unclassOff) officialList.push(...unclassOff);
        }

        const uniqueOfficial = Array.from(new Map(officialList.map(q => [q.id, q])).values());
        combinedList.push(...uniqueOfficial.map(q => ({
          ...q,
          _origin: 'official',
          _sourceLabel: formatQuestionSourceLabel(q, true),
        })));
      }

      // Desduplicar
      const uniqueCombined = Array.from(new Map(combinedList.map(q => [`${q._origin}:${q.id}`, q])).values());

      if (uniqueCombined.length === 0) {
        alert('No se encontraron preguntas tipo test para la selección realizada. Selecciona otros temas u orígenes.');
        setLoading(false);
        return;
      }

      // Mezclar aleatoriamente y recortar al número seleccionado (25, 50 u 80)
      const targetCount = Math.min(uniqueCombined.length, questionCount);
      const shuffled = uniqueCombined
        .sort(() => 0.5 - Math.random())
        .slice(0, targetCount);

      // Calcular tiempo en segundos
      let calculatedSeconds = 0;
      if (timeMode === 'standard') {
        calculatedSeconds = targetCount * 60; // 1 minuto por pregunta
      } else if (timeMode === 'custom') {
        calculatedSeconds = Math.max(1, customTimeMinutes) * 60;
      } else if (timeMode !== 'none') {
        calculatedSeconds = parseInt(timeMode, 10) * 60;
      }

      setExamQuestions(shuffled);
      setCurrentIndex(0);
      setSelectedAnswers({});
      setFlaggedQuestions({});
      setTimeLeft(calculatedSeconds);
      setInitialTimeSeconds(calculatedSeconds);
      setStartTime(Date.now());
      setExamPhase('taking');
    } catch (err: any) {
      console.error('Error al generar el examen:', err);
      alert('Error al generar el examen: ' + (err.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  // Manejo de respuestas durante el examen
  const handleSelectAnswer = (optionIdx: number) => {
    setSelectedAnswers(prev => {
      // Si pulsa la misma opción ya seleccionada, la desmarca (la deja en blanco)
      if (prev[currentIndex] === optionIdx) {
        const copy = { ...prev };
        delete copy[currentIndex];
        return copy;
      }
      return { ...prev, [currentIndex]: optionIdx };
    });
  };

  const handleClearAnswer = () => {
    setSelectedAnswers(prev => {
      const copy = { ...prev };
      delete copy[currentIndex];
      return copy;
    });
  };

  const toggleFlag = (index: number) => {
    setFlaggedQuestions(prev => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  // Finalizar examen y corregir
  const finishExam = async (isAutoSubmit = false) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    let correct = 0;
    let incorrect = 0;
    let blank = 0;

    examQuestions.forEach((q, idx) => {
      const userAns = selectedAnswers[idx];
      if (userAns === undefined) {
        blank++;
      } else if (userAns === q.correct_option) {
        correct++;
      } else {
        incorrect++;
      }
    });

    // Penalización oficial de oposición: 3 fallos = 1 acierto (cada fallo resta 1/3 = 0.333...)
    const penalty = incorrect / 3;
    const rawNet = Math.max(0, correct - penalty);
    const netScore = examQuestions.length > 0 ? (rawNet / examQuestions.length) * 10 : 0;
    const elapsedSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));

    setResultsData({
      correct,
      incorrect,
      blank,
      penalty,
      netScore,
      elapsedSeconds,
    });

    setExamPhase('results');
    setResultsFilter('all');
    setIsSubmitting(false);

    if (netScore >= 5.0) {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
      });
    }

    if (isAutoSubmit) {
      alert('⏰ ¡Tiempo agotado! Tu examen ha sido entregado y corregido automáticamente.');
    }

    // Registrar intento en Supabase
    if (profile) {
      try {
        await supabase.from('exam_attempts').insert({
          user_id: profile.id,
          mode: 'exam',
          total_questions: examQuestions.length,
          correct_count: correct,
          incorrect_count: incorrect,
          blank_count: blank,
          net_score: parseFloat(netScore.toFixed(2)),
          answers_data: {
            selectedAnswers,
            questionIds: examQuestions.map(q => q.id),
            elapsedSeconds,
            penalty: parseFloat(penalty.toFixed(2)),
            questionCount,
            questionSource,
          },
        });
      } catch (err) {
        console.warn('No se pudo guardar el intento de examen en el historial:', err);
      }
    }
  };

  // Reintentar solo preguntas falladas y en blanco
  const handleRetryFailedAndBlank = () => {
    const failedOrBlank = examQuestions.filter((q, idx) => {
      const userAns = selectedAnswers[idx];
      return userAns === undefined || userAns !== q.correct_option;
    });

    if (failedOrBlank.length === 0) {
      alert('¡Has acertado todas las preguntas! No hay falladas ni en blanco para reintentar.');
      return;
    }

    startExam(failedOrBlank);
  };

  // Formato de tiempo mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatElapsed = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs} seg`;
    return `${mins} min ${secs} seg`;
  };

  const currentQ = examQuestions[currentIndex];

  // Preguntas filtradas en la vista de resultados
  const filteredResultQuestions = useMemo(() => {
    return examQuestions.map((q, idx) => ({ q, idx })).filter(({ q, idx }) => {
      const userAns = selectedAnswers[idx];
      const isCorrect = userAns === q.correct_option;
      const isBlank = userAns === undefined;

      if (resultsFilter === 'correct') return isCorrect;
      if (resultsFilter === 'incorrect') return !isCorrect && !isBlank;
      if (resultsFilter === 'blank') return isBlank;
      return true;
    });
  }, [examQuestions, selectedAnswers, resultsFilter]);

  if (loading && examPhase === 'config') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900 w-full max-w-full overflow-x-clip overflow-x-hidden">
        <Sidebar profile={profile} />
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-sm font-bold">Cargando simulador de examen personalizado...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900 w-full max-w-full overflow-x-clip overflow-x-hidden overscroll-x-none">
      <Sidebar profile={profile} />

      <main className="flex-1 min-w-0 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-8 space-y-8 overflow-y-auto overflow-x-clip overflow-x-hidden overscroll-x-none [touch-action:pan-y]">

        {/* ========================================================= */}
        {/* FASE 1: CONFIGURACIÓN DEL EXAMEN PERSONALIZADO            */}
        {/* ========================================================= */}
        {examPhase === 'config' && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xs max-w-3xl mx-auto space-y-8">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver al Panel</span>
              </button>

              <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700">
                Penalización Oficial: -1/3 las erróneas
              </span>
            </div>

            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center mx-auto mb-4 shadow-md shadow-indigo-600/20">
                <SlidersHorizontal className="w-7 h-7" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                Examen Personalizado
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-2 max-w-lg mx-auto">
                Crea un simulacro a tu medida: elige número de preguntas (25, 50 u 80), límite de tiempo y selecciona con precisión los bloques, temas y subapartados que deseas evaluar.
              </p>
            </div>

            {/* SELECCIÓN 1: LONGITUD DEL EXAMEN (25, 50, 80 PREGUNTAS) */}
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4 text-indigo-600" />
                  1. Número de Preguntas del Examen
                </label>
                <span className="text-xs font-bold text-slate-500">
                  {totalAvailableQuestions} preguntas disponibles en tu selección
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {([25, 50, 80] as const).map(num => {
                  const isSelected = questionCount === num;
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setQuestionCount(num)}
                      className={`p-4 rounded-2xl border text-center transition-all cursor-pointer relative ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/20 ring-2 ring-indigo-600/20'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-2xl font-black block leading-none mb-1">
                        {num}
                      </span>
                      <span className={`text-xs font-bold block ${isSelected ? 'text-indigo-100' : 'text-slate-600'}`}>
                        {num === 25 ? 'Simulacro Rápido' : num === 50 ? 'Simulacro Estándar' : 'Simulacro Completo'}
                      </span>
                      <span className={`text-[10px] block mt-1 ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                        {num === 25 ? '25 min aprox.' : num === 50 ? '50 min aprox.' : '80 min oficial'}
                      </span>
                    </button>
                  );
                })}
              </div>

              {totalAvailableQuestions < questionCount && totalAvailableQuestions > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Has seleccionado {questionCount} preguntas, pero los temas marcados contienen {totalAvailableQuestions}. Se utilizarán todas las {totalAvailableQuestions} preguntas disponibles.
                  </span>
                </div>
              )}
            </div>

            {/* SELECCIÓN 2: CONFIGURACIÓN DEL TIEMPO */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 px-1">
                <Clock className="w-4 h-4 text-indigo-600" />
                2. Configurar Tiempo Límite
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setTimeMode('standard')}
                  className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                    timeMode === 'standard'
                      ? 'bg-indigo-600 border-indigo-600 text-white font-bold shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 font-semibold'
                  }`}
                >
                  <span className="text-xs block">Tiempo Estándar</span>
                  <span className={`text-[10px] block mt-0.5 ${timeMode === 'standard' ? 'text-indigo-100' : 'text-slate-400'}`}>
                    1 min / pregunta ({questionCount} min)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setTimeMode('30')}
                  className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                    timeMode === '30'
                      ? 'bg-indigo-600 border-indigo-600 text-white font-bold shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 font-semibold'
                  }`}
                >
                  <span className="text-xs block">30 Minutos</span>
                  <span className={`text-[10px] block mt-0.5 ${timeMode === '30' ? 'text-indigo-100' : 'text-slate-400'}`}>
                    Intensivo
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setTimeMode('60')}
                  className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                    timeMode === '60'
                      ? 'bg-indigo-600 border-indigo-600 text-white font-bold shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 font-semibold'
                  }`}
                >
                  <span className="text-xs block">60 Minutos</span>
                  <span className={`text-[10px] block mt-0.5 ${timeMode === '60' ? 'text-indigo-100' : 'text-slate-400'}`}>
                    1 hora
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setTimeMode('none')}
                  className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                    timeMode === 'none'
                      ? 'bg-indigo-600 border-indigo-600 text-white font-bold shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 font-semibold'
                  }`}
                >
                  <span className="text-xs block">Sin Límite</span>
                  <span className={`text-[10px] block mt-0.5 ${timeMode === 'none' ? 'text-indigo-100' : 'text-slate-400'}`}>
                    Práctica libre
                  </span>
                </button>
              </div>

              {/* Opción personalizada adicional */}
              <div className="flex items-center gap-3 pt-1 px-1">
                <button
                  type="button"
                  onClick={() => setTimeMode('custom')}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                    timeMode === 'custom'
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-black'
                      : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  ✏️ Tiempo Personalizado
                </button>

                {timeMode === 'custom' && (
                  <div className="flex items-center gap-2 animate-in fade-in">
                    <input
                      type="number"
                      min={5}
                      max={240}
                      value={customTimeMinutes}
                      onChange={(e) => setCustomTimeMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 px-3 py-1.5 rounded-lg bg-white border border-indigo-300 text-xs font-bold text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-bold text-slate-600">minutos</span>
                  </div>
                )}
              </div>
            </div>

            {/* SELECCIÓN 3: ORIGEN DE LAS PREGUNTAS */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 px-1">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                3. Origen del Banco de Preguntas
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setQuestionSource('all')}
                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                    questionSource === 'all'
                      ? 'bg-indigo-600 border-indigo-600 text-white font-bold shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 font-semibold'
                  }`}
                >
                  <span className="text-xs block">Todas las Preguntas</span>
                  <span className={`text-[10px] block mt-0.5 ${questionSource === 'all' ? 'text-indigo-100' : 'text-slate-400'}`}>
                    Banco Propio + Oficiales
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setQuestionSource('custom')}
                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                    questionSource === 'custom'
                      ? 'bg-indigo-600 border-indigo-600 text-white font-bold shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 font-semibold'
                  }`}
                >
                  <span className="text-xs block">Solo Banco de Temario</span>
                  <span className={`text-[10px] block mt-0.5 ${questionSource === 'custom' ? 'text-indigo-100' : 'text-slate-400'}`}>
                    Preguntas del temario
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setQuestionSource('official')}
                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                    questionSource === 'official'
                      ? 'bg-indigo-600 border-indigo-600 text-white font-bold shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 font-semibold'
                  }`}
                >
                  <span className="text-xs block">Solo Exámenes Oficiales</span>
                  <span className={`text-[10px] block mt-0.5 ${questionSource === 'official' ? 'text-indigo-100' : 'text-slate-400'}`}>
                    Convocatorias reales
                  </span>
                </button>
              </div>
            </div>

            {/* SELECCIÓN 4: SELECTOR DE BLOQUES, TEMAS Y SUBAPARTADOS (IDÉNTICO AL MODO ANKI) */}
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Boxes className="w-4 h-4 text-indigo-600" />
                  4. Selección de Bloques, Temas y Subapartados
                </label>
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                >
                  {hasAnySelected ? 'Desmarcar todos' : 'Seleccionar todos'}
                </button>
              </div>

              <div className="max-h-96 overflow-y-auto space-y-3 border border-slate-200 rounded-2xl p-3 bg-slate-50/60">
                {blocks.length > 0 ? (
                  <>
                    {blocks.map(block => {
                      const blockTopics = topics.filter(t => t.block_id === block.id);
                      if (blockTopics.length === 0) return null;

                      const isAllBlockSelected = blockTopics.length > 0 && blockTopics.every(t => selectedTopics.includes(t.id));
                      const selectedCount = blockTopics.filter(t => selectedTopics.includes(t.id)).length;
                      const isBlockExpanded = expandedBlocks[block.id] ?? false;

                      return (
                        <div key={block.id} className="border border-indigo-200 bg-white rounded-2xl overflow-hidden shadow-2xs">
                          <div 
                            onClick={() => toggleBlockExpand(block.id)}
                            className="flex items-center justify-between p-3.5 bg-indigo-50/70 hover:bg-indigo-100/60 transition-colors border-b border-indigo-100 cursor-pointer"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <input
                                type="checkbox"
                                checked={isAllBlockSelected}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  toggleEntireBlock(block.id);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-4 h-4 rounded text-indigo-600 border-indigo-300 focus:ring-indigo-500 cursor-pointer"
                              />
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Boxes className="w-4 h-4 text-indigo-600 shrink-0" />
                                <span className="font-bold text-xs sm:text-sm text-indigo-950 truncate">
                                  Bloque {block.order_index}: {block.title}
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-200/80 text-indigo-900 shrink-0">
                                  {selectedCount}/{blockTopics.length} {blockTopics.length === 1 ? 'tema' : 'temas'} ({getBlockQuestionsCount(blockTopics)} preg.)
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleBlockExpand(block.id);
                              }}
                              className="p-1.5 text-indigo-600 hover:text-indigo-800 rounded-lg hover:bg-indigo-200/50 cursor-pointer"
                            >
                              {isBlockExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          </div>

                          {isBlockExpanded && (
                            <div className="p-2.5 space-y-1.5 bg-indigo-50/20">
                              {blockTopics.map(t => (
                                <div key={t.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs hover:border-indigo-200 transition-all">
                                  <div className="flex items-center gap-2 p-2.5 hover:bg-slate-50 transition-colors select-none">
                                    <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={selectedTopics.includes(t.id)}
                                        onChange={() => toggleTopic(t.id)}
                                        className="w-3.5 h-3.5 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                      />
                                      <span className="font-bold text-xs text-slate-800 truncate flex-1">
                                        Tema {t.order_index}: {t.title}
                                      </span>
                                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-1.5 py-0.5 rounded-md shrink-0">
                                        ({getTopicQuestionsCount(t)} preg.)
                                      </span>
                                    </label>

                                    {t.subtopics && t.subtopics.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleTopicSubtopicExpand(t.id);
                                        }}
                                        className={`px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1 transition-colors cursor-pointer shrink-0 ${
                                          expandedTopicSubtopics[t.id]
                                            ? 'bg-amber-500 text-white shadow-2xs'
                                            : 'bg-amber-100/90 text-amber-900 border border-amber-300 hover:bg-amber-200'
                                        }`}
                                        title="Ver y seleccionar subapartados específicos"
                                      >
                                        <Zap className="w-2.5 h-2.5 fill-current" />
                                        <span>{t.subtopics.length} subapartados</span>
                                        {expandedTopicSubtopics[t.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                      </button>
                                    )}
                                  </div>

                                  {t.subtopics && t.subtopics.length > 1 && expandedTopicSubtopics[t.id] && (
                                    <div className="p-2.5 pt-2 bg-amber-50/50 border-t border-amber-200/80 space-y-1.5 animate-in fade-in">
                                      <div className="text-[10px] font-bold text-amber-900 uppercase flex items-center justify-between px-1">
                                        <span>Subapartados de este tema:</span>
                                        <span className="text-[9px] font-semibold text-slate-500">Marca los que desees evaluar</span>
                                      </div>
                                      {t.subtopics.map((st: any) => {
                                        const isSubSelected = selectedSubtopicIds[t.id]
                                          ? selectedSubtopicIds[t.id].includes(st.id)
                                          : selectedTopics.includes(t.id);
                                        const isGen = st.title?.toLowerCase() === 'general';
                                        const count = getSubtopicQuestionsCount(st.id);
                                        return (
                                          <label
                                            key={st.id}
                                            className={`flex items-center gap-2 p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                                              isSubSelected
                                                ? 'bg-amber-100/60 border-amber-300 text-amber-950 font-bold'
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                            }`}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isSubSelected}
                                              onChange={() => toggleSubtopic(t.id, st.id)}
                                              className="w-3 h-3 rounded text-amber-600 border-slate-300 focus:ring-amber-500 cursor-pointer"
                                            />
                                            <span className="flex-1 truncate">
                                              {isGen ? 'General (Sin sección especial)' : `⚡ ${st.title}`}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-500">
                                              ({count} preg.)
                                            </span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Temas Sin Bloque */}
                    {topics.some(t => !t.block_id) && (() => {
                      const unassignedTopics = topics.filter(t => !t.block_id);
                      const isAllUnassigned = unassignedTopics.length > 0 && unassignedTopics.every(t => selectedTopics.includes(t.id));
                      const selectedCount = unassignedTopics.filter(t => selectedTopics.includes(t.id)).length;
                      const isExpanded = expandedBlocks['unassigned'] ?? false;

                      return (
                        <div className="border border-amber-200 bg-white rounded-2xl overflow-hidden shadow-2xs">
                          <div 
                            onClick={() => toggleBlockExpand('unassigned')}
                            className="flex items-center justify-between p-3.5 bg-amber-50/70 hover:bg-amber-100/60 transition-colors border-b border-amber-100 cursor-pointer"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <input
                                type="checkbox"
                                checked={isAllUnassigned}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  toggleUnassignedBlock();
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-4 h-4 rounded text-amber-600 border-amber-300 focus:ring-amber-500 cursor-pointer"
                              />
                              <span className="font-bold text-xs sm:text-sm text-amber-950 truncate">
                                Temas Sin Bloque Asignado
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 shrink-0">
                                {selectedCount}/{unassignedTopics.length} ({getBlockQuestionsCount(unassignedTopics)} preg.)
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleBlockExpand('unassigned');
                              }}
                              className="p-1.5 text-amber-600 hover:text-amber-800 rounded-lg hover:bg-amber-200/50 cursor-pointer"
                            >
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="p-2.5 space-y-1.5 bg-amber-50/20">
                              {unassignedTopics.map(t => (
                                <div key={t.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs hover:border-amber-200 transition-all">
                                  <div className="flex items-center gap-2 p-2.5 hover:bg-slate-50 transition-colors select-none">
                                    <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={selectedTopics.includes(t.id)}
                                        onChange={() => toggleTopic(t.id)}
                                        className="w-3.5 h-3.5 rounded text-amber-600 border-slate-300 focus:ring-amber-500 cursor-pointer"
                                      />
                                      <span className="font-bold text-xs text-slate-800 truncate flex-1">
                                        Tema {t.order_index}: {t.title}
                                      </span>
                                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded-md shrink-0">
                                        ({getTopicQuestionsCount(t)} preg.)
                                      </span>
                                    </label>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Preguntas Libres / Sin Clasificar */}
                    {getUnclassifiedCount() > 0 && (
                      <div className="border border-slate-200 bg-white rounded-2xl p-3 shadow-2xs">
                        <label className="flex items-center gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={includeUnclassified}
                            onChange={(e) => setIncludeUnclassified(e.target.checked)}
                            className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                          />
                          <span className="font-bold text-xs text-slate-700 flex-1 truncate">
                            Incluir preguntas libres o sin tema clasificado
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                            {getUnclassifiedCount()} disponibles
                          </span>
                        </label>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-6 text-slate-400 text-xs">
                    No hay bloques ni temas registrados todavía en el sistema.
                  </div>
                )}
              </div>
            </div>

            {/* BOTÓN INICIAR EXAMEN */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => startExam()}
                disabled={totalAvailableQuestions === 0 || loading}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-extrabold text-base shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all active:scale-[0.99]"
              >
                <Zap className="w-5 h-5" />
                <span>
                  Comenzar Examen ({Math.min(questionCount, totalAvailableQuestions)} Preguntas)
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* FASE 2: REALIZACIÓN DEL EXAMEN (TAKING)                   */}
        {/* ========================================================= */}
        {examPhase === 'taking' && currentQ && (
          <div className="space-y-6 max-w-3xl mx-auto">
            {/* Barra superior fija de control */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-500 uppercase">
                  Pregunta {currentIndex + 1} de {examQuestions.length}
                </span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs font-bold text-indigo-600">
                  {Object.keys(selectedAnswers).length} contestadas
                </span>
              </div>

              {/* Temporizador */}
              <div className="flex items-center gap-2">
                {timeMode !== 'none' ? (
                  <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 font-mono text-sm font-black shadow-2xs ${
                    timeLeft <= 60
                      ? 'bg-rose-50 border-rose-300 text-rose-700 animate-pulse'
                      : timeLeft <= 300
                      ? 'bg-amber-50 border-amber-300 text-amber-800'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}>
                    <Clock className="w-4 h-4" />
                    <span>{formatTime(timeLeft)}</span>
                  </div>
                ) : (
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-[11px] font-bold text-slate-600 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Sin límite
                  </span>
                )}

                {/* Botón Marcar para Revisar */}
                <button
                  type="button"
                  onClick={() => toggleFlag(currentIndex)}
                  className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    flaggedQuestions[currentIndex]
                      ? 'bg-amber-100 border-amber-300 text-amber-900 shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                  title="Marcar pregunta para revisarla antes de entregar"
                >
                  <Flag className={`w-4 h-4 ${flaggedQuestions[currentIndex] ? 'fill-current text-amber-600' : ''}`} />
                  <span className="hidden sm:inline">
                    {flaggedQuestions[currentIndex] ? 'Marcada' : 'Marcar'}
                  </span>
                </button>

                {/* Botón Entregar Examen */}
                <button
                  type="button"
                  onClick={() => {
                    const unanswered = examQuestions.length - Object.keys(selectedAnswers).length;
                    const msg = unanswered > 0
                      ? `Tienes ${unanswered} preguntas sin responder (quedarán en blanco y no restan).\n\n¿Estás seguro de que deseas entregar y corregir el examen?`
                      : '¿Deseas entregar el examen ahora para corregirlo y ver tu nota oficial?';
                    if (confirm(msg)) finishExam();
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Entregar Examen</span>
                </button>
              </div>
            </div>

            {/* Barra de progreso */}
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-indigo-600 h-full transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / examQuestions.length) * 100}%` }}
              />
            </div>

            {/* Tarjeta de la Pregunta Actual */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 truncate max-w-md">
                  {currentQ._sourceLabel || 'Pregunta oficial'}
                </span>

                {flaggedQuestions[currentIndex] && (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                    <Flag className="w-3 h-3 fill-current" />
                    Marcada para revisión
                  </span>
                )}
              </div>

              {/* Enunciado */}
              <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-relaxed break-words [overflow-wrap:anywhere]">
                {currentQ.question_text}
              </h2>

              {/* Opciones de respuesta */}
              <div className="space-y-3">
                {currentQ.options?.map((optText: string, optIdx: number) => {
                  const isSelected = selectedAnswers[currentIndex] === optIdx;
                  const letter = ['A', 'B', 'C', 'D', 'E', 'F'][optIdx] || `${optIdx + 1}`;

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => handleSelectAnswer(optIdx)}
                      className={`w-full p-4 rounded-2xl border text-left flex items-start gap-3.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50/90 border-indigo-500 text-slate-900 ring-2 ring-indigo-500/20 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {letter}
                      </span>
                      <span className="text-sm font-semibold mt-0.5 leading-relaxed break-words [overflow-wrap:anywhere] flex-1">
                        {optText}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Botón para limpiar o dejar en blanco */}
              {selectedAnswers[currentIndex] !== undefined && (
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleClearAnswer}
                    className="text-xs text-slate-500 hover:text-slate-800 font-bold underline cursor-pointer"
                  >
                    Dejar esta pregunta en blanco (no penaliza)
                  </button>
                </div>
              )}

              {/* Controles de Navegación */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentIndex === 0}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Anterior</span>
                </button>

                {currentIndex < examQuestions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentIndex(prev => prev + 1)}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
                  >
                    <span>Siguiente</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('¿Deseas entregar el examen para corregirlo?')) finishExam();
                    }}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-sm cursor-pointer transition-colors"
                  >
                    <span>Corregir Examen</span>
                  </button>
                )}
              </div>
            </div>

            {/* Mapa de Preguntas Interactivo */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Mapa de Preguntas
                </span>
                <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block" />
                    Contestada
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                    Marcada
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-200 inline-block" />
                    En blanco
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1 max-h-48 overflow-y-auto">
                {examQuestions.map((_, idx) => {
                  const isAnswered = selectedAnswers[idx] !== undefined;
                  const isFlagged = flaggedQuestions[idx];
                  const isCurrent = currentIndex === idx;

                  let btnStyle = 'bg-slate-100 text-slate-700 hover:bg-slate-200';
                  if (isFlagged) {
                    btnStyle = 'bg-amber-400 text-amber-950 font-black';
                  } else if (isAnswered) {
                    btnStyle = 'bg-indigo-600 text-white font-bold';
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCurrentIndex(idx)}
                      className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${btnStyle} ${
                        isCurrent ? 'ring-2 ring-indigo-600 ring-offset-2 scale-105' : ''
                      }`}
                      title={`Pregunta ${idx + 1}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* FASE 3: RESULTADOS Y REVISIÓN DETALLADA (RESULTS)         */}
        {/* ========================================================= */}
        {examPhase === 'results' && (
          <div className="space-y-8 max-w-4xl mx-auto">
            {/* Tarjeta de Calificación Principal */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xs text-center space-y-6">
              <div className="inline-flex p-4 rounded-3xl bg-indigo-50 border border-indigo-100 text-indigo-600 shadow-2xs">
                <Award className="w-10 h-10" />
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Calificación Oficial Neta (Penalización Oficial: -1/3 por cada fallo)
                </span>
                <div className="text-5xl sm:text-6xl font-black text-slate-900 tracking-tight">
                  {resultsData.netScore.toFixed(2)}{' '}
                  <span className="text-2xl font-normal text-slate-400">/ 10.00</span>
                </div>
                <div className="mt-2">
                  <span className={`inline-flex px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                    resultsData.netScore >= 5.0
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}>
                    {resultsData.netScore >= 5.0 ? '🎉 Aprobado' : '⚠️ No Superado (< 5.00)'}
                  </span>
                </div>
              </div>

              {/* 3 Contadores Clave: Aciertos, Errores (-1/3), En Blanco */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl mx-auto">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <span className="text-xs font-bold text-emerald-800 block">Aciertos (+1.00)</span>
                  <span className="text-3xl font-black text-emerald-700">{resultsData.correct}</span>
                  <span className="text-[10px] text-emerald-600 block mt-0.5">preguntas correctas</span>
                </div>

                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200">
                  <span className="text-xs font-bold text-rose-800 block">Fallos (-0.33)</span>
                  <span className="text-3xl font-black text-rose-700">{resultsData.incorrect}</span>
                  <span className="text-[10px] text-rose-600 block mt-0.5">
                    Restan {resultsData.penalty.toFixed(2)} aciertos
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-xs font-bold text-slate-600 block">En blanco (0.00)</span>
                  <span className="text-3xl font-black text-slate-700">{resultsData.blank}</span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">no restan puntuación</span>
                </div>
              </div>

              {/* Metadatos adicionales */}
              <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-slate-500 pt-1">
                <span>⏱️ Tiempo invertido: <strong>{formatElapsed(resultsData.elapsedSeconds)}</strong></span>
                <span>·</span>
                <span>📋 Total preguntas: <strong>{examQuestions.length}</strong></span>
              </div>

              {/* Botones de acción rápida */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setExamPhase('config')}
                  className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm flex items-center gap-2 cursor-pointer transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Configurar Nuevo Examen</span>
                </button>

                {(resultsData.incorrect > 0 || resultsData.blank > 0) && (
                  <button
                    type="button"
                    onClick={handleRetryFailedAndBlank}
                    className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow-sm flex items-center gap-2 cursor-pointer transition-all"
                    title="Repetir solo las preguntas falladas y en blanco"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Repetir Solo Falladas y Blancas ({resultsData.incorrect + resultsData.blank})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  className="px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm cursor-pointer transition-colors"
                >
                  Volver al Panel
                </button>
              </div>
            </div>

            {/* SECCIÓN DE REVISIÓN DETALLADA DE PREGUNTAS Y FUNDAMENTO */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  <span>Revisión Detallada y Fundamento Jurídico</span>
                </h3>

                {/* Filtro de la lista */}
                <div className="flex rounded-xl bg-slate-200/80 p-1 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setResultsFilter('all')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      resultsFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Todas ({examQuestions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setResultsFilter('incorrect')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      resultsFilter === 'incorrect' ? 'bg-rose-600 text-white shadow-2xs' : 'text-rose-700 hover:text-rose-900'
                    }`}
                  >
                    Falladas ({resultsData.incorrect})
                  </button>
                  <button
                    type="button"
                    onClick={() => setResultsFilter('correct')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      resultsFilter === 'correct' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-emerald-700 hover:text-emerald-900'
                    }`}
                  >
                    Aciertos ({resultsData.correct})
                  </button>
                  <button
                    type="button"
                    onClick={() => setResultsFilter('blank')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      resultsFilter === 'blank' ? 'bg-slate-700 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    En Blanco ({resultsData.blank})
                  </button>
                </div>
              </div>

              {filteredResultQuestions.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500 text-sm">
                  No hay preguntas con el filtro seleccionado.
                </div>
              ) : (
                <div className="space-y-5">
                  {filteredResultQuestions.map(({ q, idx }) => {
                    const userAns = selectedAnswers[idx];
                    const isCorrect = userAns === q.correct_option;
                    const isBlank = userAns === undefined;

                    return (
                      <div
                        key={q.id || idx}
                        className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 space-y-4 shadow-xs"
                      >
                        {/* Cabecera de pregunta corregida */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-xs text-slate-500">
                              Pregunta {idx + 1}
                            </span>
                            <span className="text-xs text-slate-300">·</span>
                            <span className="text-[11px] font-semibold text-slate-500 truncate max-w-xs sm:max-w-md">
                              {q._sourceLabel || 'Oficial'}
                            </span>
                          </div>

                          <div>
                            {isBlank ? (
                              <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                ⚪ En Blanco (0.00)
                              </span>
                            ) : isCorrect ? (
                              <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                ✓ Acertada (+1.00)
                              </span>
                            ) : (
                              <span className="text-xs font-bold px-3 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-300 flex items-center gap-1">
                                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                ✗ Fallada (-0.33)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Enunciado */}
                        <h4 className="text-base font-bold text-slate-900 leading-relaxed break-words [overflow-wrap:anywhere]">
                          {q.question_text}
                        </h4>

                        {/* Opciones con corrección visual */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {q.options?.map((optText: string, oIdx: number) => {
                            const isCorrectOption = q.correct_option === oIdx;
                            const isUserChoice = userAns === oIdx;
                            const letter = ['A', 'B', 'C', 'D', 'E', 'F'][oIdx] || `${oIdx + 1}`;

                            let boxStyle = 'bg-slate-50 border-slate-200 text-slate-700';
                            let badgeStyle = 'bg-slate-200 text-slate-600';

                            if (isCorrectOption) {
                              boxStyle = 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold ring-1 ring-emerald-400';
                              badgeStyle = 'bg-emerald-600 text-white';
                            } else if (isUserChoice && !isCorrectOption) {
                              boxStyle = 'bg-rose-50 border-rose-300 text-rose-950 font-bold';
                              badgeStyle = 'bg-rose-600 text-white';
                            }

                            return (
                              <div
                                key={oIdx}
                                className={`p-3.5 rounded-2xl border text-xs flex items-start gap-3 transition-all ${boxStyle}`}
                              >
                                <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${badgeStyle}`}>
                                  {letter}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <span className="leading-relaxed break-words [overflow-wrap:anywhere]">
                                    {optText}
                                  </span>
                                  {isUserChoice && !isCorrectOption && (
                                    <span className="block text-[10px] font-extrabold text-rose-700 mt-1">
                                      ← Tu respuesta seleccionada (Incorrecta)
                                    </span>
                                  )}
                                  {isUserChoice && isCorrectOption && (
                                    <span className="block text-[10px] font-extrabold text-emerald-700 mt-1">
                                      ← Tu respuesta seleccionada (¡Correcta!)
                                    </span>
                                  )}
                                </div>
                                {isCorrectOption && (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                )}
                                {isUserChoice && !isCorrectOption && (
                                  <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* FUNDAMENTO JURÍDICO / EXPLICACIÓN */}
                        <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 text-xs text-slate-800 space-y-1.5 shadow-2xs">
                          <span className="font-extrabold text-indigo-900 flex items-center gap-1.5 text-xs">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                            Fundamento Jurídico / Justificación de la Respuesta:
                          </span>
                          <p className="leading-relaxed text-slate-700 break-words [overflow-wrap:anywhere]">
                            {q.explanation ? q.explanation : 'Fundamento no especificado para esta pregunta.'}
                          </p>
                        </div>

                        {/* Botón para impugnar / notificar duda */}
                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => setChallengeQuestion(q)}
                            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-amber-700 transition-colors cursor-pointer"
                          >
                            <Flag className="w-3 h-3 text-amber-500" />
                            <span>Impugnar o notificar duda sobre esta pregunta</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* Modal de Impugnación / Duda */}
      {challengeQuestion && (
        <QuestionChallengeModal
          isOpen={!!challengeQuestion}
          onClose={() => setChallengeQuestion(null)}
          question={challengeQuestion}
          user={profile}
        />
      )}
    </div>
  );
}
