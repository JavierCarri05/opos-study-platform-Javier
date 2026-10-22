'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Sidebar } from '@/components/Sidebar';
import { Profile, OfficialExam, OfficialExamQuestion } from '@/lib/types';
import { 
  Award, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  Save, 
  Clock, 
  FileText, 
  CheckCheck,
  Zap,
  ArrowRight,
  BookOpen,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  UploadCloud,
  Sparkles,
  CheckCircle2,
  Loader2,
  ArrowDownAZ,
  Calendar,
  Search,
  Tag,
} from 'lucide-react';
import { BulkImportModal } from '@/components/BulkImportModal';
import { ParsedQuestionItem } from '@/lib/bulkParser';
import { resolveTopicSubtopicId } from '@/lib/topicHelper';
import { matchTopicFromReference, classifyQuestionByKeywords } from '@/lib/autoClassifier';
import { DoubtfulQuestionsModal, DoubtfulItem } from '@/components/DoubtfulQuestionsModal';
import { AllTopicsRulesModal } from '@/components/AllTopicsRulesModal';

interface InlineQuestionEditorProps {
  question: OfficialExamQuestion;
  blocks: any[];
  topics: any[];
  onSave: (data: {
    id: string;
    question_number: number;
    question_text: string;
    options: string[];
    correct_option: number;
    explanation: string;
    subtopic_id: string | null;
    topic_id?: string | null;
  }) => Promise<boolean>;
  onCancel: () => void;
}

