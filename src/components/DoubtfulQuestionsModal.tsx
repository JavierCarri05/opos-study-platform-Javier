'use client';

import { useState } from 'react';
import { Topic } from '@/lib/types';
import { ClassificationResult } from '@/lib/autoClassifier';
import { 
  X, 
  Sparkles, 
  Check, 
  CheckCheck, 
  AlertTriangle, 
  HelpCircle, 
  BookOpen, 
  ArrowRight,
  ChevronDown
} from 'lucide-react';

export interface DoubtfulItem {
  questionId: string;
  questionNumber?: number;
  questionText: string;
  classification: ClassificationResult;
}

interface DoubtfulQuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  doubtfulItems: DoubtfulItem[];
  topics: Topic[];
  onApproveSingle: (questionId: string, topicId: string) => Promise<void>;
  onApproveAll: (assignments: { questionId: string; topicId: string }[]) => Promise<void>;
}

export function DoubtfulQuestionsModal({
  isOpen,
  onClose,
  doubtfulItems,
  topics,
  onApproveSingle,
  onApproveAll
}: DoubtfulQuestionsModalProps) {
  const [items, setItems] = useState<DoubtfulItem[]>(doubtfulItems);
  const [selectedTopics, setSelectedTopics] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen || doubtfulItems.length === 0) return null;

  const handleApproveOne = async (qId: string) => {
    const item = items.find(i => i.questionId === qId);
    if (!item) return;
    const targetTopicId = selectedTopics[qId] || item.classification.topic.id;

    setIsProcessing(true);
    try {
      await onApproveSingle(qId, targetTopicId);
      const remaining = items.filter(i => i.questionId !== qId);
      setItems(remaining);
      if (remaining.length === 0) {
        onClose();
      }
    } catch (e: any) {
      alert('Error al asignar: ' + (e.message || 'Error desconocido'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApproveAllRemaining = async () => {
    setIsProcessing(true);
    try {
      const assignments = items.map(i => ({
        questionId: i.questionId,
        topicId: selectedTopics[i.questionId] || i.classification.topic.id
      }));
      await onApproveAll(assignments);
      setItems([]);
      onClose();
    } catch (e: any) {
      alert('Error al asignar todas: ' + (e.message || 'Error'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden">
        
        {/* CABECERA */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-amber-50 via-indigo-50 to-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500 text-white shadow-md shadow-amber-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[11px] font-extrabold uppercase">
                  {items.length} {items.length === 1 ? 'Pregunta' : 'Preguntas'}
                </span>
                <h2 className="text-base font-bold text-slate-900">
                  Revisión Rápida de Preguntas con Dudas
                </h2>
              </div>
              <p className="text-xs text-slate-600 font-medium">
                Estas preguntas tienen coincidencia pero dos temas compiten con puntuación similar. Revisa y aprueba con 1 clic.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleApproveAllRemaining}
              disabled={isProcessing}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              title="Aprobar las sugerencias más probables de todas las preguntas restantes"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Aprobar Todas ({items.length})</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* LISTADO DE PREGUNTAS DUDOSAS */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-sm bg-slate-50/50">
          {items.map((item, idx) => {
            const currentSelectedTopicId = selectedTopics[item.questionId] || item.classification.topic.id;
            const currentTopic = topics.find(t => t.id === currentSelectedTopicId);
            const isSuggested = currentSelectedTopicId === item.classification.topic.id;

            return (
              <div
                key={item.questionId}
                className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3"
              >
                {/* ENUNCIADO DE LA PREGUNTA */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-black text-xs">
                        #{item.questionNumber || (idx + 1)}
                      </span>
                      <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        Disputa: {item.classification.score} pts vs {item.classification.runnerUp?.score || 0} pts
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-900 leading-snug">
                      {item.questionText}
                    </p>
                  </div>
                </div>

                {/* MOTIVO Y COINCIDENCIAS */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                  <p className="text-slate-600 font-medium">
                    {item.classification.reason}
                  </p>
                  {item.classification.matchedTerms && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {item.classification.matchedTerms.map((m, mIdx) => (
                        <span key={mIdx} className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-50 border border-indigo-100 text-indigo-700 font-medium">
                          {m}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* ACCIÓN: APROBAR SUGERENCIA O CAMBIAR */}
                <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-bold uppercase text-slate-500">
                      Asignar a:
                    </label>
                    <select
                      value={currentSelectedTopicId}
                      onChange={(e) => setSelectedTopics({ ...selectedTopics, [item.questionId]: e.target.value })}
                      className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {topics.map(t => (
                        <option key={t.id} value={t.id}>
                          Tema {t.order_index}: {t.title} {t.id === item.classification.topic.id ? '⭐ (Sugerido)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleApproveOne(item.questionId)}
                    disabled={isProcessing}
                    className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Aprobar Asignación</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* PIE */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Puedes cambiar el tema en el desplegable de cada pregunta antes de aprobar.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 font-bold text-xs transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
