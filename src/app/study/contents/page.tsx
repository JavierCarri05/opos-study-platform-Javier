'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Sidebar } from '@/components/Sidebar';
import { Profile, Block, Topic } from '@/lib/types';
import { 
  getQuestionCountsSummary, 
  getFlashcardCountsSummary, 
  getCachedUserProfile, 
  getCachedTopicsAndBlocks 
} from '@/lib/supabaseHelper';
import { 
  BookOpen, 
  Boxes, 
  HelpCircle, 
  ChevronDown, 
  ChevronRight, 
  Layers, 
  FolderOpen,
  Sparkles,
  ArrowUpDown
} from 'lucide-react';

export default function StudyContentsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({});
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({});
  const [allSubtopicsExpanded, setAllSubtopicsExpanded] = useState(false);

  // Conteo de preguntas por subtopic_id
  const [bankCountsBySubtopic, setBankCountsBySubtopic] = useState<Record<string, number>>({});
  const [officialCountsBySubtopic, setOfficialCountsBySubtopic] = useState<Record<string, number>>({});
  const [totalGeneralQuestions, setTotalGeneralQuestions] = useState(0);
  const [totalOfficialGeneralQuestions, setTotalOfficialGeneralQuestions] = useState(0);

  // Conteo de flashcards por subtema y tema
  const [flashcardsCountsBySubtopic, setFlashcardsCountsBySubtopic] = useState<Record<string, number>>({});
  const [flashcardsCountsByTopic, setFlashcardsCountsByTopic] = useState<Record<string, number>>({});
  const [totalFlashcards, setTotalFlashcards] = useState(0);

  useEffect(() => {
    async function loadData() {
      const [
        userProfRes, 
        { blocks: blocksData, topics: topicsData }, 
        qSummary, 
        fcSummary
      ] = await Promise.all([
        getCachedUserProfile(supabase),
        getCachedTopicsAndBlocks(supabase),
        getQuestionCountsSummary(supabase),
        getFlashcardCountsSummary(supabase),
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
        const initialExpanded: Record<string, boolean> = { unassigned: false };
        blocksData.forEach((b: any) => {
          initialExpanded[b.id] = false;
        });
        setExpandedBlocks(initialExpanded);
      }

      if (topicsData) {
        setTopics(topicsData);
      }

      if (qSummary) {
        setBankCountsBySubtopic(qSummary.bankCounts || {});
        setOfficialCountsBySubtopic(qSummary.officialCounts || {});
        setTotalGeneralQuestions(qSummary.bankUnclassified || 0);
        setTotalOfficialGeneralQuestions(qSummary.officialUnclassified || 0);
      }

      if (fcSummary) {
        setFlashcardsCountsBySubtopic(fcSummary.countsBySubtopic || {});
        setFlashcardsCountsByTopic(fcSummary.countsByTopic || {});
        setTotalFlashcards(fcSummary.total || 0);
      }

      setLoading(false);
    }

    loadData();
  }, []);

  // Función para obtener preguntas de un tema
  const getTopicQuestionsCount = (topic: any): number => {
    if (!topic.subtopics || topic.subtopics.length === 0) return 0;
    return topic.subtopics.reduce((acc: number, st: any) => {
      const bCount = bankCountsBySubtopic[st.id] || 0;
      const oCount = officialCountsBySubtopic[st.id] || 0;
      return acc + bCount + oCount;
    }, 0);
  };

  // Función para obtener preguntas de un bloque
  const getBlockQuestionsCount = (bTopics: any[]): number => {
    return bTopics.reduce((acc: number, t: any) => acc + getTopicQuestionsCount(t), 0);
  };

  // Función para obtener flashcards de un tema
  const getTopicFlashcardsCount = (topic: any): number => {
    let countFromSubs = 0;
    if (topic.subtopics && topic.subtopics.length > 0) {
      countFromSubs = topic.subtopics.reduce((acc: number, st: any) => {
        return acc + (flashcardsCountsBySubtopic[st.id] || 0);
      }, 0);
    }
    const countFromDirect = flashcardsCountsByTopic[topic.id] || 0;
    return Math.max(countFromSubs, countFromDirect);
  };

  // Función para obtener flashcards de un bloque
  const getBlockFlashcardsCount = (bTopics: any[]): number => {
    return bTopics.reduce((acc: number, t: any) => acc + getTopicFlashcardsCount(t), 0);
  };

  // Toggle de expansión de un bloque
  const toggleBlockExpand = (blockId: string) => {
    setExpandedBlocks(prev => ({ ...prev, [blockId]: !prev[blockId] }));
  };

  // Expandir o plegar todos los bloques
  const setAllBlocksExpanded = (expanded: boolean) => {
    const updated: Record<string, boolean> = { unassigned: expanded };
    blocks.forEach(b => { updated[b.id] = expanded; });
    setExpandedBlocks(updated);
    if (!expanded) {
      setAllSubtopicsExpanded(false);
      setExpandedTopics({});
    }
  };

  // Toggle de expansión de subapartados de un tema individual
  const toggleTopicExpand = (topicId: string) => {
    setExpandedTopics(prev => ({ ...prev, [topicId]: !prev[topicId] }));
  };

  // Expandir o plegar todos los subapartados de golpe
  const handleToggleAllSubtopics = () => {
    const nextState = !allSubtopicsExpanded;
    setAllSubtopicsExpanded(nextState);
    if (nextState) {
      // Si se expanden todos los subapartados, expandir también todos los bloques para que sean visibles
      const updatedBlocks: Record<string, boolean> = { unassigned: true };
      blocks.forEach(b => { updatedBlocks[b.id] = true; });
      setExpandedBlocks(updatedBlocks);
    }
    const updatedTopics: Record<string, boolean> = {};
    topics.forEach(t => { updatedTopics[t.id] = nextState; });
    setExpandedTopics(updatedTopics);
  };

  // Total de subapartados
  const totalSubtopics = useMemo(() => {
    return topics.reduce((acc, t) => acc + (t.subtopics?.length || 0), 0);
  }, [topics]);

  // Totales globales de preguntas
  const totalQuestionsInTopics = useMemo(() => {
    return topics.reduce((acc, t) => acc + getTopicQuestionsCount(t), 0);
  }, [topics, bankCountsBySubtopic, officialCountsBySubtopic]);

  const totalAllQuestions = totalQuestionsInTopics + totalGeneralQuestions + totalOfficialGeneralQuestions;

  // Temas sin bloque asignado
  const unassignedTopics = useMemo(() => {
    return topics.filter(t => !t.block_id);
  }, [topics]);

  const renderTopicCard = (topic: Topic, accentColor: 'indigo' | 'amber' = 'indigo') => {
    const topicQuestions = getTopicQuestionsCount(topic);
    const topicFlashcards = getTopicFlashcardsCount(topic);
    const isTopicExpanded = expandedTopics[topic.id] ?? false;
    const sortedSubtopics = (topic.subtopics || [])
      .slice()
      .sort((a: any, b: any) => (a.order_index ?? 1) - (b.order_index ?? 1));
    const hasSubtopics = sortedSubtopics.length > 0;

    return (
      <div 
        key={topic.id}
        className="rounded-2xl bg-slate-50/70 border border-slate-200/80 hover:bg-slate-50 hover:border-indigo-300 transition-all overflow-hidden shadow-2xs group"
      >
        <div 
          onClick={() => hasSubtopics && toggleTopicExpand(topic.id)}
          className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            hasSubtopics ? 'cursor-pointer select-none' : ''
          }`}
        >
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <span className={`px-2.5 py-1 rounded-xl bg-white border font-extrabold text-xs shrink-0 shadow-2xs mt-0.5 sm:mt-0 ${
              accentColor === 'amber'
                ? 'border-amber-200 text-amber-800'
                : 'border-indigo-200 text-indigo-700'
            }`}>
              Tema {topic.order_index}
            </span>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-indigo-950 transition-colors">
                {topic.title}
              </h3>
              {topic.description && (
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                  {topic.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-wrap">
            <span className="text-xs font-bold px-3 py-1 rounded-xl bg-indigo-50 border border-indigo-200/80 text-indigo-800 shadow-2xs">
              {topicQuestions} {topicQuestions === 1 ? 'pregunta' : 'preguntas'}
            </span>
            <span className="text-xs font-bold px-3 py-1 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-800 shadow-2xs flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-600" />
              {topicFlashcards} {topicFlashcards === 1 ? 'flashcard' : 'flashcards'}
            </span>

            {hasSubtopics && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTopicExpand(topic.id);
                }}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                  isTopicExpanded
                    ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300 shadow-2xs'
                }`}
                title={isTopicExpanded ? 'Ocultar subapartados' : 'Ver subapartados'}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{sortedSubtopics.length} {sortedSubtopics.length === 1 ? 'subapartado' : 'subapartados'}</span>
                {isTopicExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>

        {/* SUBAPARTADOS DESPLEGABLES */}
        {hasSubtopics && isTopicExpanded && (
          <div className="p-4 bg-white border-t border-slate-200/90 space-y-2.5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                Subapartados del tema ({sortedSubtopics.length})
              </span>
              <span className="text-[11px] font-medium text-slate-400">
                Desglose de preguntas y flashcards
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {sortedSubtopics.map((st: any) => {
                const stQCount = (bankCountsBySubtopic[st.id] || 0) + (officialCountsBySubtopic[st.id] || 0);
                const stFcCount = flashcardsCountsBySubtopic[st.id] || 0;
                const isGeneral = st.title?.toLowerCase() === 'general';

                return (
                  <div
                    key={st.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-slate-50/80 border border-slate-200/70 hover:bg-indigo-50/40 hover:border-indigo-200 transition-colors gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-slate-600 font-black text-[11px] flex items-center justify-center shrink-0 shadow-2xs">
                        {st.order_index ?? '•'}
                      </span>
                      <span className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                        {isGeneral ? 'General (Temario completo)' : st.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-white border border-slate-200 text-indigo-700 shadow-2xs">
                        {stQCount} {stQCount === 1 ? 'pregunta' : 'preguntas'}
                      </span>
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 shadow-2xs flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-600" />
                        {stFcCount} {stFcCount === 1 ? 'flashcard' : 'flashcards'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900 w-full max-w-full overflow-x-hidden">
      <Sidebar profile={profile} />

      <main className="flex-1 min-w-0 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-8 space-y-8 overflow-y-auto">
        {/* CABECERA */}
        <div className="border-b border-slate-200 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-2">
              <BookOpen className="w-3.5 h-3.5" />
              Temario y Estructura Oficial
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Contenidos
            </h1>
            <p className="text-sm text-slate-500 mt-1 max-w-2xl">
              Consulta de forma clara y directa todos los bloques, temas oficiales, subapartados detallados, preguntas tipo test y tarjetas de memorización (flashcards) disponibles para tu estudio.
            </p>
          </div>

          {/* Botones de acción rápida */}
          <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
            <button
              onClick={() => setAllBlocksExpanded(true)}
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
            >
              <FolderOpen className="w-3.5 h-3.5 text-indigo-600" />
              Expandir bloques
            </button>
            <button
              onClick={() => setAllBlocksExpanded(false)}
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
              Plegar bloques
            </button>
            <button
              onClick={handleToggleAllSubtopics}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition-all shadow-2xs cursor-pointer flex items-center gap-1.5 ${
                allSubtopicsExpanded
                  ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                  : 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100 hover:text-purple-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{allSubtopicsExpanded ? 'Plegar subapartados' : 'Desplegar todos los subapartados'}</span>
            </button>
          </div>
        </div>

        {/* TARJETAS DE RESUMEN GLOBAL (4 MÉTRICAS: BLOQUES, TEMAS, PREGUNTAS Y FLASHCARDS) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bloques Oficiales</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{blocks.length}</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Temas Totales</p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-slate-900">{topics.length}</span>
                <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
                  {totalSubtopics} subapartados
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
              <HelpCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Preguntas Disponibles</p>
              <p className="text-2xl font-black text-emerald-700 mt-0.5">{totalAllQuestions}</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Flashcards Totales</p>
              <p className="text-2xl font-black text-amber-700 mt-0.5">{totalFlashcards}</p>
            </div>
          </div>
        </div>

        {/* LISTADO DE BLOQUES Y TEMAS */}
        {loading ? (
          <div className="p-16 text-center text-slate-400 space-y-3 bg-white rounded-3xl border border-slate-200">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm font-semibold">Cargando contenidos del temario...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {blocks.map((block) => {
              const blockTopics = topics.filter(t => t.block_id === block.id);
              const isExpanded = expandedBlocks[block.id] ?? false;
              const blockQuestionsCount = getBlockQuestionsCount(blockTopics);
              const blockFlashcardsCount = getBlockFlashcardsCount(blockTopics);

              return (
                <div 
                  key={block.id} 
                  className="bg-white border border-slate-200/90 rounded-3xl shadow-2xs overflow-hidden transition-all hover:border-slate-300"
                >
                  {/* CABECERA DEL BLOQUE */}
                  <div 
                    onClick={() => toggleBlockExpand(block.id)}
                    className="p-5 sm:p-6 bg-gradient-to-r from-purple-50/70 via-indigo-50/40 to-white hover:from-purple-100/60 transition-colors border-b border-purple-100/80 cursor-pointer flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <Boxes className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-100 text-purple-800">
                            Bloque {block.order_index}
                          </span>
                          <h2 className="text-lg sm:text-xl font-black text-slate-900 truncate">
                            {block.title}
                          </h2>
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-white border border-purple-200 text-purple-700 shadow-2xs">
                            {blockTopics.length} {blockTopics.length === 1 ? 'tema' : 'temas'}
                          </span>
                          <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-purple-600 text-white shadow-2xs">
                            ({blockQuestionsCount} {blockQuestionsCount === 1 ? 'pregunta' : 'preguntas'})
                          </span>
                          <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-amber-600 text-white shadow-2xs flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            ({blockFlashcardsCount} {blockFlashcardsCount === 1 ? 'flashcard' : 'flashcards'})
                          </span>
                        </div>
                        {block.description && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                            {block.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleBlockExpand(block.id);
                      }}
                      className="p-2 rounded-xl bg-white border border-purple-200/70 text-purple-700 hover:bg-purple-100 transition-colors shrink-0 cursor-pointer"
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* TEMAS DEL BLOQUE */}
                  {isExpanded && (
                    <div className="p-4 sm:p-6 space-y-3 bg-white">
                      {blockTopics.length > 0 ? (
                        blockTopics.map((topic) => renderTopicCard(topic, 'indigo'))
                      ) : (
                        <p className="text-xs text-slate-400 italic text-center py-4">
                          No hay temas configurados en este bloque.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* TEMAS GENERALES / SIN BLOQUE ASIGNADO */}
            {unassignedTopics.length > 0 && (
              <div className="bg-white border border-amber-200/90 rounded-3xl shadow-2xs overflow-hidden transition-all">
                <div 
                  onClick={() => toggleBlockExpand('unassigned')}
                  className="p-5 sm:p-6 bg-gradient-to-r from-amber-50/70 via-amber-50/40 to-white hover:from-amber-100/60 transition-colors border-b border-amber-100/80 cursor-pointer flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-100 text-amber-900">
                          Temas Generales
                        </span>
                        <h2 className="text-lg sm:text-xl font-black text-slate-900 truncate">
                          Temas Sin Bloque Asignado
                        </h2>
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-white border border-amber-200 text-amber-800 shadow-2xs">
                          {unassignedTopics.length} {unassignedTopics.length === 1 ? 'tema' : 'temas'}
                        </span>
                        <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-amber-600 text-white shadow-2xs">
                          ({getBlockQuestionsCount(unassignedTopics)} {getBlockQuestionsCount(unassignedTopics) === 1 ? 'pregunta' : 'preguntas'})
                        </span>
                        <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-purple-600 text-white shadow-2xs flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          ({getBlockFlashcardsCount(unassignedTopics)} {getBlockFlashcardsCount(unassignedTopics) === 1 ? 'flashcard' : 'flashcards'})
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Temas disponibles en la plataforma que no han sido agrupados en un bloque concreto.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleBlockExpand('unassigned');
                    }}
                    className="p-2 rounded-xl bg-white border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors shrink-0 cursor-pointer"
                  >
                    {(expandedBlocks['unassigned'] ?? false) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                </div>

                {(expandedBlocks['unassigned'] ?? false) && (
                  <div className="p-4 sm:p-6 space-y-3 bg-white">
                    {unassignedTopics.map((topic) => renderTopicCard(topic, 'amber'))}
                  </div>
                )}
              </div>
            )}

            {blocks.length === 0 && unassignedTopics.length === 0 && (
              <div className="p-12 text-center rounded-3xl bg-white border border-dashed border-slate-300">
                <Boxes className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-900">No hay temas configurados</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Todavía no se han añadido bloques ni temas a la plataforma.
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