function InlineQuestionEditor({
  question,
  blocks,
  topics,
  onSave,
  onCancel,
}: InlineQuestionEditorProps) {
  const [num, setNum] = useState<number>(question.question_number);
  const [text, setText] = useState<string>(question.question_text);
  const [options, setOptions] = useState<string[]>(
    Array.isArray(question.options) ? [...question.options] : ['', '', '']
  );
  const [correct, setCorrect] = useState<number>(question.correct_option ?? 0);
  const [exp, setExp] = useState<string>(question.explanation || '');

  const supabase = createClient();

  // Determinar asignación de tema inicial
  const initialSubId = question.subtopic_id || '';
  const initialTopic = topics.find(t => 
    t.id === question.subtopics?.topic_id ||
    t.id === question.subtopics?.topics?.id ||
    t.subtopics?.some((st: any) => st.id === initialSubId)
  );

  const [blockId, setBlockId] = useState<string>(
    initialTopic?.block_id ? initialTopic.block_id : (initialTopic ? 'unassigned' : '')
  );
  const [topicId, setTopicId] = useState<string>(initialTopic?.id || '');
  const [subtopicId, setSubtopicId] = useState<string>(initialSubId || '');
  const [saving, setSaving] = useState(false);

  const handleBlockChange = (bId: string) => {
    setBlockId(bId);
    const available = bId === ''
      ? topics
      : bId === 'unassigned'
      ? topics.filter(t => !t.block_id)
      : topics.filter(t => t.block_id === bId);
    if (available.length > 0) {
      const alreadyInBlock = available.find(t => t.id === topicId);
      if (alreadyInBlock) {
        setTopicId(alreadyInBlock.id);
        const subExists = alreadyInBlock.subtopics?.some((s: any) => s.id === subtopicId);
        if (!subExists) setSubtopicId(alreadyInBlock.subtopics?.[0]?.id || '');
      } else {
        setTopicId(available[0].id);
        setSubtopicId(available[0].subtopics?.[0]?.id || '');
      }
    } else {
      setTopicId('');
      setSubtopicId('');
    }
  };

  const handleTopicChange = (tId: string) => {
    setTopicId(tId);
    if (tId) {
      const matched = topics.find(t => t.id === tId);
      if (matched?.block_id) {
        setBlockId(matched.block_id);
      } else if (matched && !matched.block_id) {
        setBlockId('unassigned');
      }
      setSubtopicId(matched?.subtopics?.[0]?.id || '');
    } else {
      setSubtopicId('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      alert('Por favor, introduce el enunciado de la pregunta.');
      return;
    }
    if (options.some(o => !o.trim())) {
      alert('Todas las opciones de respuesta deben estar rellenas.');
      return;
    }

    setSaving(true);
    // Resolver subtopic_id de forma transparente para el tema elegido
    const resolvedSub = await resolveTopicSubtopicId(topicId, topics, supabase, subtopicId);

    await onSave({
      id: question.id,
      question_number: num,
      question_text: text,
      options,
      correct_option: correct,
      explanation: exp,
      subtopic_id: resolvedSub,
      topic_id: topicId || null,
    });
    setSaving(false);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-indigo-50/60 via-white to-white border-2 border-indigo-500 shadow-md ring-4 ring-indigo-500/10 space-y-4 transition-all"
    >
      {/* Cabecera del editor inline */}
      <div className="flex items-center justify-between pb-3 border-b border-indigo-100">
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs font-black flex items-center gap-1.5 shadow-2xs">
            <Edit3 className="w-3.5 h-3.5" />
            Editando Pregunta Nº {num}
          </span>
          <span className="text-xs text-indigo-700/80 font-semibold hidden sm:inline">
            Modificando directamente sobre esta pregunta
          </span>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center gap-1 transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
          Cancelar
        </button>
      </div>

      {/* Nº de Pregunta y Enunciado */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="w-full sm:w-28 shrink-0">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
            Nº Pregunta
          </label>
          <input
            type="number"
            min={1}
            required
            value={num}
            onChange={(e) => setNum(parseInt(e.target.value) || 1)}
            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex-1">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
            Enunciado Oficial
          </label>
          <textarea
            required
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribe el enunciado de la pregunta..."
            className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-snug resize-y"
          />
        </div>
      </div>

      {/* Clasificación en Temario (Bloque y Tema) */}
      <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200/80 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase text-indigo-950 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
            Clasificar en Bloque y Tema (Para Repaso Anki y Simulacros)
          </label>
          <div className="flex items-center gap-2">
            {!topicId && (
              <button
                type="button"
                onClick={() => {
                  const match = classifyQuestionByKeywords(
                    { question_text: text, explanation: exp, options },
                    topics
                  );
                  if (match) {
                    handleTopicChange(match.topic.id);
                    alert(`✅ Tema detectado por la justificación: "${match.topic.title}"\n\n• ${match.reason}`);
                  } else {
                    alert('ℹ️ No se detectaron palabras clave o leyes en la justificación de esta pregunta.\n\nPor favor, escribe el artículo/ley en la justificación o selecciona el tema a mano.');
                  }
                }}
                className="text-[11px] text-purple-700 hover:text-purple-950 font-bold flex items-center gap-1 cursor-pointer bg-purple-100/80 hover:bg-purple-100 px-2 py-0.5 rounded-md transition-colors"
                title="Detectar tema automáticamente por la justificación legal"
              >
                <Sparkles className="w-3 h-3 text-purple-600" />
                Auto-detectar tema
              </button>
            )}
            {topicId && (
              <button
                type="button"
                onClick={() => { setBlockId(''); setTopicId(''); }}
                className="text-[11px] text-indigo-700 hover:text-indigo-950 font-bold underline cursor-pointer"
              >
                Quitar tema
              </button>
            )}
          </div>
        </div>

        <div className={`grid grid-cols-1 ${blocks.length > 0 ? 'sm:grid-cols-2' : ''} gap-2.5`}>
          {blocks.length > 0 && (
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                Bloque
              </label>
              <select
                value={blockId}
                onChange={(e) => handleBlockChange(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Todos los Bloques --</option>
                {blocks.map(b => (
                  <option key={b.id} value={b.id}>
                    Bloque {b.order_index}: {b.title}
                  </option>
                ))}
                {topics.some(t => !t.block_id) && (
                  <option value="unassigned">Temas Sin Bloque</option>
                )}
              </select>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
              Tema
            </label>
            <select
              value={topicId}
              onChange={(e) => handleTopicChange(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">-- Sin tema asignado (Solo examen oficial) --</option>
              {blockId === '' ? (
                <>
                  {blocks.map(b => {
                    const bTopics = topics.filter(t => t.block_id === b.id).sort((x, y) => (x.order_index ?? 0) - (y.order_index ?? 0));
                    if (bTopics.length === 0) return null;
                    return (
                      <optgroup key={b.id} label={`Bloque ${b.order_index}: ${b.title}`}>
                        {bTopics.map(t => (
                          <option key={t.id} value={t.id}>
                            Tema {t.order_index}: {t.title}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                  {topics.some(t => !t.block_id) && (
                    <optgroup label="Temas Sin Bloque">
                      {topics.filter(t => !t.block_id).sort((x, y) => (x.order_index ?? 0) - (y.order_index ?? 0)).map(t => (
                        <option key={t.id} value={t.id}>
                          Tema {t.order_index}: {t.title}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </>
              ) : (
                (blockId === 'unassigned'
                  ? topics.filter(t => !t.block_id)
                  : topics.filter(t => t.block_id === blockId)
                ).sort((x, y) => (x.order_index ?? 0) - (y.order_index ?? 0)).map(t => (
                  <option key={t.id} value={t.id}>
                    Tema {t.order_index}: {t.title}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Subapartado Selector si el tema tiene subapartados especiales */}
        {(() => {
          const currentTopic = topics.find(t => t.id === topicId);
          const currentSubtopics = currentTopic?.subtopics || [];
          if (!topicId || currentSubtopics.length <= 1) return null;
          return (
            <div className="pt-2 border-t border-indigo-100 flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <label className="text-[10px] font-bold uppercase text-indigo-950 flex items-center gap-1 shrink-0">
                <span>⚡ Subapartado Especial:</span>
              </label>
              <select
                value={subtopicId}
                onChange={(e) => setSubtopicId(e.target.value)}
                className="flex-1 w-full px-2.5 py-1.5 rounded-lg bg-white border border-indigo-300 text-xs font-semibold text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {currentSubtopics.map((st: any) => (
                  <option key={st.id} value={st.id}>
                    {st.title === 'General' ? 'General (Preguntas estándar del tema)' : `⚡ ${st.title}`}
                  </option>
                ))}
              </select>
            </div>
          );
        })()}
      </div>

      {/* Opciones con selección directa de respuesta correcta */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="block text-xs font-bold uppercase text-slate-700">
            Texto de las Opciones de Respuesta
          </label>
          <span className="text-[11px] text-slate-500 font-medium">
            Pulsa en &ldquo;Hacer correcta&rdquo; o en la letra para cambiar la respuesta
          </span>
        </div>

        <div className="space-y-2">
          {options.map((val, idx) => {
            const label = ['A', 'B', 'C', 'D', 'E'][idx] || `${idx + 1}`;
            const isCorr = correct === idx;
            return (
              <div
                key={idx}
                className={`flex items-center gap-2.5 p-2 rounded-xl border transition-all ${
                  isCorr
                    ? 'bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
                }`}
              >
                {/* Botón de la letra con estado de selección */}
                <button
                  type="button"
                  onClick={() => setCorrect(idx)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs transition-all shrink-0 cursor-pointer ${
                    isCorr
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300'
                  }`}
                  title={`Marcar Opción ${label} como correcta`}
                >
                  {isCorr ? <Check className="w-4 h-4 stroke-[3]" /> : label}
                </button>

                <input
                  type="text"
                  required
                  placeholder={`Texto de la Opción ${label}...`}
                  value={val}
                  onChange={(e) => {
                    const updated = [...options];
                    updated[idx] = e.target.value;
                    setOptions(updated);
                  }}
                  className="flex-1 bg-transparent border-0 px-2 text-xs text-slate-900 focus:outline-none font-medium"
                />

                {/* Badge o botón explícito de hacer correcta */}
                {isCorr ? (
                  <span className="text-[10px] font-black text-emerald-800 px-2.5 py-1 rounded-full bg-emerald-100 border border-emerald-300 mr-1 shrink-0 flex items-center gap-1 shadow-2xs">
                    <Check className="w-3 h-3 stroke-[3]" />
                    CORRECTA
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCorrect(idx)}
                    className="text-[10px] font-bold text-slate-500 hover:text-emerald-800 hover:bg-emerald-100/70 border border-slate-200 hover:border-emerald-300 bg-white px-2.5 py-1 rounded-full transition-all mr-1 shrink-0 cursor-pointer flex items-center gap-1"
                    title={`Hacer que la Opción ${label} sea la respuesta correcta`}
                  >
                    <span>Hacer correcta</span>
                  </button>
                )}

                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => {
                      const updated = options.filter((_, i) => i !== idx);
                      setOptions(updated);
                      if (correct === idx) setCorrect(0);
                      else if (correct > idx) setCorrect(prev => prev - 1);
                    }}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors mr-1 cursor-pointer"
                    title="Eliminar opción"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {options.length < 5 && (
          <button
            type="button"
            onClick={() => setOptions([...options, ''])}
            className="w-full py-1.5 px-3 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            + Añadir Opción {['A', 'B', 'C', 'D', 'E'][options.length] || ''}
          </button>
        )}
      </div>

      {/* Justificación oficial */}
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
          Justificación o plantilla oficial de corrección
        </label>
        <input
          type="text"
          required
          placeholder="Ej. Art. 116.2 CE o criterio del Tribunal Calificador"
          value={exp}
          onChange={(e) => setExp(e.target.value)}
          className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Botones de acción inferiores */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-200">
        <span className="text-[11px] text-slate-400 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-indigo-500" />
          Edición en el mismo lugar de la lista
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Guardando...' : 'Actualizar Pregunta'}
          </button>
        </div>
      </div>
    </form>
  );
}

export default function AdminOfficialExamsPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExam, setSelectedExam] = useState<any | null>(null);
  const selectedExamIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedExamIdRef.current = selectedExam?.id || null;
  }, [selectedExam]);

  const [questions, setQuestions] = useState<OfficialExamQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  // Ordenador de exámenes oficiales en 2 categorías: Por antigüedad (más nuevos primero) o Por orden alfabético
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
        // Categoría 1: Por antigüedad (apareciendo primero los más nuevos según el año)
        const yearDiff = (b.year || 0) - (a.year || 0);
        if (yearDiff !== 0) return yearDiff;
        // Criterio secundario: Por orden alfabético para exámenes del mismo año
        return (a.title || '').localeCompare(b.title || '', 'es', { sensitivity: 'base' });
      } else {
        // Categoría 2: Por orden alfabético (A-Z)
        const titleDiff = (a.title || '').localeCompare(b.title || '', 'es', { sensitivity: 'base' });
        if (titleDiff !== 0) return titleDiff;
        // Criterio secundario: Más nuevos primero si tienen el mismo título
        return (b.year || 0) - (a.year || 0);
      }
    });
  }, [exams, examSortBy, examSearch]);

  // Modal Nuevo/Editar Examen Convocatoria
  const [showExamModal, setShowExamModal] = useState(false);
  const [examTitle, setExamTitle] = useState('');
  const [examYear, setExamYear] = useState<number>(new Date().getFullYear());
  const [examDesc, setExamDesc] = useState('');
  const [examDuration, setExamDuration] = useState<number>(90);
  const [examPenalty, setExamPenalty] = useState<number>(0.33);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);

  // Formulario pregunta dentro del examen
  const [qNumber, setQNumber] = useState<number>(1);
  const [qText, setQText] = useState('');
  const [optionsList, setOptionsList] = useState<string[]>(['', '', '']); // Por defecto 3 opciones (A, B, C)
  const [correctOpt, setCorrectOpt] = useState<number>(0);
  const [qExp, setQExp] = useState('');
  const [savingQ, setSavingQ] = useState(false);
  const [successToast, setSuccessToast] = useState(false);

  // Edición inline sobre la propia pregunta
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [justSavedQId, setJustSavedQId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Importador en bloque
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkStatus, setBulkStatus] = useState<string | null>(null);

  // Temario (para clasificar preguntas en bloque y tema)
  const [blocks, setBlocks] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [qBlockId, setQBlockId] = useState<string>('');
  const [qTopicId, setQTopicId] = useState<string>('');
  const [qSubtopicId, setQSubtopicId] = useState<string>('');

  // Filtros y Búsqueda de preguntas dentro del examen seleccionado
  const [qSearchTerm, setQSearchTerm] = useState('');
  const [qFilterClassification, setQFilterClassification] = useState<'all' | 'classified' | 'unclassified'>('all');
  const [qFilterTopic, setQFilterTopic] = useState<string>('all');
  const [qFilterSubtopic, setQFilterSubtopic] = useState<string>('all');
  const [isAutoClassifying, setIsAutoClassifying] = useState(false);
  const [showDoubtfulModal, setShowDoubtfulModal] = useState(false);
  const [doubtfulList, setDoubtfulList] = useState<DoubtfulItem[]>([]);
  const [showAllRulesModal, setShowAllRulesModal] = useState(false);

  const handleApproveSingleDoubtful = async (qId: string, topicId: string) => {
    const resolvedSub = await resolveTopicSubtopicId(topicId, topics, supabase);
    if (!resolvedSub) throw new Error('No se pudo encontrar o crear subapartado para este tema.');
    const { error } = await supabase
      .from('official_exam_questions')
      .update({ subtopic_id: resolvedSub })
      .eq('id', qId);
    if (error) throw error;
    if (selectedExam) {
      loadQuestions(selectedExam.id);
    }
  };

  const handleApproveAllDoubtful = async (assignments: { questionId: string; topicId: string }[]) => {
    for (const a of assignments) {
      const resolvedSub = await resolveTopicSubtopicId(a.topicId, topics, supabase);
      if (resolvedSub) {
        await supabase
          .from('official_exam_questions')
          .update({ subtopic_id: resolvedSub })
          .eq('id', a.questionId);
      }
    }
    if (selectedExam) {
      await loadQuestions(selectedExam.id);
    }
    alert(`✅ ¡Listo! Se asignaron ${assignments.length} preguntas a sus respectivos temas.`);
  };


  const fetchExams = async (preserveExamId?: string) => {
    if (exams.length === 0) {
      setLoading(true);
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: myProf } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(myProf);
    }

    const { data: blocksData } = await supabase
      .from('blocks')
      .select('*')
      .order('order_index', { ascending: true });

    if (blocksData) {
      setBlocks(blocksData);
    }

    const { data: topicsData } = await supabase
      .from('topics')
      .select('*, subtopics(*)')
      .order('order_index', { ascending: true });

    if (topicsData) {
      setTopics(topicsData);
    }

    const { data, error } = await supabase
      .from('official_exams')
      .select('*, official_exam_questions(count)')
      .order('year', { ascending: false });

    if (data && data.length > 0) {
      setExams(data);
      const previousSelectedId = selectedExamIdRef.current;
      const urlExamId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('examId') : null;
      
      // Prioridad de selección:
      // 1. preserveExamId explícito pasado por el llamador
      // 2. previousSelectedId (el examen que ya estaba viendo el usuario)
      // 3. urlExamId (parámetro de URL en la carga inicial)
      // 4. data[0] (primer examen disponible)
      const targetId = preserveExamId || previousSelectedId || urlExamId;
      const targetExam = targetId ? data.find((e: any) => e.id === targetId) : null;
      const chosenExam = targetExam || data[0];

      if (chosenExam) {
        setSelectedExam(chosenExam);
        selectedExamIdRef.current = chosenExam.id;

        // Mantener la URL en sincronía con el examen seleccionado sin recargar la página
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          if (url.searchParams.get('examId') !== chosenExam.id) {
            url.searchParams.set('examId', chosenExam.id);
            window.history.replaceState({}, '', url.toString());
          }
        }

        // Cargar preguntas si es la carga inicial o si cambió de examen
        if (!previousSelectedId || previousSelectedId !== chosenExam.id) {
          loadQuestions(chosenExam.id);
        }
      }
    } else if (data && data.length === 0) {
      setExams([]);
      setSelectedExam(null);
      selectedExamIdRef.current = null;
      setQuestions([]);
    }
    setLoading(false);
  };

  const loadQuestions = async (examId: string) => {
    const { data } = await supabase
      .from('official_exam_questions')
      .select('*, subtopics(id, title, topic_id, topics(id, title, order_index, block_id))')
      .eq('exam_id', examId)
      .order('question_number', { ascending: true });

    if (data) {
      setQuestions(data);
      setQNumber(data.length + 1);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  const handleSelectExam = (exam: any) => {
    selectedExamIdRef.current = exam.id;
    setSelectedExam(exam);
    loadQuestions(exam.id);
    setInlineEditingId(null);
    setQSearchTerm('');
    setQFilterClassification('all');
    setQFilterTopic('all');
    setQFilterSubtopic('all');

    // Sincronizar URL para que si se recarga o se consulta la URL, apunte al examen actual
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('examId', exam.id);
      window.history.replaceState({}, '', url.toString());
    }
  };

  // Preguntas filtradas dentro del examen actual
  const filteredExamQuestions = useMemo(() => {
    return questions.filter(q => {
      const matchesSearch = !qSearchTerm.trim() ||
        q.question_text.toLowerCase().includes(qSearchTerm.toLowerCase()) ||
        (q.explanation || '').toLowerCase().includes(qSearchTerm.toLowerCase()) ||
        String(q.question_number).includes(qSearchTerm.trim());

      const matchesClass =
        qFilterClassification === 'all'
          ? true
          : qFilterClassification === 'classified'
          ? !!q.subtopic_id
          : !q.subtopic_id;

      const matchesTopic =
        qFilterTopic === 'all'
          ? true
          : q.subtopics?.topic_id === qFilterTopic ||
            topics.find(t => t.id === qFilterTopic)?.subtopics?.some((s: any) => s.id === q.subtopic_id);

      const matchesSubtopic =
        qFilterSubtopic === 'all'
          ? true
          : q.subtopic_id === qFilterSubtopic;

      return matchesSearch && matchesClass && matchesTopic && matchesSubtopic;
    });
  }, [questions, qSearchTerm, qFilterClassification, qFilterTopic, qFilterSubtopic, topics]);

  // Herramienta de auto-clasificación masiva por palabras clave y leyes con descarte estricto ante dudas
  const handleAutoClassifyExamQuestions = async () => {
    if (!selectedExam || questions.length === 0) return;
    let targetQuestions = questions.filter(q => !q.subtopic_id);

    if (targetQuestions.length === 0) {
      const confirmReclassify = confirm(
        'Todas las preguntas de este examen ya tienen un tema asignado.\n\n' +
        '¿Deseas volver a clasificar TODAS las preguntas del examen aplicando las palabras clave y leyes actuales?'
      );
      if (!confirmReclassify) return;
      targetQuestions = [...questions];
    }

    setIsAutoClassifying(true);
    let classifiedCount = 0;
    const doubtful: DoubtfulItem[] = [];
    const topicSummary: Record<string, number> = {};

    try {
      for (const q of targetQuestions) {
        // Ejecutar clasificador inteligente centrado en la justificación de la pregunta
        const classification = classifyQuestionByKeywords(
          {
            question_text: q.question_text,
            explanation: q.explanation || '',
            options: q.options || [],
          },
          topics
        );

        if (classification) {
          if (classification.confidence === 'high') {
            const resolvedSub = await resolveTopicSubtopicId(classification.topic.id, topics, supabase);
            if (resolvedSub) {
              await supabase
                .from('official_exam_questions')
                .update({ subtopic_id: resolvedSub })
                .eq('id', q.id);
              classifiedCount++;
              topicSummary[classification.topic.title] = (topicSummary[classification.topic.title] || 0) + 1;
            }
          } else {
            doubtful.push({
              questionId: q.id,
              questionNumber: q.question_number,
              questionText: q.question_text,
              classification
            });
          }
        }
      }

      const currentExamId = selectedExam?.id || selectedExamIdRef.current;
      if (currentExamId && classifiedCount > 0) {
        await loadQuestions(currentExamId);
      }

      if (doubtful.length > 0) {
        setDoubtfulList(doubtful);
        setShowDoubtfulModal(true);
      } else if (classifiedCount > 0) {
        const breakdown = Object.entries(topicSummary)
          .map(([tTitle, count]) => `• ${tTitle}: ${count} pregunta(s)`)
          .join('\n');

        alert(
          `🎉 ¡Clasificación completada con éxito por justificación!\n\n` +
          `• ${classifiedCount} pregunta(s) asignadas con 100% certeza a su tema:\n\n${breakdown}`
        );
      } else {
        alert(
          `ℹ️ No se detectaron leyes o palabras clave en las justificaciones de estas preguntas.\n\n` +
          `Abre "Palabras Clave de Temas" para revisar las leyes asignadas a tus temas o clasifícalas manualmente usando "Editar".`
        );
      }
    } catch (err: any) {
      alert('Error durante la clasificación: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsAutoClassifying(false);
    }
  };

  // Guardar Examen (Convocatoria)
  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    let createdExamId: string | null = null;
    try {
      if (editingExamId) {
        const { error } = await supabase
          .from('official_exams')
          .update({
            title: examTitle,
            year: examYear,
            description: examDesc,
            duration_minutes: examDuration,
            penalty_ratio: examPenalty,
          })
          .eq('id', editingExamId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('official_exams')
          .insert({
            title: examTitle,
            year: examYear,
            description: examDesc,
            duration_minutes: examDuration,
            penalty_ratio: examPenalty,
          })
          .select()
          .single();
        if (error) throw error;
        if (data) {
          createdExamId = data.id;
          setSelectedExam(data);
          loadQuestions(data.id);
        }
      }

      setShowExamModal(false);
      setEditingExamId(null);
      setExamTitle('');
      setExamDesc('');
      const targetId = editingExamId || createdExamId || selectedExamIdRef.current;
      fetchExams(targetId || undefined);
    } catch (err: any) {
      alert('Error al guardar examen: ' + (err.message || 'Verifica que ejecutaste official_exams_setup.sql'));
    }
  };

  const handleDeleteExam = async (id: string) => {
    if (!confirm('¿Eliminar este examen y todas sus preguntas?')) return;
    await supabase.from('official_exams').delete().eq('id', id);
    if (selectedExamIdRef.current === id || selectedExam?.id === id) {
      selectedExamIdRef.current = null;
      setSelectedExam(null);
      setQuestions([]);
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('examId');
        window.history.replaceState({}, '', url.toString());
      }
    }
    fetchExams();
  };

  // Guardar pregunta nueva 1 a 1 en el examen seleccionado
  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExam) return;

    setSavingQ(true);
    const opts = optionsList.map(o => o.trim());

    try {
      const resolvedSub = await resolveTopicSubtopicId(qTopicId, topics, supabase, qSubtopicId);

      const { error } = await supabase
        .from('official_exam_questions')
        .insert({
          exam_id: selectedExam.id,
          question_number: qNumber,
          question_text: qText.trim(),
          options: opts,
          correct_option: correctOpt,
          explanation: qExp.trim(),
          subtopic_id: resolvedSub,
        });
      if (error) throw error;

      setQText('');
      setOptionsList(['', '', '']);
      setCorrectOpt(0);
      setQExp('');
      setSavingQ(false);
      setSuccessToast(true);
      setTimeout(() => setSuccessToast(false), 2500);

      const currentExamId = selectedExam.id;
      loadQuestions(currentExamId);
      fetchExams(currentExamId);
    } catch (err: any) {
      alert('Error: ' + err.message);
      setSavingQ(false);
    }
  };

  // Guardar cambios directamente sobre la pregunta en la lista (inline)
  const handleSaveInlineQuestion = async (updated: {
    id: string;
    question_number: number;
    question_text: string;
    options: string[];
    correct_option: number;
    explanation: string;
    subtopic_id: string | null;
    topic_id?: string | null;
  }) => {
    try {
      const { error } = await supabase
        .from('official_exam_questions')
        .update({
          question_number: updated.question_number,
          question_text: updated.question_text.trim(),
          options: updated.options.map(o => o.trim()),
          correct_option: updated.correct_option,
          explanation: updated.explanation.trim(),
          subtopic_id: updated.subtopic_id || null,
        })
        .eq('id', updated.id);

      if (error) throw error;

      // Resolver el tema destino de forma directa y determinista
      const targetTopic = updated.topic_id
        ? topics.find(t => t.id === updated.topic_id)
        : updated.subtopic_id
        ? topics.find(t => t.subtopics?.some((s: any) => s.id === updated.subtopic_id))
        : null;

      let subtopicObj: any = null;
      if (targetTopic) {
        const foundSub = targetTopic.subtopics?.find((s: any) => s.id === updated.subtopic_id);
        subtopicObj = {
          id: updated.subtopic_id || '',
          title: foundSub?.title || 'General',
          topic_id: targetTopic.id,
          topics: {
            id: targetTopic.id,
            title: targetTopic.title,
            order_index: targetTopic.order_index,
            block_id: targetTopic.block_id,
          }
        };

        if (updated.subtopic_id) {
          if (!targetTopic.subtopics) targetTopic.subtopics = [];
          if (!targetTopic.subtopics.some((s: any) => s.id === updated.subtopic_id)) {
            (targetTopic.subtopics as any).push({
              id: updated.subtopic_id,
              title: foundSub?.title || 'General',
              topic_id: targetTopic.id,
              order_index: 1,
              created_at: new Date().toISOString(),
            });
          }
        }
      }

      // Actualizamos questions en el estado local de forma inmediata sin saltos de scroll
      setQuestions(prev => prev.map(q => {
        if (q.id === updated.id) {
          return {
            ...q,
            question_number: updated.question_number,
            question_text: updated.question_text.trim(),
            options: updated.options.map(o => o.trim()),
            correct_option: updated.correct_option,
            explanation: updated.explanation.trim(),
            subtopic_id: updated.subtopic_id || null,
            subtopics: subtopicObj,
          };
        }
        return q;
      }));

      setInlineEditingId(null);
      setJustSavedQId(updated.id);
      setTimeout(() => setJustSavedQId(null), 3000);

      const currentExamId = selectedExam?.id || selectedExamIdRef.current;
      if (currentExamId) {
        loadQuestions(currentExamId);
      }
      return true;
    } catch (err: any) {
      alert('Error al guardar: ' + err.message);
      return false;
    }
  };

  const handleDeleteQ = async (id: string) => {
    if (!confirm('¿Eliminar esta pregunta del examen?')) return;
    await supabase.from('official_exam_questions').delete().eq('id', id);
    if (inlineEditingId === id) setInlineEditingId(null);
    const currentExamId = selectedExam?.id || selectedExamIdRef.current;
    if (currentExamId) {
      loadQuestions(currentExamId);
      fetchExams(currentExamId);
    }
  };

  // Importar examen completo en bloque (con detección de [TEMA X] y leyes)
  const handleConfirmBulkExamQuestions = async (parsedQuestions: ParsedQuestionItem[]) => {
    if (!selectedExam) return;

    let startNum = questions.length + 1;
    const defaultBulkSub = qSubtopicId || (qTopicId ? await resolveTopicSubtopicId(qTopicId, topics, supabase, qSubtopicId) : null);

    const payload = [];
    for (let idx = 0; idx < parsedQuestions.length; idx++) {
      const pq = parsedQuestions[idx];
      let assignedSubId = defaultBulkSub;

      if (qSubtopicId) {
        // El usuario seleccionó explícitamente un subapartado concreto
        if (pq.topic_reference) {
          const matched = matchTopicFromReference(pq.topic_reference, topics);
          if (matched && matched.id !== qTopicId) {
            const otherSub = await resolveTopicSubtopicId(matched.id, topics, supabase);
            if (otherSub) assignedSubId = otherSub;
          } else {
            assignedSubId = qSubtopicId;
          }
        } else {
          assignedSubId = qSubtopicId;
        }
      } else if (qTopicId) {
        // El usuario seleccionó un tema concreto
        if (pq.topic_reference) {
          const matched = matchTopicFromReference(pq.topic_reference, topics);
          if (matched && matched.id !== qTopicId) {
            const otherSub = await resolveTopicSubtopicId(matched.id, topics, supabase);
            if (otherSub) assignedSubId = otherSub;
          } else {
            assignedSubId = defaultBulkSub;
          }
        } else {
          assignedSubId = defaultBulkSub;
        }
      } else {
        // Sin tema seleccionado
        if (pq.topic_reference) {
          const matched = matchTopicFromReference(pq.topic_reference, topics);
          if (matched) {
            const sub = await resolveTopicSubtopicId(matched.id, topics, supabase);
            if (sub) assignedSubId = sub;
          }
        } else {
          const autoMatch = classifyQuestionByKeywords(
            { question_text: pq.question_text, explanation: pq.explanation, options: pq.options },
            topics
          );
          if (autoMatch) {
            const sub = await resolveTopicSubtopicId(autoMatch.topic.id, topics, supabase);
            if (sub) assignedSubId = sub;
          }
        }
      }

      payload.push({
        exam_id: selectedExam.id,
        question_number: pq.question_number || (startNum + idx),
        question_text: pq.question_text,
        options: pq.options,
        correct_option: pq.correct_option,
        explanation: pq.explanation || 'Conforme a la plantilla oficial de respuestas.',
        subtopic_id: assignedSubId,
      });
    }

    const { error } = await supabase.from('official_exam_questions').insert(payload);
    if (error) throw error;

    const currentExamId = selectedExam.id;
    loadQuestions(currentExamId);
    fetchExams(currentExamId);
  };



  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900 w-full max-w-full overflow-x-hidden">
      <Sidebar profile={profile} />

      <main className="flex-1 min-w-0 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-8 space-y-8 overflow-y-auto">
        {/* Cabecera */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-6">
          <div>
            <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Award className="w-4 h-4" />
              Gestor de Convocatorias Reales
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Exámenes Oficiales Completos
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Crea exámenes reales de convocatorias pasadas (pregunta 1 a la última) para que los alumnos hagan el examen íntegro.
            </p>
          </div>

          <button
            onClick={() => {
              setEditingExamId(null);
              setExamTitle('');
              setExamYear(new Date().getFullYear());
              setExamDesc('');
              setExamDuration(90);
              setExamPenalty(0.33);
              setShowExamModal(true);
            }}
            className="px-4 py-2.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white text-sm shadow-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Crear Nuevo Examen Oficial
          </button>
        </div>

        {/* Panel en dos columnas: Lista de Exámenes a la izquierda, Contenido a la derecha */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* COLUMNA IZQUIERDA: Selector y Ordenador de Exámenes (4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Exámenes Disponibles ({sortedExams.length})
              </span>
              <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-lg shadow-2xs">
                {examSortBy === 'year' ? '📅 Más nuevos primero' : '🔤 Orden A-Z'}
              </span>
            </div>

            {/* Ordenador en 2 categorías: Por antigüedad o Por orden alfabético */}
            <div className="bg-slate-100 p-1 rounded-2xl flex items-center gap-1 shadow-2xs border border-slate-200/80">
              <button
                type="button"
                onClick={() => setExamSortBy('year')}
                className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  examSortBy === 'year'
                    ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80 font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
                title="Ordenar por antigüedad (los más nuevos primero según el año)"
              >
                <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="truncate">Por Antigüedad</span>
              </button>

              <button
                type="button"
                onClick={() => setExamSortBy('alpha')}
                className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  examSortBy === 'alpha'
                    ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80 font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
                title="Ordenar por orden alfabético (A-Z)"
              >
                <ArrowDownAZ className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="truncate">Por Orden Alfabético</span>
              </button>
            </div>

            {/* Buscador de convocatorias */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar convocatoria o año..."
                value={examSearch}
                onChange={(e) => setExamSearch(e.target.value)}
                className="w-full pl-8.5 pr-8 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs font-medium"
              />
              {examSearch && (
                <button
                  type="button"
                  onClick={() => setExamSearch('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                  title="Limpiar búsqueda"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {sortedExams.length === 0 ? (
              <div className="p-8 rounded-3xl bg-white border border-dashed border-slate-300 text-center text-xs text-slate-500">
                {examSearch
                  ? `No se encontraron exámenes oficiales que coincidan con "${examSearch}".`
                  : 'No hay exámenes oficiales creados aún. Haz clic en "Crear Nuevo Examen Oficial".'}
              </div>
            ) : (
              sortedExams.map((ex) => {
                const isSelected = selectedExam?.id === ex.id;
                const count = ex.official_exam_questions?.[0]?.count || 0;

                return (
                  <div
                    key={ex.id}
                    onClick={() => handleSelectExam(ex)}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-500 shadow-sm ring-1 ring-indigo-500'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                        Año {ex.year}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingExamId(ex.id);
                            setExamTitle(ex.title);
                            setExamYear(ex.year);
                            setExamDesc(ex.description || '');
                            setExamDuration(ex.duration_minutes);
                            setExamPenalty(ex.penalty_ratio);
                            setShowExamModal(true);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-800"
                          title="Editar datos del examen"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteExam(ex.id);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600"
                          title="Eliminar examen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 leading-snug">
                      {ex.title}
                    </h3>
                    {ex.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                        {ex.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-[11px] text-slate-500 font-semibold">
                      <span>{count} preguntas añadidas</span>
                      <span>⏱️ {ex.duration_minutes} min</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* COLUMNA DERECHA: Editor y Preguntas del Examen Seleccionado (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {selectedExam ? (
              <>
                {/* Cabecera del examen seleccionado */}
                <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                      Cargando preguntas para:
                    </span>
                    <h2 className="text-xl font-black text-slate-900">
                      {selectedExam.title} ({selectedExam.year})
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {questions.length} preguntas en el examen • {selectedExam.duration_minutes} min • Penalización -{selectedExam.penalty_ratio} por fallo
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowBulk(true)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-sm flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Subir Examen Completo de Golpe
                    </button>
                    <a
                      href={`/study/official-exam/${selectedExam.id}`}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 shadow-2xs flex items-center gap-1.5 transition-colors"
                    >
                      Probar Examen
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* MODAL DE IMPORTACIÓN RÁPIDA DE EXAMEN */}
                <BulkImportModal
                  isOpen={showBulk}
                  onClose={() => setShowBulk(false)}
                  title={`Subir Examen Oficial Completo: ${selectedExam.title}`}
                  subtitle={`Pega todas las preguntas con 3 o 4 opciones o sube el archivo .txt/.json. El sistema las insertará en orden correlativo.`}
                  onConfirmImport={handleConfirmBulkExamQuestions}
                  topics={topics}
                  blocks={blocks}
                  topicSelector={
                    <div className="p-3 bg-purple-50/60 border border-purple-200/60 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-purple-950 uppercase">
                          Asignar tema a todas estas preguntas (Opcional):
                        </label>
                        {qTopicId && (
                          <button
                            type="button"
                            onClick={() => { setQBlockId(''); setQTopicId(''); }}
                            className="text-[10px] text-purple-700 hover:text-purple-900 font-bold underline"
                          >
                            Quitar asignación
                          </button>
                        )}
                      </div>
                      <div className={`grid grid-cols-1 ${blocks.length > 0 ? 'sm:grid-cols-2' : ''} gap-2`}>
                        {blocks.length > 0 && (
                          <select
                            value={qBlockId}
                            onChange={(e) => {
                              const bId = e.target.value;
                              setQBlockId(bId);
                              const availableTopics = bId === ''
                                ? topics
                                : bId === 'unassigned'
                                ? topics.filter(t => !t.block_id)
                                : topics.filter(t => t.block_id === bId);
                              if (availableTopics.length > 0) {
                                setQTopicId(availableTopics[0].id);
                              } else {
                                setQTopicId('');
                              }
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-800"
                          >
                            <option value="">-- Todos los Bloques --</option>
                            {blocks.map(b => (
                              <option key={b.id} value={b.id}>
                                Bloque {b.order_index}: {b.title}
                              </option>
                            ))}
                          </select>
                        )}
                        <select
                          value={qTopicId}
                          onChange={(e) => {
                            setQTopicId(e.target.value);
                            setQSubtopicId('');
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-800"
                        >
                          <option value="">-- Sin tema (Solo en este examen) --</option>
                          {qBlockId === '' ? (
                            <>
                              {blocks.map(b => {
                                const bTopics = topics.filter(t => t.block_id === b.id).sort((x, y) => (x.order_index ?? 0) - (y.order_index ?? 0));
                                if (bTopics.length === 0) return null;
                                return (
                                  <optgroup key={b.id} label={`Bloque ${b.order_index}: ${b.title}`}>
                                    {bTopics.map(t => (
                                      <option key={t.id} value={t.id}>
                                        Tema {t.order_index}: {t.title}
                                      </option>
                                    ))}
                                  </optgroup>
                                );
                              })}
                              {topics.some(t => !t.block_id) && (
                                <optgroup label="Temas Sin Bloque">
                                  {topics.filter(t => !t.block_id).sort((x, y) => (x.order_index ?? 0) - (y.order_index ?? 0)).map(t => (
                                    <option key={t.id} value={t.id}>
                                      Tema {t.order_index}: {t.title}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                            </>
                          ) : (
                            (qBlockId === 'unassigned'
                              ? topics.filter(t => !t.block_id)
                              : topics.filter(t => t.block_id === qBlockId)
                            ).sort((x, y) => (x.order_index ?? 0) - (y.order_index ?? 0)).map(t => (
                              <option key={t.id} value={t.id}>
                                Tema {t.order_index}: {t.title}
                              </option>
                            ))
                          )}
                        </select>
                      </div>

                      {/* Selector de subapartado para el importador de examen si el tema tiene subapartados */}
                      {qTopicId && (() => {
                        const matchedTopic = topics.find(t => t.id === qTopicId);
                        if (!matchedTopic?.subtopics || matchedTopic.subtopics.length === 0) return null;
                        const hasSpecific = matchedTopic.subtopics.some((st: any) => st.title?.toLowerCase() !== 'general');
                        if (!hasSpecific && matchedTopic.subtopics.length <= 1) return null;

                        return (
                          <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg space-y-1 mt-1.5 animate-in fade-in">
                            <div className="flex items-center justify-between">
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1">
                                <Zap className="w-3 h-3 text-amber-600 fill-amber-500" />
                                Subapartado Especial / Sección (Opcional):
                              </label>
                              <span className="text-[9px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded">
                                {matchedTopic.subtopics.length} apartados
                              </span>
                            </div>
                            <select
                              value={qSubtopicId}
                              onChange={(e) => setQSubtopicId(e.target.value)}
                              className="w-full px-2 py-1 rounded-md bg-white border border-amber-300 text-xs text-amber-950 font-bold focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs cursor-pointer"
                            >
                              <option value="">-- Todo el Tema / General (Sin subsección específica) --</option>
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
                  }
                />

                {/* FORMULARIO PARA AÑADIR PREGUNTAS (DESPLEGABLE) */}
                <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 shadow-xs transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                        <Plus className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          Añadir Pregunta Nº {qNumber}
                          <span className="text-[10px] font-semibold text-indigo-600 px-2 py-0.5 rounded-full bg-indigo-50">
                            Nueva
                          </span>
                        </h3>
                        <p className="text-xs text-slate-500">
                          {showAddForm || questions.length === 0
                            ? 'Rellena los datos para añadir la siguiente pregunta al final del examen.'
                            : 'Pulsa para desplegar el formulario si deseas añadir una pregunta una a una.'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowAddForm(!showAddForm)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {showAddForm || questions.length === 0 ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" />
                          Ocultar formulario
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" />
                          Añadir nueva pregunta
                        </>
                      )}
                    </button>
                  </div>

                  {(showAddForm || questions.length === 0) && (
                    <div className="mt-5 pt-5 border-t border-slate-100 space-y-4">
                      {successToast && (
                        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                          <CheckCheck className="w-4 h-4 text-emerald-600" />
                          ¡Pregunta guardada en el examen oficial! Lista para la siguiente.
                        </div>
                      )}

                      <form onSubmit={handleSaveQuestion} className="space-y-4">
                        <div className="flex gap-4">
                          <div className="w-24 shrink-0">
                            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                              Nº Pregunta
                            </label>
                            <input
                              type="number"
                              min={1}
                              required
                              value={qNumber}
                              onChange={(e) => setQNumber(parseInt(e.target.value) || 1)}
                              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-900 font-bold focus:outline-none"
                            />
                          </div>

                          <div className="flex-1">
                            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                              Enunciado Oficial
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="Escribe el enunciado de la pregunta..."
                              value={qText}
                              onChange={(e) => setQText(e.target.value)}
                              className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        </div>

                        {/* VINCULACIÓN CON TEMA DEL TEMARIO */}
                        <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold uppercase text-indigo-950 flex items-center gap-1.5">
                              <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                              Clasificar en Bloque y Tema (Para Repaso Anki y Simulacros)
                            </label>
                            {qTopicId && (
                              <button
                                type="button"
                                onClick={() => { setQBlockId(''); setQTopicId(''); }}
                                className="text-[11px] text-indigo-700 hover:text-indigo-950 font-bold underline cursor-pointer"
                              >
                                Quitar tema
                              </button>
                            )}
                          </div>

                          <div className={`grid grid-cols-1 ${blocks.length > 0 ? 'sm:grid-cols-2' : ''} gap-3`}>
                            {blocks.length > 0 && (
                              <div>
                                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                  Bloque del temario
                                </label>
                                <select
                                  value={qBlockId}
                                  onChange={(e) => {
                                    const bId = e.target.value;
                                    setQBlockId(bId);
                                    const availableTopics = bId === ''
                                      ? topics
                                      : bId === 'unassigned'
                                      ? topics.filter(t => !t.block_id)
                                      : topics.filter(t => t.block_id === bId);
                                    if (availableTopics.length > 0) {
                                      setQTopicId(availableTopics[0].id);
                                    } else {
                                      setQTopicId('');
                                    }
                                  }}
                                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                  <option value="">-- Todos los Bloques --</option>
                                  {blocks.map(b => (
                                    <option key={b.id} value={b.id}>
                                      Bloque {b.order_index}: {b.title}
                                    </option>
                                  ))}
                                  {topics.some(t => !t.block_id) && (
                                    <option value="unassigned">Temas Sin Bloque</option>
                                  )}
                                </select>
                              </div>
                            )}

                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                Tema del temario
                              </label>
                              <select
                                value={qTopicId}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setQTopicId(val);
                                  const matched = topics.find(t => t.id === val);
                                  setQSubtopicId(matched?.subtopics?.[0]?.id || '');
                                }}
                                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              >
                                <option value="">-- Sin tema asignado (Solo examen oficial) --</option>
                                {qBlockId === '' ? (
                                  <>
                                    {blocks.map(b => {
                                      const bTopics = topics.filter(t => t.block_id === b.id).sort((x, y) => (x.order_index ?? 0) - (y.order_index ?? 0));
                                      if (bTopics.length === 0) return null;
                                      return (
                                        <optgroup key={b.id} label={`Bloque ${b.order_index}: ${b.title}`}>
                                          {bTopics.map(t => (
                                            <option key={t.id} value={t.id}>
                                              Tema {t.order_index}: {t.title}
                                            </option>
                                          ))}
                                        </optgroup>
                                      );
                                    })}
                                    {topics.some(t => !t.block_id) && (
                                      <optgroup label="Temas Sin Bloque">
                                        {topics.filter(t => !t.block_id).sort((x, y) => (x.order_index ?? 0) - (y.order_index ?? 0)).map(t => (
                                          <option key={t.id} value={t.id}>
                                            Tema {t.order_index}: {t.title}
                                          </option>
                                        ))}
                                      </optgroup>
                                    )}
                                  </>
                                ) : (
                                  (qBlockId === 'unassigned'
                                    ? topics.filter(t => !t.block_id)
                                    : topics.filter(t => t.block_id === qBlockId)
                                  ).sort((x, y) => (x.order_index ?? 0) - (y.order_index ?? 0)).map(t => (
                                    <option key={t.id} value={t.id}>
                                      Tema {t.order_index}: {t.title}
                                    </option>
                                  ))
                                )}
                              </select>
                            </div>
                          </div>

                          {/* Subapartado Selector en formulario de añadir */}
                          {(() => {
                            const currentTopic = topics.find(t => t.id === qTopicId);
                            const currentSubtopics = currentTopic?.subtopics || [];
                            if (!qTopicId || currentSubtopics.length <= 1) return null;
                            return (
                              <div className="pt-2 border-t border-slate-200">
                                <label className="block text-[11px] font-bold text-amber-900 mb-1 flex items-center gap-1">
                                  <span>⚡ Subapartado Especial del Tema:</span>
                                </label>
                                <select
                                  value={qSubtopicId}
                                  onChange={(e) => setQSubtopicId(e.target.value)}
                                  className="w-full px-3 py-2 rounded-xl bg-amber-50/70 border border-amber-300 text-xs text-amber-950 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                                >
                                  {currentSubtopics.map((st: any) => (
                                    <option key={st.id} value={st.id}>
                                      {st.title === 'General' ? 'General (Preguntas estándar del tema)' : `⚡ ${st.title}`}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Opciones con selección directa de respuesta correcta */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="block text-xs font-bold uppercase text-slate-700">
                              Texto de las Opciones ({optionsList.length} opciones)
                            </label>
                            <span className="text-[11px] text-slate-500 font-medium">
                              Pulsa en &ldquo;Hacer correcta&rdquo; o en la letra para cambiar la respuesta
                            </span>
                          </div>

                          <div className="space-y-2">
                            {optionsList.map((val, idx) => {
                              const label = ['A', 'B', 'C', 'D', 'E'][idx] || `${idx + 1}`;
                              const isCorr = correctOpt === idx;
                              return (
                                <div
                                  key={idx}
                                  className={`flex items-center gap-2.5 p-2 rounded-xl border transition-all ${
                                    isCorr
                                      ? 'bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-500/20 shadow-xs'
                                      : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
                                  }`}
                                >
                                  {/* Botón de la letra con estado de selección */}
                                  <button
                                    type="button"
                                    onClick={() => setCorrectOpt(idx)}
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs transition-all shrink-0 cursor-pointer ${
                                      isCorr
                                        ? 'bg-emerald-600 text-white shadow-xs'
                                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300'
                                    }`}
                                    title={`Marcar Opción ${label} como correcta`}
                                  >
                                    {isCorr ? <Check className="w-4 h-4 stroke-[3]" /> : label}
                                  </button>

                                  <input
                                    type="text"
                                    required
                                    placeholder={`Texto de la Opción ${label}...`}
                                    value={val}
                                    onChange={(e) => {
                                      const updated = [...optionsList];
                                      updated[idx] = e.target.value;
                                      setOptionsList(updated);
                                    }}
                                    className="flex-1 bg-transparent border-0 px-2 text-xs text-slate-900 focus:outline-none font-medium"
                                  />

                                  {/* Badge o botón explícito de hacer correcta */}
                                  {isCorr ? (
                                    <span className="text-[10px] font-black text-emerald-800 px-2.5 py-1 rounded-full bg-emerald-100 border border-emerald-300 mr-1 shrink-0 flex items-center gap-1 shadow-2xs">
                                      <Check className="w-3 h-3 stroke-[3]" />
                                      CORRECTA
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setCorrectOpt(idx)}
                                      className="text-[10px] font-bold text-slate-500 hover:text-emerald-800 hover:bg-emerald-100/70 border border-slate-200 hover:border-emerald-300 bg-white px-2.5 py-1 rounded-full transition-all mr-1 shrink-0 cursor-pointer flex items-center gap-1"
                                      title={`Hacer que la Opción ${label} sea la respuesta correcta`}
                                    >
                                      <span>Hacer correcta</span>
                                    </button>
                                  )}

                                  {optionsList.length > 3 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOptionsList(optionsList.filter((_, i) => i !== idx));
                                        if (correctOpt === idx) setCorrectOpt(0);
                                        else if (correctOpt > idx) setCorrectOpt(prev => prev - 1);
                                      }}
                                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors mr-1 cursor-pointer"
                                      title="Eliminar opción"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {optionsList.length === 3 ? (
                            <button
                              type="button"
                              onClick={() => setOptionsList([...optionsList, ''])}
                              className="w-full py-2 px-3 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              + Añadir Opción D (4ª opción)
                            </button>
                          ) : (
                            <p className="text-[10px] text-slate-400 italic text-right">
                              Pregunta de 4 opciones. Pulsa la papelera en la opción D si deseas dejarla en 3.
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                            Justificación o plantilla oficial de corrección
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Ej. Art. 116.2 CE o criterio del Tribunal Calificador"
                            value={qExp}
                            onChange={(e) => setQExp(e.target.value)}
                            className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        <div className="flex justify-end pt-2">
                          <button
                            type="submit"
                            disabled={savingQ}
                            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center gap-2 cursor-pointer"
                          >
                            <Save className="w-4 h-4" />
                            {savingQ ? 'Guardando...' : 'Guardar y Siguiente'}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>

                {/* LISTADO DE PREGUNTAS INTRODUCIDAS */}
                <div className="space-y-4 pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                        Preguntas del examen ({filteredExamQuestions.length} de {questions.length})
                      </h3>
                      {questions.some(q => !q.subtopic_id) ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                          <Zap className="w-3 h-3 text-amber-600" />
                          {questions.filter(q => !q.subtopic_id).length} sin clasificar en temario
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-600" />
                          100% clasificadas en temario
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAllRulesModal(true)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
                        title="Ver y editar las leyes y palabras clave de todos los temas juntos en una tabla"
                      >
                        <Tag className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Palabras Clave de Temas</span>
                      </button>

                      <button
                        type="button"
                        disabled={isAutoClassifying}
                        onClick={handleAutoClassifyExamQuestions}
                        className="px-3.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
                        title="Clasificar automáticamente las preguntas que tengan palabras y leyes claras en la justificación"
                      >
                        {isAutoClassifying ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Analizando y clasificando...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                            <span>
                              {questions.some(q => !q.subtopic_id) 
                                ? 'Auto-clasificar por justificación' 
                                : 'Re-clasificar examen'}
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Barra de Control, Búsqueda y Filtros de Preguntas */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-2xs">
                    <div className="flex-1 relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Buscar por texto, número de pregunta o ley..."
                        value={qSearchTerm}
                        onChange={(e) => setQSearchTerm(e.target.value)}
                        className="w-full pl-8.5 pr-8 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs font-medium"
                      />
                      {qSearchTerm && (
                        <button
                          type="button"
                          onClick={() => setQSearchTerm('')}
                          className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Filtro por estado de clasificación */}
                      <div className="flex items-center bg-white p-0.5 rounded-xl border border-slate-200 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => setQFilterClassification('all')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            qFilterClassification === 'all'
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Todas ({questions.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setQFilterClassification('unclassified')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            qFilterClassification === 'unclassified'
                              ? 'bg-amber-500 text-white shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Sin tema ({questions.filter(q => !q.subtopic_id).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setQFilterClassification('classified')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            qFilterClassification === 'classified'
                              ? 'bg-purple-600 text-white shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Clasificadas ({questions.filter(q => !!q.subtopic_id).length})
                        </button>
                      </div>

                      {/* Filtro por tema específico */}
                      <select
                        value={qFilterTopic}
                        onChange={(e) => {
                          setQFilterTopic(e.target.value);
                          setQFilterSubtopic('all');
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 font-bold focus:outline-none cursor-pointer"
                      >
                        <option value="all">-- Todos los temas --</option>
                        {topics.map(t => (
                          <option key={t.id} value={t.id}>
                            Tema {t.order_index}: {t.title}
                          </option>
                        ))}
                      </select>

                      {/* Filtro por subapartado si el tema seleccionado tiene varios */}
                      {(() => {
                        if (qFilterTopic === 'all') return null;
                        const activeT = topics.find(t => t.id === qFilterTopic);
                        if (!activeT || !activeT.subtopics || activeT.subtopics.length <= 1) return null;
                        return (
                          <select
                            value={qFilterSubtopic}
                            onChange={(e) => setQFilterSubtopic(e.target.value)}
                            className="px-2.5 py-1.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 font-bold focus:outline-none cursor-pointer"
                          >
                            <option value="all">⚡ Todos los subapartados</option>
                            {activeT.subtopics.map((st: any) => (
                              <option key={st.id} value={st.id}>
                                {st.title === 'General' ? 'General' : `⚡ ${st.title}`}
                              </option>
                            ))}
                          </select>
                        );
                      })()}
                    </div>
                  </div>

                  {filteredExamQuestions.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-white border border-dashed border-slate-300 text-center text-xs text-slate-400">
                      {qSearchTerm || qFilterClassification !== 'all' || qFilterTopic !== 'all'
                        ? 'No se encontraron preguntas que coincidan con los filtros seleccionados.'
                        : 'Aún no has añadido preguntas a este examen. Usa el formulario superior para añadir la Pregunta 1.'}
                    </div>
                  ) : (
                    filteredExamQuestions.map((q) => {
                      if (inlineEditingId === q.id) {
                        return (
                          <InlineQuestionEditor
                            key={q.id}
                            question={q}
                            blocks={blocks}
                            topics={topics}
                            onSave={handleSaveInlineQuestion}
                            onCancel={() => setInlineEditingId(null)}
                          />
                        );
                      }

                      const isJustSaved = justSavedQId === q.id;

                      return (
                        <div
                          key={q.id}
                          className={`p-5 rounded-2xl bg-white border transition-all space-y-3.5 hover:border-slate-300 ${
                            isJustSaved
                              ? 'border-emerald-400 bg-emerald-50/20 ring-2 ring-emerald-300/50 shadow-sm'
                              : 'border-slate-200 shadow-2xs'
                          }`}
                        >
                          {/* Fila superior: Badges y Botones de acción */}
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-black px-2.5 py-1 rounded-xl bg-indigo-50 border border-indigo-200/70 text-indigo-700 shadow-2xs">
                                Pregunta {q.question_number}
                              </span>
                              {q.subtopics ? (
                                <>
                                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-purple-50 text-purple-700 border border-purple-200">
                                    Tema {q.subtopics.topics?.order_index || ''}: {q.subtopics.topics?.title || q.subtopics.title}
                                  </span>
                                  {q.subtopics.title && q.subtopics.title.toLowerCase() !== 'general' && (
                                    <span className="text-[11px] font-black px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1 shadow-2xs">
                                      <span>⚡</span>
                                      <span>{q.subtopics.title}</span>
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="text-[11px] font-medium px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500">
                                  Sin tema asignado
                                </span>
                              )}
                              {isJustSaved && (
                                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1 animate-pulse">
                                  <CheckCheck className="w-3 h-3 text-emerald-600" />
                                  ¡Actualizada!
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => setInlineEditingId(q.id)}
                                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-600 text-slate-600 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                                title="Editar sobre esta pregunta"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Editar</span>
                              </button>
                              <button
                                onClick={() => handleDeleteQ(q.id)}
                                className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                title="Eliminar pregunta"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Enunciado Oficial debajo a ancho completo */}
                          <div>
                            <p className="text-sm sm:text-base font-bold text-slate-900 leading-relaxed">
                              {q.question_text}
                            </p>
                          </div>

                          {/* Opciones de respuesta */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            {q.options.map((opt, oIdx) => {
                              const isCorrect = q.correct_option === oIdx;
                              return (
                                <div
                                  key={oIdx}
                                  className={`p-2.5 rounded-xl border text-xs flex items-center gap-2.5 transition-all ${
                                    isCorrect
                                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold ring-1 ring-emerald-200/60 shadow-2xs'
                                      : 'bg-slate-50 border-slate-200 text-slate-700'
                                  }`}
                                >
                                  <span
                                    className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px] shrink-0 ${
                                      isCorrect
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-white border border-slate-300 text-slate-700'
                                    }`}
                                  >
                                    {['A', 'B', 'C', 'D'][oIdx]}
                                  </span>
                                  <span className="flex-1 leading-snug">{opt}</span>
                                  {isCorrect && (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 ml-auto shrink-0" />
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Justificación / Fundamento Legal */}
                          {q.explanation && (
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 flex items-start gap-2">
                              <span className="font-bold text-indigo-700 shrink-0">Justificación:</span>
                              <span className="leading-relaxed">{q.explanation}</span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              <div className="p-16 rounded-3xl bg-white border border-dashed border-slate-300 text-center text-slate-400">
                Selecciona un examen en la columna izquierda o crea uno nuevo para empezar a meter sus preguntas.
              </div>
            )}
          </div>
        </div>

        {/* MODAL CREAR EXAMEN (CONVOCATORIA) */}
        {showExamModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-900">
                  {editingExamId ? 'Editar Datos del Examen' : 'Nuevo Examen Oficial'}
                </h3>
                <button onClick={() => setShowExamModal(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveExam} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Título de la Convocatoria
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. OEP 2023 - Administrativo Junta de Comunidades CLM"
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Año
                    </label>
                    <input
                      type="number"
                      required
                      value={examYear}
                      onChange={(e) => setExamYear(parseInt(e.target.value) || 2023)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Duración (Minutos)
                    </label>
                    <input
                      type="number"
                      min={10}
                      required
                      value={examDuration}
                      onChange={(e) => setExamDuration(parseInt(e.target.value) || 90)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Penalización oficial por fallo (Ej. 0.33 para 3 fallos = 1 acierto)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    required
                    value={examPenalty}
                    onChange={(e) => setExamPenalty(parseFloat(e.target.value) || 0.33)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Descripción / Turno (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Turno Libre - Primer Ejercicio"
                    value={examDesc}
                    onChange={(e) => setExamDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowExamModal(false)}
                    className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    Guardar Examen
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL DE REVISIÓN DE PREGUNTAS DUDOSAS */}
        <DoubtfulQuestionsModal
          isOpen={showDoubtfulModal}
          onClose={() => setShowDoubtfulModal(false)}
          doubtfulItems={doubtfulList}
          topics={topics}
          onApproveSingle={handleApproveSingleDoubtful}
          onApproveAll={handleApproveAllDoubtful}
        />

        {/* MODAL DE TABLA GENERAL DE PALABRAS CLAVE */}
        <AllTopicsRulesModal
          isOpen={showAllRulesModal}
          onClose={() => setShowAllRulesModal(false)}
          topics={topics}
          blocks={blocks}
          supabase={supabase}
          onAllRulesSaved={async () => {
            const { data: updatedTopics } = await supabase
              .from('topics')
              .select('*, subtopics(*)')
              .order('order_index', { ascending: true });
            if (updatedTopics) setTopics(updatedTopics);
          }}
        />

      </main>
    </div>
  );
}
