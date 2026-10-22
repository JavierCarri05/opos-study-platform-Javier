'use client';

import React, { useEffect, useState, useMemo, useDeferredValue } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Sidebar } from '@/components/Sidebar';
import { Profile, Topic, Subtopic, Question, Block } from '@/lib/types';
import { 
  HelpCircle, 
  Plus, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  X, 
  Search, 
  Sparkles, 
  Layers, 
  BookOpen, 
  Check, 
  Zap,
  Save,
  CheckCheck,
  UploadCloud,
  Boxes,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Folder,
  FolderOpen,
  LayoutList,
  Award,
  FileText,
  Loader2,
  FolderInput,
  CheckSquare,
  Square,
} from 'lucide-react';
import { BulkImportModal } from '@/components/BulkImportModal';
import { BulkMoveQuestionsModal } from '@/components/BulkMoveQuestionsModal';
import { ParsedQuestionItem } from '@/lib/bulkParser';
import { resolveTopicSubtopicId } from '@/lib/topicHelper';
import { matchTopicFromReference, classifyQuestionByKeywords } from '@/lib/autoClassifier';
import { fetchAllRows, getCachedUserProfile } from '@/lib/supabaseHelper';

interface InlineBankQuestionEditorProps {
  question: any;
  blocks: Block[];
  topics: Topic[];
  onSave: (data: {
    id: string;
    question_text: string;
    subtopic_id: string | null;
    topic_id?: string | null;
    options: string[];
    correct_option: number;
    explanation: string;
    question_number?: number;
  }) => Promise<boolean>;
  onCancel: () => void;
}

