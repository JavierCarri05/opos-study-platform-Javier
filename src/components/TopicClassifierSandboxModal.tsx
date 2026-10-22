'use client';

import { useState } from 'react';
import { Topic } from '@/lib/types';
import { testClassifierSandbox, getTopicRules } from '@/lib/autoClassifier';
import { 
  X, 
  Sparkles, 
  Play, 
  Scale, 
  HelpCircle, 
  Trophy, 
  AlertTriangle, 
  CheckCircle2, 
  Edit3,
  Layers,
  ChevronRight
} from 'lucide-react';

interface TopicClassifierSandboxModalProps {
  topics: Topic[];
  isOpen: boolean;
  onClose: () => void;
  onEditTopicRules: (topic: Topic) => void;
}

export function TopicClassifierSandboxModal({
  topics,
  isOpen,
  onClose,
  onEditTopicRules
}: TopicClassifierSandboxModalProps) {
  const [questionText, setQuestionText] = useState('');
  const [explanationText, setExplanationText] = useState('');
  const [analysis, setAnalysis] = useState<any>(null);

  if (!isOpen) return null;

  const handleRunAnalysis = () => {
    if (!questionText.trim() && !explanationText.trim()) return;
    const res = testClassifierSandbox({ question_text: questionText, explanation: explanationText }, topics);
    setAnalysis(res);
  };

  const handlePasteSample = (sampleQ: string, sampleExp: string) => {
    setQuestionText(sampleQ);
    setExplanationText(sampleExp);
    const res = testClassifierSandbox({ question_text: sampleQ, explanation: sampleExp }, topics);
    setAnalysis(res);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden">
        
        {/* CABECERA */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-emerald-50 via-indigo-50 to-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
              <Play className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Simulador de Clasificación por Justificación (Sin IA)
              </h2>
              <p className="text-xs text-slate-600 font-medium">
                Comprueba cómo se analizan las leyes y palabras clave en la justificación de las preguntas de tus {topics.length} temas oficiales.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CONTENIDO */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          
          {/* SAMPLES RÁPIDOS */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Ejemplos de justificación legal:
            </span>
            <button
              type="button"
              onClick={() => handlePasteSample(
                '¿Cuál es el plazo para interponer un recurso de alzada contra un acto expreso?',
                'Artículo 122 de la Ley 39/2015 del Procedimiento Administrativo Común.'
              )}
              className="text-xs px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold border border-indigo-200 transition-colors cursor-pointer"
            >
              Justificación Ley 39/2015
            </button>
            <button
              type="button"
              onClick={() => handlePasteSample(
                '¿A quién corresponde la aprobación del presupuesto municipal en un municipio de régimen común?',
                'Art. 22 de la Ley 7/1985 reguladora de las Bases del Régimen Local.'
              )}
              className="text-xs px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold border border-purple-200 transition-colors cursor-pointer"
            >
              Justificación Ley 7/1985
            </button>
            <button
              type="button"
              onClick={() => handlePasteSample(
                'El permiso por nacimiento para el personal funcionario según el TREBEP tiene una duración de:',
                'Artículo 49 del Estatuto Básico del Empleado Público (TREBEP).'
              )}
              className="text-xs px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold border border-emerald-200 transition-colors cursor-pointer"
            >
              Justificación TREBEP
            </button>
          </div>

          {/* INPUTS DE TEXTO */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-indigo-950 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-indigo-600" />
                  Justificación / Fundamento Legal
                </span>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
                  Foco Principal
                </span>
              </label>
              <textarea
                rows={4}
                value={explanationText}
                onChange={(e) => setExplanationText(e.target.value)}
                placeholder="Pega aquí la justificación legal de la pregunta (ej: Artículo 47 de la Ley 39/2015)..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-indigo-50/50 border border-indigo-200 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-slate-700 flex items-center justify-between">
                <span>Enunciado de la Pregunta (Opcional)</span>
                <span className="text-[10px] font-normal text-slate-400">Respaldo</span>
              </label>
              <textarea
                rows={4}
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="Pega aquí el enunciado si lo deseas..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-slate-500 focus:outline-none resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleRunAnalysis}
              disabled={!questionText.trim() && !explanationText.trim()}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <Play className="w-4 h-4" />
              <span>Simular Clasificación</span>
            </button>
          </div>

          {/* RESULTADOS DE LA SIMULACIÓN */}
          {analysis && (
            <div className="space-y-4 pt-2 border-t border-slate-200">
              
              {/* TARJETA DEL GANADOR */}
              {analysis.result ? (
                <div className={`p-4 rounded-2xl border ${
                  analysis.result.confidence === 'high'
                    ? 'bg-emerald-50/80 border-emerald-300'
                    : 'bg-amber-50/80 border-amber-300'
                } space-y-2`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      {analysis.result.confidence === 'high' ? (
                        <div className="p-1.5 rounded-lg bg-emerald-600 text-white">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                      ) : (
                        <div className="p-1.5 rounded-lg bg-amber-600 text-white">
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                      )}
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          {analysis.result.confidence === 'high' ? 'Asignación Directa Segura' : 'Sugerencia Recomendada con Dudas'}
                        </span>
                        <h3 className="text-base font-extrabold text-slate-900">
                          Tema {analysis.result.topic.order_index}: {analysis.result.topic.title}
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-xl bg-white border border-slate-200 text-slate-900 font-black text-xs shadow-sm">
                        {analysis.result.score} Puntos
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onEditTopicRules(analysis.result.topic);
                        }}
                        className="px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Ajustar Reglas</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 font-medium">
                    {analysis.result.reason}
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-slate-100 border border-slate-300 text-slate-700 space-y-1">
                  <p className="font-bold text-xs flex items-center gap-1.5 text-slate-800">
                    <AlertTriangle className="w-4 h-4 text-slate-500" />
                    Sin coincidencias suficientes (&lt; 10 puntos)
                  </p>
                  <p className="text-xs text-slate-600">
                    Ningún tema alcanzó la puntuación mínima para clasificar esta pregunta. Revisa las palabras clave de tus temas o añade la ley correspondiente.
                  </p>
                </div>
              )}

              {/* TABLA / RANKING DE PUNTUACIONES */}
              {analysis.leaderboard && analysis.leaderboard.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    Tabla de Puntuaciones por Tema
                  </h4>

                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {analysis.leaderboard.map((item: any, idx: number) => (
                      <div
                        key={item.topic.id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                          item.isWinner
                            ? 'bg-emerald-50/50 border-emerald-300 font-medium'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs ${
                            idx === 0 ? 'bg-amber-400 text-amber-950' : 'bg-slate-100 text-slate-600'
                          }`}>
                            #{idx + 1}
                          </span>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 block truncate">
                              Tema {item.topic.order_index}: {item.topic.title}
                            </span>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {item.matchedTerms.map((m: string, mIdx: number) => (
                                <span key={mIdx} className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                  {m}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-black text-xs text-indigo-700">
                            {item.score} pts
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onEditTopicRules(item.topic);
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100"
                            title="Editar Reglas de este tema"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* PIE */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
          >
            Cerrar Simulador
          </button>
        </div>

      </div>
    </div>
  );
}
