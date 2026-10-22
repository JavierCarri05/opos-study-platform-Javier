'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Sidebar } from '@/components/Sidebar';
import { Profile, Topic, Block, AnkiInterval, AnkiItemType, AnkiReview } from '@/lib/types';
import { 
  Sparkles, 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  BookOpen, 
  Zap,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Boxes,
  Clock,
  Calendar,
  Layers,
  BarChart3,
  Check,
  X,
  Search,
  Filter,
  Info,
  CalendarDays,
  Flame,
  Award,
  ArrowRight,
  FolderOpen,
  Folder,
  Tag,
  HelpCircle,
  AlertCircle,
  Edit3,
  Save,
  Loader2,
  Flag,
  Plus,
  Trash2,
  Home,
  ArrowLeft,
  LogOut
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { QuestionChallengeModal } from '@/components/QuestionChallengeModal';
import { 
  ANKI_INTERVALS, 
  loadAnkiReviews, 
  saveAnkiReview, 
  getAnkiItemKey, 
  isItemDueForReview, 
  formatReviewTiming,
  resetAnkiReview,
  AnkiSessionMode,
  analyzeAnkiItem,
  buildBalancedAnkiQueue,
  getAnkiQueueBreakdown,
} from '@/lib/ankiStorage';
import { resolveTopicSubtopicId } from '@/lib/topicHelper';
import { fetchAllRows, getQuestionCountsSummary, getCachedUserProfile, getCachedTopicsAndBlocks } from '@/lib/supabaseHelper';

export default function AnkiStudyPage() {
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const isAdmin = profile?.role === 'admin';
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);

  const [phase, setPhase] = useState<'setup' | 'session' | 'complete'>('setup');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({});
  const [expandedTopicSubtopics, setExpandedTopicSubtopics] = useState<Record<string, boolean>>({});
  const [selectedSubtopicIds, setSelectedSubtopicIds] = useState<Record<string, string[]>>({});

  // Filtro de origen de preguntas tipo test (Banco vs Exámenes Oficiales)
  const [questionSource, setQuestionSource] = useState<'all' | 'custom' | 'official'>('all');
  const [bankCountsBySubtopic, setBankCountsBySubtopic] = useState<Record<string, number>>({});
  const [officialCountsBySubtopic, setOfficialCountsBySubtopic] = useState<Record<string, number>>({});

  // Preguntas libres / sin tema asignado
  const [includeUnclassified, setIncludeUnclassified] = useState(false);
  const [bankUnclassifiedCount, setBankUnclassifiedCount] = useState(0);
  const [officialUnclassifiedCount, setOfficialUnclassifiedCount] = useState(0);

  // Clasificación rápida en vivo durante la sesión
  const [showInlineClassifier, setShowInlineClassifier] = useState(false);
  const [selectedClassifyTopicId, setSelectedClassifyTopicId] = useState('');
  const [selectedClassifySubtopicId, setSelectedClassifySubtopicId] = useState('');
  const [isSavingClassification, setIsSavingClassification] = useState(false);

  // Edición rápida del fundamento legal en vivo (Solo Administrador)
  const [isEditingExplanation, setIsEditingExplanation] = useState(false);
  const [editingExplanationText, setEditingExplanationText] = useState('');
  const [isSavingExplanation, setIsSavingExplanation] = useState(false);
  const [showChallengeModal, setShowChallengeModal] = useState(false);

  // Edición completa de la pregunta tipo test y fundamento en vivo (Solo Administrador)
  const [isEditingQuestion, setIsEditingQuestion] = useState(false);
  const [editQuestionText, setEditQuestionText] = useState('');
  const [editOptions, setEditOptions] = useState<string[]>(['', '', '', '']);
  const [editCorrectOption, setEditCorrectOption] = useState<number>(0);
  const [editQuestionExplanation, setEditQuestionExplanation] = useState('');
  const [editQuestionTopicId, setEditQuestionTopicId] = useState('');
  const [editQuestionSubtopicId, setEditQuestionSubtopicId] = useState('');
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);
  const [isDeletingQuestion, setIsDeletingQuestion] = useState(false);

  // Ecosistema Anki & Programación Espaciada
  const [reviewsMap, setReviewsMap] = useState<Record<string, AnkiReview>>({});
  const [ankiFilterMode, setAnkiFilterMode] = useState<AnkiSessionMode>('balanced');
  const [showClassificationModal, setShowClassificationModal] = useState(false);
  const [classificationSearch, setClassificationSearch] = useState('');
  const [selectedIntervalTab, setSelectedIntervalTab] = useState<AnkiInterval | 'all' | 'classified' | 'new'>('classified');
  const [allLoadedItems, setAllLoadedItems] = useState<any[]>([]);
  const [isLoadingClassification, setIsLoadingClassification] = useState(false);

  // Sesión activa
  const [queue, setQueue] = useState<any[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<any | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [schedulingToast, setSchedulingToast] = useState<{ days: number; text: string } | null>(null);

  // Estadísticas de la sesión
  const [sessionStats, setSessionStats] = useState({
    cardsCompleted: 0,
    intervalCounts: { 1: 0, 3: 0, 10: 0, 20: 0, 30: 0 } as Record<AnkiInterval, number>,
  });

  useEffect(() => {
    async function init() {
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
        setSelectedTopics([]);
      }

      setBankCountsBySubtopic(countsSummary.bankCounts);
      setOfficialCountsBySubtopic(countsSummary.officialCounts);
      setBankUnclassifiedCount(countsSummary.bankUnclassified);
      setOfficialUnclassifiedCount(countsSummary.officialUnclassified);

      // Cargar ecosistema de reviews Anki persistentes
      const revs = await loadAnkiReviews(supabase, userProfRes.user.id);
      setReviewsMap(revs);
    }
    init();
  }, []);

  const getTopicQuestionsCount = (topic: any): number => {
    if (!topic.subtopics || topic.subtopics.length === 0) return 0;
    return topic.subtopics.reduce((acc: number, st: any) => {
      const bankCount = bankCountsBySubtopic[st.id] || 0;
      const offCount = officialCountsBySubtopic[st.id] || 0;
      if (questionSource === 'custom') return acc + bankCount;
      if (questionSource === 'official') return acc + offCount;
      return acc + bankCount + offCount;
    }, 0);
  };

  const getBlockQuestionsCount = (bTopics: any[]): number => {
    return bTopics.reduce((acc: number, t: any) => acc + getTopicQuestionsCount(t), 0);
  };

  const getUnclassifiedCount = (): number => {
    if (questionSource === 'custom') return bankUnclassifiedCount;
    if (questionSource === 'official') return officialUnclassifiedCount;
    return bankUnclassifiedCount + officialUnclassifiedCount;
  };

  const toggleBlockExpand = (bId: string) => {
    setExpandedBlocks(prev => ({ ...prev, [bId]: !prev[bId] }));
  };

  const toggleEntireBlock = (blockId: string) => {
    const blockTopics = topics.filter(t => t.block_id === blockId);
    const blockTopicIds = blockTopics.map(t => t.id);

    const allSelected = blockTopics.length > 0 && blockTopics.every(t => selectedTopics.includes(t.id));

    if (allSelected) {
      setSelectedTopics(prev => prev.filter(id => !blockTopicIds.includes(id)));
    } else {
      setSelectedTopics(prev => Array.from(new Set([...prev, ...blockTopicIds])));
    }
  };

  const toggleUnassignedBlock = () => {
    const unassignedTopics = topics.filter(t => !t.block_id);
    const unassignedTopicIds = unassignedTopics.map(t => t.id);

    const allSelected = unassignedTopics.length > 0 && unassignedTopics.every(t => selectedTopics.includes(t.id));

    if (allSelected) {
      setSelectedTopics(prev => prev.filter(id => !unassignedTopicIds.includes(id)));
    } else {
      setSelectedTopics(prev => Array.from(new Set([...prev, ...unassignedTopicIds])));
    }
  };

  const getSubtopicQuestionsCount = (subtopicId: string): number => {
    const bankCount = bankCountsBySubtopic[subtopicId] || 0;
    const offCount = officialCountsBySubtopic[subtopicId] || 0;
    if (questionSource === 'custom') return bankCount;
    if (questionSource === 'official') return offCount;
    return bankCount + offCount;
  };

  const toggleTopicSubtopicExpand = (tId: string) => {
    setExpandedTopicSubtopics(prev => ({ ...prev, [tId]: !prev[tId] }));
  };

  const toggleSubtopic = (topicId: string, subtopicId: string) => {
    const topic = topics.find(t => t.id === topicId);
    if (!topic || !topic.subtopics) return;

    const allSubIds = topic.subtopics.map((s: any) => s.id);
    const currentSelected = selectedSubtopicIds[topicId] ?? (selectedTopics.includes(topicId) ? allSubIds : []);

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

  const formatQuestionSourceLabel = (q: any, origin: AnkiItemType): string => {
    const isOfficial = origin === 'official_question' || !!q.exam_id;
    const examPrefix = isOfficial
      ? `Examen Oficial: ${q.official_exams?.title || 'Convocatoria'} (${q.official_exams?.year || ''}) - Pregunta ${q.question_number} · `
      : '';

    if (!q.subtopics) {
      return isOfficial
        ? `Examen Oficial: ${q.official_exams?.title || 'Convocatoria'} (${q.official_exams?.year || ''}) - Pregunta ${q.question_number} (Sin Tema Asignado)`
        : 'Pregunta Libre (Sin Tema Asignado)';
    }

    const topicOrder = q.subtopics?.topics?.order_index ? `Tema ${q.subtopics.topics.order_index}: ` : (q.subtopics?.order_index ? `Tema ${q.subtopics.order_index}: ` : '');
    const topicTitle = q.subtopics?.topics?.title || q.subtopics?.title || '';
    const isSpecialSub = q.subtopics?.title && q.subtopics.title.toLowerCase() !== 'general';
    const subtopicSuffix = isSpecialSub ? ` · ⚡ ${q.subtopics.title}` : '';

    return `${examPrefix}${topicOrder}${topicTitle}${subtopicSuffix}`;
  };

  // Carga de preguntas tipo test desde la base de datos (Banco + Exámenes Oficiales + Preguntas Libres)
  const fetchAllMatchingItems = async (loadAll: boolean = false) => {
    let combinedList: any[] = [];

    if (loadAll) {
      // 1. Cargar la totalidad de preguntas del banco (paginado automático si >1000)
      const allCustom = await fetchAllRows(
        supabase,
        'questions',
        '*, subtopics(id, title, topic_id, topics(id, title, order_index, block_id))'
      );
      if (allCustom && allCustom.length > 0) {
        const taggedCustom = allCustom.map((q: any) => ({
          ...q,
          _origin: 'question' as AnkiItemType,
          _sourceLabel: formatQuestionSourceLabel(q, 'question'),
        }));
        combinedList.push(...taggedCustom);
      }

      // 2. Cargar la totalidad de preguntas de exámenes oficiales (paginado automático si >1000)
      const allOfficial = await fetchAllRows(
        supabase,
        'official_exam_questions',
        '*, official_exams(title, year), subtopics(id, title, topic_id, topics(id, title, order_index, block_id))'
      );
      if (allOfficial && allOfficial.length > 0) {
        const taggedOfficial = allOfficial.map((q: any) => ({
          ...q,
          _origin: 'official_question' as AnkiItemType,
          _sourceLabel: formatQuestionSourceLabel(q, 'official_question'),
        }));
        combinedList.push(...taggedOfficial);
      }
    } else {
      // Modo sesión: filtrar estrictamente por los temas y subapartados seleccionados en la pantalla de configuración
      const matchingSubtopicIds = topics
        .filter(t => selectedTopics.includes(t.id))
        .flatMap(t => {
          const specificSubs = selectedSubtopicIds[t.id];
          if (specificSubs && specificSubs.length > 0) {
            return specificSubs;
          }
          return t.subtopics?.map((st: any) => st.id) || [];
        });

      // 1. Preguntas propias del banco de preguntas
      if (questionSource === 'all' || questionSource === 'custom') {
        let customList: any[] = [];
        if (matchingSubtopicIds.length > 0) {
          const { data: bySub } = await supabase
            .from('questions')
            .select('*, subtopics(id, title, topic_id, topics(id, title, order_index, block_id))')
            .in('subtopic_id', matchingSubtopicIds);
          if (bySub) customList.push(...bySub);
        }

        // Preguntas del banco libres / sin tema asignado
        if (includeUnclassified) {
          const { data: generalQ } = await supabase
            .from('questions')
            .select('*')
            .is('subtopic_id', null);
          if (generalQ) customList.push(...generalQ);
        }

        const uniqueCustom = Array.from(new Map(customList.map(q => [q.id, q])).values());
        const taggedCustom = uniqueCustom.map(q => ({
          ...q,
          _origin: 'question' as AnkiItemType,
          _sourceLabel: formatQuestionSourceLabel(q, 'question'),
        }));
        combinedList = [...combinedList, ...taggedCustom];
      }

      // 2. Preguntas de exámenes oficiales
      if (questionSource === 'all' || questionSource === 'official') {
        let officialList: any[] = [];
        if (matchingSubtopicIds.length > 0) {
          const { data: bySub } = await supabase
            .from('official_exam_questions')
            .select('*, official_exams(title, year), subtopics(id, title, topic_id, topics(id, title, order_index, block_id))')
            .in('subtopic_id', matchingSubtopicIds);
          if (bySub) officialList.push(...bySub);
        }

        // Preguntas de exámenes oficiales libres / sin tema asignado
        if (includeUnclassified) {
          const { data: unclassOff } = await supabase
            .from('official_exam_questions')
            .select('*, official_exams(title, year)')
            .is('subtopic_id', null);
          if (unclassOff) officialList.push(...unclassOff);
        }

        const uniqueOfficial = Array.from(new Map(officialList.map(q => [q.id, q])).values());
        const taggedOfficial = uniqueOfficial.map(q => ({
          ...q,
          _origin: 'official_question' as AnkiItemType,
          _sourceLabel: formatQuestionSourceLabel(q, 'official_question'),
        }));
        combinedList = [...combinedList, ...taggedOfficial];
      }
    }

    const uniqueCombined = Array.from(new Map(combinedList.map(q => [`${q._origin}:${q.id}`, q])).values());
    setAllLoadedItems(uniqueCombined);
    return uniqueCombined;
  };

  const startSession = async () => {
    if (selectedTopics.length === 0 && (!includeUnclassified || getUnclassifiedCount() === 0)) {
      alert('Debes seleccionar al menos un bloque, tema o las preguntas libres para repasar.');
      return;
    }

    const combinedList = await fetchAllMatchingItems();

    if (combinedList.length === 0) {
      alert('No se encontraron preguntas tipo test para la selección realizada.');
      return;
    }

    // Construir la cola de estudio con el algoritmo Anki anti-bucle y persistencia de atrasadas
    const { queue: preparedQueue, breakdown } = buildBalancedAnkiQueue(
      combinedList,
      item => getAnkiItemKey(item._origin, item.id),
      reviewsMap,
      { mode: ankiFilterMode, orderPreference: 'random' }
    );

    if (preparedQueue.length === 0) {
      if (ankiFilterMode === 'due_only') {
        alert(
          '🎉 ¡Al día! No tienes preguntas pendientes para repasar hoy en los temas seleccionados.\n\nPuedes elegir "⚡ Modo Equilibrado" o "🌱 Solo Contenido Nuevo" para seguir avanzando.'
        );
      } else if (ankiFilterMode === 'new_only') {
        alert(
          '🎉 ¡Has visto todas las preguntas de los temas seleccionados al menos una vez!\n\nPuedes elegir "⚡ Modo Equilibrado" o "⏰ Solo Repasos del día" para afianzar tus conocimientos.'
        );
      } else {
        alert(
          '🎉 ¡Enhorabuena! Todas las preguntas seleccionadas ya han sido repasadas y están programadas para días futuros. Ninguna toca repasar hoy.\n\nPuedes cambiar el modo a "Modo Libre / Intensivo" si deseas forzar un repaso ahora.'
        );
      }
      return;
    }

    setQueue(preparedQueue.slice(1));
    setCurrentQuestion(preparedQueue[0]);
    setAnswered(false);
    setSelectedOption(null);
    setSchedulingToast(null);
    setShowInlineClassifier(false);
    setSelectedClassifyTopicId('');
    setIsEditingExplanation(false);
    setEditingExplanationText('');
    setIsEditingQuestion(false);
    setEditQuestionText('');
    setEditOptions(['', '', '', '']);
    setEditQuestionExplanation('');
    setEditQuestionTopicId('');
    setSessionStats({
      cardsCompleted: 0,
      intervalCounts: { 1: 0, 3: 0, 10: 0, 20: 0, 30: 0 },
    });
    setPhase('session');
  };

  // Clasificación rápida en vivo mientras se estudia (Solo Administrador)
  const handleSaveQuestionClassification = async (targetTopicId: string, targetSubtopicId?: string) => {
    if (!currentQuestion || !targetTopicId) return;

    if (!isAdmin) {
      alert('Solo el administrador tiene permisos para clasificar o asignar preguntas a temas.');
      return;
    }

    setIsSavingClassification(true);
    try {
      const subToResolve = targetSubtopicId || selectedClassifySubtopicId;
      const resolvedSubId = await resolveTopicSubtopicId(targetTopicId, topics, supabase, subToResolve);
      if (!resolvedSubId) {
        alert('No se pudo resolver el tema seleccionado. Inténtalo de nuevo.');
        setIsSavingClassification(false);
        return;
      }

      const isOfficial = currentQuestion._origin === 'official_question' || !!currentQuestion.exam_id;

      if (isOfficial) {
        const { data, error } = await supabase
          .from('official_exam_questions')
          .update({ subtopic_id: resolvedSubId })
          .eq('id', currentQuestion.id)
          .select();

        if (error) {
          console.error('Error al actualizar official_exam_questions:', error);
          throw error;
        }
        if (!data || data.length === 0) {
          throw new Error('No se pudo actualizar la pregunta en la base de datos. Verifica tus permisos de administrador.');
        }
      } else {
        const { data, error } = await supabase
          .from('questions')
          .update({ subtopic_id: resolvedSubId })
          .eq('id', currentQuestion.id)
          .select();

        if (error) {
          console.error('Error al actualizar questions:', error);
          throw error;
        }
        if (!data || data.length === 0) {
          throw new Error('No se pudo actualizar la pregunta en la base de datos. Verifica tus permisos de administrador.');
        }
      }

      const assignedTopic = topics.find(t => t.id === targetTopicId);
      const assignedSubtopic = assignedTopic?.subtopics?.find((s: any) => s.id === resolvedSubId);
      const isSpecialSub = assignedSubtopic && assignedSubtopic.title?.toLowerCase() !== 'general';
      const subtopicSuffix = isSpecialSub ? ` · ⚡ ${assignedSubtopic.title}` : '';
      const topicLabel = assignedTopic ? `Tema ${assignedTopic.order_index}: ${assignedTopic.title}${subtopicSuffix}` : 'Tema Asignado';

      // Actualizar la pregunta actual en la sesión
      const updatedSourceLabel = isOfficial
        ? `Examen Oficial: ${currentQuestion.official_exams?.title || 'Convocatoria'} (${currentQuestion.official_exams?.year || ''}) - Pregunta ${currentQuestion.question_number} · ${topicLabel}`
        : topicLabel;

      setCurrentQuestion((prev: any) => ({
        ...prev,
        subtopic_id: resolvedSubId,
        _sourceLabel: updatedSourceLabel,
      }));

      // Actualizar en memoria en allLoadedItems y queue
      setAllLoadedItems(prev => prev.map(item => {
        if (item.id === currentQuestion.id) {
          return { ...item, subtopic_id: resolvedSubId, _sourceLabel: updatedSourceLabel };
        }
        return item;
      }));

      setQueue(prev => prev.map(item => {
        if (item.id === currentQuestion.id) {
          return { ...item, subtopic_id: resolvedSubId, _sourceLabel: updatedSourceLabel };
        }
        return item;
      }));

      // Actualizar contadores locales
      if (!isOfficial) {
        setBankCountsBySubtopic(prev => ({
          ...prev,
          [resolvedSubId]: (prev[resolvedSubId] || 0) + 1,
        }));
        setBankUnclassifiedCount(prev => Math.max(0, prev - 1));
      } else {
        setOfficialCountsBySubtopic(prev => ({
          ...prev,
          [resolvedSubId]: (prev[resolvedSubId] || 0) + 1,
        }));
        setOfficialUnclassifiedCount(prev => Math.max(0, prev - 1));
      }

      setShowInlineClassifier(false);
      setSchedulingToast({
        days: 0,
        text: `✅ ¡Pregunta guardada y asignada al ${topicLabel}!`,
      });
      setTimeout(() => setSchedulingToast(null), 4000);
    } catch (err: any) {
      console.error('Error al clasificar pregunta:', err);
      alert('Error al guardar la clasificación: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsSavingClassification(false);
    }
  };

  // Iniciar edición completa de la pregunta tipo test (Solo Administrador)
  const handleStartEditQuestion = () => {
    if (!currentQuestion) return;
    setEditQuestionText(currentQuestion.question_text || '');
    setEditOptions(
      Array.isArray(currentQuestion.options) && currentQuestion.options.length > 0
        ? [...currentQuestion.options]
        : ['', '', '', '']
    );
    setEditCorrectOption(typeof currentQuestion.correct_option === 'number' ? currentQuestion.correct_option : 0);
    setEditQuestionExplanation(currentQuestion.explanation || '');

    // Buscar tema y subapartado asignado
    const currentSubId = currentQuestion.subtopic_id;
    let foundTopicId = '';
    let foundSubId = '';
    if (currentSubId) {
      const matchTopic = topics.find(t => t.subtopics?.some((s: any) => s.id === currentSubId));
      if (matchTopic) {
        foundTopicId = matchTopic.id;
        foundSubId = currentSubId;
      }
    }
    setEditQuestionTopicId(foundTopicId);
    setEditQuestionSubtopicId(foundSubId);
    setIsEditingQuestion(true);
    setIsEditingExplanation(false);
    setShowInlineClassifier(false);
  };

  const handleOptionChange = (idx: number, val: string) => {
    const updated = [...editOptions];
    updated[idx] = val;
    setEditOptions(updated);
  };

  const handleAddOption = () => {
    if (editOptions.length >= 6) return;
    setEditOptions(prev => [...prev, '']);
  };

  const handleRemoveOption = (idx: number) => {
    if (editOptions.length <= 2) {
      alert('La pregunta debe tener al menos 2 opciones de respuesta.');
      return;
    }
    const updated = editOptions.filter((_, i) => i !== idx);
    setEditOptions(updated);
    if (editCorrectOption === idx) {
      setEditCorrectOption(0);
    } else if (editCorrectOption > idx) {
      setEditCorrectOption(prev => prev - 1);
    }
  };

  // Guardar pregunta tipo test completa en la base de datos (Solo Administrador)
  const handleSaveFullQuestion = async () => {
    if (!currentQuestion) return;
    if (!isAdmin) {
      alert('Solo el administrador tiene permisos para editar la pregunta.');
      return;
    }

    const trimmedQuestionText = editQuestionText.trim();
    if (!trimmedQuestionText) {
      alert('El enunciado de la pregunta no puede estar vacío.');
      return;
    }

    const cleanedOptions = editOptions.map(o => o.trim());
    if (cleanedOptions.some(o => !o)) {
      alert('Todas las opciones de respuesta deben tener texto.');
      return;
    }

    if (editCorrectOption < 0 || editCorrectOption >= cleanedOptions.length) {
      alert('Por favor selecciona cuál es la opción correcta.');
      return;
    }

    const trimmedExplanation = editQuestionExplanation.trim();

    setIsSavingQuestion(true);
    try {
      const isOfficial = currentQuestion._origin === 'official_question' || !!currentQuestion.exam_id;
      const targetTable = isOfficial ? 'official_exam_questions' : 'questions';

      let resolvedSubId = currentQuestion.subtopic_id;
      let newSourceLabel = currentQuestion._sourceLabel;

      if (editQuestionTopicId) {
        const subId = await resolveTopicSubtopicId(editQuestionTopicId, topics, supabase, editQuestionSubtopicId);
        if (subId) {
          resolvedSubId = subId;
          const assignedTopic = topics.find(t => t.id === editQuestionTopicId);
          const assignedSubtopic = assignedTopic?.subtopics?.find((s: any) => s.id === subId);
          const isSpecialSub = assignedSubtopic && assignedSubtopic.title?.toLowerCase() !== 'general';
          const subtopicSuffix = isSpecialSub ? ` · ⚡ ${assignedSubtopic.title}` : '';
          const topicLabel = assignedTopic ? `Tema ${assignedTopic.order_index}: ${assignedTopic.title}${subtopicSuffix}` : 'Tema Asignado';
          newSourceLabel = isOfficial
            ? `Examen Oficial: ${currentQuestion.official_exams?.title || 'Convocatoria'} (${currentQuestion.official_exams?.year || ''}) - Pregunta ${currentQuestion.question_number} · ${topicLabel}`
            : topicLabel;
        }
      }

      const updatePayload: any = {
        question_text: trimmedQuestionText,
        options: cleanedOptions,
        correct_option: editCorrectOption,
        explanation: trimmedExplanation,
        subtopic_id: resolvedSubId,
      };

      const { data, error } = await supabase
        .from(targetTable)
        .update(updatePayload)
        .eq('id', currentQuestion.id)
        .select();

      if (error) {
        console.error(`Error al actualizar ${targetTable}:`, error);
        throw error;
      }
      if (!data || data.length === 0) {
        throw new Error('No se pudo guardar la pregunta en la base de datos. Comprueba tus permisos de administrador.');
      }

      // Actualizar estado en memoria
      setCurrentQuestion((prev: any) => ({
        ...prev,
        ...updatePayload,
        _sourceLabel: newSourceLabel,
      }));

      setAllLoadedItems(prev => prev.map(item => {
        if (item.id === currentQuestion.id) {
          return {
            ...item,
            ...updatePayload,
            _sourceLabel: newSourceLabel,
          };
        }
        return item;
      }));

      setQueue(prev => prev.map(item => {
        if (item.id === currentQuestion.id) {
          return {
            ...item,
            ...updatePayload,
            _sourceLabel: newSourceLabel,
          };
        }
        return item;
      }));

      setIsEditingQuestion(false);
      setSchedulingToast({
        days: 0,
        text: '✅ ¡Pregunta tipo test y fundamento guardados con éxito!',
      });
      setTimeout(() => setSchedulingToast(null), 3500);
    } catch (err: any) {
      console.error('Error al guardar la pregunta:', err);
      alert('Error al guardar la pregunta: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsSavingQuestion(false);
    }
  };

  // Eliminar pregunta tipo test permanentemente de la base de datos y la plataforma (Solo Administrador)
  const handleDeleteCurrentQuestion = async () => {
    if (!currentQuestion) return;

    if (!isAdmin) {
      alert('Solo el administrador tiene permisos para eliminar preguntas.');
      return;
    }

    const isOfficial = currentQuestion._origin === 'official_question' || !!currentQuestion.exam_id;
    const targetTable = isOfficial ? 'official_exam_questions' : 'questions';
    const typeLabel = isOfficial ? 'esta pregunta de examen oficial' : 'esta pregunta del banco';

    const confirmed = confirm(
      `⚠️ ¿Estás seguro de que deseas ELIMINAR PERMANENTEMENTE ${typeLabel} de la base de datos y de la plataforma?\n\nEsta acción no se puede deshacer y borrará también su historial de repasos.`
    );
    if (!confirmed) return;

    setIsDeletingQuestion(true);
    try {
      const qId = currentQuestion.id;
      const qOrigin = currentQuestion._origin;

      // 1. Eliminar reviews de Anki asociadas a esta pregunta
      await supabase
        .from('anki_reviews')
        .delete()
        .match({ item_type: qOrigin, item_id: qId });

      // Limpiar de localStorage local
      if (profile?.id) {
        resetAnkiReview(supabase, profile.id, qOrigin, qId);
      }

      // 2. Eliminar impugnaciones o reportes asociados si existieran
      try {
        await supabase
          .from('question_challenges')
          .delete()
          .match({ question_id: qId, question_origin: qOrigin });
      } catch (_) {}

      // 3. Eliminar la pregunta de la tabla correspondiente
      const { error } = await supabase
        .from(targetTable)
        .delete()
        .eq('id', qId);

      if (error) {
        console.error(`Error al eliminar de ${targetTable}:`, error);
        throw error;
      }

      // 4. Actualizar listas en memoria
      setAllLoadedItems(prev => prev.filter(item => item.id !== qId));

      // Actualizar colas y avanzar a la siguiente pregunta
      const nextQueue = queue.filter(item => item.id !== qId);

      setIsEditingQuestion(false);
      setSchedulingToast({
        days: 0,
        text: '🗑️ Pregunta eliminada permanentemente de la base de datos.',
      });
      setTimeout(() => setSchedulingToast(null), 3500);

      if (nextQueue.length > 0) {
        setCurrentQuestion(nextQueue[0]);
        setQueue(nextQueue.slice(1));
        setSelectedOption(null);
        setAnswered(false);
      } else {
        setCurrentQuestion(null);
        setQueue([]);
        setPhase('complete');
      }
    } catch (err: any) {
      console.error('Error al eliminar la pregunta:', err);
      alert('Error al eliminar la pregunta: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsDeletingQuestion(false);
    }
  };

  // Guardar fundamento legal en vivo (Solo Administrador)
  const handleSaveExplanation = async () => {
    if (!currentQuestion) return;

    if (!isAdmin) {
      alert('Solo el administrador tiene permisos para editar o añadir el fundamento legal.');
      return;
    }

    const newExplanation = editingExplanationText.trim();
    if (!newExplanation) {
      alert('Por favor, introduce el fundamento legal o justificación normativa.');
      return;
    }

    setIsSavingExplanation(true);
    try {
      const isOfficial = currentQuestion._origin === 'official_question' || !!currentQuestion.exam_id;

      if (isOfficial) {
        const { data, error } = await supabase
          .from('official_exam_questions')
          .update({ explanation: newExplanation })
          .eq('id', currentQuestion.id)
          .select();

        if (error) {
          console.error('Error al actualizar fundamento legal en official_exam_questions:', error);
          throw error;
        }
        if (!data || data.length === 0) {
          throw new Error('No se pudo actualizar en la base de datos. Verifica tus permisos de administrador.');
        }
      } else {
        const { data, error } = await supabase
          .from('questions')
          .update({ explanation: newExplanation })
          .eq('id', currentQuestion.id)
          .select();

        if (error) {
          console.error('Error al actualizar fundamento legal en questions:', error);
          throw error;
        }
        if (!data || data.length === 0) {
          throw new Error('No se pudo actualizar en la base de datos. Verifica tus permisos de administrador.');
        }
      }

      // Actualizar la pregunta en el estado local activo
      setCurrentQuestion((prev: any) => ({
        ...prev,
        explanation: newExplanation,
      }));

      // Actualizar en el almacén de preguntas cargadas y en la cola
      setAllLoadedItems(prev => prev.map(item => {
        if (item.id === currentQuestion.id) {
          return { ...item, explanation: newExplanation };
        }
        return item;
      }));

      setQueue(prev => prev.map(item => {
        if (item.id === currentQuestion.id) {
          return { ...item, explanation: newExplanation };
        }
        return item;
      }));

      setIsEditingExplanation(false);
      setSchedulingToast({
        days: 0,
        text: '✅ ¡Fundamento legal guardado con éxito!',
      });
      setTimeout(() => setSchedulingToast(null), 3500);
    } catch (err: any) {
      console.error('Error al guardar el fundamento legal:', err);
      alert('Error al guardar el fundamento legal: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsSavingExplanation(false);
    }
  };

  const handleChooseOption = (optIdx: number) => {
    if (answered) return;
    setSelectedOption(optIdx);
    setAnswered(true);
  };

  // PROGRAMACIÓN DEL INTERVALO EN DÍAS (1, 3, 10, 20, 30 DÍAS)
  const handleScheduleInterval = async (days: AnkiInterval) => {
    if (!currentQuestion || !profile) return;

    const itemType: AnkiItemType = currentQuestion._origin;

    const lastResult = selectedOption === currentQuestion.correct_option
      ? 'correct'
      : 'incorrect';

    // 1. Guardar en el ecosistema Anki (Supabase + localStorage)
    const review = await saveAnkiReview(
      supabase,
      profile.id,
      itemType,
      currentQuestion.id,
      days,
      lastResult
    );

    const itemKey = getAnkiItemKey(itemType, currentQuestion.id);
    setReviewsMap(prev => ({ ...prev, [itemKey]: review }));

    // Feedback visual
    setSchedulingToast({
      days,
      text: `Pregunta programada para dentro de ${days} ${days === 1 ? 'día' : 'días'}. ¡No volverá a salir en Modo Anki hasta entonces!`,
    });

    // 2. Actualizar estadísticas de la sesión
    setSessionStats(prev => ({
      cardsCompleted: prev.cardsCompleted + 1,
      intervalCounts: {
        ...prev.intervalCounts,
        [days]: (prev.intervalCounts[days] || 0) + 1,
      },
    }));

    // 3. Pasar a la siguiente pregunta tras breve transición
    setTimeout(() => {
      setSchedulingToast(null);
      if (queue.length > 0) {
        const nextQ = queue[0];
        setQueue(queue.slice(1));
        setCurrentQuestion(nextQ);
        setAnswered(false);
        setSelectedOption(null);
        setShowInlineClassifier(false);
        setSelectedClassifyTopicId('');
        setIsEditingExplanation(false);
        setEditingExplanationText('');
        setIsEditingQuestion(false);
        setEditQuestionText('');
        setEditOptions(['', '', '', '']);
      } else {
        setPhase('complete');
        confetti({ particleCount: 120, spread: 80 });
      }
    }, 450);
  };

  // Abrir modal de clasificación de preguntas
  const handleOpenClassification = async () => {
    setIsLoadingClassification(true);
    try {
      let currentMap = reviewsMap;
      if (profile?.id) {
        currentMap = await loadAnkiReviews(supabase, profile.id);
        setReviewsMap(currentMap);
      }
      const allItems = await fetchAllMatchingItems(true);
      const hasClassified = allItems.some(item => !!currentMap[getAnkiItemKey(item._origin, item.id)]);
      setSelectedIntervalTab(hasClassified ? 'classified' : 'all');
      setShowClassificationModal(true);
    } catch (err) {
      console.error('Error al abrir clasificación Anki:', err);
      alert('Error al cargar las preguntas del ecosistema Anki.');
    } finally {
      setIsLoadingClassification(false);
    }
  };

  // Filtrado de elementos en el modal de clasificación
  const classifiedItems = useMemo(() => {
    return allLoadedItems.filter(item => {
      const key = getAnkiItemKey(item._origin, item.id);
      const rev = reviewsMap[key];

      // Filtro por pestaña de intervalo
      if (selectedIntervalTab === 'new') {
        if (rev) return false;
      } else if (selectedIntervalTab === 'classified') {
        if (!rev) return false;
      } else if (selectedIntervalTab !== 'all') {
        if (!rev || rev.interval_days !== selectedIntervalTab) return false;
      }

      // Filtro por búsqueda de texto
      if (classificationSearch.trim()) {
        const s = classificationSearch.toLowerCase();
        const text = (item.question_text || item.front_text || item.back_text || '').toLowerCase();
        const exp = (item.explanation || item.hint || '').toLowerCase();
        return text.includes(s) || exp.includes(s);
      }

      return true;
    });
  }, [allLoadedItems, reviewsMap, selectedIntervalTab, classificationSearch]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900 w-full max-w-full overflow-x-hidden">
      <Sidebar profile={profile} />

      <main className="flex-1 min-w-0 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-8 overflow-y-auto">
        {/* ========================================================= */}
        {/* FASE 1: CONFIGURACIÓN INICIAL DEL REPASO ANKI             */}
        {/* ========================================================= */}
        {phase === 'setup' && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xs max-w-2xl mx-auto space-y-7">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver al Panel de Inicio</span>
              </button>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center mx-auto mb-4 shadow-sm shadow-purple-500/20">
                <Sparkles className="w-7 h-7" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                Modo Anki (Preguntas Tipo Test)
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-2 max-w-md mx-auto">
                Repaso espaciado individual para <strong>{profile?.full_name || profile?.email}</strong> con intervalos de <strong>1, 3, 10, 20 y 30 días</strong>.
              </p>
            </div>

            {/* BANNER DE REGLA Y FILTRO ANKI ESTRICTO */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50 via-indigo-50/50 to-purple-50 border border-purple-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-purple-600" />
                  Modo de Repaso Espaciado
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-200 text-purple-900">
                  Algoritmo Activo
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setAnkiFilterMode('balanced')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    ankiFilterMode === 'balanced'
                      ? 'bg-white border-purple-500 ring-2 ring-purple-500/20 shadow-xs'
                      : 'bg-white/60 border-purple-200 hover:bg-white text-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      ⚡ Modo Equilibrado (Recomendado)
                    </span>
                    {ankiFilterMode === 'balanced' && <Check className="w-4 h-4 text-purple-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Intercala preguntas de repaso pendientes con preguntas totalmente nuevas.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setAnkiFilterMode('prioritize_due')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    ankiFilterMode === 'prioritize_due'
                      ? 'bg-white border-purple-500 ring-2 ring-purple-500/20 shadow-xs'
                      : 'bg-white/60 border-purple-200 hover:bg-white text-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-purple-600" />
                      📌 Primero Repasos, luego Nuevas
                    </span>
                    {ankiFilterMode === 'prioritize_due' && <Check className="w-4 h-4 text-purple-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Resuelve primero lo atrasado y de hoy por urgencia temporal; al terminar, salen preguntas nuevas.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setAnkiFilterMode('new_only')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    ankiFilterMode === 'new_only'
                      ? 'bg-white border-purple-500 ring-2 ring-purple-500/20 shadow-xs'
                      : 'bg-white/60 border-purple-200 hover:bg-white text-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-purple-600" />
                      🌱 Solo Contenido Nuevo
                    </span>
                    {ankiFilterMode === 'new_only' && <Check className="w-4 h-4 text-purple-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Solo preguntas que nunca has visto antes en Modo Anki para aprender materia nueva.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setAnkiFilterMode('all')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    ankiFilterMode === 'all'
                      ? 'bg-white border-purple-500 ring-2 ring-purple-500/20 shadow-xs'
                      : 'bg-white/60 border-purple-200 hover:bg-white text-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-purple-600" />
                      🌐 Modo Libre / Intensivo
                    </span>
                    {ankiFilterMode === 'all' && <Check className="w-4 h-4 text-purple-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Todas las preguntas sin esperar días ni fechas. Ideal para repaso intensivo pre-examen.
                  </p>
                </button>
              </div>

              {/* Botón para ver clasificación y estado general */}
              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  disabled={isLoadingClassification}
                  onClick={handleOpenClassification}
                  className="text-xs font-bold text-purple-700 hover:text-purple-900 disabled:opacity-50 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {isLoadingClassification ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
                      <span>Cargando Ecosistema Anki...</span>
                    </>
                  ) : (
                    <>
                      <BarChart3 className="w-3.5 h-3.5" />
                      <span>Ver Clasificación y Preguntas Programadas</span>
                      <ArrowRight className="w-3 h-3" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* SELECTOR DE ORIGEN DE PREGUNTAS */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                1. Banco de preguntas tipo test
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setQuestionSource('all')}
                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                    questionSource === 'all'
                      ? 'bg-purple-600 border-purple-600 text-white font-bold shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 font-semibold'
                  }`}
                >
                  <span className="text-xs block">Todas las Preguntas</span>
                  <span className={`text-[10px] block mt-0.5 ${questionSource === 'all' ? 'text-purple-100' : 'text-slate-400'}`}>
                    Banco + Oficiales
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setQuestionSource('custom')}
                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                    questionSource === 'custom'
                      ? 'bg-purple-600 border-purple-600 text-white font-bold shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 font-semibold'
                  }`}
                >
                  <span className="text-xs block">Banco de Temario</span>
                  <span className={`text-[10px] block mt-0.5 ${questionSource === 'custom' ? 'text-purple-100' : 'text-slate-400'}`}>
                    Preguntas del temario
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setQuestionSource('official')}
                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                    questionSource === 'official'
                      ? 'bg-purple-600 border-purple-600 text-white font-bold shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 font-semibold'
                  }`}
                >
                  <span className="text-xs block">Exámenes Oficiales</span>
                  <span className={`text-[10px] block mt-0.5 ${questionSource === 'official' ? 'text-purple-100' : 'text-slate-400'}`}>
                    Convocatorias reales
                  </span>
                </button>
              </div>
            </div>

            {/* SELECTOR DE BLOQUES Y TEMAS */}
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  2. Bloques y Temas a Repasar
                </label>
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-xs text-purple-600 hover:text-purple-700 font-bold cursor-pointer"
                >
                  {hasAnySelected ? 'Desmarcar todos' : 'Seleccionar todos'}
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto space-y-3 border border-slate-200 rounded-2xl p-3 bg-slate-50/60">
                {blocks.length > 0 ? (
                  <>
                    {blocks.map(block => {
                      const blockTopics = topics.filter(t => t.block_id === block.id);
                      if (blockTopics.length === 0) return null;

                      const isAllBlockSelected = blockTopics.length > 0 && blockTopics.every(t => selectedTopics.includes(t.id));
                      const selectedCount = blockTopics.filter(t => selectedTopics.includes(t.id)).length;
                      const isBlockExpanded = expandedBlocks[block.id] ?? false;

                      return (
                        <div key={block.id} className="border border-purple-200 bg-white rounded-2xl overflow-hidden shadow-2xs">
                          <div 
                            onClick={() => toggleBlockExpand(block.id)}
                            className="flex items-center justify-between p-3.5 bg-purple-50/70 hover:bg-purple-100/60 transition-colors border-b border-purple-100 cursor-pointer"
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
                                className="w-4 h-4 rounded text-purple-600 border-purple-300 focus:ring-purple-500 cursor-pointer"
                              />
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Boxes className="w-4 h-4 text-purple-600 shrink-0" />
                                <span className="font-bold text-xs sm:text-sm text-purple-950 truncate">
                                  Bloque {block.order_index}: {block.title}
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-200/80 text-purple-800 shrink-0">
                                  {selectedCount}/{blockTopics.length} {blockTopics.length === 1 ? 'tema' : 'temas'} ({getBlockQuestionsCount(blockTopics)} {getBlockQuestionsCount(blockTopics) === 1 ? 'pregunta' : 'preguntas'})
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleBlockExpand(block.id);
                              }}
                              className="p-1.5 text-purple-600 hover:text-purple-800 rounded-lg hover:bg-purple-200/50 cursor-pointer"
                            >
                              {isBlockExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          </div>

                          {isBlockExpanded && (
                            <div className="p-2.5 space-y-1.5 bg-purple-50/20">
                              {blockTopics.map(t => (
                                <div key={t.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs hover:border-purple-200 transition-all">
                                  <div className="flex items-center gap-2 p-2.5 hover:bg-slate-50 transition-colors select-none">
                                    <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={selectedTopics.includes(t.id)}
                                        onChange={() => toggleTopic(t.id)}
                                        className="w-3.5 h-3.5 rounded text-purple-600 border-slate-300 focus:ring-purple-500 cursor-pointer"
                                      />
                                      <span className="font-bold text-xs text-slate-800 truncate flex-1">
                                        Tema {t.order_index}: {t.title}
                                      </span>
                                      <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200/60 px-1.5 py-0.5 rounded-md shrink-0">
                                        ({getTopicQuestionsCount(t)} {getTopicQuestionsCount(t) === 1 ? 'pregunta' : 'preguntas'})
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
                                        <span className="text-[9px] font-semibold text-slate-500">Marca los que desees repasar</span>
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
                                              ({count} {count === 1 ? 'preg.' : 'pregs.'})
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
                              <span className="font-bold text-xs sm:text-sm text-amber-950">
                                Temas Sin Bloque Asignado
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-800 shrink-0">
                                {selectedCount}/{unassignedTopics.length} {unassignedTopics.length === 1 ? 'tema' : 'temas'} ({getBlockQuestionsCount(unassignedTopics)} {getBlockQuestionsCount(unassignedTopics) === 1 ? 'pregunta' : 'preguntas'})
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
                                        ({getTopicQuestionsCount(t)} {getTopicQuestionsCount(t) === 1 ? 'pregunta' : 'preguntas'})
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
                                        <span className="text-[9px] font-semibold text-slate-500">Marca los que desees repasar</span>
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
                                              ({count} {count === 1 ? 'preg.' : 'pregs.'})
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
                    })()}

                    {/* Preguntas Libres / Sin Asignar a Tema */}
                    {getUnclassifiedCount() > 0 && (
                      <div className="border border-amber-300 bg-white rounded-2xl overflow-hidden shadow-2xs">
                        <div 
                          onClick={() => setIncludeUnclassified(prev => !prev)}
                          className="flex items-center justify-between p-3.5 bg-amber-50/80 hover:bg-amber-100/60 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={includeUnclassified}
                              onChange={(e) => {
                                e.stopPropagation();
                                setIncludeUnclassified(e.target.checked);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 rounded text-amber-600 border-amber-300 focus:ring-amber-500 cursor-pointer"
                            />
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
                              <span className="font-bold text-xs sm:text-sm text-amber-950 truncate">
                                Preguntas Libres (Sin Tema Asignado)
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 shrink-0">
                                {getUnclassifiedCount()} {getUnclassifiedCount() === 1 ? 'pregunta' : 'preguntas'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-slate-400 text-center py-4">Cargando temas...</p>
                )}
              </div>
            </div>

            {/* BOTÓN INICIAR SESIÓN */}
            <button
              onClick={startSession}
              disabled={selectedTopics.length === 0 && (!includeUnclassified || getUnclassifiedCount() === 0)}
              className="w-full py-4 rounded-2xl font-extrabold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white shadow-md transition-all text-center flex items-center justify-center gap-2 cursor-pointer text-sm sm:text-base"
            >
              <Zap className="w-5 h-5" />
              <span>Comenzar Sesión Anki</span>
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* FASE 2: SESIÓN ACTIVA (PREGUNTA / FLASHCARD)              */}
        {/* ========================================================= */}
        {phase === 'session' && currentQuestion && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-3 text-xs text-slate-500 border-b border-slate-200 pb-3 font-semibold flex-wrap">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('¿Deseas salir de esta ronda y volver al panel de Modo Anki? Tu progreso ya queda guardado.')) {
                      setPhase('setup');
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300 border border-slate-200 transition-all cursor-pointer shadow-2xs group"
                  title="Salir de esta ronda y volver al panel de Modo Anki"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-slate-500 group-hover:text-purple-600 transition-colors" />
                  <span>Salir al Panel Modo Anki</span>
                </button>

                <span className="flex items-center gap-1.5 text-purple-700 font-bold bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
                  <Sparkles className="w-3.5 h-3.5" />
                  Elementos en cola: {queue.length + 1}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-slate-600">
                  Completadas: <strong className="text-slate-900 font-black">{sessionStats.cardsCompleted}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('¿Deseas pausar esta sesión y cambiar la selección de temas o modo?')) {
                      setPhase('setup');
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-purple-700 hover:bg-purple-50 border border-purple-200 transition-colors cursor-pointer"
                  title="Volver a la selección de temas de Anki"
                >
                  Cambiar Temas
                </button>
              </div>
            </div>

            {/* TOAST DE FEEDBACK DE PROGRAMACIÓN */}
            {schedulingToast && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2 shadow-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{schedulingToast.text}</span>
              </div>
            )}

            {/* VISTA DE PREGUNTA TIPO TEST EN MODO ANKI */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xs space-y-6">
              {/* CABECERA DE ORIGEN Y BOTÓN DE CLASIFICACIÓN RÁPIDA */}
              <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2 flex-wrap">
                  {currentQuestion._sourceLabel && (
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${
                      !currentQuestion.subtopic_id
                        ? 'bg-amber-50 text-amber-900 border border-amber-300'
                        : 'bg-purple-50 text-purple-700 border border-purple-200'
                    }`}>
                      <BookOpen className="w-3.5 h-3.5" />
                      {currentQuestion._sourceLabel}
                    </div>
                  )}

                  {(() => {
                    const key = getAnkiItemKey(currentQuestion._origin, currentQuestion.id);
                    const analysis = analyzeAnkiItem(reviewsMap[key]);
                    return (
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black border shadow-2xs ${analysis.badgeClass}`}>
                        {analysis.status === 'overdue' && <Clock className="w-3.5 h-3.5 text-rose-600" />}
                        {analysis.status === 'due_today' && <Clock className="w-3.5 h-3.5 text-amber-600" />}
                        {analysis.status === 'new' && <Sparkles className="w-3.5 h-3.5 text-emerald-600" />}
                        {analysis.status === 'future' && <Calendar className="w-3.5 h-3.5 text-slate-500" />}
                        <span>{analysis.status === 'new' ? '✨ Pregunta nueva' : `📌 ${analysis.label}`}</span>
                      </span>
                    );
                  })()}

                  {!currentQuestion.subtopic_id && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-amber-600" />
                      Pregunta libre sin clasificar
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Botón Impugnar Pregunta (Alumnos y Profesores) */}
                  <button
                    type="button"
                    onClick={() => setShowChallengeModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer shadow-2xs active:scale-95"
                    title="Impugnar o reportar un posible error en esta pregunta"
                  >
                    <Flag className="w-3.5 h-3.5 text-amber-600" />
                    <span>Impugnar</span>
                  </button>

                  {/* BOTÓN ADMINISTRADOR (CAMBIAR / ASIGNAR TEMA) */}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        const currentSubId = currentQuestion.subtopic_id;
                        const matchTopic = topics.find(t => t.subtopics?.some((s: any) => s.id === currentSubId));
                        setSelectedClassifyTopicId(matchTopic?.id || '');
                        setSelectedClassifySubtopicId(currentSubId || '');
                        setShowInlineClassifier(prev => !prev);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                        !currentQuestion.subtopic_id
                          ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600'
                          : 'bg-purple-50 hover:bg-purple-100 text-purple-800 border-purple-200'
                      }`}
                    >
                      <Tag className="w-3.5 h-3.5" />
                      {!currentQuestion.subtopic_id ? 'Asignar a Bloque y Tema' : 'Cambiar Tema / Bloque'}
                    </button>
                  )}
                </div>
              </div>

              {/* PANEL DE CLASIFICACIÓN RÁPIDA EN VIVO (SOLO ADMINISTRADOR) */}
              {showInlineClassifier && isAdmin && (
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-50 via-indigo-50 to-amber-50 border-2 border-purple-300 space-y-3 animate-in fade-in shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-purple-950 flex items-center gap-1.5">
                      <Tag className="w-4 h-4 text-purple-700" />
                      Clasificación de Pregunta (Solo Administrador)
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowInlineClassifier(false)}
                      className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-white/80 transition-colors cursor-pointer"
                      title="Cerrar"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-600">
                    Selecciona el tema oficial y haz clic en <strong>Guardar Pregunta</strong> para clasificarla de forma permanente en la base de datos:
                  </p>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full">
                    <div className="flex-1 min-w-0 w-full space-y-2">
                      <select
                        value={selectedClassifyTopicId}
                        onChange={(e) => {
                          const topId = e.target.value;
                          setSelectedClassifyTopicId(topId);
                          const matched = topics.find(t => t.id === topId);
                          const genSub = matched?.subtopics?.find((s: any) => s.title?.toLowerCase() === 'general');
                          setSelectedClassifySubtopicId(genSub ? genSub.id : (matched?.subtopics?.[0]?.id || ''));
                        }}
                        className="w-full min-w-0 max-w-full truncate px-3.5 py-2.5 rounded-xl bg-white border border-purple-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs"
                      >
                        <option value="">-- Selecciona el Tema al que corresponde --</option>
                        {blocks.map(b => {
                          const blockTopics = topics.filter(t => t.block_id === b.id).sort((x, y) => (x.order_index ?? 0) - (y.order_index ?? 0));
                          if (blockTopics.length === 0) return null;
                          return (
                            <optgroup key={b.id} label={`Bloque ${b.order_index}: ${b.title}`}>
                              {blockTopics.map(t => (
                                <option key={t.id} value={t.id}>
                                  Tema {t.order_index}: {t.title}
                                </option>
                              ))}
                            </optgroup>
                          );
                        })}
                        {topics.some(t => !t.block_id) && (
                          <optgroup label="Temas Generales (Sin Bloque)">
                            {topics.filter(t => !t.block_id).sort((x, y) => (x.order_index ?? 0) - (y.order_index ?? 0)).map(t => (
                              <option key={t.id} value={t.id}>
                                Tema {t.order_index}: {t.title}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>

                      {selectedClassifyTopicId && (() => {
                        const matchedTopic = topics.find(t => t.id === selectedClassifyTopicId);
                        if (!matchedTopic?.subtopics || matchedTopic.subtopics.length <= 1) return null;
                        return (
                          <div className="p-2 bg-amber-50/80 rounded-xl border border-amber-300">
                            <label className="block text-[10px] font-extrabold uppercase text-amber-900 mb-1 flex items-center gap-1">
                              <Zap className="w-3 h-3 text-amber-600 fill-amber-500" />
                              Subapartado Especial / Sección
                            </label>
                            <select
                              value={selectedClassifySubtopicId}
                              onChange={(e) => setSelectedClassifySubtopicId(e.target.value)}
                              className="w-full px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-xs font-bold text-amber-950 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs"
                            >
                              {matchedTopic.subtopics.map((st: any) => {
                                const isGen = st.title?.toLowerCase() === 'general';
                                return (
                                  <option key={st.id} value={st.id}>
                                    {isGen ? 'General (Sin subsección específica)' : `⚡ ${st.title}`}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        );
                      })()}
                    </div>

                    <button
                      type="button"
                      disabled={!selectedClassifyTopicId || isSavingClassification}
                      onClick={() => handleSaveQuestionClassification(selectedClassifyTopicId, selectedClassifySubtopicId)}
                      className="px-5 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 active:scale-95"
                    >
                      <Check className="w-4 h-4 text-white shrink-0" />
                      <span>{isSavingClassification ? 'Guardando...' : 'Guardar Pregunta'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* MODO EDICIÓN COMPLETA DE PREGUNTA TIPO TEST (SOLO ADMINISTRADOR) */}
              {isEditingQuestion && isAdmin ? (
                <div className="p-5 sm:p-6 rounded-3xl bg-slate-50/90 border-2 border-indigo-300 space-y-5 animate-in fade-in shadow-inner">
                  {/* Header del Editor */}
                  <div className="flex items-center justify-between pb-3 border-b border-indigo-100">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                        <Edit3 className="w-4 h-4" />
                      </span>
                      <div>
                        <h3 className="text-sm font-black text-slate-900">
                          Editar Pregunta Tipo Test (Modo Administrador)
                        </h3>
                        <p className="text-[11px] text-slate-500 font-medium">
                          Modifica el enunciado, las opciones, la opción correcta, el fundamento legal y el tema oficial
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsEditingQuestion(false)}
                      className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-white transition-colors cursor-pointer"
                      title="Cancelar edición"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Selector de Tema / Bloque integrado */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Tema Oficial / Bloque:</span>
                    </label>
                    <select
                      value={editQuestionTopicId}
                      onChange={(e) => {
                        const topId = e.target.value;
                        setEditQuestionTopicId(topId);
                        const matched = topics.find(t => t.id === topId);
                        const genSub = matched?.subtopics?.find((s: any) => s.title?.toLowerCase() === 'general');
                        setEditQuestionSubtopicId(genSub ? genSub.id : (matched?.subtopics?.[0]?.id || ''));
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                    >
                      <option value="">-- Dejar tema actual o seleccionar nuevo tema --</option>
                      {blocks.map(b => {
                        const blockTopics = topics.filter(t => t.block_id === b.id).sort((x, y) => (x.order_index ?? 0) - (y.order_index ?? 0));
                        if (blockTopics.length === 0) return null;
                        return (
                          <optgroup key={b.id} label={`Bloque ${b.order_index}: ${b.title}`}>
                            {blockTopics.map(t => (
                              <option key={t.id} value={t.id}>
                                Tema {t.order_index}: {t.title}
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                      {topics.some(t => !t.block_id) && (
                        <optgroup label="Temas Generales (Sin Bloque)">
                          {topics.filter(t => !t.block_id).sort((x, y) => (x.order_index ?? 0) - (y.order_index ?? 0)).map(t => (
                            <option key={t.id} value={t.id}>
                              Tema {t.order_index}: {t.title}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>

                    {editQuestionTopicId && (() => {
                      const matchedTopic = topics.find(t => t.id === editQuestionTopicId);
                      if (!matchedTopic?.subtopics || matchedTopic.subtopics.length <= 1) return null;
                      return (
                        <div className="mt-2 p-2.5 bg-amber-50/80 rounded-xl border border-amber-300">
                          <label className="block text-[10px] font-extrabold uppercase text-amber-900 mb-1 flex items-center gap-1">
                            <Zap className="w-3 h-3 text-amber-600 fill-amber-500" />
                            Subapartado Especial / Sección
                          </label>
                          <select
                            value={editQuestionSubtopicId}
                            onChange={(e) => setEditQuestionSubtopicId(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-xs font-bold text-amber-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                          >
                            {matchedTopic.subtopics.map((st: any) => {
                              const isGen = st.title?.toLowerCase() === 'general';
                              return (
                                <option key={st.id} value={st.id}>
                                  {isGen ? 'General (Sin subsección específica)' : `⚡ ${st.title}`}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Enunciado de la Pregunta */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>Enunciado de la Pregunta:</span>
                      <span className="text-[11px] font-normal text-slate-400">Texto principal de la pregunta</span>
                    </label>
                    <textarea
                      rows={3}
                      value={editQuestionText}
                      onChange={(e) => setEditQuestionText(e.target.value)}
                      placeholder="Escribe el enunciado de la pregunta..."
                      className="w-full p-3.5 rounded-2xl bg-white border border-slate-300 text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs leading-relaxed"
                    />
                  </div>

                  {/* Opciones de Respuesta */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <span>Opciones de Respuesta:</span>
                        <span className="text-[11px] font-medium text-slate-500">
                          (Haz clic en &ldquo;Marcar correcta&rdquo; o en la letra para fijar la correcta)
                        </span>
                      </label>
                      {editOptions.length < 5 && (
                        <button
                          type="button"
                          onClick={handleAddOption}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer hover:underline"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Añadir opción</span>
                        </button>
                      )}
                    </div>

                    <div className="space-y-2.5">
                      {editOptions.map((opt, oIdx) => {
                        const isCorr = editCorrectOption === oIdx;
                        const letter = ['A', 'B', 'C', 'D', 'E'][oIdx] || `${oIdx + 1}`;
                        return (
                          <div
                            key={oIdx}
                            className={`flex items-center gap-2.5 p-2 rounded-2xl border transition-all ${
                              isCorr
                                ? 'bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-500/20'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setEditCorrectOption(oIdx)}
                              className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs transition-all shrink-0 cursor-pointer ${
                                isCorr
                                  ? 'bg-emerald-600 text-white shadow-xs scale-105'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              }`}
                              title="Haz clic para marcar esta opción como correcta"
                            >
                              {isCorr ? <Check className="w-4 h-4 stroke-[3]" /> : letter}
                            </button>

                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => handleOptionChange(oIdx, e.target.value)}
                              placeholder={`Texto de la opción ${letter}...`}
                              className="flex-1 bg-transparent border-0 px-2 text-xs sm:text-sm text-slate-900 focus:outline-none font-medium"
                            />

                            {isCorr ? (
                              <span className="text-[10px] font-black text-emerald-700 px-2.5 py-1 rounded-full bg-emerald-100 border border-emerald-300 shrink-0 uppercase tracking-wide">
                                Correcta
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setEditCorrectOption(oIdx)}
                                className="text-[10px] font-bold text-slate-400 hover:text-emerald-600 px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors shrink-0 cursor-pointer"
                              >
                                Marcar correcta
                              </button>
                            )}

                            {editOptions.length > 2 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveOption(oIdx)}
                                className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Eliminar opción"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Fundamento Legal / Explicación del fallo */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Fundamento Legal / Explicación del fallo:</span>
                    </label>
                    <textarea
                      rows={3}
                      value={editQuestionExplanation}
                      onChange={(e) => setEditQuestionExplanation(e.target.value)}
                      placeholder="Art. de ley, Constitución, ordenanza municipal o explicación técnica..."
                      className="w-full p-3.5 rounded-2xl bg-white border border-slate-300 text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs leading-relaxed"
                    />
                  </div>

                  {/* Barra de botones de acción del editor */}
                  <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-slate-200 flex-wrap">
                    <button
                      type="button"
                      disabled={isSavingQuestion || isDeletingQuestion}
                      onClick={handleDeleteCurrentQuestion}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 hover:text-rose-800 border border-rose-200 hover:border-rose-300 transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-2xs"
                      title="Eliminar permanentemente esta pregunta de la base de datos y la plataforma"
                    >
                      {isDeletingQuestion ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                          <span>Eliminando de BD...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>Eliminar Pregunta</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        disabled={isSavingQuestion || isDeletingQuestion}
                        onClick={() => setIsEditingQuestion(false)}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>

                      <button
                        type="button"
                        disabled={isSavingQuestion || isDeletingQuestion}
                        onClick={handleSaveFullQuestion}
                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center gap-2 active:scale-95"
                      >
                        {isSavingQuestion ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Guardando en BD...</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            <span>Guardar Pregunta y Fundamento</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* VISTA NORMAL DE LA PREGUNTA TIPO TEST */
                <>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-relaxed">
                    {currentQuestion.question_text}
                  </h2>

                  <div className="space-y-3">
                    {currentQuestion.options.map((optText: string, optIdx: number) => {
                      const isCorrect = currentQuestion.correct_option === optIdx;
                      const isUserSelection = selectedOption === optIdx;

                      let cardStyle = 'bg-white border-slate-200 text-slate-700 hover:border-slate-300';

                      if (answered) {
                        if (isCorrect) {
                          cardStyle = 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold';
                        } else if (isUserSelection && !isCorrect) {
                          cardStyle = 'bg-rose-50 border-rose-400 text-rose-950 font-bold';
                        } else {
                          cardStyle = 'bg-slate-50 border-slate-200 text-slate-400 opacity-60';
                        }
                      }

                      return (
                        <button
                          key={optIdx}
                          disabled={answered}
                          onClick={() => handleChooseOption(optIdx)}
                          className={`w-full p-3.5 sm:p-4 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer ${cardStyle}`}
                        >
                          <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {['A', 'B', 'C', 'D'][optIdx]}
                          </span>
                          <span className="text-xs sm:text-sm font-semibold mt-0.5 leading-relaxed flex-1">
                            {optText}
                          </span>
                          {answered && isCorrect && (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                          )}
                          {answered && isUserSelection && !isCorrect && (
                            <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {!isEditingQuestion && (answered || (isAdmin && isEditingExplanation)) && (
                <div className="space-y-6 pt-4 border-t border-slate-100 animate-in fade-in duration-200">
                  <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50/80 border border-indigo-200 text-xs text-slate-800 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-bold text-indigo-700 flex items-center gap-1.5 text-sm">
                        <BookOpen className="w-4 h-4" />
                        Fundamento Legal / Explicación del fallo:
                      </span>
                      {isAdmin && !isEditingExplanation && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingExplanationText(currentQuestion.explanation || '');
                              setIsEditingExplanation(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-indigo-700 bg-white hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer shadow-2xs active:scale-95"
                            title="Editar fundamento legal como administrador"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                            <span>{currentQuestion.explanation ? 'Editar Fundamento' : 'Añadir Fundamento'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleStartEditQuestion}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors cursor-pointer shadow-2xs active:scale-95"
                            title="Editar la pregunta completa tipo test (enunciado, opciones y solución)"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-purple-600" />
                            <span>Editar Pregunta Completa</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {isEditingExplanation && isAdmin ? (
                      <div className="space-y-2.5 pt-1 animate-in fade-in">
                        <textarea
                          rows={4}
                          value={editingExplanationText}
                          onChange={(e) => setEditingExplanationText(e.target.value)}
                          placeholder="Escribe aquí el fundamento legal (artículo de ley, ordenanza, constitución o criterio del tribunal)..."
                          className="w-full text-xs sm:text-sm p-3.5 bg-white border border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl text-slate-900 placeholder-slate-400 resize-y font-medium leading-relaxed shadow-inner focus:outline-none"
                          autoFocus
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={isSavingExplanation}
                            onClick={() => setIsEditingExplanation(false)}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            disabled={isSavingExplanation}
                            onClick={handleSaveExplanation}
                            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-xs transition-all cursor-pointer active:scale-95"
                          >
                            {isSavingExplanation ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Guardando...</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Guardar Fundamento</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="leading-relaxed text-slate-700 text-xs sm:text-sm whitespace-pre-line">
                        {currentQuestion.explanation || (
                          <span className="italic text-slate-400">Sin fundamento legal registrado todavía.</span>
                        )}
                      </p>
                    )}
                  </div>

                  {answered && (
                    <div className="space-y-3 pt-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-center sm:text-left">
                      <div className="flex items-center justify-center sm:justify-start gap-1.5">
                        <Clock className="w-4 h-4 text-purple-600" />
                        <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                          ¿Cuándo deseas volver a repasar esta pregunta?
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium">
                        No saldrá en Modo Anki hasta cumplir los días seleccionados
                      </span>
                    </div>

                    <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5">
                      {ANKI_INTERVALS.map((opt) => (
                        <button
                          key={opt.days}
                          type="button"
                          onClick={() => handleScheduleInterval(opt.days)}
                          className={`py-3 px-1 sm:px-2 rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center text-center shadow-2xs hover:shadow-sm transform active:scale-95 ${opt.buttonClass}`}
                          title={`Programar próximo repaso para dentro de ${opt.days} días`}
                        >
                          <span className="text-base sm:text-lg font-black tracking-tight">
                            {opt.label}
                          </span>
                          <span className="text-[10px] font-semibold opacity-80 mt-0.5 line-clamp-1">
                            {opt.sublabel}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* FASE 3: SESIÓN COMPLETADA                                 */}
        {/* ========================================================= */}
        {phase === 'complete' && (
          <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-10 shadow-sm max-w-lg mx-auto text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center mx-auto shadow-sm shadow-emerald-500/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-2xl font-black text-slate-900">
                ¡Sesión Anki Completada!
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Todas las preguntas de esta ronda han sido programadas y guardadas en tu ecosistema de repetición espaciada.
              </p>
            </div>

            {/* Desglose por intervalos programados */}
            <div className="space-y-2 text-left bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                Programación de esta sesión:
              </span>
              <div className="grid grid-cols-5 gap-1 text-center">
                {ANKI_INTERVALS.map(opt => (
                  <div key={opt.days} className="p-2 rounded-xl bg-white border border-slate-200">
                    <span className="text-xs font-bold text-slate-900 block">{opt.label}</span>
                    <span className="text-sm font-black text-purple-700 block mt-0.5">
                      {sessionStats.intervalCounts[opt.days] || 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={() => setPhase('setup')}
                className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Configurar otra sesión Anki
              </button>
              <button
                type="button"
                disabled={isLoadingClassification}
                onClick={handleOpenClassification}
                className="w-full py-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                {isLoadingClassification ? (
                  <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                ) : (
                  <BarChart3 className="w-4 h-4" />
                )}
                <span>Ver Ecosistema de Clasificación y Repasos</span>
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs cursor-pointer transition-colors"
              >
                Volver al Panel Principal
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL / DRAWER DEL ECOSISTEMA DE CLASIFICACIÓN ANKI       */}
        {/* ========================================================= */}
        {showClassificationModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
              {/* Encabezado del modal */}
              <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-purple-600 text-white shadow-sm shadow-purple-500/20">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Ecosistema de Clasificación Anki
                    </h2>
                    <p className="text-xs text-slate-500">
                      Progreso de <strong>{profile?.full_name || profile?.email}</strong> ·{' '}
                      <span className="font-semibold text-purple-700">
                        {allLoadedItems.filter(i => !!reviewsMap[getAnkiItemKey(i._origin, i.id)]).length} preguntas clasificadas
                      </span>{' '}
                      en tu memoria a largo plazo.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowClassificationModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Barra de pestañas por intervalo (Clasificadas, 1d, 3d, 10d, 20d, 30d, nuevas, todas) */}
              <div className="p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
                  {/* Pestaña: Clasificadas en Anki */}
                  <button
                    type="button"
                    onClick={() => setSelectedIntervalTab('classified')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                      selectedIntervalTab === 'classified'
                        ? 'bg-purple-600 text-white shadow-2xs'
                        : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200/60'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Clasificadas</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      selectedIntervalTab === 'classified' ? 'bg-white/20' : 'bg-purple-200/70 text-purple-900'
                    }`}>
                      {allLoadedItems.filter(i => !!reviewsMap[getAnkiItemKey(i._origin, i.id)]).length}
                    </span>
                  </button>

                  {/* Intervalos Anki individuales */}
                  {ANKI_INTERVALS.map(opt => {
                    const count = allLoadedItems.filter(i => {
                      const key = getAnkiItemKey(i._origin, i.id);
                      return reviewsMap[key]?.interval_days === opt.days;
                    }).length;

                    return (
                      <button
                        key={opt.days}
                        type="button"
                        onClick={() => setSelectedIntervalTab(opt.days)}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                          selectedIntervalTab === opt.days
                            ? 'bg-purple-600 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <span>{opt.label}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                          selectedIntervalTab === opt.days ? 'bg-white/20' : 'bg-slate-200/80 text-slate-700'
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}

                  {/* Pestaña: Nuevas sin clasificar */}
                  <button
                    type="button"
                    onClick={() => setSelectedIntervalTab('new')}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                      selectedIntervalTab === 'new'
                        ? 'bg-purple-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>Nuevas</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      selectedIntervalTab === 'new' ? 'bg-white/20' : 'bg-slate-200/80 text-slate-700'
                    }`}>
                      {allLoadedItems.filter(i => !reviewsMap[getAnkiItemKey(i._origin, i.id)]).length}
                    </span>
                  </button>

                  {/* Pestaña: Todas en la plataforma */}
                  <button
                    type="button"
                    onClick={() => setSelectedIntervalTab('all')}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                      selectedIntervalTab === 'all'
                        ? 'bg-purple-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>Todas</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      selectedIntervalTab === 'all' ? 'bg-white/20' : 'bg-slate-200/80 text-slate-700'
                    }`}>
                      {allLoadedItems.length}
                    </span>
                  </button>
                </div>

                <div className="relative w-full sm:w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar preguntas..."
                    value={classificationSearch}
                    onChange={(e) => setClassificationSearch(e.target.value)}
                    className="w-full pl-8.5 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Listado de tarjetas clasificadas */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 bg-slate-50/50">
                {classifiedItems.length === 0 ? (
                  <div className="p-12 text-center text-xs text-slate-500 space-y-2">
                    <BarChart3 className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="font-bold text-sm text-slate-700">
                      {selectedIntervalTab === 'classified'
                        ? 'Aún no tienes preguntas clasificadas en tu ecosistema Anki.'
                        : selectedIntervalTab === 'new'
                        ? '¡Has clasificado todas las preguntas del sistema!'
                        : selectedIntervalTab === 'all'
                        ? 'No se encontraron preguntas en la base de datos.'
                        : `No hay preguntas programadas en el intervalo de ${selectedIntervalTab} días.`}
                    </p>
                    <p className="text-slate-400 max-w-sm mx-auto">
                      {selectedIntervalTab === 'classified'
                        ? 'Cuando hagas una sesión en Modo Anki y selecciones los días de repaso (1, 3, 10, 20 o 30 días), tus preguntas aparecerán aquí guardadas.'
                        : 'Puedes cambiar de pestaña arriba o buscar con otros términos.'}
                    </p>
                  </div>
                ) : (
                  classifiedItems.map(item => {
                    const key = getAnkiItemKey(item._origin, item.id);
                    const rev = reviewsMap[key];
                    const timing = formatReviewTiming(rev);

                    return (
                      <div
                        key={key}
                        className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-purple-200 transition-colors"
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 border border-purple-200 text-purple-700">
                              {item._origin === 'official_question' ? 'Examen Oficial' : 'Banco de Temario'}
                            </span>
                            {item._sourceLabel && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 truncate max-w-xs">
                                {item._sourceLabel}
                              </span>
                            )}
                            {rev ? (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                ANKI_INTERVALS.find(o => o.days === rev.interval_days)?.badgeClass || 'bg-slate-100 text-slate-700'
                              }`}>
                                Intervalo: {rev.interval_days} {rev.interval_days === 1 ? 'día' : 'días'}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">
                                Sin repasar aún
                              </span>
                            )}
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              timing.isDue ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {timing.text}
                            </span>
                          </div>

                          <p className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                            {item.question_text}
                          </p>

                          {item.explanation && (
                            <p className="text-[11px] text-slate-500 line-clamp-2 italic bg-slate-50 p-2 rounded-xl border border-slate-100">
                              💡 {item.explanation}
                            </p>
                          )}
                        </div>

                        {/* Acciones directas sobre la pregunta */}
                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0 flex-wrap justify-end">
                          {/* Selector rápido de intervalo directo */}
                          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                            <span className="text-[9px] font-bold text-slate-400 px-1">Mover a:</span>
                            {ANKI_INTERVALS.map(intv => (
                              <button
                                key={intv.days}
                                type="button"
                                onClick={async () => {
                                  const newRev = await saveAnkiReview(
                                    supabase,
                                    profile!.id,
                                    item._origin,
                                    item.id,
                                    intv.days,
                                    rev?.last_result || 'correct'
                                  );
                                  setReviewsMap(prev => ({ ...prev, [key]: newRev }));
                                }}
                                className={`px-1.5 py-0.5 rounded-lg text-[9px] font-extrabold transition-all cursor-pointer ${
                                  rev?.interval_days === intv.days
                                    ? 'bg-purple-600 text-white shadow-2xs'
                                    : 'hover:bg-purple-100 text-slate-600'
                                }`}
                                title={`Mover a intervalo de ${intv.label}`}
                              >
                                {intv.days}d
                              </button>
                            ))}
                          </div>

                          {rev && (
                            <button
                              type="button"
                              onClick={async () => {
                                if (!confirm('¿Deseas reiniciar la programación de esta pregunta a nueva?')) return;
                                await resetAnkiReview(supabase, profile!.id, item._origin, item.id);
                                setReviewsMap(prev => {
                                  const next = { ...prev };
                                  delete next[key];
                                  return next;
                                });
                              }}
                              className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                              title="Reiniciar intervalo a nueva"
                            >
                              Reiniciar
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Pie del modal */}
              <div className="p-4 border-t border-slate-200 bg-white flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowClassificationModal(false)}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal para Impugnar Pregunta */}
        <QuestionChallengeModal
          isOpen={showChallengeModal}
          onClose={() => setShowChallengeModal(false)}
          question={currentQuestion}
          user={profile}
          onSuccess={() => {
            setSchedulingToast({
              days: 0,
              text: 'Impugnación registrada. La pregunta continúa en tu sesión de estudio y se ha enviado un aviso para su revisión docente.'
            });
            setTimeout(() => setSchedulingToast(null), 6000);
          }}
        />
      </main>
    </div>
  );
}