function InlineBankQuestionEditor({
  question,
  blocks,
  topics,
  onSave,
  onCancel,
}: InlineBankQuestionEditorProps) {
  const [text, setText] = useState<string>(question.question_text);
  const [qNumber, setQNumber] = useState<number>(question.question_number || 1);
  const [options, setOptions] = useState<string[]>(
    Array.isArray(question.options) ? [...question.options] : ['', '', '']
  );
  const [correct, setCorrect] = useState<number>(question.correct_option ?? 0);
  const [exp, setExp] = useState<string>(question.explanation || '');

  const supabase = createClient();

  // Determinar asignación inicial exacta
  const initialSubId = question.subtopic_id || '';
  const initialTopic = topics.find(t => 
    t.id === question.subtopics?.topic_id ||
    t.id === question.subtopics?.topics?.id ||
    t.subtopics?.some((st: any) => st.id === initialSubId)
  );

  const [blockId, setBlockId] = useState<string>(
    initialTopic?.block_id ? initialTopic.block_id : (initialTopic ? 'unassigned' : 'all')
  );
  const [topicId, setTopicId] = useState<string>(initialTopic?.id || '');
  const [subtopicId, setSubtopicId] = useState<string>(initialSubId || '');
  const [saving, setSaving] = useState(false);

  const currentTopic = topics.find(t => t.id === topicId);

  const handleBlockChange = (bId: string) => {
    setBlockId(bId);
    const available = bId === 'all'
      ? topics
      : bId === 'unassigned'
      ? topics.filter(t => !t.block_id)
      : topics.filter(t => t.block_id === bId);
    if (available.length > 0) {
      const alreadyInBlock = available.find(t => t.id === topicId);
      if (alreadyInBlock) {
        setTopicId(alreadyInBlock.id);
      } else {
        setTopicId(available[0].id);
        const genSub = available[0].subtopics?.find((s: any) => s.title?.toLowerCase() === 'general');
        setSubtopicId(genSub ? genSub.id : (available[0].subtopics?.[0]?.id || ''));
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
      if (matched?.subtopics && matched.subtopics.length > 0) {
        const foundSub = matched.subtopics.find((s: any) => s.id === subtopicId);
        if (!foundSub) {
          const genSub = matched.subtopics.find((s: any) => s.title?.toLowerCase() === 'general');
          setSubtopicId(genSub ? genSub.id : matched.subtopics[0].id);
        }
      } else {
        setSubtopicId('');
      }
    } else {
      setSubtopicId('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      alert('Por favor, indica el enunciado de la pregunta.');
      return;
    }
    if (options.some(o => !o.trim())) {
      alert('Todas las opciones de respuesta deben estar rellenas.');
      return;
    }

    setSaving(true);
    // Resolver subtopic_id de forma transparente para el tema y subapartado elegido
    const resolvedSub = await resolveTopicSubtopicId(topicId, topics, supabase, subtopicId);

    await onSave({
      id: question.id,
      question_text: text,
      subtopic_id: resolvedSub,
      topic_id: topicId || null,
      options,
      correct_option: correct,
      explanation: exp,
      question_number: question._origin === 'official' ? qNumber : undefined,
    });
    setSaving(false);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-indigo-50/60 via-white to-white border-2 border-indigo-500 shadow-md ring-4 ring-indigo-500/10 space-y-4 transition-all"
    >
      <div className="flex items-center justify-between pb-3 border-b border-indigo-100">
        <div className="flex items-center gap-2 flex-wrap">
          {question._origin === 'official' ? (
            <span className="px-3 py-1 rounded-lg bg-amber-500 text-white text-xs font-black flex items-center gap-1.5 shadow-2xs">
              <Award className="w-3.5 h-3.5" />
              Editando Pregunta de Examen Oficial Nº {question.question_number}
            </span>
          ) : (
            <span className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs font-black flex items-center gap-1.5 shadow-2xs">
              <Edit3 className="w-3.5 h-3.5" />
              Editando Pregunta del Banco
            </span>
          )}
          {question._origin === 'official' && question.official_exams && (
            <span className="text-xs text-amber-900 font-extrabold bg-amber-100/80 border border-amber-300 px-2.5 py-0.5 rounded-md">
              {question.official_exams.title} ({question.official_exams.year})
            </span>
          )}
          <span className="text-xs text-indigo-700/80 font-semibold hidden sm:inline">
            Modificando sobre esta tarjeta directamente
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

      {/* Control de número de pregunta oficial si procede */}
      {question._origin === 'official' && (
        <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-bold text-amber-900">
              {question.official_exams?.title || 'Examen Oficial'} ({question.official_exams?.year || ''})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-bold uppercase text-amber-900">
              Nº Pregunta en Examen:
            </label>
            <input
              type="number"
              min={1}
              value={qNumber}
              onChange={(e) => setQNumber(parseInt(e.target.value) || 1)}
              className="w-20 px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-xs font-black text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
            />
          </div>
        </div>
      )}

      {/* Enunciado */}
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
          Enunciado de la Pregunta
        </label>
        <textarea
          required
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe el enunciado de la pregunta..."
          className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-snug resize-y"
        />
      </div>

      {/* Clasificación en Temario (Bloque y Tema) */}
      <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200/80 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase text-indigo-950 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
            Clasificar en Bloque y Tema
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
                onClick={() => { setBlockId('all'); setTopicId(''); }}
                className="text-[11px] text-indigo-700 hover:text-indigo-950 font-bold underline cursor-pointer"
              >
                Quitar asignación
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
                <option value="all">-- Todos los Bloques --</option>
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
              <option value="">-- Sin tema (Pregunta Libre) --</option>
              {blockId === 'all' ? (
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

        {currentTopic && currentTopic.subtopics && currentTopic.subtopics.length > 1 && (
          <div className="pt-2.5 mt-1 border-t border-indigo-200/60">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                Subapartado Especial / Sección del Tema
              </label>
              <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md">
                {currentTopic.subtopics.length} apartados
              </span>
            </div>
            <select
              value={subtopicId}
              onChange={(e) => setSubtopicId(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-amber-50/80 border border-amber-300 text-xs text-amber-950 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
            >
              {currentTopic.subtopics.map((st: any) => {
                const isGen = st.title?.toLowerCase() === 'general';
                return (
                  <option key={st.id} value={st.id}>
                    {isGen ? 'General (Sin subsección específica)' : `⚡ ${st.title}`}
                  </option>
                );
              })}
            </select>
          </div>
        )}
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

      {/* Fundamento legal */}
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
          Fundamento Legal / Explicación del fallo
        </label>
        <textarea
          required
          rows={2}
          placeholder="Ej. Art. 116.2 CE..."
          value={exp}
          onChange={(e) => setExp(e.target.value)}
          className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-snug resize-y"
        />
      </div>

      {/* Botones de acción */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-200">
        <span className="text-[11px] text-slate-400 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-indigo-500" />
          Edición directa en la tarjeta
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

const QuestionCard = React.memo(function QuestionCard({
  q,
  isBeingEdited,
  isJustSaved,
  isSelected = false,
  blocks,
  topics,
  onStartEdit,
  onDelete,
  onSaveInline,
  onCancelInline,
  onToggleSelect,
}: {
  q: any;
  isBeingEdited: boolean;
  isJustSaved: boolean;
  isSelected?: boolean;
  blocks: Block[];
  topics: Topic[];
  onStartEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onSaveInline: (data: any) => Promise<boolean>;
  onCancelInline: () => void;
  onToggleSelect?: (id: string) => void;
}) {
  if (isBeingEdited) {
    return (
      <InlineBankQuestionEditor
        question={q}
        blocks={blocks}
        topics={topics}
        onSave={onSaveInline}
        onCancel={onCancelInline}
      />
    );
  }

  return (
    <div
      className={`p-5 sm:p-6 rounded-2xl border transition-all ${
        isSelected
          ? 'border-indigo-500 bg-indigo-50/25 ring-2 ring-indigo-400/50 shadow-sm'
          : isJustSaved
          ? 'border-emerald-400 bg-emerald-50/30 ring-2 ring-emerald-300/50 shadow-sm'
          : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
      }`}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          {onToggleSelect && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect(q.id);
              }}
              className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all cursor-pointer border shrink-0 ${
                isSelected
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs ring-2 ring-indigo-300'
                  : 'bg-white border-slate-300 text-transparent hover:border-indigo-400 hover:bg-slate-50'
              }`}
              title={isSelected ? 'Deseleccionar pregunta' : 'Seleccionar pregunta para mover'}
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </button>
          )}

          {q._origin === 'official' ? (
            <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 flex items-center gap-1.5 shadow-2xs">
              <Award className="w-3.5 h-3.5 text-amber-600" />
              <span>
                {q.official_exams?.title || 'Examen Oficial'} ({q.official_exams?.year || ''}) · Pregunta Nº {q.question_number}
              </span>
            </span>
          ) : (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 flex items-center gap-1">
              <FileText className="w-3 h-3 text-blue-500" />
              <span>Banco Propio</span>
            </span>
          )}

          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700">
            {q.subtopics
              ? `Tema ${q.subtopics.topics?.order_index || ''}: ${q.subtopics.topics?.title || q.subtopics.title}`
              : 'Pregunta Libre (Sin Tema)'}
          </span>
          {q.subtopics?.title && q.subtopics.title.toLowerCase() !== 'general' && (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 shadow-2xs">
              <Zap className="w-3 h-3 text-amber-600 fill-amber-500" />
              {q.subtopics.title}
            </span>
          )}
          {isJustSaved && (
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1 animate-pulse">
              <CheckCheck className="w-3 h-3 text-emerald-600" />
              ¡Actualizada!
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onStartEdit(q.id)}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-600 text-slate-700 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Editar sobre esta pregunta"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Retocar</span>
          </button>
          <button
            onClick={() => onDelete(q.id)}
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
            title="Eliminar pregunta"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <p className="text-sm sm:text-base font-bold text-slate-900 mb-3 leading-snug">
        {q.question_text}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
        {q.options.map((opt: string, oIdx: number) => {
          const isCorrect = q.correct_option === oIdx;
          return (
            <div
              key={oIdx}
              className={`p-2 rounded-xl text-xs flex items-center gap-2 border ${
                isCorrect
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <span className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px] shrink-0 ${
                isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {['A', 'B', 'C', 'D'][oIdx]}
              </span>
              <span className="truncate">{opt}</span>
              {isCorrect && (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 ml-auto shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
        <span className="font-bold text-indigo-700">Fundamento legal: </span>
        {q.explanation}
      </div>
    </div>
  );
});

export default function AdminQuestionsPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros de búsqueda
  const [selectedTopicFilter, setSelectedTopicFilter] = useState<string>('all');
  const [selectedSubtopicFilter, setSelectedSubtopicFilter] = useState<string>('all');
  const [originFilter, setOriginFilter] = useState<'all' | 'bank' | 'official'>('all');
  const [officialExams, setOfficialExams] = useState<any[]>([]);
  const [selectedExamFilter, setSelectedExamFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Inline editing & Acordeones desplegables
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [justSavedId, setJustSavedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [viewMode, setViewMode] = useState<'sections' | 'flat'>('sections');
  const [openBlocks, setOpenBlocks] = useState<Record<string, boolean>>({});
  const [openTopics, setOpenTopics] = useState<Record<string, boolean>>({});

  // Formulario pregunta individual nueva
  const [selectedBlockId, setSelectedBlockId] = useState<string>('all');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [selectedSubtopicId, setSelectedSubtopicId] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [optionsList, setOptionsList] = useState<string[]>(['', '', '']); // Por defecto 3 opciones (A, B, C)
  const [correctOption, setCorrectOption] = useState<number>(0);
  const [explanation, setExplanation] = useState('');
  const [saving, setSaving] = useState(false);
  const [successToast, setSuccessToast] = useState(false);

  // Inserción rápida masiva
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkBlockId, setBulkBlockId] = useState('all');
  const [bulkTopicId, setBulkTopicId] = useState('');
  const [bulkSubtopicId, setBulkSubtopicId] = useState('');

  // Selección múltiple y traslado masivo de preguntas
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveToast, setMoveToast] = useState<string | null>(null);

  const toggleSelectQuestion = (id: string) => {
    setSelectedQuestionIds(prev =>
      prev.includes(id) ? prev.filter(qId => qId !== id) : [...prev, id]
    );
  };

  const selectAllFiltered = () => {
    const allFilteredIds = filteredQuestions.map(q => q.id);
    const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedQuestionIds.includes(id));
    if (allSelected) {
      setSelectedQuestionIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
    } else {
      setSelectedQuestionIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const selectQuestionsOfTopic = (tId: string) => {
    const topicQIds = questions.filter(q => q.subtopics?.topic_id === tId).map(q => q.id);
    const allSelected = topicQIds.length > 0 && topicQIds.every(id => selectedQuestionIds.includes(id));
    if (allSelected) {
      setSelectedQuestionIds(prev => prev.filter(id => !topicQIds.includes(id)));
    } else {
      setSelectedQuestionIds(prev => Array.from(new Set([...prev, ...topicQIds])));
    }
  };

  const handleConfirmBulkMove = async (destination: {
    topicId: string;
    subtopicId: string;
    newSubtopicTitle?: string;
  }) => {
    if (selectedQuestionIds.length === 0) return;
    try {
      let targetSubtopicId = destination.subtopicId;

      if (destination.newSubtopicTitle) {
        const { data: newSub, error: newSubErr } = await supabase
          .from('subtopics')
          .insert({
            topic_id: destination.topicId,
            title: destination.newSubtopicTitle,
            order_index: 99,
          })
          .select('*')
          .single();

        if (newSubErr) throw newSubErr;
        targetSubtopicId = newSub.id;

        setTopics(prev => prev.map(t => {
          if (t.id === destination.topicId) {
            return {
              ...t,
              subtopics: [...(t.subtopics || []), newSub as Subtopic]
            };
          }
          return t;
        }));
      } else {
        targetSubtopicId = await resolveTopicSubtopicId(destination.topicId, topics, supabase, destination.subtopicId || null) || '';
      }

      if (!targetSubtopicId) {
        throw new Error('No se pudo determinar el subapartado de destino.');
      }

      const selectedBankIds = questions
        .filter(q => selectedQuestionIds.includes(q.id) && q._origin !== 'official')
        .map(q => q.id);
      const selectedOfficialIds = questions
        .filter(q => selectedQuestionIds.includes(q.id) && q._origin === 'official')
        .map(q => q.id);

      if (selectedBankIds.length > 0) {
        const { error: bErr } = await supabase
          .from('questions')
          .update({ subtopic_id: targetSubtopicId })
          .in('id', selectedBankIds);
        if (bErr) throw bErr;
      }

      if (selectedOfficialIds.length > 0) {
        const { error: oErr } = await supabase
          .from('official_exam_questions')
          .update({ subtopic_id: targetSubtopicId })
          .in('id', selectedOfficialIds);
        if (oErr) throw oErr;
      }

      const destTopic = topics.find(t => t.id === destination.topicId);
      const destSub = destTopic?.subtopics?.find((s: any) => s.id === targetSubtopicId) || {
        id: targetSubtopicId,
        title: destination.newSubtopicTitle || 'General',
        topic_id: destination.topicId,
      };

      setQuestions(prev => prev.map(q => {
        if (selectedQuestionIds.includes(q.id)) {
          return {
            ...q,
            subtopic_id: targetSubtopicId,
            subtopics: {
              id: targetSubtopicId,
              title: destSub.title,
              topic_id: destination.topicId,
              topics: destTopic ? {
                id: destTopic.id,
                title: destTopic.title,
                order_index: destTopic.order_index,
                block_id: destTopic.block_id,
              } : undefined,
            }
          };
        }
        return q;
      }));

      const count = selectedQuestionIds.length;
      setSelectedQuestionIds([]);
      setShowMoveModal(false);

      const destTopicLabel = destTopic ? `Tema ${destTopic.order_index}: ${destTopic.title}` : 'nuevo tema';
      const destSubLabel = destSub.title?.toLowerCase() === 'general' ? 'General' : destSub.title;
      setMoveToast(`✅ ¡Se han movido ${count} preguntas a "${destTopicLabel}" (${destSubLabel})!`);
      setTimeout(() => setMoveToast(null), 4500);

      fetchData(true);
    } catch (err: any) {
      alert('Error al mover preguntas: ' + (err.message || 'Error desconocido'));
    }
  };

  const handleDeleteBulkSelected = async () => {
    if (selectedQuestionIds.length === 0) return;
    if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente las ${selectedQuestionIds.length} preguntas seleccionadas? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const selectedBankIds = questions
        .filter(q => selectedQuestionIds.includes(q.id) && q._origin !== 'official')
        .map(q => q.id);
      const selectedOfficialIds = questions
        .filter(q => selectedQuestionIds.includes(q.id) && q._origin === 'official')
        .map(q => q.id);

      if (selectedBankIds.length > 0) {
        await supabase.from('questions').delete().in('id', selectedBankIds);
      }
      if (selectedOfficialIds.length > 0) {
        await supabase.from('official_exam_questions').delete().in('id', selectedOfficialIds);
      }

      setQuestions(prev => prev.filter(q => !selectedQuestionIds.includes(q.id)));
      const count = selectedQuestionIds.length;
      setSelectedQuestionIds([]);
      setMoveToast(`🗑️ ${count} preguntas eliminadas correctamente.`);
      setTimeout(() => setMoveToast(null), 3000);
    } catch (err: any) {
      alert('Error al eliminar preguntas: ' + (err.message || 'Error desconocido'));
    }
  };


  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);

    try {
      // Ejecutar todas las consultas en paralelo con Promise.all para eliminar el waterfall y acelerar la carga radicalmente
      const [
        userProfileRes,
        { data: blocksData },
        { data: topicsData },
        qData,
        offQData,
        { data: examsData }
      ] = await Promise.all([
        getCachedUserProfile(supabase),
        supabase.from('blocks').select('*').order('order_index', { ascending: true }),
        supabase.from('topics').select('*, subtopics(*)').order('order_index', { ascending: true }),
        fetchAllRows(
          supabase,
          'questions',
          '*, subtopics(id, title, topic_id, topics(id, title, order_index, block_id))',
          'created_at',
          false
        ),
        fetchAllRows(
          supabase,
          'official_exam_questions',
          '*, official_exams(id, title, year), subtopics(id, title, topic_id, topics(id, title, order_index, block_id))',
          'question_number',
          true
        ),
        supabase.from('official_exams').select('id, title, year').order('year', { ascending: false }),
      ]);

      if (userProfileRes?.profile) {
        setProfile(userProfileRes.profile);
      }
      if (blocksData) {
        setBlocks(blocksData);
      }
      if (topicsData) {
        setTopics(topicsData);
      }
      if (examsData) {
        setOfficialExams(examsData);
      }

      let combinedList: any[] = [];
      if (qData) {
        combinedList = [
          ...combinedList,
          ...qData.map(q => ({ ...q, _origin: 'bank' }))
        ];
      }
      if (offQData) {
        combinedList = [
          ...combinedList,
          ...offQData.map(q => ({
            ...q,
            _origin: 'official',
          }))
        ];
      }

      setQuestions(combinedList);
    } catch (err) {
      console.error('Error al cargar preguntas en AdminQuestionsPage:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlTopicId = params.get('topicId');
      const urlSubtopicId = params.get('subtopicId');
      const urlBulk = params.get('bulk');

      if (urlTopicId) {
        setSelectedTopicFilter(urlTopicId);
        setBulkTopicId(urlTopicId);
      }
      if (urlSubtopicId) {
        setSelectedSubtopicFilter(urlSubtopicId);
        setBulkSubtopicId(urlSubtopicId);
      }
      if (urlBulk === 'true') {
        setShowBulkModal(true);
      }
    }
  }, []);

  const handleTopicChange = (topId: string) => {
    setSelectedTopicId(topId);
    if (topId) {
      const matched = topics.find(t => t.id === topId);
      if (matched?.subtopics && matched.subtopics.length > 0) {
        const genSub = matched.subtopics.find((s: any) => s.title?.toLowerCase() === 'general');
        setSelectedSubtopicId(genSub ? genSub.id : matched.subtopics[0].id);
      } else {
        setSelectedSubtopicId('');
      }
    } else {
      setSelectedSubtopicId('');
    }
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const cleanedOptions = optionsList.map(o => o.trim());

    try {
      const targetSubtopicId = await resolveTopicSubtopicId(selectedTopicId, topics, supabase, selectedSubtopicId);

      // Guardamos la nueva pregunta
      let saveError: any = null;

      const { error } = await supabase.from('questions').insert({
        subtopic_id: targetSubtopicId,
        question_text: questionText.trim(),
        options: cleanedOptions,
        correct_option: correctOption,
        explanation: explanation.trim(),
      });
      saveError = error;

      // Si la BD aún tuviera la restricción NOT NULL en subtopic_id, aplicamos fallback automático
      if (saveError && (saveError.code === '23502' || saveError.message?.includes('null value in column "subtopic_id"'))) {
        let fallbackSubId: string | null = null;
        const { data: genTopic } = await supabase
          .from('topics')
          .select('id, subtopics(id)')
          .eq('title', 'Banco General / Libre')
          .maybeSingle();

        if (genTopic && genTopic.subtopics && (genTopic.subtopics as any).length > 0) {
          fallbackSubId = (genTopic.subtopics as any)[0].id;
        } else {
          const { data: newTop } = await supabase
            .from('topics')
            .insert({ order_index: 999, title: 'Banco General / Libre' })
            .select()
            .single();
          if (newTop) {
            const { data: newSub } = await supabase
              .from('subtopics')
              .insert({ topic_id: newTop.id, order_index: 1, title: 'General' })
              .select()
              .single();
            if (newSub) fallbackSubId = newSub.id;
          }
        }

        if (fallbackSubId) {
          const { error: fErr } = await supabase.from('questions').insert({
            subtopic_id: fallbackSubId,
            question_text: questionText.trim(),
            options: cleanedOptions,
            correct_option: correctOption,
            explanation: explanation.trim(),
          });
          saveError = fErr;
        }
      }

      if (saveError) throw saveError;

      setQuestionText('');
      setOptionsList(['', '', '']);
      setCorrectOption(0);
      setExplanation('');
      setSaving(false);

      setSuccessToast(true);
      setTimeout(() => setSuccessToast(false), 3000);

      fetchData();
    } catch (err: any) {
      alert('Error al guardar la pregunta: ' + (err.message || 'Error desconocido'));
      setSaving(false);
    }
  };

  const handleSaveInlineQuestion = async (updated: {
    id: string;
    question_text: string;
    subtopic_id: string | null;
    topic_id?: string | null;
    options: string[];
    correct_option: number;
    explanation: string;
    question_number?: number;
  }) => {
    try {
      const targetQ = questions.find(q => q.id === updated.id);
      let targetSubtopicId: string | null = updated.subtopic_id || null;
      let saveError: any = null;

      if (targetQ?._origin === 'official') {
        const updatePayload: any = {
          subtopic_id: targetSubtopicId,
          question_text: updated.question_text.trim(),
          options: updated.options.map(o => o.trim()),
          correct_option: updated.correct_option,
          explanation: updated.explanation.trim(),
        };
        if (typeof updated.question_number === 'number') {
          updatePayload.question_number = updated.question_number;
        }

        const { error } = await supabase
          .from('official_exam_questions')
          .update(updatePayload)
          .eq('id', updated.id);
        saveError = error;
      } else {
        const { error } = await supabase
          .from('questions')
          .update({
            subtopic_id: targetSubtopicId,
            question_text: updated.question_text.trim(),
            options: updated.options.map(o => o.trim()),
            correct_option: updated.correct_option,
            explanation: updated.explanation.trim(),
          })
          .eq('id', updated.id);
        saveError = error;

        if (saveError && (saveError.code === '23502' || saveError.message?.includes('null value in column "subtopic_id"'))) {
          let fallbackSubId: string | null = null;
          const { data: genTopic } = await supabase
            .from('topics')
            .select('id, subtopics(id)')
            .eq('title', 'Banco General / Libre')
            .maybeSingle();

          if (genTopic && genTopic.subtopics && (genTopic.subtopics as any).length > 0) {
            fallbackSubId = (genTopic.subtopics as any)[0].id;
          }
          if (fallbackSubId) {
            const { error: fErr } = await supabase
              .from('questions')
              .update({
                subtopic_id: fallbackSubId,
                question_text: updated.question_text.trim(),
                options: updated.options.map(o => o.trim()),
                correct_option: updated.correct_option,
                explanation: updated.explanation.trim(),
              })
              .eq('id', updated.id);
            saveError = fErr;
            targetSubtopicId = fallbackSubId;
          }
        }
      }

      if (saveError) throw saveError;

      // Resolver el tema destino de manera determinista y completa
      const targetTopic = updated.topic_id
        ? topics.find(t => t.id === updated.topic_id)
        : targetSubtopicId
        ? topics.find(t => t.subtopics?.some((s: any) => s.id === targetSubtopicId))
        : null;

      let subtopicObj: any = null;
      if (targetTopic) {
        const foundSub = targetTopic.subtopics?.find((s: any) => s.id === targetSubtopicId);
        subtopicObj = {
          id: targetSubtopicId || '',
          title: foundSub?.title || 'General',
          topic_id: targetTopic.id,
          topics: {
            id: targetTopic.id,
            title: targetTopic.title,
            order_index: targetTopic.order_index,
            block_id: targetTopic.block_id,
          }
        };

        // Registrar subtopic_id en la lista en memoria del tema
        if (targetSubtopicId) {
          if (!targetTopic.subtopics) targetTopic.subtopics = [];
          if (!targetTopic.subtopics.some((s: any) => s.id === targetSubtopicId)) {
            (targetTopic.subtopics as any).push({
              id: targetSubtopicId,
              title: 'General',
              topic_id: targetTopic.id,
              order_index: 1,
              created_at: new Date().toISOString(),
            });
          }
        }

        // Desplegar automáticamente el bloque y tema destino para que el usuario visualice la pregunta movida
        if (targetTopic.block_id) {
          setOpenBlocks(prev => ({ ...prev, [targetTopic.block_id!]: true }));
        } else {
          setOpenBlocks(prev => ({ ...prev, unassigned_block: true }));
        }
        setOpenTopics(prev => ({ ...prev, [targetTopic.id]: true }));

        // Si había un filtro por tema activo diferente al destino, restaurar a 'all' para que no desaparezca de la vista
        if (selectedTopicFilter !== 'all' && selectedTopicFilter !== targetTopic.id) {
          setSelectedTopicFilter('all');
        }
      }

      // Actualizar localmente questions de inmediato con las nuevas referencias
      setQuestions(prev => prev.map(q => {
        if (q.id === updated.id) {
          return {
            ...q,
            question_text: updated.question_text.trim(),
            options: updated.options.map(o => o.trim()),
            correct_option: updated.correct_option,
            explanation: updated.explanation.trim(),
            subtopic_id: targetSubtopicId,
            subtopics: subtopicObj,
            ...(typeof updated.question_number === 'number' ? { question_number: updated.question_number } : {}),
          };
        }
        return q;
      }));

      setInlineEditingId(null);
      setJustSavedId(updated.id);
      setTimeout(() => setJustSavedId(null), 3000);

      // Re-sincronizar silenciosamente en segundo plano
      fetchData(true);
      return true;
    } catch (err: any) {
      alert('Error al guardar: ' + err.message);
      return false;
    }
  };

  const toggleBlock = (blockId: string) => {
    setOpenBlocks(prev => ({ ...prev, [blockId]: !(prev[blockId] ?? false) }));
  };

  const toggleTopic = (topicId: string) => {
    setOpenTopics(prev => ({ ...prev, [topicId]: !prev[topicId] }));
  };

  const handleExpandAll = () => {
    const allB: Record<string, boolean> = { unassigned_block: true, free_questions: true };
    blocks.forEach(b => { allB[b.id] = true; });
    const allT: Record<string, boolean> = {};
    topics.forEach(t => { allT[t.id] = true; });
    setOpenBlocks(allB);
    setOpenTopics(allT);
  };

  const handleCollapseAll = () => {
    const noneB: Record<string, boolean> = { unassigned_block: false, free_questions: false };
    blocks.forEach(b => { noneB[b.id] = false; });
    const noneT: Record<string, boolean> = {};
    topics.forEach(t => { noneT[t.id] = false; });
    setOpenBlocks(noneB);
    setOpenTopics(noneT);
  };

  const handleDelete = async (id: string) => {
    const targetQ = questions.find(q => q.id === id);
    const isOfficial = targetQ?._origin === 'official';
    if (!confirm(isOfficial ? '¿Deseas eliminar esta pregunta del examen oficial?' : '¿Deseas eliminar permanentemente esta pregunta?')) return;
    if (isOfficial) {
      await supabase.from('official_exam_questions').delete().eq('id', id);
    } else {
      await supabase.from('questions').delete().eq('id', id);
    }
    if (inlineEditingId === id) setInlineEditingId(null);
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  const handleConfirmBulkQuestions = async (parsedQuestions: ParsedQuestionItem[]) => {
    // 1. Determinar el subapartado base seleccionado por el usuario en el modal
    const defaultBulkSub = bulkSubtopicId || (bulkTopicId ? await resolveTopicSubtopicId(bulkTopicId, topics, supabase, bulkSubtopicId) : null);

    const payload = [];
    for (const pq of parsedQuestions) {
      let assignedSub = defaultBulkSub;

      if (bulkSubtopicId) {
        // CASO A: El usuario ha seleccionado explícitamente un subapartado específico en el modal.
        // Toda la batería de preguntas debe asignarse a este subapartado seleccionado.
        // Solo si una pregunta incluye explícitamente una etiqueta [TEMA X] de otro tema diferente,
        // se asociará a ese otro tema. En ningún caso se sobreescribe con 'General'.
        if (pq.topic_reference) {
          const matched = matchTopicFromReference(pq.topic_reference, topics);
          if (matched && matched.id !== bulkTopicId) {
            const otherSub = await resolveTopicSubtopicId(matched.id, topics, supabase);
            if (otherSub) assignedSub = otherSub;
          } else {
            assignedSub = bulkSubtopicId;
          }
        } else {
          assignedSub = bulkSubtopicId;
        }
      } else if (bulkTopicId) {
        // CASO B: El usuario eligió un tema concreto pero no un subapartado específico (se usa el tema general).
        if (pq.topic_reference) {
          const matched = matchTopicFromReference(pq.topic_reference, topics);
          if (matched && matched.id !== bulkTopicId) {
            const otherSub = await resolveTopicSubtopicId(matched.id, topics, supabase);
            if (otherSub) assignedSub = otherSub;
          } else {
            assignedSub = defaultBulkSub;
          }
        } else {
          assignedSub = defaultBulkSub;
        }
      } else {
        // CASO C: El usuario eligió "Sin Tema" / importación libre.
        if (pq.topic_reference) {
          const matched = matchTopicFromReference(pq.topic_reference, topics);
          if (matched) {
            const sub = await resolveTopicSubtopicId(matched.id, topics, supabase);
            if (sub) assignedSub = sub;
          }
        } else {
          // Intentar clasificar por palabras clave solo si no hay tema ni subapartado indicado
          const autoMatch = classifyQuestionByKeywords(
            { question_text: pq.question_text, explanation: pq.explanation, options: pq.options },
            topics
          );
          if (autoMatch) {
            const sub = await resolveTopicSubtopicId(autoMatch.topic.id, topics, supabase);
            if (sub) assignedSub = sub;
          }
        }
      }

      payload.push({
        subtopic_id: assignedSub,
        question_text: pq.question_text,
        options: pq.options,
        correct_option: pq.correct_option,
        explanation: pq.explanation || 'Conforme a la normativa oficial.',
      });
    }

    let { error } = await supabase.from('questions').insert(payload);

    if (error && (error.code === '23502' || error.message?.includes('null value in column "subtopic_id"'))) {
      let fallbackSubId: string | null = null;
      const { data: genTopic } = await supabase
        .from('topics')
        .select('id, subtopics(id)')
        .eq('title', 'Banco General / Libre')
        .maybeSingle();

      if (genTopic && genTopic.subtopics && (genTopic.subtopics as any).length > 0) {
        fallbackSubId = (genTopic.subtopics as any)[0].id;
      } else {
        const { data: newTop } = await supabase
          .from('topics')
          .insert({ order_index: 999, title: 'Banco General / Libre' })
          .select()
          .single();
        if (newTop) {
          const { data: newSub } = await supabase
            .from('subtopics')
            .insert({ topic_id: newTop.id, order_index: 1, title: 'General' })
            .select()
            .single();
          if (newSub) fallbackSubId = newSub.id;
        }
      }

      if (fallbackSubId) {
        const fallbackPayload = payload.map(p => ({ ...p, subtopic_id: p.subtopic_id || fallbackSubId }));
        const res = await supabase.from('questions').insert(fallbackPayload);
        error = res.error;
      }
    }

    if (error) throw error;

    fetchData();
  };


  const currentTopicObj = topics.find(t => t.id === selectedTopicId);

  const deferredSearchTerm = useDeferredValue(searchTerm);

  const filteredQuestions = useMemo(() => {
    const sTerm = deferredSearchTerm.toLowerCase().trim();
    return questions.filter(q => {
      const matchesSearch = !sTerm ||
        q.question_text.toLowerCase().includes(sTerm) ||
        (q.explanation || '').toLowerCase().includes(sTerm) ||
        (q.official_exams?.title || '').toLowerCase().includes(sTerm) ||
        String(q.official_exams?.year || '').includes(sTerm);

      const matchesTopic =
        selectedTopicFilter === 'all'
          ? true
          : selectedTopicFilter === 'unassigned'
          ? !q.subtopics?.topic_id
          : q.subtopics?.topic_id === selectedTopicFilter;

      const matchesSubtopic =
        selectedSubtopicFilter === 'all'
          ? true
          : q.subtopic_id === selectedSubtopicFilter;

      const matchesOrigin =
        originFilter === 'all'
          ? true
          : originFilter === 'official'
          ? q._origin === 'official'
          : q._origin === 'bank';

      const matchesExam =
        selectedExamFilter === 'all'
          ? true
          : q.exam_id === selectedExamFilter;

      return matchesSearch && matchesTopic && matchesSubtopic && matchesOrigin && matchesExam;
    });
  }, [questions, deferredSearchTerm, selectedTopicFilter, selectedSubtopicFilter, originFilter, selectedExamFilter]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900 w-full max-w-full overflow-x-hidden">
      <Sidebar profile={profile} />

      <main className="flex-1 min-w-0 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-8 space-y-8 overflow-y-auto">
        {/* Encabezado */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-6">
          <div>
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Zap className="w-4 h-4" />
              Gestión Ágil de Preguntas
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Banco y Editor de Preguntas
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Organizado por bloques y temas desplegables. Edita cualquier pregunta directamente sobre su tarjeta con un clic.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                if (selectedTopicFilter && selectedTopicFilter !== 'all' && selectedTopicFilter !== 'unassigned') {
                  setBulkTopicId(selectedTopicFilter);
                  const activeTop = topics.find(t => t.id === selectedTopicFilter);
                  if (activeTop?.block_id) {
                    setBulkBlockId(activeTop.block_id);
                  }
                  if (selectedSubtopicFilter && selectedSubtopicFilter !== 'all') {
                    setBulkSubtopicId(selectedSubtopicFilter);
                  }
                }
                setShowBulkModal(true);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-sm flex items-center gap-2 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              Subir Batería de Preguntas de Golpe
            </button>
          </div>
        </div>

        {/* MODAL DE IMPORTACIÓN RÁPIDA CON VISTA PREVIA */}
        <BulkImportModal
          isOpen={showBulkModal}
          onClose={() => setShowBulkModal(false)}
          title="Importador Inteligente de Preguntas"
          subtitle="Pega tu examen o batería de preguntas (3 o 4 opciones) o sube un archivo .txt/.json. Podrás previsualizarlas antes de insertarlas."
          onConfirmImport={handleConfirmBulkQuestions}
          topics={topics}
          blocks={blocks}
          topicSelector={
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Tema del temario al que asociar las preguntas importadas:
              </label>
              <div className={`grid grid-cols-1 ${blocks.length > 0 ? 'sm:grid-cols-2' : ''} gap-2`}>
                {blocks.length > 0 && (
                  <select
                    value={bulkBlockId}
                    onChange={(e) => {
                      const bId = e.target.value;
                      setBulkBlockId(bId);
                      const available = bId === 'all'
                        ? topics
                        : bId === 'unassigned'
                        ? topics.filter(t => !t.block_id)
                        : topics.filter(t => t.block_id === bId);
                      if (available.length > 0) {
                        setBulkTopicId(available[0].id);
                        setBulkSubtopicId('');
                      } else {
                        setBulkTopicId('');
                        setBulkSubtopicId('');
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-800"
                  >
                    <option value="all">-- Todos los Bloques --</option>
                    {blocks.map(b => (
                      <option key={b.id} value={b.id}>
                        Bloque {b.order_index}: {b.title}
                      </option>
                    ))}
                  </select>
                )}
                <select
                  value={bulkTopicId}
                  onChange={(e) => {
                    setBulkTopicId(e.target.value);
                    setBulkSubtopicId('');
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-800 font-semibold"
                >
                  <option value="">-- Sin Tema (Preguntas Libres) --</option>
                  {bulkBlockId === 'all' ? (
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
                    (bulkBlockId === 'unassigned'
                      ? topics.filter(t => !t.block_id)
                      : topics.filter(t => t.block_id === bulkBlockId)
                    ).sort((x, y) => (x.order_index ?? 0) - (y.order_index ?? 0)).map(t => (
                      <option key={t.id} value={t.id}>
                        Tema {t.order_index}: {t.title}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Selector de subapartado para el importador de golpe si el tema tiene subapartados */}
              {bulkTopicId && (() => {
                const matchedTopic = topics.find(t => t.id === bulkTopicId);
                if (!matchedTopic?.subtopics || matchedTopic.subtopics.length === 0) return null;
                const hasSpecific = matchedTopic.subtopics.some((st: any) => st.title?.toLowerCase() !== 'general');
                if (!hasSpecific && matchedTopic.subtopics.length <= 1) return null;

                return (
                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1.5 mt-2 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                        Subapartado Especial / Sección del Tema (Opcional):
                      </label>
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md">
                        {matchedTopic.subtopics.length} apartados
                      </span>
                    </div>
                    <select
                      value={bulkSubtopicId}
                      onChange={(e) => setBulkSubtopicId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-amber-300 text-xs text-amber-950 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs cursor-pointer"
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

        {/* MODAL PARA MOVER PREGUNTAS EN LOTE A OTROS TEMAS O SUBAPARTADOS */}
        <BulkMoveQuestionsModal
          isOpen={showMoveModal}
          onClose={() => setShowMoveModal(false)}
          selectedCount={selectedQuestionIds.length}
          selectedQuestions={questions.filter(q => selectedQuestionIds.includes(q.id))}
          blocks={blocks}
          topics={topics}
          initialTopicId={selectedTopicFilter !== 'all' && selectedTopicFilter !== 'unassigned' ? selectedTopicFilter : undefined}
          initialSubtopicId={selectedSubtopicFilter !== 'all' ? selectedSubtopicFilter : undefined}
          onConfirmMove={handleConfirmBulkMove}
        />

        {/* Formulario 1 a 1 (Plegable) */}
        <div className="rounded-3xl border border-slate-200 bg-white transition-all shadow-xs overflow-hidden">
          <div 
            onClick={() => setShowAddForm(!showAddForm)}
            className="p-5 sm:p-6 flex items-center justify-between cursor-pointer hover:bg-slate-50/70 transition-colors select-none"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-2xs">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  Añadir Nueva Pregunta Manual
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Plegable
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  {showAddForm 
                    ? 'Rellena el formulario a continuación para guardar una nueva pregunta.' 
                    : 'Haz clic aquí para desplegar el formulario e introducir una nueva pregunta.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {showAddForm ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  <span>Ocultar formulario</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  <span>Desplegar formulario</span>
                </>
              )}
            </button>
          </div>

          {showAddForm && (
            <div className="p-6 sm:p-8 pt-2 border-t border-slate-100">
              {successToast && (
                <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <CheckCheck className="w-4 h-4 text-emerald-600" />
                  ¡Pregunta guardada con éxito en la base de datos! Lista para introducir la siguiente.
                </div>
              )}

              <form onSubmit={handleSaveQuestion} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {blocks.length > 0 && (
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                        1. Bloque (Opcional)
                      </label>
                      <select
                        value={selectedBlockId}
                        onChange={(e) => {
                          const bId = e.target.value;
                          setSelectedBlockId(bId);
                          const availableTopics = bId === 'all' 
                            ? topics 
                            : bId === 'unassigned' 
                            ? topics.filter(t => !t.block_id) 
                            : topics.filter(t => t.block_id === bId);
                          if (availableTopics.length > 0) {
                            handleTopicChange(availableTopics[0].id);
                          } else {
                            setSelectedTopicId('');
                          }
                        }}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                      >
                        <option value="all">-- Todos los Bloques / General --</option>
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

                  <div className={blocks.length > 0 ? '' : 'sm:col-span-2'}>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                      {blocks.length > 0 ? '2. Tema (Opcional)' : 'Tema (Opcional)'}
                    </label>
                    <select
                      value={selectedTopicId}
                      onChange={(e) => handleTopicChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    >
                      <option value="">-- Sin Tema (Pregunta Libre / General) --</option>
                      {selectedBlockId === 'all' ? (
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
                        (selectedBlockId === 'unassigned'
                          ? topics.filter(t => !t.block_id)
                          : topics.filter(t => t.block_id === selectedBlockId)
                        ).sort((x, y) => (x.order_index ?? 0) - (y.order_index ?? 0)).map(t => (
                          <option key={t.id} value={t.id}>
                            Tema {t.order_index}: {t.title}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  {selectedTopicId && (() => {
                    const matchedTopic = topics.find(t => t.id === selectedTopicId);
                    if (!matchedTopic?.subtopics || matchedTopic.subtopics.length <= 1) return null;
                    return (
                      <div className="sm:col-span-2 p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                            Subapartado Especial / Sección del Tema
                          </label>
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md">
                            {matchedTopic.subtopics.length} apartados
                          </span>
                        </div>
                        <select
                          value={selectedSubtopicId}
                          onChange={(e) => setSelectedSubtopicId(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white border border-amber-300 text-xs text-amber-950 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
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

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                    Enunciado de la Pregunta
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder="Ej. ¿A quién corresponde declarar los estados de alarma y de excepción, de acuerdo con el Art. 116 de la Constitución?"
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Opciones de Respuesta
                    </label>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Pulsa en &ldquo;Hacer correcta&rdquo; o en la letra para cambiar la respuesta
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {optionsList.map((val, idx) => {
                      const label = ['A', 'B', 'C', 'D'][idx];
                      const isCorrect = correctOption === idx;
                      return (
                        <div
                          key={idx}
                          className={`flex items-center gap-3 p-2 rounded-2xl border transition-all ${
                            isCorrect
                              ? 'bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-500/20 shadow-xs'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setCorrectOption(idx)}
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs transition-all shrink-0 cursor-pointer ${
                              isCorrect
                                ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-300'
                                : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200'
                            }`}
                            title={`Marcar Opción ${label} como correcta`}
                          >
                            {isCorrect ? <Check className="w-5 h-5 stroke-[3]" /> : label}
                          </button>

                          <input
                            type="text"
                            required
                            placeholder={`Texto para la Opción ${label}...`}
                            value={val}
                            onChange={(e) => {
                              const updated = [...optionsList];
                              updated[idx] = e.target.value;
                              setOptionsList(updated);
                            }}
                            className="flex-1 bg-transparent border-0 px-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none font-medium"
                          />

                          {isCorrect ? (
                            <span className="text-[10px] font-black text-emerald-800 px-2.5 py-1 rounded-full bg-emerald-100 border border-emerald-300 mr-2 shrink-0 flex items-center gap-1 shadow-2xs">
                              <Check className="w-3 h-3 stroke-[3]" />
                              CORRECTA
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setCorrectOption(idx)}
                              className="text-[10px] font-bold text-slate-500 hover:text-emerald-800 hover:bg-emerald-100/70 border border-slate-200 hover:border-emerald-300 bg-white px-2.5 py-1 rounded-full transition-all mr-2 shrink-0 cursor-pointer flex items-center gap-1"
                              title={`Hacer que la Opción ${label} sea la respuesta correcta`}
                            >
                              <span>Hacer correcta</span>
                            </button>
                          )}

                          {idx === 3 && (
                            <button
                              type="button"
                              onClick={() => {
                                setOptionsList(optionsList.slice(0, 3));
                                if (correctOption === 3) setCorrectOption(0);
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Eliminar Opción D"
                            >
                              <Trash2 className="w-4 h-4" />
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
                      className="w-full py-2.5 px-4 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      + Añadir Opción D (4ª opción)
                    </button>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic text-right">
                      Pregunta con 4 opciones (A, B, C, D). Puedes pulsar la papelera en la opción D para volver a 3.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                    Fundamento Legal / Explicación del fallo
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder="Ej. Art. 116.2 CE: El estado de alarma será declarado por el Gobierno mediante decreto acordado en Consejo de Ministros..."
                    value={explanation}
                    onChange={(e) => setExplanation(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-8 py-3 rounded-xl font-bold text-sm shadow-md flex items-center gap-2 cursor-pointer transition-all bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Guardando...' : 'Guardar Pregunta'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Listado y Secciones de Preguntas */}
        <section className="space-y-6 pt-2">
          {/* Barra de control: Título, Filtros, Modos de Vista y Desplegables */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
            <div>
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                  Banco de Preguntas ({filteredQuestions.length})
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Preguntas propias y de exámenes oficiales organizadas por Bloques y Temas. Edita sobre la tarjeta con <span className="font-semibold text-slate-700">"Retocar"</span>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
              {/* Filtro por Procedencia */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => { setOriginFilter('all'); setSelectedExamFilter('all'); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    originFilter === 'all'
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todas ({questions.length})
                </button>
                <button
                  type="button"
                  onClick={() => { setOriginFilter('bank'); setSelectedExamFilter('all'); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                    originFilter === 'bank'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-3 h-3 text-blue-500" />
                  <span>Banco Propio ({questions.filter(q => q._origin === 'bank').length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOriginFilter('official')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                    originFilter === 'official'
                      ? 'bg-white text-amber-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Award className="w-3 h-3 text-amber-600" />
                  <span>Oficiales ({questions.filter(q => q._origin === 'official').length})</span>
                </button>
              </div>

              {/* Selector específico de Convocatoria Oficial */}
              {officialExams.length > 0 && (
                <select
                  value={selectedExamFilter}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedExamFilter(val);
                    if (val !== 'all') {
                      setOriginFilter('official');
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors shadow-2xs cursor-pointer ${
                    selectedExamFilter !== 'all'
                      ? 'bg-amber-50 border-amber-400 text-amber-900 ring-2 ring-amber-500/20'
                      : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
                  }`}
                  title="Filtrar por una convocatoria o examen oficial concreto"
                >
                  <option value="all">-- Todos los Exámenes Oficiales --</option>
                  {officialExams.map(ex => {
                    const count = questions.filter(q => q.exam_id === ex.id).length;
                    return (
                      <option key={ex.id} value={ex.id}>
                        {ex.title} ({ex.year}) — {count} preg.
                      </option>
                    );
                  })}
                </select>
              )}

              {/* Selector de modo de visualización */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setViewMode('sections')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    viewMode === 'sections'
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Organizado por Bloques y Temas"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Por Bloques y Temas</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('flat')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    viewMode === 'flat'
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Lista corrida sin agrupar"
                >
                  <LayoutList className="w-3.5 h-3.5" />
                  <span>Lista Plana</span>
                </button>
              </div>

              {/* Botones Desplegar / Plegar todos si estamos en secciones */}
              {viewMode === 'sections' && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleExpandAll}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-[11px] font-bold transition-colors cursor-pointer"
                    title="Desplegar todos los bloques y temas"
                  >
                    Desplegar todo
                  </button>
                  <button
                    type="button"
                    onClick={handleCollapseAll}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-[11px] font-bold transition-colors cursor-pointer"
                    title="Plegar todos los bloques y temas"
                  >
                    Plegar todo
                  </button>
                </div>
              )}

              {/* Botón de selección múltiple rápida */}
              <button
                type="button"
                onClick={selectAllFiltered}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedQuestionIds.length > 0 && filteredQuestions.length > 0 && filteredQuestions.every(q => selectedQuestionIds.includes(q.id))
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xs'
                    : selectedQuestionIds.length > 0
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
                title="Seleccionar o deseleccionar todas las preguntas visibles según el filtro actual"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>
                  {selectedQuestionIds.length > 0 && filteredQuestions.length > 0 && filteredQuestions.every(q => selectedQuestionIds.includes(q.id))
                    ? 'Deseleccionar visibles'
                    : selectedQuestionIds.length > 0
                    ? `Seleccionadas (${filteredQuestions.filter(q => selectedQuestionIds.includes(q.id)).length}/${filteredQuestions.length})`
                    : `Seleccionar visibles (${filteredQuestions.length})`}
                </span>
              </button>

              {/* Filtro por tema */}
              <select
                value={selectedTopicFilter}
                onChange={(e) => {
                  setSelectedTopicFilter(e.target.value);
                  setSelectedSubtopicFilter('all');
                }}
                className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                <option value="all">-- Todos los temas ({questions.length}) --</option>
                <option value="unassigned">
                  Preguntas Libres ({questions.filter(q => !q.subtopics?.topic_id).length})
                </option>
                {blocks.map(b => {
                  const bTopics = topics.filter(t => t.block_id === b.id).sort((x, y) => (x.order_index ?? 0) - (y.order_index ?? 0));
                  if (bTopics.length === 0) return null;
                  return (
                    <optgroup key={b.id} label={`Bloque ${b.order_index}: ${b.title}`}>
                      {bTopics.map(t => {
                        const count = questions.filter(q => q.subtopics?.topic_id === t.id).length;
                        return (
                          <option key={t.id} value={t.id}>
                            Tema {t.order_index}: {t.title} ({count})
                          </option>
                        );
                      })}
                    </optgroup>
                  );
                })}
                {topics.some(t => !t.block_id) && (
                  <optgroup label="Temas Sin Bloque">
                    {topics.filter(t => !t.block_id).sort((x, y) => (x.order_index ?? 0) - (y.order_index ?? 0)).map(t => {
                      const count = questions.filter(q => q.subtopics?.topic_id === t.id).length;
                      return (
                        <option key={t.id} value={t.id}>
                          Tema {t.order_index}: {t.title} ({count})
                        </option>
                      );
                    })}
                  </optgroup>
                )}
              </select>

              {/* Filtro por Subapartado si el tema seleccionado tiene más de uno */}
              {(() => {
                if (selectedTopicFilter === 'all' || selectedTopicFilter === 'unassigned') return null;
                const activeTop = topics.find(t => t.id === selectedTopicFilter);
                if (!activeTop?.subtopics || activeTop.subtopics.length <= 1) return null;
                return (
                  <select
                    value={selectedSubtopicFilter}
                    onChange={(e) => setSelectedSubtopicFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                  >
                    <option value="all">-- Todos los subapartados --</option>
                    {activeTop.subtopics.map((st: any) => {
                      const count = questions.filter(q => q.subtopic_id === st.id).length;
                      const isGen = st.title?.toLowerCase() === 'general';
                      return (
                        <option key={st.id} value={st.id}>
                          {isGen ? 'General' : `⚡ ${st.title}`} ({count})
                        </option>
                      );
                    })}
                  </select>
                );
              })()}

              {/* Buscador */}
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar texto o ley..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8.5 pr-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Renderizado de Preguntas: Secciones vs Lista Plana */}
          {viewMode === 'sections' ? (
            <div className="space-y-6">
              {/* 1. Bloques Oficiales */}
              {blocks.map((block) => {
                const blockTopics = topics.filter(t => t.block_id === block.id);
                const blockQuestions = filteredQuestions.filter(
                  q => q.subtopics?.topics?.block_id === block.id || blockTopics.some(t => t.id === q.subtopics?.topic_id)
                );
                const isBlockExpanded = openBlocks[block.id] ?? false;

                if (selectedTopicFilter !== 'all') {
                  const matchesTopicInBlock = blockTopics.some(t => t.id === selectedTopicFilter);
                  if (!matchesTopicInBlock) return null;
                }

                return (
                  <div
                    key={block.id}
                    className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-xs transition-all"
                  >
                    {/* Cabecera del Bloque */}
                    <div
                      onClick={() => toggleBlock(block.id)}
                      className="p-5 sm:p-6 bg-gradient-to-r from-slate-50 via-white to-indigo-50/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-100/60 transition-colors select-none border-b border-slate-100"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-2xs">
                          {block.order_index}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                              Bloque {block.order_index}
                            </span>
                            <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                              {block.title}
                            </h3>
                          </div>
                          {block.description && (
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                              {block.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700">
                          {blockTopics.length} {blockTopics.length === 1 ? 'tema' : 'temas'}
                        </span>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-xl ${
                          blockQuestions.length > 0 
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {blockQuestions.length} {blockQuestions.length === 1 ? 'pregunta' : 'preguntas'}
                        </span>
                        <div className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
                          {isBlockExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </div>
                      </div>
                    </div>

                    {/* Temas dentro del Bloque */}
                    {isBlockExpanded && (
                      <div className="p-4 sm:p-6 space-y-4 bg-slate-50/50">
                        {blockTopics.length === 0 ? (
                          <div className="p-6 text-center text-xs text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                            No hay temas asignados a este bloque todavía.
                          </div>
                        ) : (
                          blockTopics.map((topic) => {
                            if (selectedTopicFilter !== 'all' && selectedTopicFilter !== topic.id) {
                              return null;
                            }

                            const topicQuestions = filteredQuestions.filter(q => q.subtopics?.topic_id === topic.id);
                            const isTopicExpanded = openTopics[topic.id] ?? false;

                            return (
                              <div
                                key={topic.id}
                                className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs"
                              >
                                {/* Cabecera del Tema */}
                                <div
                                  onClick={() => toggleTopic(topic.id)}
                                  className="px-4 py-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 transition-colors select-none bg-white"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
                                      {isTopicExpanded ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
                                    </div>
                                    <div className="min-w-0">
                                      <span className="text-xs font-bold text-slate-900 truncate block">
                                        Tema {topic.order_index}: {topic.title}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    {topicQuestions.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          selectQuestionsOfTopic(topic.id);
                                        }}
                                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all border cursor-pointer ${
                                          topicQuestions.every(q => selectedQuestionIds.includes(q.id))
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                            : topicQuestions.some(q => selectedQuestionIds.includes(q.id))
                                            ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                                            : 'bg-slate-50 text-slate-600 hover:text-indigo-600 border-slate-200'
                                        }`}
                                        title="Seleccionar todas las preguntas de este tema"
                                      >
                                        {topicQuestions.every(q => selectedQuestionIds.includes(q.id)) ? (
                                          <CheckSquare className="w-3 h-3" />
                                        ) : (
                                          <Square className="w-3 h-3" />
                                        )}
                                        <span>
                                          {topicQuestions.every(q => selectedQuestionIds.includes(q.id))
                                            ? 'Deseleccionar tema'
                                            : 'Seleccionar tema'}
                                        </span>
                                      </button>
                                    )}
                                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                                      topicQuestions.length > 0
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-slate-100 text-slate-400'
                                    }`}>
                                      {topicQuestions.length} {topicQuestions.length === 1 ? 'pregunta' : 'preguntas'}
                                    </span>
                                    <div className="text-slate-400">
                                      {isTopicExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </div>
                                  </div>
                                </div>

                                {/* Lista de Preguntas del Tema */}
                                {isTopicExpanded && (
                                  <div className="p-4 pt-2 space-y-3.5 border-t border-slate-100 bg-slate-50/30">
                                    {topicQuestions.length === 0 ? (
                                      <div className="p-4 text-center text-xs text-slate-400 italic">
                                        No hay preguntas registradas en este tema que coincidan con la búsqueda.
                                      </div>
                                    ) : (
                                      topicQuestions.map((q) => (
                                        <QuestionCard
                                          key={q.id}
                                          q={q}
                                          isBeingEdited={inlineEditingId === q.id}
                                          isJustSaved={justSavedId === q.id}
                                          isSelected={selectedQuestionIds.includes(q.id)}
                                          onToggleSelect={toggleSelectQuestion}
                                          blocks={blocks}
                                          topics={topics}
                                          onStartEdit={(id) => setInlineEditingId(id)}
                                          onDelete={handleDelete}
                                          onSaveInline={handleSaveInlineQuestion}
                                          onCancelInline={() => setInlineEditingId(null)}
                                        />
                                      ))
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 2. Temas Sin Bloque */}
              {(() => {
                const unassignedTopics = topics.filter(t => !t.block_id);
                if (unassignedTopics.length === 0) return null;
                if (selectedTopicFilter !== 'all' && !unassignedTopics.some(t => t.id === selectedTopicFilter)) {
                  return null;
                }

                const unassignedQuestions = filteredQuestions.filter(
                  q => unassignedTopics.some(t => t.id === q.subtopics?.topic_id)
                );
                const isExpanded = openBlocks['unassigned_block'] ?? false;

                return (
                  <div className="rounded-3xl border border-amber-200 bg-white overflow-hidden shadow-xs transition-all">
                    <div
                      onClick={() => toggleBlock('unassigned_block')}
                      className="p-5 sm:p-6 bg-gradient-to-r from-amber-50/40 via-white to-amber-50/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer hover:bg-amber-50/60 transition-colors select-none border-b border-amber-100"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-2xs">
                          <Folder className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                              Temario
                            </span>
                            <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                              Temas Sin Bloque Asignado
                            </h3>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Temas que no están adscritos a ningún bloque específico.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-amber-100 text-amber-800">
                          {unassignedTopics.length} temas
                        </span>
                        <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                          {unassignedQuestions.length} preguntas
                        </span>
                        <div className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
                          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 sm:p-6 space-y-4 bg-slate-50/50">
                        {unassignedTopics.map((topic) => {
                          if (selectedTopicFilter !== 'all' && selectedTopicFilter !== topic.id) return null;
                          const topicQuestions = filteredQuestions.filter(q => q.subtopics?.topic_id === topic.id);
                          const isTopicExpanded = openTopics[topic.id] ?? false;

                          return (
                            <div key={topic.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                              <div
                                onClick={() => toggleTopic(topic.id)}
                                className="px-4 py-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 transition-colors select-none"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 shrink-0">
                                    {isTopicExpanded ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
                                  </div>
                                  <span className="text-xs font-bold text-slate-900 truncate">
                                    Tema {topic.order_index}: {topic.title}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {topicQuestions.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        selectQuestionsOfTopic(topic.id);
                                      }}
                                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all border cursor-pointer ${
                                        topicQuestions.every(q => selectedQuestionIds.includes(q.id))
                                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                          : topicQuestions.some(q => selectedQuestionIds.includes(q.id))
                                          ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                                          : 'bg-slate-50 text-slate-600 hover:text-indigo-600 border-slate-200'
                                      }`}
                                      title="Seleccionar todas las preguntas de este tema"
                                    >
                                      {topicQuestions.every(q => selectedQuestionIds.includes(q.id)) ? (
                                        <CheckSquare className="w-3 h-3" />
                                      ) : (
                                        <Square className="w-3 h-3" />
                                      )}
                                      <span>
                                        {topicQuestions.every(q => selectedQuestionIds.includes(q.id))
                                          ? 'Deseleccionar tema'
                                          : 'Seleccionar tema'}
                                      </span>
                                    </button>
                                  )}
                                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600">
                                    {topicQuestions.length} preguntas
                                  </span>
                                  {isTopicExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                </div>
                              </div>

                              {isTopicExpanded && (
                                <div className="p-4 pt-2 space-y-3.5 border-t border-slate-100 bg-slate-50/30">
                                  {topicQuestions.length === 0 ? (
                                    <div className="p-4 text-center text-xs text-slate-400 italic">
                                      No hay preguntas registradas en este tema.
                                    </div>
                                  ) : (
                                    topicQuestions.map((q) => (
                                      <QuestionCard
                                        key={q.id}
                                        q={q}
                                        isBeingEdited={inlineEditingId === q.id}
                                        isJustSaved={justSavedId === q.id}
                                        isSelected={selectedQuestionIds.includes(q.id)}
                                        onToggleSelect={toggleSelectQuestion}
                                        blocks={blocks}
                                        topics={topics}
                                        onStartEdit={(id) => setInlineEditingId(id)}
                                        onDelete={handleDelete}
                                        onSaveInline={handleSaveInlineQuestion}
                                        onCancelInline={() => setInlineEditingId(null)}
                                      />
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* 3. Preguntas Libres / Sin Asignar a Tema */}
              {(() => {
                const freeQuestions = filteredQuestions.filter(q => !q.subtopics?.topic_id);
                if (selectedTopicFilter !== 'all' && selectedTopicFilter !== 'unassigned') return null;
                if (freeQuestions.length === 0 && selectedTopicFilter !== 'unassigned') return null;

                const isExpanded = openBlocks['free_questions'] ?? false;

                return (
                  <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-xs transition-all">
                    <div
                      onClick={() => toggleBlock('free_questions')}
                      className="p-5 sm:p-6 bg-gradient-to-r from-slate-100 via-white to-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-100/70 transition-colors select-none border-b border-slate-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-700 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-2xs">
                          <HelpCircle className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 bg-slate-200 px-2 py-0.5 rounded-md">
                              Sin Asignar
                            </span>
                            <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                              Preguntas Libres / Banco General
                            </h3>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Preguntas que aún no han sido clasificadas en un tema específico.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 border border-slate-200">
                          {freeQuestions.length} {freeQuestions.length === 1 ? 'pregunta' : 'preguntas'}
                        </span>
                        <div className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
                          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 sm:p-6 space-y-3.5 bg-slate-50/50">
                        {freeQuestions.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-400 italic">
                            No hay preguntas libres o sin clasificar.
                          </div>
                        ) : (
                          freeQuestions.map((q) => (
                            <QuestionCard
                              key={q.id}
                              q={q}
                              isBeingEdited={inlineEditingId === q.id}
                              isJustSaved={justSavedId === q.id}
                              isSelected={selectedQuestionIds.includes(q.id)}
                              onToggleSelect={toggleSelectQuestion}
                              blocks={blocks}
                              topics={topics}
                              onStartEdit={(id) => setInlineEditingId(id)}
                              onDelete={handleDelete}
                              onSaveInline={handleSaveInlineQuestion}
                              onCancelInline={() => setInlineEditingId(null)}
                            />
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          ) : (
            /* Modo Lista Plana */
            <div className="space-y-4">
              {filteredQuestions.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
                  <HelpCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700">No se encontraron preguntas</p>
                  <p className="text-xs text-slate-400 mt-1">Prueba a cambiar los términos de búsqueda o filtros.</p>
                </div>
              ) : (
                filteredQuestions.map((q) => (
                  <QuestionCard
                    key={q.id}
                    q={q}
                    isBeingEdited={inlineEditingId === q.id}
                    isJustSaved={justSavedId === q.id}
                    isSelected={selectedQuestionIds.includes(q.id)}
                    onToggleSelect={toggleSelectQuestion}
                    blocks={blocks}
                    topics={topics}
                    onStartEdit={(id) => setInlineEditingId(id)}
                    onDelete={handleDelete}
                    onSaveInline={handleSaveInlineQuestion}
                    onCancelInline={() => setInlineEditingId(null)}
                  />
                ))
              )}
            </div>
          )}
        </section>

        {/* BARRA DE ACCIÓN FLOTANTE AL SELECCIONAR PREGUNTAS EN LOTE */}
        {selectedQuestionIds.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-2xl bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-slate-700/80 p-3 sm:p-4 animate-in fade-in slide-in-from-bottom-5 duration-200">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
                  {selectedQuestionIds.length}
                </span>
                <div>
                  <p className="text-xs sm:text-sm font-bold leading-tight">
                    {selectedQuestionIds.length === 1 ? '1 pregunta seleccionada' : `${selectedQuestionIds.length} preguntas seleccionadas`}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Listas para mover a otro tema/subapartado o eliminar en lote
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedQuestionIds([])}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <X className="w-4 h-4" />
                  <span className="hidden sm:inline">Deseleccionar</span>
                </button>

                <button
                  type="button"
                  onClick={handleDeleteBulkSelected}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-600/20 text-rose-300 hover:bg-rose-600 hover:text-white border border-rose-500/30 transition-all cursor-pointer flex items-center gap-1.5"
                  title="Eliminar preguntas seleccionadas"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Eliminar</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowMoveModal(true)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white shadow-md hover:shadow-indigo-500/20 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <FolderInput className="w-4 h-4" />
                  <span>Mover a...</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* NOTIFICACIÓN FLOTANTE TRAS MOVER O ELIMINAR PREGUNTAS */}
        {moveToast && (
          <div className="fixed bottom-24 right-6 z-50 bg-emerald-900/95 text-white px-5 py-3 rounded-2xl shadow-xl border border-emerald-700 flex items-center gap-2.5 text-xs sm:text-sm font-bold animate-in fade-in slide-in-from-bottom-2 duration-150 backdrop-blur-md">
            <span>{moveToast}</span>
            <button
              type="button"
              onClick={() => setMoveToast(null)}
              className="ml-2 text-emerald-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}


      </main>
    </div>
  );
}
