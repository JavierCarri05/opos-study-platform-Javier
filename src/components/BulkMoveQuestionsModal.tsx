'use client';

import React, { useState, useEffect } from 'react';
import { 
  FolderInput, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Zap, 
  Plus, 
  Layers, 
  BookOpen, 
  Loader2,
  ChevronDown,
  ChevronUp,
  FileText
} from 'lucide-react';
import { Block, Topic } from '@/lib/types';

interface BulkMoveQuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  selectedQuestions: any[];
  blocks: Block[];
  topics: Topic[];
  initialTopicId?: string;
  initialSubtopicId?: string;
  onConfirmMove: (destination: {
    topicId: string;
    subtopicId: string;
    newSubtopicTitle?: string;
  }) => Promise<void>;
}

export function BulkMoveQuestionsModal({
  isOpen,
  onClose,
  selectedCount,
  selectedQuestions,
  blocks,
  topics,
  initialTopicId,
  initialSubtopicId,
  onConfirmMove,
}: BulkMoveQuestionsModalProps) {
  const [targetBlockId, setTargetBlockId] = useState<string>('all');
  const [targetTopicId, setTargetTopicId] = useState<string>('');
  const [targetSubtopicId, setTargetSubtopicId] = useState<string>('');
  const [isCreatingSubtopic, setIsCreatingSubtopic] = useState(false);
  const [newSubtopicTitle, setNewSubtopicTitle] = useState('');
  const [showPreviewList, setShowPreviewList] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Inicializar destino preferido al abrir
  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setIsCreatingSubtopic(false);
    setNewSubtopicTitle('');
    setShowPreviewList(false);

    if (initialTopicId && topics.some(t => t.id === initialTopicId)) {
      const matched = topics.find(t => t.id === initialTopicId);
      setTargetTopicId(initialTopicId);
      if (matched?.block_id) {
        setTargetBlockId(matched.block_id);
      } else {
        setTargetBlockId('unassigned');
      }
      if (initialSubtopicId) {
        setTargetSubtopicId(initialSubtopicId);
      } else if (matched?.subtopics && matched.subtopics.length > 0) {
        const gen = matched.subtopics.find((s: any) => s.title?.toLowerCase() === 'general');
        setTargetSubtopicId(gen ? gen.id : matched.subtopics[0].id);
      } else {
        setTargetSubtopicId('');
      }
    } else if (topics.length > 0) {
      setTargetBlockId('all');
      setTargetTopicId(topics[0].id);
      const firstGen = topics[0].subtopics?.find((s: any) => s.title?.toLowerCase() === 'general');
      setTargetSubtopicId(firstGen ? firstGen.id : (topics[0].subtopics?.[0]?.id || ''));
    }
  }, [isOpen, initialTopicId, initialSubtopicId, topics]);

  if (!isOpen) return null;

  const handleBlockChange = (bId: string) => {
    setTargetBlockId(bId);
    const available = bId === 'all'
      ? topics
      : bId === 'unassigned'
      ? topics.filter(t => !t.block_id)
      : topics.filter(t => t.block_id === bId);

    if (available.length > 0) {
      const alreadyIn = available.find(t => t.id === targetTopicId);
      if (!alreadyIn) {
        const nextTopic = available[0];
        setTargetTopicId(nextTopic.id);
        const gen = nextTopic.subtopics?.find((s: any) => s.title?.toLowerCase() === 'general');
        setTargetSubtopicId(gen ? gen.id : (nextTopic.subtopics?.[0]?.id || ''));
      }
    } else {
      setTargetTopicId('');
      setTargetSubtopicId('');
    }
  };

  const handleTopicChange = (tId: string) => {
    setTargetTopicId(tId);
    setIsCreatingSubtopic(false);
    setNewSubtopicTitle('');
    const matched = topics.find(t => t.id === tId);
    if (matched) {
      if (matched.block_id) {
        setTargetBlockId(matched.block_id);
      } else {
        setTargetBlockId('unassigned');
      }
      if (matched.subtopics && matched.subtopics.length > 0) {
        const gen = matched.subtopics.find((s: any) => s.title?.toLowerCase() === 'general');
        setTargetSubtopicId(gen ? gen.id : matched.subtopics[0].id);
      } else {
        setTargetSubtopicId('');
      }
    } else {
      setTargetSubtopicId('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTopicId) {
      setErrorMsg('Debes seleccionar un tema de destino.');
      return;
    }

    if (isCreatingSubtopic && !newSubtopicTitle.trim()) {
      setErrorMsg('Escribe el título para el nuevo subapartado o desactiva la opción.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await onConfirmMove({
        topicId: targetTopicId,
        subtopicId: isCreatingSubtopic ? '' : targetSubtopicId,
        newSubtopicTitle: isCreatingSubtopic ? newSubtopicTitle.trim() : undefined,
      });
      setIsSubmitting(false);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al reubicar las preguntas');
      setIsSubmitting(false);
    }
  };

  const currentTopic = topics.find(t => t.id === targetTopicId);
  const currentSubtopics = currentTopic?.subtopics || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Cabecera */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
              <FolderInput className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                Mover {selectedCount} {selectedCount === 1 ? 'pregunta' : 'preguntas'}
              </h2>
              <p className="text-xs text-slate-500">
                Elige el bloque, tema y subapartado al que deseas reubicar las preguntas seleccionadas.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido / Formulario */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Selector de Bloque */}
          {blocks.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                1. Bloque de destino
              </label>
              <select
                value={targetBlockId}
                onChange={(e) => handleBlockChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
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

          {/* 2. Selector de Tema */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
              2. Tema de destino
            </label>
            <select
              required
              value={targetTopicId}
              onChange={(e) => handleTopicChange(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
            >
              <option value="">-- Selecciona el Tema --</option>
              {targetBlockId === 'all' ? (
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
                (targetBlockId === 'unassigned'
                  ? topics.filter(t => !t.block_id)
                  : topics.filter(t => t.block_id === targetBlockId)
                ).sort((x, y) => (x.order_index ?? 0) - (y.order_index ?? 0)).map(t => (
                  <option key={t.id} value={t.id}>
                    Tema {t.order_index}: {t.title}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* 3. Selector de Subapartado */}
          {targetTopicId && (
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                  3. Subapartado / Sección de destino
                </label>
                <button
                  type="button"
                  onClick={() => setIsCreatingSubtopic(!isCreatingSubtopic)}
                  className="text-[11px] font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 cursor-pointer hover:underline"
                >
                  <Plus className="w-3 h-3" />
                  <span>{isCreatingSubtopic ? 'Elegir existente' : '+ Crear nuevo subapartado'}</span>
                </button>
              </div>

              {isCreatingSubtopic ? (
                <div className="space-y-1.5 animate-in fade-in">
                  <input
                    type="text"
                    required={isCreatingSubtopic}
                    placeholder="Ej. Artículos 14 a 29 (Derechos Fundamentales)..."
                    value={newSubtopicTitle}
                    onChange={(e) => setNewSubtopicTitle(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-amber-300 text-xs text-amber-950 placeholder-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold shadow-2xs"
                  />
                  <p className="text-[10px] text-amber-700">
                    Se creará este nuevo subapartado dentro del tema seleccionado y las preguntas se trasladarán a él.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <select
                    value={targetSubtopicId}
                    onChange={(e) => setTargetSubtopicId(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-amber-300 text-xs text-amber-950 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs cursor-pointer"
                  >
                    {currentSubtopics.length === 0 ? (
                      <option value="">📌 General (Por defecto del tema)</option>
                    ) : (
                      currentSubtopics.map((st: any) => {
                        const isGen = st.title?.toLowerCase() === 'general';
                        return (
                          <option key={st.id} value={st.id}>
                            {isGen ? '📌 General (Sin subapartado específico)' : `⚡ ${st.title}`}
                          </option>
                        );
                      })
                    )}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Vista previa desplegable de las preguntas seleccionadas */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowPreviewList(!showPreviewList)}
              className="w-full p-3 flex items-center justify-between text-xs font-bold text-slate-700 hover:bg-slate-100/70 transition-colors select-none cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                Ver preguntas a mover ({selectedQuestions.length})
              </span>
              {showPreviewList ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {showPreviewList && (
              <div className="p-3 pt-0 max-h-44 overflow-y-auto space-y-1.5 border-t border-slate-200/60 bg-white text-xs">
                {selectedQuestions.map((q, idx) => (
                  <div key={q.id || idx} className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-2">
                    <span className="w-5 h-5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-800 font-medium truncate">{q.question_text}</p>
                      <span className="text-[10px] text-slate-400">
                        {q.subtopics?.title ? `Actualmente en: ${q.subtopics.title}` : 'Sin subapartado actual'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>

        {/* Pie de modal con acciones */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !targetTopicId}
            className="px-6 py-2.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Moviendo preguntas...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Mover {selectedCount} {selectedCount === 1 ? 'Pregunta' : 'Preguntas'} Ahora</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
