'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Sidebar } from '@/components/Sidebar';
import { Profile, Topic, Flashcard, Block, AnkiInterval, AnkiReview } from '@/lib/types';
import { 
  Sparkles, 
  RotateCcw, 
  CheckCircle2, 
  Zap,
  Eye,
  Layers,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Boxes,
  Clock,
  Calendar,
  CalendarDays,
  Check,
  BarChart3,
  ArrowRight,
  ArrowLeft,
  Search,
  X,
  Lightbulb,
  Shuffle,
  Flame,
  CornerDownLeft,
  ListOrdered,
  Edit3,
  Save,
  Loader2,
  Flag,
  Tag,
  Trash2,
  BookOpen,
  Home
} from 'lucide-react';
import confetti from 'canvas-confetti';
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
import { QuestionChallengeModal } from '@/components/QuestionChallengeModal';
import { getFlashcardCountsSummary, invalidateFlashcardCountsCache } from '@/lib/supabaseHelper';

export default function FlashcardsStudyPage() {
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [flashcardCountsByTopic, setFlashcardCountsByTopic] = useState<Record<string, number>>({});
  const [flashcardCountsBySubtopic, setFlashcardCountsBySubtopic] = useState<Record<string, number>>({});

  const getTopicFlashcardsCount = (topic: Topic): number => {
    if (flashcardCountsByTopic[topic.id] !== undefined) {
      return flashcardCountsByTopic[topic.id];
    }
    if (topic.subtopics && topic.subtopics.length > 0) {
      return topic.subtopics.reduce((acc: number, st: any) => {
        return acc + (flashcardCountsBySubtopic[st.id] || 0);
      }, 0);
    }
    return 0;
  };

  const getBlockFlashcardsCount = (bTopics: Topic[]): number => {
    return bTopics.reduce((acc: number, t: Topic) => acc + getTopicFlashcardsCount(t), 0);
  };

  const [phase, setPhase] = useState<'setup' | 'session' | 'complete'>('setup');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({});

  // Ecosistema Anki y orden de estudio
  const [reviewsMap, setReviewsMap] = useState<Record<string, AnkiReview>>({});
  const [ankiFilterMode, setAnkiFilterMode] = useState<AnkiSessionMode>('balanced');
  const [orderMode, setOrderMode] = useState<'sequential' | 'random'>('sequential');
  const [showClassificationModal, setShowClassificationModal] = useState(false);
  const [classificationSearch, setClassificationSearch] = useState('');
  const [selectedIntervalTab, setSelectedIntervalTab] = useState<AnkiInterval | 'all' | 'new'>('all');
  const [allLoadedCards, setAllLoadedCards] = useState<Flashcard[]>([]);

  const sortCardsSequential = (list: Flashcard[]) => {
    return [...list].sort((a, b) => {
      const topA = a.subtopics?.topics?.order_index ?? 0;
      const topB = b.subtopics?.topics?.order_index ?? 0;
      if (topA !== topB) return topA - topB;
      return (a.order_index ?? 999999) - (b.order_index ?? 999999);
    });
  };

  const [sessionCards, setSessionCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentCard = sessionCards[currentIndex] || null;
  const [isFlipped, setIsFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [totalInSession, setTotalInSession] = useState(0);
  const [streak, setStreak] = useState(0);
  const [difficultCards, setDifficultCards] = useState<Flashcard[]>([]);
  const [schedulingToast, setSchedulingToast] = useState<{ days: number; text: string } | null>(null);

  const [sessionStats, setSessionStats] = useState({
    cardsCompleted: 0,
    intervalCounts: { 1: 0, 3: 0, 10: 0, 20: 0, 30: 0 } as Record<AnkiInterval, number>,
  });

  const isAdmin = profile?.role === 'admin';

  // Edición en vivo de Flashcards para Administradores y Modal de Impugnación
  const [isEditingCard, setIsEditingCard] = useState(false);
  const [editFrontText, setEditFrontText] = useState('');
  const [editBackText, setEditBackText] = useState('');
  const [editHint, setEditHint] = useState('');
  const [editOrderIndex, setEditOrderIndex] = useState('');
  const [editTopicId, setEditTopicId] = useState('');
  const [isSavingCard, setIsSavingCard] = useState(false);
  const [isDeletingCard, setIsDeletingCard] = useState(false);
  const [showChallengeModal, setShowChallengeModal] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (prof?.status !== 'approved' && prof?.role !== 'admin') {
        router.push('/pending');
        return;
      }
      setProfile(prof);

      // Cargar en paralelo Bloques, Temas, Reviews de Anki y Conteos de Flashcards para máxima velocidad
      const [
        { data: blocksData },
        { data: topicsData },
        revs,
        fcSummary
      ] = await Promise.all([
        supabase.from('blocks').select('*').order('order_index'),
        supabase.from('topics').select('*, subtopics(*)').order('order_index'),
        loadAnkiReviews(supabase, user.id),
        getFlashcardCountsSummary(supabase),
      ]);

      if (blocksData) {
        setBlocks(blocksData);
        const expBlocksMap: Record<string, boolean> = { unassigned: false };
        blocksData.forEach(b => { expBlocksMap[b.id] = false; });
        setExpandedBlocks(expBlocksMap);
      }

      if (topicsData) {
        setTopics(topicsData);
        setSelectedTopics([]);
      }

      if (revs) {
        setReviewsMap(revs);
      }

      if (fcSummary) {
        setFlashcardCountsByTopic(fcSummary.countsByTopic || {});
        setFlashcardCountsBySubtopic(fcSummary.countsBySubtopic || {});
      }
    }
    init();
  }, []);

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

  const toggleTopic = (topicId: string) => {
    setSelectedTopics(prev =>
      prev.includes(topicId) ? prev.filter(id => id !== topicId) : [...prev, topicId]
    );
  };

  const hasAnySelected = selectedTopics.length > 0;
  const toggleSelectAll = () => {
    if (hasAnySelected) {
      setSelectedTopics([]);
    } else {
      setSelectedTopics(topics.map(t => t.id));
    }
  };

  const fetchAllMatchingCards = async () => {
    const matchingSubtopicIds = topics
      .filter(t => selectedTopics.includes(t.id))
      .flatMap(t => t.subtopics?.map((st: any) => st.id) || []);

    let cardList: any[] = [];
    if (matchingSubtopicIds.length > 0) {
      const { data: bySub } = await supabase
        .from('flashcards')
        .select('*, subtopics(id, title, topic_id, topics(id, title, order_index, block_id))')
        .in('subtopic_id', matchingSubtopicIds);
      if (bySub) cardList.push(...bySub);
    }

    // Flashcards libres
    const { data: generalFc } = await supabase
      .from('flashcards')
      .select('*, subtopics(id, title, topic_id, topics(id, title, order_index, block_id))')
      .is('subtopic_id', null);
    if (generalFc) cardList.push(...generalFc);

    const uniqueCards = Array.from(new Map(cardList.map(c => [c.id, c])).values());
    uniqueCards.sort((a, b) => (a.order_index ?? 999999) - (b.order_index ?? 999999));
    setAllLoadedCards(uniqueCards);
    return uniqueCards;
  };

  const handleOpenClassification = async () => {
    await fetchAllMatchingCards();
    setShowClassificationModal(true);
  };

  const classifiedCards = useMemo(() => {
    return allLoadedCards.filter(card => {
      const key = getAnkiItemKey('flashcard', card.id);
      const rev = reviewsMap[key];

      if (selectedIntervalTab === 'new') {
        if (rev) return false;
      } else if (selectedIntervalTab !== 'all') {
        if (!rev || rev.interval_days !== selectedIntervalTab) return false;
      }

      if (classificationSearch.trim()) {
        const s = classificationSearch.toLowerCase();
        const front = (card.front_text || '').toLowerCase();
        const back = (card.back_text || '').toLowerCase();
        const hint = (card.hint || '').toLowerCase();
        return front.includes(s) || back.includes(s) || hint.includes(s);
      }

      return true;
    });
  }, [allLoadedCards, reviewsMap, selectedIntervalTab, classificationSearch]);

  const startSession = async () => {
    if (selectedTopics.length === 0) {
      alert('Debes seleccionar al menos un bloque o tema para repasar.');
      return;
    }

    const uniqueCards = await fetchAllMatchingCards();

    if (uniqueCards.length === 0) {
      alert('No hay flashcards registradas para los temas seleccionados.');
      return;
    }

    // Construir la cola de estudio con el algoritmo Anki anti-bucle y persistencia de atrasadas
    const { queue: preparedQueue, breakdown } = buildBalancedAnkiQueue(
      uniqueCards,
      c => getAnkiItemKey('flashcard', c.id),
      reviewsMap,
      { mode: ankiFilterMode, orderPreference: orderMode }
    );

    if (preparedQueue.length === 0) {
      if (ankiFilterMode === 'due_only') {
        alert(
          '🎉 ¡Al día! No tienes flashcards pendientes para repasar hoy en los temas seleccionados.\n\nPuedes elegir "⚡ Modo Equilibrado" o "🌱 Solo Contenido Nuevo" para seguir avanzando.'
        );
      } else if (ankiFilterMode === 'new_only') {
        alert(
          '🎉 ¡Has visto todas las flashcards de los temas seleccionados al menos una vez!\n\nPuedes elegir "⚡ Modo Equilibrado" o "⏰ Solo Repasos del día" para afianzar tus conocimientos.'
        );
      } else {
        alert(
          '🎉 ¡Excelente! Todas las flashcards de estos temas ya han sido repasadas y están programadas a futuro. Ninguna toca repasar hoy.\n\nPuedes cambiar el modo a "Modo Libre / Intensivo" si deseas forzar un repaso ahora.'
        );
      }
      return;
    }

    // Si el usuario eligió orden correlativo, ordenar las tarjetas del grupo según esa secuencia
    let finalQueue = preparedQueue;
    if (orderMode === 'sequential' && (ankiFilterMode === 'due_only' || ankiFilterMode === 'new_only' || ankiFilterMode === 'all')) {
      finalQueue = sortCardsSequential(preparedQueue);
    }

    setSessionCards(finalQueue);
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowHint(false);
    setIsEditingCard(false);
    setSchedulingToast(null);
    setTotalInSession(preparedQueue.length);
    setStreak(0);
    setDifficultCards([]);
    setSessionStats({
      cardsCompleted: 0,
      intervalCounts: { 1: 0, 3: 0, 10: 0, 20: 0, 30: 0 },
    });
    setPhase('session');
  };

  // INICIAR EDICIÓN EN VIVO (SOLO ADMINISTRADOR)
  const handleStartEditCard = () => {
    if (!currentCard) return;
    setEditFrontText(currentCard.front_text || '');
    setEditBackText(currentCard.back_text || '');
    setEditHint(currentCard.hint || '');
    setEditOrderIndex(currentCard.order_index != null ? String(currentCard.order_index) : '');

    const currentTopicId = currentCard.subtopics?.topics?.id 
      || currentCard.subtopics?.topic_id 
      || (topics.find(t => t.subtopics?.some((s: any) => s.id === currentCard.subtopic_id))?.id || '');
    setEditTopicId(currentTopicId);

    setIsEditingCard(true);
  };

  // GUARDAR CAMBIOS DE FLASHCARD EN SUPABASE (SOLO ADMINISTRADOR)
  const handleSaveCard = async () => {
    if (!currentCard || !isAdmin) {
      alert('Solo el administrador tiene permisos para editar flashcards.');
      return;
    }

    if (!editFrontText.trim()) {
      alert('El texto del anverso (pregunta/concepto) no puede estar vacío.');
      return;
    }
    if (!editBackText.trim()) {
      alert('El texto del reverso (respuesta/explicación) no puede estar vacío.');
      return;
    }

    setIsSavingCard(true);
    try {
      const updatePayload: any = {
        front_text: editFrontText.trim(),
        back_text: editBackText.trim(),
        hint: editHint.trim() ? editHint.trim() : null,
        order_index: editOrderIndex.trim() !== '' ? parseInt(editOrderIndex.trim(), 10) : null,
      };

      let updatedSubtopicData: any = currentCard.subtopics;

      if (editTopicId) {
        const currentTopicId = currentCard.subtopics?.topics?.id 
          || currentCard.subtopics?.topic_id 
          || (topics.find(t => t.subtopics?.some((s: any) => s.id === currentCard.subtopic_id))?.id || '');

        if (editTopicId !== currentTopicId) {
          const newSubtopicId = await resolveTopicSubtopicId(editTopicId, topics, supabase);
          if (newSubtopicId) {
            updatePayload.subtopic_id = newSubtopicId;
            const targetTopic = topics.find(t => t.id === editTopicId);
            updatedSubtopicData = {
              id: newSubtopicId,
              title: 'General',
              topic_id: editTopicId,
              topics: targetTopic ? {
                id: targetTopic.id,
                title: targetTopic.title,
                order_index: targetTopic.order_index,
                block_id: targetTopic.block_id,
              } : undefined
            };
          }
        }
      }

      const { data, error } = await supabase
        .from('flashcards')
        .update(updatePayload)
        .eq('id', currentCard.id)
        .select();

      if (error) {
        console.error('Error al actualizar flashcard:', error);
        throw error;
      }
      if (!data || data.length === 0) {
        throw new Error('No se pudo actualizar en la base de datos. Verifica tus permisos de administrador.');
      }

      const updatedCard: Flashcard = {
        ...currentCard,
        ...updatePayload,
        subtopics: updatedSubtopicData || currentCard.subtopics,
      };

      setSessionCards(prev => prev.map((c, idx) => (idx === currentIndex ? updatedCard : c)));
      setAllLoadedCards(prev => prev.map(c => (c.id === currentCard.id ? updatedCard : c)));

      invalidateFlashcardCountsCache();
      getFlashcardCountsSummary(supabase, true).then(summary => {
        if (summary) {
          setFlashcardCountsByTopic(summary.countsByTopic || {});
          setFlashcardCountsBySubtopic(summary.countsBySubtopic || {});
        }
      }).catch(console.error);

      setIsEditingCard(false);
      setSchedulingToast({
        days: 0,
        text: '✅ ¡Flashcard actualizada con éxito en la base de datos!',
      });
      setTimeout(() => setSchedulingToast(null), 3500);
    } catch (err: any) {
      console.error('Error al guardar la flashcard:', err);
      alert('Error al guardar la flashcard: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsSavingCard(false);
    }
  };

  // Eliminar flashcard permanentemente de la base de datos y la plataforma (Solo Administrador)
  const handleDeleteCurrentCard = async () => {
    if (!currentCard || !isAdmin) {
      alert('Solo el administrador tiene permisos para eliminar flashcards.');
      return;
    }

    const confirmed = confirm(
      '⚠️ ¿Estás seguro de que deseas ELIMINAR PERMANENTEMENTE esta flashcard de la base de datos y de la plataforma?\n\nEsta acción no se puede deshacer y borrará también su historial de repasos.'
    );
    if (!confirmed) return;

    setIsDeletingCard(true);
    try {
      const cId = currentCard.id;

      // 1. Eliminar reviews de Anki asociadas a esta flashcard
      await supabase
        .from('anki_reviews')
        .delete()
        .match({ item_type: 'flashcard', item_id: cId });

      if (profile?.id) {
        resetAnkiReview(supabase, profile.id, 'flashcard', cId);
      }

      // 2. Eliminar impugnaciones asociadas si existieran
      try {
        await supabase
          .from('question_challenges')
          .delete()
          .match({ question_id: cId, question_origin: 'flashcard' });
      } catch (_) {}

      // 3. Eliminar de la tabla flashcards
      const { error } = await supabase
        .from('flashcards')
        .delete()
        .eq('id', cId);

      if (error) {
        console.error('Error al eliminar flashcard:', error);
        throw error;
      }

      // 4. Actualizar contadores y caches
      invalidateFlashcardCountsCache();
      getFlashcardCountsSummary(supabase, true).then(summary => {
        if (summary) {
          setFlashcardCountsByTopic(summary.countsByTopic || {});
          setFlashcardCountsBySubtopic(summary.countsBySubtopic || {});
        }
      }).catch(console.error);

      // 5. Actualizar colas y memoria
      setAllLoadedCards(prev => prev.filter(c => c.id !== cId));
      const remainingCards = sessionCards.filter(c => c.id !== cId);

      setIsEditingCard(false);
      setSchedulingToast({
        days: 0,
        text: '🗑️ Flashcard eliminada permanentemente de la plataforma.',
      });
      setTimeout(() => setSchedulingToast(null), 3500);

      if (remainingCards.length > 0) {
        setSessionCards(remainingCards);
        if (currentIndex >= remainingCards.length) {
          setCurrentIndex(remainingCards.length - 1);
        }
        setIsFlipped(false);
        setShowHint(false);
      } else {
        setSessionCards([]);
        setPhase('complete');
      }
    } catch (err: any) {
      console.error('Error al eliminar la flashcard:', err);
      alert('Error al eliminar la flashcard: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsDeletingCard(false);
    }
  };

  // NAVEGACIÓN ENTRE TARJETAS (ANTERIOR / SIGUIENTE / SALTAR)
  const handlePrevCard = () => {
    setIsEditingCard(false);
    setCurrentIndex(curr => {
      if (curr > 0) {
        setIsFlipped(false);
        setShowHint(false);
        setSchedulingToast(null);
        return curr - 1;
      }
      return curr;
    });
  };

  const handleNextCard = () => {
    setIsEditingCard(false);
    setCurrentIndex(curr => {
      if (curr < sessionCards.length - 1) {
        setIsFlipped(false);
        setShowHint(false);
        setSchedulingToast(null);
        return curr + 1;
      }
      return curr;
    });
  };

  // PROGRAMAR INTERVALO DE FLASHCARD EN ANKI (1, 3, 10, 20, 30 DÍAS)
  const handleScheduleInterval = async (days: AnkiInterval) => {
    if (!currentCard || !profile) return;

    if (days <= 3) {
      setDifficultCards(prev => prev.some(c => c.id === currentCard.id) ? prev : [...prev, currentCard]);
      setStreak(0);
    } else {
      setStreak(prev => prev + 1);
    }

    // Guardar en Supabase + localStorage
    const review = await saveAnkiReview(
      supabase,
      profile.id,
      'flashcard',
      currentCard.id,
      days,
      'revealed'
    );

    const key = getAnkiItemKey('flashcard', currentCard.id);
    setReviewsMap(prev => ({ ...prev, [key]: review }));

    setSchedulingToast({
      days,
      text: `Flashcard programada para dentro de ${days} ${days === 1 ? 'día' : 'días'}. ¡No volverá a salir hasta entonces!`,
    });

    setSessionStats(prev => ({
      cardsCompleted: prev.cardsCompleted + 1,
      intervalCounts: {
        ...prev.intervalCounts,
        [days]: (prev.intervalCounts[days] || 0) + 1,
      },
    }));

    setTimeout(() => {
      setSchedulingToast(null);
      setCurrentIndex(curr => {
        if (curr < sessionCards.length - 1) {
          setIsFlipped(false);
          setShowHint(false);
          return curr + 1;
        } else {
          setPhase('complete');
          confetti({ particleCount: 100, spread: 80 });
          return curr;
        }
      });
    }, 450);
  };

  const handleShuffleRemaining = () => {
    const pastAndCurrent = sessionCards.slice(0, currentIndex + 1);
    const remaining = sessionCards.slice(currentIndex + 1);
    if (remaining.length <= 1) return;
    const shuffled = [...remaining].sort(() => 0.5 - Math.random());
    setSessionCards([...pastAndCurrent, ...shuffled]);
    setOrderMode('random');
  };

  const toggleSessionOrder = () => {
    const pastAndCurrent = sessionCards.slice(0, currentIndex + 1);
    const remaining = sessionCards.slice(currentIndex + 1);
    if (remaining.length === 0) return;

    if (orderMode === 'sequential') {
      const shuffled = [...remaining].sort(() => 0.5 - Math.random());
      setSessionCards([...pastAndCurrent, ...shuffled]);
      setOrderMode('random');
    } else {
      const sorted = sortCardsSequential(remaining);
      setSessionCards([...pastAndCurrent, ...sorted]);
      setOrderMode('sequential');
    }
  };

  const restartDifficultCards = () => {
    if (difficultCards.length === 0) return;
    let prepared = [...difficultCards];
    if (orderMode === 'random') {
      prepared = prepared.sort(() => 0.5 - Math.random());
    } else {
      prepared = sortCardsSequential(prepared);
    }
    setSessionCards(prepared);
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowHint(false);
    setTotalInSession(prepared.length);
    setStreak(0);
    setDifficultCards([]);
    setSessionStats({
      cardsCompleted: 0,
      intervalCounts: { 1: 0, 3: 0, 10: 0, 20: 0, 30: 0 },
    });
    setPhase('session');
  };

  // Atajos de teclado para estudio rápido (Espacio/Enter = Voltear, Flechas = Navegar, 1-5 = Calificar, H = Pista)
  useEffect(() => {
    if (phase !== 'session' || !currentCard || isEditingCard) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName) || isEditingCard) return;

      if (e.code === 'Space' || e.code === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsFlipped(prev => !prev);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevCard();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextCard();
      } else if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        setShowHint(prev => !prev);
      } else if (['1', '2', '3', '4', '5'].includes(e.key)) {
        if (isFlipped) {
          e.preventDefault();
          const keyToDays: Record<string, AnkiInterval> = {
            '1': 1,
            '2': 3,
            '3': 10,
            '4': 20,
            '5': 30,
          };
          const days = keyToDays[e.key];
          if (days) handleScheduleInterval(days);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, currentCard, isFlipped, currentIndex, sessionCards.length, isEditingCard]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900 w-full max-w-full overflow-x-hidden">
      <Sidebar profile={profile} />

      <main className="flex-1 min-w-0 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-8 overflow-y-auto">
        {/* SELECTOR DE BLOQUES Y TEMAS */}
        {phase === 'setup' && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xs max-w-2xl mx-auto space-y-6">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-4">
                <Layers className="w-7 h-7" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                Modo Flashcards (Anki)
              </h1>
              <p className="text-sm text-slate-500 mt-2">
                Memorización activa individual para <strong>{profile?.full_name || profile?.email}</strong> con intervalos de <strong>1, 3, 10, 20 y 30 días</strong>.
              </p>
            </div>

            {/* Selector de Modo de Repaso Anki */}
            <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  Regla de Repetición Espaciada
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setAnkiFilterMode('balanced')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    ankiFilterMode === 'balanced'
                      ? 'bg-white border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                      : 'bg-white/60 border-indigo-200 hover:bg-white text-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      ⚡ Modo Equilibrado (Recomendado)
                    </span>
                    {ankiFilterMode === 'balanced' && <Check className="w-4 h-4 text-indigo-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Intercala flashcards de repaso pendientes con flashcards totalmente nuevas.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setAnkiFilterMode('prioritize_due')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    ankiFilterMode === 'prioritize_due'
                      ? 'bg-white border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                      : 'bg-white/60 border-indigo-200 hover:bg-white text-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-indigo-600" />
                      📌 Primero Repasos, luego Nuevas
                    </span>
                    {ankiFilterMode === 'prioritize_due' && <Check className="w-4 h-4 text-indigo-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Resuelve primero lo atrasado y de hoy por orden de urgencia temporal; al terminar, salen flashcards nuevas.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setAnkiFilterMode('new_only')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    ankiFilterMode === 'new_only'
                      ? 'bg-white border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                      : 'bg-white/60 border-indigo-200 hover:bg-white text-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-indigo-600" />
                      🌱 Solo Contenido Nuevo
                    </span>
                    {ankiFilterMode === 'new_only' && <Check className="w-4 h-4 text-indigo-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Solo flashcards que nunca has visto antes en Modo Anki para memorizar materia virgen.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setAnkiFilterMode('all')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    ankiFilterMode === 'all'
                      ? 'bg-white border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                      : 'bg-white/60 border-indigo-200 hover:bg-white text-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-indigo-600" />
                      🌐 Modo Libre / Todas
                    </span>
                    {ankiFilterMode === 'all' && <Check className="w-4 h-4 text-indigo-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Todas las flashcards sin esperar días ni plazos programados. Ideal antes de un examen.
                  </p>
                </button>
              </div>

              {/* Botón para ver clasificación y estado general */}
              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={handleOpenClassification}
                  className="text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Ver Clasificación y Flashcards Programadas</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Modalidad de Orden de Estudio */}
            <div className="p-4 sm:p-5 rounded-2xl bg-purple-50/50 border border-purple-100 space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-purple-900 block">
                Orden de Repaso de las Tarjetas
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setOrderMode('sequential')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    orderMode === 'sequential'
                      ? 'bg-white border-purple-500 ring-2 ring-purple-500/20 shadow-xs'
                      : 'bg-white/60 border-purple-200 hover:bg-white text-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <ListOrdered className="w-4 h-4 text-purple-600" />
                      En orden correlativo (1, 2, 3...)
                    </span>
                    {orderMode === 'sequential' && <Check className="w-4 h-4 text-purple-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Repasa las tarjetas en su orden exacto asignado por temas y posiciones.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setOrderMode('random')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    orderMode === 'random'
                      ? 'bg-white border-purple-500 ring-2 ring-purple-500/20 shadow-xs'
                      : 'bg-white/60 border-purple-200 hover:bg-white text-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Shuffle className="w-4 h-4 text-purple-600" />
                      Modo Aleatorio (Barajado)
                    </span>
                    {orderMode === 'random' && <Check className="w-4 h-4 text-purple-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Baraja y mezcla todas las tarjetas al azar para evaluar retención imprevisible.
                  </p>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Bloques y Temas a Repasar
                </label>
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-bold cursor-pointer"
                >
                  {hasAnySelected ? 'Desmarcar todos' : 'Seleccionar todos'}
                </button>
              </div>

              {/* Selector con despliegue de Bloques y Temas */}
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
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-200/80 text-indigo-800 shrink-0">
                                  {selectedCount}/{blockTopics.length} {blockTopics.length === 1 ? 'tema' : 'temas'} ({getBlockFlashcardsCount(blockTopics)} {getBlockFlashcardsCount(blockTopics) === 1 ? 'flashcard' : 'flashcards'})
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
                              {blockTopics.map(t => {
                                const cardCount = getTopicFlashcardsCount(t);
                                return (
                                  <div key={t.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs hover:border-indigo-200 transition-all">
                                    <label className="flex items-center gap-2.5 p-2.5 hover:bg-slate-50 transition-colors cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        checked={selectedTopics.includes(t.id)}
                                        onChange={() => toggleTopic(t.id)}
                                        className="w-3.5 h-3.5 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                      />
                                      <span className="font-bold text-xs text-slate-800 truncate flex-1">
                                        Tema {t.order_index}: {t.title}
                                      </span>
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 border flex items-center gap-1 ${
                                        cardCount > 0
                                          ? 'text-indigo-700 bg-indigo-50 border-indigo-200/80'
                                          : 'text-slate-400 bg-slate-50 border-slate-200'
                                      }`}>
                                        <Layers className={`w-3 h-3 ${cardCount > 0 ? 'text-indigo-500' : 'text-slate-300'}`} />
                                        <span>{cardCount} {cardCount === 1 ? 'flashcard' : 'flashcards'}</span>
                                      </span>
                                    </label>
                                  </div>
                                );
                              })}
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
                                {selectedCount}/{unassignedTopics.length} temas ({getBlockFlashcardsCount(unassignedTopics)} {getBlockFlashcardsCount(unassignedTopics) === 1 ? 'flashcard' : 'flashcards'})
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
                              {unassignedTopics.map(t => {
                                const cardCount = getTopicFlashcardsCount(t);
                                return (
                                  <div key={t.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs hover:border-amber-200 transition-all">
                                    <label className="flex items-center gap-2.5 p-2.5 hover:bg-slate-50 transition-colors cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        checked={selectedTopics.includes(t.id)}
                                        onChange={() => toggleTopic(t.id)}
                                        className="w-3.5 h-3.5 rounded text-amber-600 border-slate-300 focus:ring-amber-500 cursor-pointer"
                                      />
                                      <span className="font-bold text-xs text-slate-800 truncate flex-1">
                                        Tema {t.order_index}: {t.title}
                                      </span>
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 border flex items-center gap-1 ${
                                        cardCount > 0
                                          ? 'text-amber-700 bg-amber-50 border-amber-200/80'
                                          : 'text-slate-400 bg-slate-50 border-slate-200'
                                      }`}>
                                        <Layers className={`w-3 h-3 ${cardCount > 0 ? 'text-amber-500' : 'text-slate-300'}`} />
                                        <span>{cardCount} {cardCount === 1 ? 'flashcard' : 'flashcards'}</span>
                                      </span>
                                    </label>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <p className="text-xs text-slate-400 text-center py-4">Cargando temas...</p>
                )}
              </div>
            </div>

            <button
              onClick={startSession}
              disabled={selectedTopics.length === 0}
              className="w-full py-4 rounded-2xl font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-md transition-all text-center flex items-center justify-center gap-2 cursor-pointer"
            >
              <Zap className="w-4 h-4" />
              Comenzar Repaso de Flashcards
            </button>
          </div>
        )}

        {/* SESIÓN ACTIVA */}
        {phase === 'session' && currentCard && (
          <div className="space-y-6">
            {/* Barra superior de progreso y herramientas */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[11px] font-black">
                    Tarjeta {currentIndex + 1} de {sessionCards.length}
                  </span>
                  <span>({Math.round(((currentIndex + 1) / Math.max(sessionCards.length, 1)) * 100)}%)</span>
                  {sessionStats.cardsCompleted > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ✓ {sessionStats.cardsCompleted} calificadas
                    </span>
                  )}
                  {orderMode === 'sequential' ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      📋 En orden
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                      🎲 Aleatorio
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {streak > 1 && (
                    <span className="flex items-center gap-1 text-amber-600 font-black text-xs animate-in zoom-in-95">
                      🔥 {streak} seguidas
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={toggleSessionOrder}
                    className="text-[11px] text-slate-500 hover:text-indigo-600 flex items-center gap-1 font-bold cursor-pointer transition-colors"
                    title={orderMode === 'sequential' ? 'Cambiar a modo aleatorio para las tarjetas restantes' : 'Ordenar tarjetas restantes correlativamente'}
                  >
                    {orderMode === 'sequential' ? (
                      <>
                        <Shuffle className="w-3.5 h-3.5" />
                        <span>Barajar restantes</span>
                      </>
                    ) : (
                      <>
                        <ListOrdered className="w-3.5 h-3.5" />
                        <span>Ordenar restantes</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('¿Deseas salir del repaso actual y volver al panel de inicio?')) {
                        router.push('/dashboard');
                      }
                    }}
                    className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 text-slate-600 font-bold cursor-pointer transition-colors shadow-2xs"
                    title="Salir al panel de inicio"
                  >
                    <Home className="w-3 h-3 text-slate-500" />
                    <span>Salir al Panel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('¿Deseas pausar el repaso actual y volver a la selección de temas?')) {
                        setPhase('setup');
                      }
                    }}
                    className="text-[11px] text-slate-400 hover:text-indigo-600 font-bold cursor-pointer transition-colors"
                  >
                    Temas
                  </button>
                </div>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.round(((currentIndex + 1) / Math.max(sessionCards.length, 1)) * 100)}%` }}
                />
              </div>
            </div>

            {schedulingToast && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2 animate-in fade-in shadow-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{schedulingToast.text}</span>
              </div>
            )}

            {/* TARJETA 3D FLIP Y NAVEGACIÓN */}
            {(() => {
              const currentTopic = currentCard.subtopics?.topics;
              const currentBlock = blocks.find(b => b.id === currentTopic?.block_id);
              const blockPrefix = currentBlock ? `Bloque ${currentBlock.order_index} · ` : '';
              const topicText = currentTopic ? `Tema ${currentTopic.order_index}: ${currentTopic.title}` : (currentCard.subtopics?.title || 'General');
              const existingReview = reviewsMap[getAnkiItemKey('flashcard', currentCard.id)];

              return (
                <div className="space-y-4">
                  {/* BARRA SUPERIOR DE ACCIONES: NÚMERO, TEMA, IMPUGNAR Y EDITAR FLASHCARD (ADMIN) */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white border border-slate-200/90 p-2.5 sm:px-4 sm:py-2.5 rounded-2xl shadow-2xs">
                    <div className="flex items-center gap-2 truncate max-w-[65%] sm:max-w-[70%]">
                      {currentCard.order_index != null && (
                        <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-indigo-600 text-white shadow-2xs shrink-0">
                          #{currentCard.order_index}
                        </span>
                      )}
                      <span className="text-[11px] font-black tracking-wider text-indigo-700 bg-indigo-50/90 px-3 py-1 rounded-full border border-indigo-200/70 flex items-center gap-1.5 truncate">
                        <BookOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span className="truncate">{blockPrefix}{topicText}</span>
                      </span>
                      {(() => {
                        const analysis = analyzeAnkiItem(existingReview);
                        return (
                          <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border shadow-2xs flex items-center gap-1 shrink-0 ${analysis.badgeClass}`}>
                            {analysis.status === 'overdue' && <Clock className="w-3 h-3 text-rose-600" />}
                            {analysis.status === 'due_today' && <Clock className="w-3 h-3 text-amber-600" />}
                            {analysis.status === 'new' && <Sparkles className="w-3 h-3 text-emerald-600" />}
                            {analysis.status === 'future' && <Calendar className="w-3 h-3 text-slate-500" />}
                            <span>{analysis.status === 'new' ? '✨ Tarjeta nueva' : `📌 ${analysis.label}`}</span>
                          </span>
                        );
                      })()}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowChallengeModal(true)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold border border-amber-300 bg-amber-50/90 hover:bg-amber-100 text-amber-800 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        title="Impugnar o reportar un fallo en esta flashcard"
                      >
                        <Flag className="w-3.5 h-3.5 text-amber-600" />
                        <span>Impugnar</span>
                      </button>

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            if (isEditingCard) {
                              setIsEditingCard(false);
                            } else {
                              handleStartEditCard();
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                            isEditingCard
                              ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                              : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                          }`}
                          title="Editar el contenido o tema de esta flashcard mientras estudias"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>{isEditingCard ? 'Cancelar Edición' : 'Editar Flashcard'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* PANEL DE EDICIÓN EN VIVO (SOLO ADMINISTRADOR) */}
                  {isEditingCard && isAdmin ? (
                    <div className="bg-white border-2 border-indigo-400 rounded-3xl p-6 sm:p-8 shadow-xl space-y-5 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                            <Edit3 className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                              <span>Editar Flashcard en Vivo</span>
                              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800">
                                Administrador
                              </span>
                            </h3>
                            <p className="text-[11px] font-medium text-slate-500">
                              Modifica la flashcard mientras estudias; se actualizará en base de datos al instante.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsEditingCard(false)}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Cancelar edición"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Selector de Tema y Bloque */}
                        <div className="sm:col-span-2 space-y-1">
                          <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <Tag className="w-3 h-3 text-indigo-600" />
                            Tema / Bloque Oficial
                          </label>
                          <select
                            value={editTopicId}
                            onChange={(e) => setEditTopicId(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                          >
                            <option value="">-- Sin tema específico (General) --</option>
                            {blocks.map(b => {
                              const blockTopics = topics.filter(t => t.block_id === b.id).sort((x, y) => (x.order_index ?? 0) - (y.order_index ?? 0));
                              if (blockTopics.length === 0) return null;
                              return (
                                <optgroup key={b.id} label={`Bloque ${b.order_index}: ${b.title}`}>
                                  {blockTopics.map(t => (
                                    <option key={t.id} value={t.id}>
                                      Tema {t.order_index}: {t.title} ({getTopicFlashcardsCount(t)})
                                    </option>
                                  ))}
                                </optgroup>
                              );
                            })}
                            {topics.filter(t => !t.block_id).length > 0 && (
                              <optgroup label="Temas Generales / Sin Bloque">
                                {topics.filter(t => !t.block_id).map(t => (
                                  <option key={t.id} value={t.id}>
                                    Tema {t.order_index}: {t.title} ({getTopicFlashcardsCount(t)})
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                        </div>

                        {/* Número de orden */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                            Nº Orden (#)
                          </label>
                          <input
                            type="number"
                            value={editOrderIndex}
                            onChange={(e) => setEditOrderIndex(e.target.value)}
                            placeholder="Ej: 1"
                            className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                          />
                        </div>
                      </div>

                      {/* Cara Frontal (Anverso) */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-black text-indigo-950 uppercase tracking-wider flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-indigo-500" />
                            Anverso (Pregunta / Enunciado / Concepto)
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold normal-case">Visible al inicio</span>
                        </label>
                        <textarea
                          value={editFrontText}
                          onChange={(e) => setEditFrontText(e.target.value)}
                          rows={4}
                          className="w-full p-3.5 rounded-xl bg-slate-50 border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white leading-relaxed resize-y shadow-2xs"
                          placeholder="Escribe la pregunta o concepto a recordar..."
                        />
                      </div>

                      {/* Cara Trasera (Reverso) */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-black text-emerald-950 uppercase tracking-wider flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            Reverso (Respuesta / Explicación / Solución)
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold normal-case">Visible al voltear</span>
                        </label>
                        <textarea
                          value={editBackText}
                          onChange={(e) => setEditBackText(e.target.value)}
                          rows={4}
                          className="w-full p-3.5 rounded-xl bg-slate-50 border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white leading-relaxed resize-y shadow-2xs"
                          placeholder="Escribe la respuesta correcta o solución..."
                        />
                      </div>

                      {/* Pista / Fundamento Legal */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-black text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                          <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                          Pista / Fundamento Legal / Referencia Normativa (Opcional)
                        </label>
                        <textarea
                          value={editHint}
                          onChange={(e) => setEditHint(e.target.value)}
                          rows={2}
                          className="w-full p-3 rounded-xl bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white leading-relaxed resize-y shadow-2xs"
                          placeholder="Ej: Art. 25.1 CE, Ley 7/1985..."
                        />
                      </div>

                      {/* Botones de acción */}
                      <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200 flex-wrap">
                        <button
                          type="button"
                          onClick={handleDeleteCurrentCard}
                          disabled={isSavingCard || isDeletingCard}
                          className="px-4 py-2.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 hover:text-rose-800 border border-rose-200 hover:border-rose-300 transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-2xs"
                          title="Eliminar permanentemente esta flashcard de la base de datos y la plataforma"
                        >
                          {isDeletingCard ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                              <span>Eliminando de BD...</span>
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                              <span>Eliminar Flashcard</span>
                            </>
                          )}
                        </button>

                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => setIsEditingCard(false)}
                            disabled={isSavingCard || isDeletingCard}
                            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 cursor-pointer transition-colors"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveCard}
                            disabled={isSavingCard || isDeletingCard}
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-black shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSavingCard ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Guardando en BD...</span>
                              </>
                            ) : (
                              <>
                                <Save className="w-4 h-4" />
                                <span>Guardar Cambios</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* TARJETA 3D FLIP Y NAVEGACIÓN */
                    <div className="flex items-center gap-2 sm:gap-4 w-full">
                      {/* Botón Flecha Izquierda (Anterior) */}
                      <button
                        type="button"
                        onClick={handlePrevCard}
                        disabled={currentIndex === 0}
                        className="p-3 sm:p-4 rounded-2xl bg-white border border-slate-200 shadow-xs text-slate-700 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/50 disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-slate-700 disabled:hover:border-slate-200 transition-all cursor-pointer shrink-0 active:scale-95 group flex items-center justify-center"
                        title={currentIndex === 0 ? 'Estás en la primera tarjeta' : 'Ver tarjeta anterior repasada (Tecla ←)'}
                        aria-label="Tarjeta anterior"
                      >
                        <ChevronLeft className="w-6 h-6 group-hover:-translate-x-0.5 transition-transform" />
                      </button>

                      {/* Tarjeta Flip 3D */}
                      <div className="relative flex-1 min-w-0 min-h-[380px] [perspective:1200px]">
                        <div
                          onClick={() => setIsFlipped(!isFlipped)}
                          className={`w-full min-h-[380px] transition-transform duration-500 [transform-style:preserve-3d] cursor-pointer select-none relative ${
                            isFlipped ? '[transform:rotateY(180deg)]' : ''
                          }`}
                        >
                          {/* CARA ANVERSO (FRONT) */}
                          <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] bg-white border-2 border-indigo-100 hover:border-indigo-300 rounded-3xl p-6 sm:p-10 shadow-lg flex flex-col justify-between transition-colors">
                            <div className="space-y-4 my-auto">
                              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-relaxed whitespace-pre-line text-center sm:text-left">
                                {currentCard.front_text}
                              </h2>

                              {currentCard.hint && (
                                <div className="pt-2">
                                  {showHint ? (
                                    <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs font-medium animate-in fade-in flex items-start gap-2.5">
                                      <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                      <div>
                                        <span className="font-bold block mb-0.5 text-amber-950">Pista / Referencia legal:</span>
                                        {currentCard.hint}
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setShowHint(true);
                                      }}
                                      className="text-[11px] font-bold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-xl border border-amber-200/80 flex items-center gap-1.5 transition-colors cursor-pointer mx-auto sm:mx-0"
                                    >
                                      <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                                      <span>Ver Pista (H)</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="text-center text-xs font-semibold text-slate-400 pt-4 border-t border-slate-100 flex items-center justify-center gap-2">
                              <CornerDownLeft className="w-3.5 h-3.5" />
                              <span>Haz clic en la tarjeta o pulsa <kbd className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-mono text-[10px]">Espacio</kbd> para voltear</span>
                            </div>
                          </div>

                          {/* CARA REVERSO (BACK) */}
                          <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 border-2 border-indigo-500/40 rounded-3xl p-6 sm:p-10 shadow-xl flex flex-col justify-between text-white">
                            <div className="space-y-4 my-auto">
                              <div className="text-lg sm:text-xl font-bold text-white leading-relaxed bg-white/10 p-5 sm:p-6 rounded-2xl border border-white/10 whitespace-pre-line shadow-inner">
                                {currentCard.back_text}
                              </div>

                              {currentCard.hint && (
                                <p className="text-xs text-indigo-200 italic bg-indigo-950/60 p-2.5 rounded-xl border border-indigo-800/40">
                                  Fundamento: {currentCard.hint}
                                </p>
                              )}
                            </div>

                            <div className="text-center text-xs font-semibold text-indigo-300 pt-4 border-t border-indigo-800/60 flex items-center justify-center gap-2">
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Selecciona tu intervalo de repaso abajo o pulsa <kbd className="px-1.5 py-0.5 rounded bg-indigo-800 text-indigo-200 border border-indigo-700 font-mono text-[10px]">1-5</kbd></span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Botón Flecha Derecha (Siguiente / Finalizar) */}
                      {currentIndex < sessionCards.length - 1 ? (
                        <button
                          type="button"
                          onClick={handleNextCard}
                          className="p-3 sm:p-4 rounded-2xl bg-white border border-slate-200 shadow-xs text-slate-700 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all cursor-pointer shrink-0 active:scale-95 group flex items-center justify-center"
                          title="Pasar a la siguiente tarjeta sin responder (Tecla →)"
                          aria-label="Siguiente o saltar tarjeta"
                        >
                          <ChevronRight className="w-6 h-6 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setPhase('complete');
                            confetti({ particleCount: 100, spread: 80 });
                          }}
                          className="p-3 sm:p-4 rounded-2xl bg-emerald-50 border border-emerald-300 shadow-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100 transition-all cursor-pointer shrink-0 active:scale-95 group flex items-center justify-center"
                          title="Finalizar sesión de flashcards"
                          aria-label="Finalizar repaso"
                        >
                          <Check className="w-6 h-6 group-hover:scale-110 transition-transform text-emerald-600" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* LAS 5 OPCIONES DE INTERVALO ANKI (1, 3, 10, 20, 30 DÍAS) */}
            {isFlipped && !isEditingCard && (
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-1.5">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                      ¿Cuándo deseas volver a repasar esta flashcard?
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Atajos directos en el teclado: Teclas [1] a [5]
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5">
                  {ANKI_INTERVALS.map((opt, idx) => (
                    <button
                      key={opt.days}
                      type="button"
                      onClick={() => handleScheduleInterval(opt.days)}
                      className={`py-3 px-1 sm:px-2 rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center text-center shadow-2xs hover:shadow-md transform active:scale-95 ${opt.buttonClass} relative group`}
                      title={`Programar próximo repaso para dentro de ${opt.days} días (Tecla ${idx + 1})`}
                    >
                      <span className="absolute -top-2 -right-1 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-slate-900 text-white shadow-xs">
                        {idx + 1}
                      </span>
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

        {/* SESIÓN COMPLETADA */}
        {phase === 'complete' && (
          <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm max-w-md mx-auto text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-2xl font-black text-slate-900">
                ¡Sesión Completada!
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Todas las flashcards han sido programadas y guardadas en el ecosistema Anki.
              </p>
            </div>

            {/* Desglose por intervalos */}
            <div className="space-y-2 text-left bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                Programación de esta sesión:
              </span>
              <div className="grid grid-cols-5 gap-1 text-center">
                {ANKI_INTERVALS.map(opt => (
                  <div key={opt.days} className="p-2 rounded-xl bg-white border border-slate-200">
                    <span className="text-xs font-bold text-slate-900 block">{opt.label}</span>
                    <span className="text-sm font-black text-indigo-700 block mt-0.5">
                      {sessionStats.intervalCounts[opt.days] || 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Booster para tarjetas difíciles */}
            {difficultCards.length > 0 && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-left space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                  <Flame className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Has marcado {difficultCards.length} tarjetas con repaso a corto plazo (1 o 3 días)</span>
                </div>
                <button
                  type="button"
                  onClick={restartDifficultCards}
                  className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Repasar ahora las difíciles ({difficultCards.length})
                </button>
              </div>
            )}

            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={() => setPhase('setup')}
                className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Hacer otra ronda de Flashcards
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
        {/* MODAL / DRAWER DEL ECOSISTEMA DE CLASIFICACIÓN FLASHCARDS */}
        {/* ========================================================= */}
        {showClassificationModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
              {/* Encabezado del modal */}
              <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-600 text-white">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Clasificación de Flashcards Anki
                    </h2>
                    <p className="text-xs text-slate-500">
                      Progreso personal de <strong>{profile?.full_name || profile?.email}</strong> · Intervalos de repaso independientes.
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

              {/* Barra de pestañas por intervalo (1d, 3d, 10d, 20d, 30d, nuevas) */}
              <div className="p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  <button
                    type="button"
                    onClick={() => setSelectedIntervalTab('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                      selectedIntervalTab === 'all'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Todas ({allLoadedCards.length})
                  </button>

                  {ANKI_INTERVALS.map(opt => {
                    const count = allLoadedCards.filter(i => {
                      const key = getAnkiItemKey('flashcard', i.id);
                      return reviewsMap[key]?.interval_days === opt.days;
                    }).length;

                    return (
                      <button
                        key={opt.days}
                        type="button"
                        onClick={() => setSelectedIntervalTab(opt.days)}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                          selectedIntervalTab === opt.days
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <span>{opt.label}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
                          {count}
                        </span>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setSelectedIntervalTab('new')}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                      selectedIntervalTab === 'new'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>Nuevas</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
                      {allLoadedCards.filter(i => !reviewsMap[getAnkiItemKey('flashcard', i.id)]).length}
                    </span>
                  </button>
                </div>

                <div className="relative w-full sm:w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar tarjetas..."
                    value={classificationSearch}
                    onChange={(e) => setClassificationSearch(e.target.value)}
                    className="w-full pl-8.5 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Listado de tarjetas clasificadas */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 bg-slate-50/50">
                {classifiedCards.length === 0 ? (
                  <div className="p-12 text-center text-xs text-slate-400 italic">
                    No hay flashcards en este intervalo de clasificación.
                  </div>
                ) : (
                  classifiedCards.map(item => {
                    const key = getAnkiItemKey('flashcard', item.id);
                    const rev = reviewsMap[key];
                    const timing = formatReviewTiming(rev);

                    return (
                      <div
                        key={key}
                        className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700">
                              Flashcard
                            </span>
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

                          <p className="text-xs sm:text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                            {item.front_text}
                          </p>

                          {item.back_text && (
                            <p className="text-[11px] text-slate-500 line-clamp-1 italic">
                              {item.back_text}
                            </p>
                          )}
                        </div>

                        {rev && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm('¿Deseas reiniciar la programación de esta flashcard a nueva?')) return;
                              await resetAnkiReview(supabase, profile!.id, 'flashcard', item.id);
                              setReviewsMap(prev => {
                                const next = { ...prev };
                                delete next[key];
                                return next;
                              });
                            }}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0 cursor-pointer"
                            title="Reiniciar intervalo"
                          >
                            Reiniciar
                          </button>
                        )}
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
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DE IMPUGNACIÓN DE FLASHCARD */}
        {showChallengeModal && currentCard && (
          <QuestionChallengeModal
            isOpen={showChallengeModal}
            onClose={() => setShowChallengeModal(false)}
            question={{
              id: currentCard.id,
              question_text: `[FLASHCARD] ${currentCard.front_text}`,
              explanation: `Reverso: ${currentCard.back_text}${currentCard.hint ? ` | Pista / Fundamento: ${currentCard.hint}` : ''}`,
              _origin: 'flashcard'
            }}
            user={profile}
            onSuccess={() => {
              setSchedulingToast({
                days: 0,
                text: '✅ ¡Impugnación enviada correctamente para revisión docente!',
              });
              setTimeout(() => setSchedulingToast(null), 3500);
            }}
          />
        )}
      </main>
    </div>
  );
}
