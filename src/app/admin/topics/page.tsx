'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Sidebar } from '@/components/Sidebar';
import { Profile, Block, Topic } from '@/lib/types';
import { getQuestionCountsSummary, getCachedUserProfile, invalidateTopicsBlocksCache, invalidateQuestionCountsCache } from '@/lib/supabaseHelper';
import { 
  Layers, 
  Plus, 
  Trash2, 
  Edit3, 
  FolderPlus, 
  X, 
  Boxes, 
  FolderOpen, 
  ChevronRight, 
  ChevronDown,
  Sparkles,
  Play,
  Scale,
  Tag 
} from 'lucide-react';
import { TopicRulesModal } from '@/components/TopicRulesModal';
import { TopicClassifierSandboxModal } from '@/components/TopicClassifierSandboxModal';
import { AllTopicsRulesModal } from '@/components/AllTopicsRulesModal';
import { getTopicRules, saveTopicRules, generateSuggestedRulesForTopic } from '@/lib/autoClassifier';

export default function AdminTopicsPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [officialCountsBySubtopic, setOfficialCountsBySubtopic] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({});

  const toggleBlockExpand = (bId: string) => {
    setExpandedBlocks(prev => ({ ...prev, [bId]: !prev[bId] }));
  };

  // Estados Modal Bloque
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockOrder, setBlockOrder] = useState<number>(1);
  const [blockTitle, setBlockTitle] = useState('');
  const [blockDesc, setBlockDesc] = useState('');
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  // Estados Modal Tema
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string>('');
  const [topicOrder, setTopicOrder] = useState<number>(1);
  const [topicTitle, setTopicTitle] = useState('');
  const [topicDesc, setTopicDesc] = useState('');
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);

  // Estados Modal Subapartado Especial
  const [showSubtopicModal, setShowSubtopicModal] = useState(false);
  const [subtopicTopicId, setSubtopicTopicId] = useState<string>('');
  const [subtopicTitle, setSubtopicTitle] = useState('');
  const [subtopicOrder, setSubtopicOrder] = useState<number>(1);
  const [editingSubtopicId, setEditingSubtopicId] = useState<string | null>(null);

  // Estados Reglas Clasificador & Sandbox
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [selectedTopicForRules, setSelectedTopicForRules] = useState<any | null>(null);
  const [showSandboxModal, setShowSandboxModal] = useState(false);
  const [showAllRulesModal, setShowAllRulesModal] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        userProfRes,
        { data: blocksData },
        { data: topicsData },
        summary
      ] = await Promise.all([
        getCachedUserProfile(supabase),
        supabase.from('blocks').select('*').order('order_index', { ascending: true }),
        supabase.from('topics').select('*, subtopics(id, title, order_index, topic_id, questions(count))').order('order_index', { ascending: true }),
        getQuestionCountsSummary(supabase),
      ]);

      if (userProfRes?.profile) {
        setProfile(userProfRes.profile);
      }

      if (blocksData) {
        setBlocks(blocksData);
        setExpandedBlocks(prev => {
          const next = { ...prev };
          if (next['unassigned'] === undefined) next['unassigned'] = false;
          blocksData.forEach((b: any) => {
            if (next[b.id] === undefined) next[b.id] = false;
          });
          return next;
        });
      }

      if (summary?.officialCounts) {
        setOfficialCountsBySubtopic(summary.officialCounts);
      }

      if (topicsData) {
        setTopics(topicsData);
      }
    } catch (err) {
      console.error('Error al cargar datos en AdminTopicsPage:', err);
    } finally {
      setLoading(false);
    }
  };

  const getTopicQuestionsCount = (topic: any): number => {
    if (!topic.subtopics || topic.subtopics.length === 0) return 0;
    return topic.subtopics.reduce((acc: number, st: any) => {
      const bankCount = st.questions?.[0]?.count || 0;
      const offCount = officialCountsBySubtopic[st.id] || 0;
      return acc + bankCount + offCount;
    }, 0);
  };

  const getBlockQuestionsCount = (bTopics: any[]): number => {
    return bTopics.reduce((acc: number, t: any) => acc + getTopicQuestionsCount(t), 0);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // CRUD REGLAS CLASIFICADOR
  const handleAutoGenerateAllRules = async () => {
    if (!confirm('¿Deseas autogenerar sugerencias iniciales de leyes y palabras clave para todos los temas que aún no tengan reglas configuradas?')) return;
    let count = 0;
    for (const t of topics) {
      const existing = getTopicRules(t);
      const hasRules = (existing.laws && existing.laws.length > 0) || (existing.keywords && existing.keywords.length > 0);
      if (!hasRules) {
        const suggested = generateSuggestedRulesForTopic(t);
        await saveTopicRules(supabase, t.id, suggested);
        count++;
      }
    }
    fetchData();
    alert(`✨ ¡Listo! Se generaron y guardaron reglas iniciales para ${count} temas.`);
  };

  const handleRulesSaved = (topicId: string, newRules: any) => {
    setTopics(prev => prev.map(t => {
      if (t.id === topicId) {
        return { ...t, classification_rules: newRules };
      }
      return t;
    }));
  };

  // CRUD BLOQUES
  const handleSaveBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingBlockId) {
        const { error } = await supabase
          .from('blocks')
          .update({
            order_index: blockOrder,
            title: blockTitle,
            description: blockDesc,
          })
          .eq('id', editingBlockId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('blocks').insert({
          order_index: blockOrder,
          title: blockTitle,
          description: blockDesc,
        });
        if (error) throw error;
      }

      setShowBlockModal(false);
      setEditingBlockId(null);
      setBlockTitle('');
      setBlockDesc('');
      fetchData();
    } catch (err: any) {
      alert('Error con Bloques: ' + (err.message || 'Verifica que ejecutaste blocks_setup.sql en Supabase.'));
    }
  };

  const handleDeleteBlock = async (id: string) => {
    if (!confirm('¿Eliminar este Bloque? Los temas asociados pasarán a "Sin Bloque asignado".')) return;
    const { error } = await supabase.from('blocks').delete().eq('id', id);
    if (error) alert('Error al eliminar: ' + error.message);
    fetchData();
  };

  // CRUD TEMAS
  const handleSaveTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetBlockId = selectedBlockId || null;

    try {
      if (editingTopicId) {
        const { error } = await supabase
          .from('topics')
          .update({
            block_id: targetBlockId,
            order_index: topicOrder,
            title: topicTitle,
            description: topicDesc,
          })
          .eq('id', editingTopicId);
        if (error) throw error;
      } else {
        const { data: newTopic, error } = await supabase.from('topics').insert({
          block_id: targetBlockId,
          order_index: topicOrder,
          title: topicTitle,
          description: topicDesc,
        }).select().single();
        if (error) throw error;

        if (newTopic) {
          await supabase.from('subtopics').insert({
            topic_id: newTopic.id,
            order_index: 1,
            title: 'General',
          });
        }
      }

      setShowTopicModal(false);
      setEditingTopicId(null);
      setTopicTitle('');
      setTopicDesc('');
      fetchData();
    } catch (err: any) {
      alert('Error con Temas: ' + (err.message || 'Error al guardar'));
    }
  };

  const handleDeleteTopic = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar este tema y las preguntas asociadas?')) return;
    await supabase.from('topics').delete().eq('id', id);
    fetchData();
  };

  // CRUD SUBAPARTADOS ESPECIALES
  const handleSaveSubtopic = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = subtopicTitle.trim();
    if (!cleanTitle) {
      alert('Por favor, introduce el título del subapartado.');
      return;
    }

    try {
      if (editingSubtopicId) {
        const { error } = await supabase
          .from('subtopics')
          .update({
            title: cleanTitle,
            order_index: subtopicOrder,
          })
          .eq('id', editingSubtopicId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('subtopics').insert({
          topic_id: subtopicTopicId,
          title: cleanTitle,
          order_index: subtopicOrder,
        });
        if (error) throw error;
      }

      setShowSubtopicModal(false);
      setEditingSubtopicId(null);
      setSubtopicTitle('');
      fetchData();
    } catch (err: any) {
      alert('Error al guardar subapartado: ' + (err.message || 'Error desconocido'));
    }
  };

  const handleDeleteSubtopic = async (subId: string, topId: string) => {
    if (!confirm('¿Eliminar este subapartado? Las preguntas que contenga se moverán automáticamente a "General" de este tema para no perderlas.')) {
      return;
    }

    try {
      // 1. Encontrar o crear el subtema 'General' para este tema como destino seguro
      const topicObj = topics.find(t => t.id === topId);
      let generalSub = topicObj?.subtopics?.find((s: any) => s.id !== subId && s.title?.toLowerCase() === 'general');
      if (!generalSub) {
        generalSub = topicObj?.subtopics?.find((s: any) => s.id !== subId);
      }
      if (!generalSub) {
        const { data: newGen, error: genErr } = await supabase
          .from('subtopics')
          .insert({ topic_id: topId, title: 'General', order_index: 1 })
          .select()
          .single();
        if (genErr) throw genErr;
        generalSub = newGen;
      }

      // 2. Reasignar preguntas del banco propio
      await supabase
        .from('questions')
        .update({ subtopic_id: generalSub.id })
        .eq('subtopic_id', subId);

      // 3. Reasignar preguntas de exámenes oficiales
      await supabase
        .from('official_exam_questions')
        .update({ subtopic_id: generalSub.id })
        .eq('subtopic_id', subId);

      // 4. Eliminar el subtema de forma limpia
      const { error: delErr } = await supabase
        .from('subtopics')
        .delete()
        .eq('id', subId);
      if (delErr) throw delErr;

      fetchData();
    } catch (err: any) {
      alert('Error al eliminar subapartado: ' + (err.message || 'Error desconocido'));
    }
  };

  // Agrupar temas por bloque
  const unassignedTopics = topics.filter(t => !t.block_id);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900 w-full max-w-full overflow-x-hidden">
      <Sidebar profile={profile} />

      <main className="flex-1 min-w-0 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-8 space-y-8 overflow-y-auto">
        {/* Encabezado */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-6">
          <div>
            <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Boxes className="w-4 h-4" />
              Estructura del Temario
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Bloques y Temas
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Organiza tu oposición por grandes Bloques (ej. Bloque I: Derecho Constitucional) y Temas (Tema 1, Tema 2...).
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowAllRulesModal(true)}
              className="px-3.5 py-2.5 rounded-xl font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs sm:text-sm shadow-sm flex items-center gap-2 cursor-pointer transition-colors"
              title="Ver y editar en una sola tabla las leyes y palabras clave de todos los temas"
            >
              <Tag className="w-4 h-4 text-indigo-600" />
              <span>Tabla de Palabras Clave</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSandboxModal(true)}
              className="px-3.5 py-2.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm shadow-sm flex items-center gap-2 cursor-pointer transition-colors"
              title="Probar cómo clasifica cualquier pregunta o justificación en vivo"
            >
              <Play className="w-4 h-4" />
              <span>Simulador Clasificador</span>
            </button>
            <button
              type="button"
              onClick={handleAutoGenerateAllRules}
              className="px-3.5 py-2.5 rounded-xl font-bold bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-200 text-xs sm:text-sm shadow-sm flex items-center gap-2 cursor-pointer transition-colors"
              title="Generar reglas y palabras clave automáticas para los temas que no tengan aún"
            >
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>Autogenerar Reglas</span>
            </button>
            <button
              onClick={() => {
                setEditingBlockId(null);
                setBlockOrder(blocks.length + 1);
                setBlockTitle('');
                setBlockDesc('');
                setShowBlockModal(true);
              }}
              className="px-4 py-2.5 rounded-xl font-bold bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm shadow-sm flex items-center gap-2"
            >
              <Boxes className="w-4 h-4" />
              Nuevo Bloque
            </button>
            <button
              onClick={() => {
                setEditingTopicId(null);
                setSelectedBlockId(blocks[0]?.id || '');
                setTopicOrder(topics.length + 1);
                setTopicTitle('');
                setTopicDesc('');
                setShowTopicModal(true);
              }}
              className="px-4 py-2.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm shadow-sm flex items-center gap-2"
            >
              <FolderPlus className="w-4 h-4" />
              Nuevo Tema
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Cargando temario estructurado...
          </div>
        ) : (
          <div className="space-y-8">
            {/* RENDER DE BLOQUES */}
            {blocks.map((block) => {
              const blockTopics = topics.filter(t => t.block_id === block.id);
              const isBlockExpanded = expandedBlocks[block.id] ?? false;
              const blockQuestionsCount = getBlockQuestionsCount(blockTopics);

              return (
                <div
                  key={block.id}
                  className="bg-white border-2 border-purple-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6"
                >
                  {/* Cabecera del Bloque */}
                  <div className="flex items-center justify-between flex-wrap gap-3 border-b border-purple-100 pb-4">
                    <div 
                      onClick={() => toggleBlockExpand(block.id)}
                      className="flex items-center gap-3 cursor-pointer group flex-1 min-w-0"
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleBlockExpand(block.id);
                        }}
                        className="p-2 rounded-2xl bg-purple-100 text-purple-700 group-hover:bg-purple-200 transition-colors"
                      >
                        {isBlockExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                      </button>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                            Bloque {block.order_index}
                          </span>
                          <h2 className="text-xl font-black text-slate-900 group-hover:text-purple-700 transition-colors truncate">
                            {block.title}
                          </h2>
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {blockTopics.length} {blockTopics.length === 1 ? 'tema' : 'temas'}
                          </span>
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700">
                            ({blockQuestionsCount} {blockQuestionsCount === 1 ? 'pregunta' : 'preguntas'})
                          </span>
                        </div>
                        {block.description && (
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{block.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedBlockId(block.id);
                          setEditingTopicId(null);
                          setTopicOrder(blockTopics.length + 1);
                          setTopicTitle('');
                          setTopicDesc('');
                          setShowTopicModal(true);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Añadir Tema al Bloque
                      </button>
                      <button
                        onClick={() => {
                          setEditingBlockId(block.id);
                          setBlockOrder(block.order_index);
                          setBlockTitle(block.title);
                          setBlockDesc(block.description || '');
                          setShowBlockModal(true);
                        }}
                        className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600"
                        title="Editar bloque"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteBlock(block.id)}
                        className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-600"
                        title="Eliminar bloque"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Temas del Bloque al desplegar */}
                  {isBlockExpanded && (
                    <div className="space-y-4 pl-2 sm:pl-4">
                    {blockTopics.length > 0 ? (
                      blockTopics.map((topic) => {
                        const topicQuestionsCount = getTopicQuestionsCount(topic);
                        return (
                        <div
                          key={topic.id}
                          className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3"
                        >
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-3">
                              <span className="px-2.5 py-1 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 font-extrabold text-xs shrink-0">
                                Tema {topic.order_index}
                              </span>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="text-base font-bold text-slate-900">{topic.title}</h3>
                                  <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200/80 text-indigo-700">
                                    ({topicQuestionsCount} {topicQuestionsCount === 1 ? 'pregunta' : 'preguntas'})
                                  </span>
                                </div>
                                {topic.description && (
                                  <p className="text-xs text-slate-500">{topic.description}</p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Botón Reglas Clasificador */}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedTopicForRules(topic);
                                  setShowRulesModal(true);
                                }}
                                className="px-2.5 py-1 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200/90 text-purple-800 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                                title="Configurar leyes y palabras clave para clasificar preguntas por su justificación"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                                <span>Reglas Clasificador</span>
                                {(() => {
                                  const r = getTopicRules(topic);
                                  const count = (r.laws?.length || 0) + (r.keywords?.length || 0);
                                  return count > 0 ? (
                                    <span className="px-1.5 py-0.2 rounded-full bg-purple-200 text-purple-900 text-[10px] font-extrabold">
                                      {count}
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-600 text-[10px] font-medium">
                                      0
                                    </span>
                                  );
                                })()}
                              </button>

                              <button
                                onClick={() => {
                                  setEditingTopicId(topic.id);
                                  setSelectedBlockId(topic.block_id || '');
                                  setTopicOrder(topic.order_index);
                                  setTopicTitle(topic.title);
                                  setTopicDesc(topic.description || '');
                                  setShowTopicModal(true);
                                }}
                                className="p-1.5 rounded-lg hover:bg-white text-slate-500 hover:text-slate-900"
                                title="Editar Tema"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteTopic(topic.id)}
                                className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-500 hover:text-rose-600"
                                title="Eliminar Tema"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* GESTIÓN DE SUBAPARTADOS DEL TEMA */}
                          <div className="pt-3 border-t border-slate-200/60">
                            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                                Subapartados del Tema ({topic.subtopics?.length || 1})
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setSubtopicTopicId(topic.id);
                                  setEditingSubtopicId(null);
                                  setSubtopicTitle('');
                                  setSubtopicOrder((topic.subtopics?.length || 0) + 1);
                                  setShowSubtopicModal(true);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Añadir Subapartado Especial</span>
                              </button>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {topic.subtopics && topic.subtopics.length > 0 ? (
                                topic.subtopics
                                  .slice()
                                  .sort((a: any, b: any) => (a.order_index ?? 1) - (b.order_index ?? 1))
                                  .map((st: any) => {
                                    const stBankCount = st.questions?.[0]?.count || 0;
                                    const stOffCount = officialCountsBySubtopic[st.id] || 0;
                                    const stTotalCount = stBankCount + stOffCount;
                                    const isGeneral = st.title?.toLowerCase() === 'general';

                                    return (
                                      <div
                                        key={st.id}
                                        className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs transition-all ${
                                          isGeneral
                                            ? 'bg-white border-slate-200 text-slate-800'
                                            : 'bg-amber-50/90 border-amber-300 text-amber-950 font-bold shadow-2xs'
                                        }`}
                                      >
                                        <span>{isGeneral ? '📌' : '⚡'}</span>
                                        <span>{st.title}</span>
                                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                          isGeneral ? 'bg-slate-100 text-slate-600' : 'bg-amber-200 text-amber-900'
                                        }`}>
                                          {stTotalCount} {stTotalCount === 1 ? 'preg.' : 'preg.'}
                                        </span>

                                        <div className="flex items-center gap-0.5 ml-1">
                                          <a
                                            href={`/admin/questions?topicId=${topic.id}&subtopicId=${st.id}&bulk=true`}
                                            className="p-1 text-slate-400 hover:text-purple-600 rounded cursor-pointer"
                                            title="Subir batería de preguntas de golpe a este subapartado"
                                          >
                                            <Sparkles className="w-3 h-3 text-purple-600" />
                                          </a>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setSubtopicTopicId(topic.id);
                                              setEditingSubtopicId(st.id);
                                              setSubtopicTitle(st.title);
                                              setSubtopicOrder(st.order_index ?? 1);
                                              setShowSubtopicModal(true);
                                            }}
                                            className="p-1 text-slate-400 hover:text-indigo-600 rounded cursor-pointer"
                                            title="Editar Subapartado"
                                          >
                                            <Edit3 className="w-3 h-3" />
                                          </button>
                                          {!isGeneral && (
                                            <button
                                              type="button"
                                              onClick={() => handleDeleteSubtopic(st.id, topic.id)}
                                              className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                                              title="Eliminar Subapartado (preguntas pasarán a General)"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })
                              ) : (
                                <span className="text-xs text-slate-400 italic">Sin subapartados</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                      })
                    ) : (
                      <div className="p-4 rounded-2xl bg-purple-50/50 border border-dashed border-purple-200 text-xs text-purple-700 text-center font-medium">
                        Este bloque aún no tiene temas asignados. Haz clic en "Añadir Tema al Bloque".
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

            {/* TEMAS GENERALES / SIN BLOQUE ASIGNADO */}
            {unassignedTopics.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
                <div 
                  onClick={() => toggleBlockExpand('unassigned')}
                  className="flex items-center justify-between border-b border-slate-100 pb-4 cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="p-2 rounded-2xl bg-slate-100 text-slate-600 group-hover:bg-slate-200 transition-colors"
                    >
                      {expandedBlocks['unassigned'] ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </button>
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Temas Generales (Sin Bloque Asignado)
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl font-bold text-slate-900 group-hover:text-slate-700">
                          Otros Temas ({unassignedTopics.length} {unassignedTopics.length === 1 ? 'tema' : 'temas'})
                        </h2>
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800">
                          ({getBlockQuestionsCount(unassignedTopics)} {getBlockQuestionsCount(unassignedTopics) === 1 ? 'pregunta' : 'preguntas'})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {expandedBlocks['unassigned'] && (
                  <div className="space-y-4">
                  {unassignedTopics.map((topic) => {
                    const topicQuestionsCount = getTopicQuestionsCount(topic);
                    return (
                    <div
                      key={topic.id}
                      className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <span className="px-2.5 py-1 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 font-extrabold text-xs shrink-0">
                            Tema {topic.order_index}
                          </span>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-base font-bold text-slate-900">{topic.title}</h3>
                              <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200/80 text-indigo-700">
                                ({topicQuestionsCount} {topicQuestionsCount === 1 ? 'pregunta' : 'preguntas'})
                              </span>
                            </div>
                            {topic.description && (
                              <p className="text-xs text-slate-500">{topic.description}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Botón Reglas Clasificador */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTopicForRules(topic);
                              setShowRulesModal(true);
                            }}
                            className="px-2.5 py-1 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200/90 text-purple-800 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="Configurar leyes y palabras clave para clasificar preguntas por su justificación"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                            <span>Reglas Clasificador</span>
                            {(() => {
                              const r = getTopicRules(topic);
                              const count = (r.laws?.length || 0) + (r.keywords?.length || 0);
                              return count > 0 ? (
                                <span className="px-1.5 py-0.2 rounded-full bg-purple-200 text-purple-900 text-[10px] font-extrabold">
                                  {count}
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-600 text-[10px] font-medium">
                                  0
                                </span>
                              );
                            })()}
                          </button>

                          <button
                            onClick={() => {
                              setEditingTopicId(topic.id);
                              setSelectedBlockId(topic.block_id || '');
                              setTopicOrder(topic.order_index);
                              setTopicTitle(topic.title);
                              setTopicDesc(topic.description || '');
                              setShowTopicModal(true);
                            }}
                            className="p-1.5 rounded-lg hover:bg-white text-slate-500 hover:text-slate-900"
                            title="Editar Tema"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteTopic(topic.id)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-500 hover:text-rose-600"
                            title="Eliminar Tema"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* GESTIÓN DE SUBAPARTADOS DEL TEMA */}
                      <div className="pt-3 border-t border-slate-200/60">
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-indigo-600" />
                            Subapartados del Tema ({topic.subtopics?.length || 1})
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSubtopicTopicId(topic.id);
                              setEditingSubtopicId(null);
                              setSubtopicTitle('');
                              setSubtopicOrder((topic.subtopics?.length || 0) + 1);
                              setShowSubtopicModal(true);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Añadir Subapartado Especial</span>
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {topic.subtopics && topic.subtopics.length > 0 ? (
                            topic.subtopics
                              .slice()
                              .sort((a: any, b: any) => (a.order_index ?? 1) - (b.order_index ?? 1))
                              .map((st: any) => {
                                const stBankCount = st.questions?.[0]?.count || 0;
                                const stOffCount = officialCountsBySubtopic[st.id] || 0;
                                const stTotalCount = stBankCount + stOffCount;
                                const isGeneral = st.title?.toLowerCase() === 'general';

                                return (
                                  <div
                                    key={st.id}
                                    className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs transition-all ${
                                      isGeneral
                                        ? 'bg-white border-slate-200 text-slate-800'
                                        : 'bg-amber-50/90 border-amber-300 text-amber-950 font-bold shadow-2xs'
                                    }`}
                                  >
                                    <span>{isGeneral ? '📌' : '⚡'}</span>
                                    <span>{st.title}</span>
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                      isGeneral ? 'bg-slate-100 text-slate-600' : 'bg-amber-200 text-amber-900'
                                    }`}>
                                      {stTotalCount} {stTotalCount === 1 ? 'preg.' : 'preg.'}
                                    </span>

                                    <div className="flex items-center gap-0.5 ml-1">
                                      <a
                                        href={`/admin/questions?topicId=${topic.id}&subtopicId=${st.id}&bulk=true`}
                                        className="p-1 text-slate-400 hover:text-purple-600 rounded cursor-pointer"
                                        title="Subir batería de preguntas de golpe a este subapartado"
                                      >
                                        <Sparkles className="w-3 h-3 text-purple-600" />
                                      </a>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSubtopicTopicId(topic.id);
                                          setEditingSubtopicId(st.id);
                                          setSubtopicTitle(st.title);
                                          setSubtopicOrder(st.order_index ?? 1);
                                          setShowSubtopicModal(true);
                                        }}
                                        className="p-1 text-slate-400 hover:text-indigo-600 rounded cursor-pointer"
                                        title="Editar Subapartado"
                                      >
                                        <Edit3 className="w-3 h-3" />
                                      </button>
                                      {!isGeneral && (
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteSubtopic(st.id, topic.id)}
                                          className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                                          title="Eliminar Subapartado (preguntas pasarán a General)"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                          ) : (
                            <span className="text-xs text-slate-400 italic">Sin subapartados</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                  })}
                </div>
              )}
            </div>
          )}

            {blocks.length === 0 && unassignedTopics.length === 0 && (
              <div className="p-12 text-center rounded-3xl bg-white border border-dashed border-slate-300">
                <Boxes className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-900">Temario vacío</h3>
                <p className="text-xs text-slate-500 mt-1 mb-4">
                  Crea tu primer Bloque o Tema para empezar a organizar tu oposición.
                </p>
              </div>
            )}
          </div>
        )}

        {/* MODAL BLOQUE */}
        {showBlockModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-900">
                  {editingBlockId ? 'Editar Bloque' : 'Nuevo Bloque'}
                </h3>
                <button onClick={() => setShowBlockModal(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveBlock} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Número / Orden del Bloque
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={blockOrder}
                    onChange={(e) => setBlockOrder(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Título del Bloque
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Bloque I: Organización del Estado y Derecho Constitucional"
                    value={blockTitle}
                    onChange={(e) => setBlockTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Descripción (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Materias comprendidas en este bloque..."
                    value={blockDesc}
                    onChange={(e) => setBlockDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowBlockModal(false)}
                    className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-sm font-bold bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    Guardar Bloque
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL TEMA */}
        {showTopicModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-900">
                  {editingTopicId ? 'Editar Tema' : 'Nuevo Tema'}
                </h3>
                <button onClick={() => setShowTopicModal(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveTopic} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Bloque al que pertenece (Opcional)
                  </label>
                  <select
                    value={selectedBlockId}
                    onChange={(e) => setSelectedBlockId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Sin Bloque Asignado (General)</option>
                    {blocks.map(b => (
                      <option key={b.id} value={b.id}>
                        Bloque {b.order_index}: {b.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Número / Orden del Tema
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={topicOrder}
                    onChange={(e) => setTopicOrder(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Título del Tema
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. La Constitución Española de 1978: Principios Generales"
                    value={topicTitle}
                    onChange={(e) => setTopicTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Descripción (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Leyes, normativas de referencia..."
                    value={topicDesc}
                    onChange={(e) => setTopicDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowTopicModal(false)}
                    className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    Guardar Tema
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL SUBAPARTADO ESPECIAL */}
        {showSubtopicModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-xl animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {editingSubtopicId ? 'Editar Subapartado' : 'Nuevo Subapartado Especial'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Infracciones, régimen sancionador, competencias, etc.
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowSubtopicModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveSubtopic} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Título del Subapartado
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Régimen Sancionador e Infracciones, Competencias Municipales..."
                    value={subtopicTitle}
                    onChange={(e) => setSubtopicTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                  />
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    <span className="text-[10px] text-slate-400">Sugerencias:</span>
                    {['Régimen Sancionador', 'Infracciones y Sanciones', 'Competencias Municipales', 'Procedimiento y Plazos'].map(sug => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setSubtopicTitle(sug)}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-semibold cursor-pointer"
                      >
                        + {sug}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Orden dentro del Tema
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={subtopicOrder}
                    onChange={(e) => setSubtopicOrder(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowSubtopicModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm cursor-pointer"
                  >
                    Guardar Subapartado
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL DE REGLAS DE CLASIFICACIÓN POR TEMA */}
        <TopicRulesModal
          isOpen={showRulesModal}
          topic={selectedTopicForRules}
          allTopics={topics}
          supabase={supabase}
          onClose={() => {
            setShowRulesModal(false);
            setSelectedTopicForRules(null);
          }}
          onRulesSaved={handleRulesSaved}
        />

        {/* MODAL SIMULADOR GENERAL DE CLASIFICACIÓN */}
        <TopicClassifierSandboxModal
          isOpen={showSandboxModal}
          topics={topics}
          onClose={() => setShowSandboxModal(false)}
          onEditTopicRules={(t) => {
            setSelectedTopicForRules(t);
            setShowRulesModal(true);
          }}
        />

        {/* MODAL TABLA GENERAL DE PALABRAS CLAVE */}
        <AllTopicsRulesModal
          isOpen={showAllRulesModal}
          onClose={() => setShowAllRulesModal(false)}
          topics={topics}
          blocks={blocks}
          supabase={supabase}
          onAllRulesSaved={() => {
            fetchData();
          }}
        />

      </main>
    </div>
  );
}
