'use client';

import React, { useState } from 'react';
import { parseBulkExamQuestions, ParsedQuestionItem } from '@/lib/bulkParser';
import { 
  Sparkles, 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Check, 
  Info, 
  X,
} from 'lucide-react';
import { Topic, Block } from '@/lib/types';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  onConfirmImport: (questions: ParsedQuestionItem[]) => Promise<void>;
  topicSelector?: React.ReactNode;
  topics?: Topic[];
  blocks?: Block[];
}

export function BulkImportModal({
  isOpen,
  onClose,
  title,
  subtitle,
  onConfirmImport,
  topicSelector,
  topics,
  blocks
}: BulkImportModalProps) {
  const [rawText, setRawText] = useState('');
  const [parsedList, setParsedList] = useState<ParsedQuestionItem[]>([]);
  const [step, setStep] = useState<'input' | 'preview'>('input');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);



  if (!isOpen) return null;

  const handleAnalyze = () => {
    if (!rawText.trim()) return;
    const results = parseBulkExamQuestions(rawText);
    if (results.length === 0) {
      setStatusMsg('No se detectaron preguntas válidas. Revisa el formato de ejemplo a la derecha.');
      return;
    }
    setParsedList(results);
    setStatusMsg(null);
    setStep('preview');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawText(content);
        const results = parseBulkExamQuestions(content);
        if (results.length > 0) {
          setParsedList(results);
          setStep('preview');
          setStatusMsg(null);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleRemoveItem = (index: number) => {
    const updated = parsedList.filter((_, i) => i !== index);
    setParsedList(updated);
    if (updated.length === 0) setStep('input');
  };

  const handleCorrectChange = (qIndex: number, newCorr: number) => {
    const updated = [...parsedList];
    updated[qIndex].correct_option = newCorr;
    setParsedList(updated);
  };



  const handleFinalSubmit = async () => {
    if (parsedList.length === 0) return;
    setIsSubmitting(true);
    setStatusMsg(null);
    try {
      await onConfirmImport(parsedList);
      setIsSubmitting(false);
      setRawText('');
      setParsedList([]);
      setStep('input');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setStatusMsg('Error al guardar: ' + msg);
      setIsSubmitting(false);
    }
  };

  const sampleStandard = `[TEMA 1]
1. ¿Quién nombra al Presidente del Gobierno según el Art. 99 de la Constitución?
a) El Rey
b) Las Cortes Generales
c) El Presidente del Congreso
RESPUESTA: A
EXPLICACIÓN: Art. 99.3 CE: El Rey propondrá un candidato y lo nombrará tras obtener la confianza.

[TEMA 4]
2. ¿Cuál es el plazo ordinario de duración del estado de alarma?
a) 10 días
b) 15 días
c) 20 días
d) 30 días
RESPUESTA: B
EXPLICACIÓN: Art. 116.2 CE: Plazo máximo de quince días sin prórroga del Congreso.`;

  const sampleStarred = `1. ¿A quién corresponde declarar el estado de excepción?
a) Al Rey
*b) Al Gobierno, previa autorización del Congreso
c) Al Consejo de Ministros directamente sin previa autorización

2. La soberanía nacional reside en:
*a) El pueblo español
b) Las Cortes Generales
c) El Rey y el Gobierno`;

  const sampleChatGpt = `[
  {
    "pregunta": "¿En qué artículo se regula el principio de legalidad de la Administración?",
    "opciones": ["Art. 9.3 CE", "Art. 103.1 CE", "Art. 14 CE"],
    "correcta": "B",
    "explicacion": "Art. 103.1 CE: La Administración Pública sirve con objetividad los intereses generales con sometimiento pleno a la ley y al Derecho."
  }
]`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Encabezado */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">{title}</h2>
              <p className="text-xs text-slate-500">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido según Step */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Selector de tema si aplica */}
          {topicSelector && (
            <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100">
              {topicSelector}
            </div>
          )}

          {step === 'input' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Columna Izquierda: Input de texto o archivo */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-600" />
                    Pega aquí tus preguntas de golpe
                  </label>
                  
                  {/* Carga de archivo .txt o .json */}
                  <label className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors border border-purple-200">
                    <Upload className="w-3.5 h-3.5" />
                    Subir archivo (.txt o .json)
                    <input
                      type="file"
                      accept=".txt,.json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                <textarea
                  rows={14}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Pega aquí el texto del examen completo o las preguntas generadas por ChatGPT / Claude..."
                  className="w-full font-mono text-xs px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 leading-relaxed shadow-inner"
                />

                {statusMsg && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    {statusMsg}
                  </div>
                )}
              </div>

              {/* Columna Derecha: Plantillas y Guía Rápida */}
              <div className="lg:col-span-5 space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
                  <Info className="w-4 h-4 text-indigo-600" />
                  Formatos Soportados al Instante
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  El importador detecta automáticamente 3 o 4 opciones, números de pregunta, letras A/B/C/D y justificaciones legales. Podrás previsualizar y editar cada pregunta antes de insertarlas.
                </p>

                <div className="space-y-3 pt-1">
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-indigo-700">Formato Estándar (Recomendado)</span>
                      <button
                        onClick={() => setRawText(sampleStandard)}
                        className="text-[10px] text-purple-700 font-bold hover:underline"
                      >
                        Usar plantilla
                      </button>
                    </div>
                    <pre className="text-[10px] font-mono text-slate-600 whitespace-pre-wrap bg-slate-50 p-2 rounded-lg">
{`[TEMA 1]
1. ¿Enunciado de la pregunta?
a) Primera opción
b) Segunda opción
c) Tercera opción
RESPUESTA: A
EXPLICACIÓN: Art. 116 de la CE.`}
                    </pre>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-indigo-700">Formato con Asterisco (*) en la correcta</span>
                      <button
                        onClick={() => setRawText(sampleStarred)}
                        className="text-[10px] text-purple-700 font-bold hover:underline"
                      >
                        Usar plantilla
                      </button>
                    </div>
                    <pre className="text-[10px] font-mono text-slate-600 whitespace-pre-wrap bg-slate-50 p-2 rounded-lg">
{`1. ¿Enunciado...?
*a) Opción correcta marcada con asterisco
b) Opción incorrecta
c) Otra opción incorrecta`}
                    </pre>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-indigo-700">Formato JSON (Directo de ChatGPT)</span>
                      <button
                        onClick={() => setRawText(sampleChatGpt)}
                        className="text-[10px] text-purple-700 font-bold hover:underline"
                      >
                        Usar plantilla
                      </button>
                    </div>
                    <pre className="text-[10px] font-mono text-slate-600 whitespace-pre-wrap bg-slate-50 p-2 rounded-lg">
{`[ { "pregunta": "...", "opciones": ["a","b","c"], "correcta": "B" } ]`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 p-4 rounded-2xl">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <h3 className="text-sm font-bold text-emerald-950">
                      ¡Se han detectado {parsedList.length} preguntas correctamente!
                    </h3>
                    <p className="text-xs text-emerald-700">
                      Revisa la vista previa a continuación. Puedes corregir la opción correcta con un clic o descartar preguntas antes de insertarlas.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">


                  <button
                    onClick={() => setStep('input')}
                    className="px-3.5 py-1.5 rounded-xl bg-white text-slate-700 text-xs font-bold border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Volver al texto
                  </button>
                </div>
              </div>

              {/* Listado de preguntas previsualizadas */}
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {parsedList.map((pq, qIdx) => (
                  <div
                    key={qIdx}
                    className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 shadow-2xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 font-black text-xs flex items-center justify-center">
                          {pq.question_number || qIdx + 1}
                        </span>
                        <span className="text-xs font-semibold text-slate-400">
                          ({pq.options.length} opciones)
                        </span>
                        {pq.topic_reference && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1 shadow-2xs">
                            🏷️ {pq.topic_reference.toLowerCase().startsWith('tema') ? pq.topic_reference : `Tema ${pq.topic_reference}`}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveItem(qIdx)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Descartar esta pregunta"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <p className="text-sm font-bold text-slate-900 leading-snug">
                      {pq.question_text}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {pq.options.map((opt, optIdx) => {
                        const isCorrect = pq.correct_option === optIdx;
                        const label = ['A', 'B', 'C', 'D'][optIdx];
                        return (
                          <div
                            key={optIdx}
                            onClick={() => handleCorrectChange(qIdx, optIdx)}
                            className={`p-2 rounded-xl border text-xs flex items-center gap-2 cursor-pointer transition-all ${
                              isCorrect
                                ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold ring-1 ring-emerald-300'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                            title="Haz clic para marcar como correcta"
                          >
                            <span className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px] shrink-0 ${
                              isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                            }`}>
                              {label}
                            </span>
                            <span className="truncate flex-1">{opt}</span>
                            {isCorrect && (
                              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 stroke-[3]" />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {pq.explanation && (
                      <div className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                        <span className="font-bold text-indigo-700">Fundamento legal: </span>
                        {pq.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Pie de modal con acciones */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>

          {step === 'input' ? (
            <button
              onClick={handleAnalyze}
              disabled={!rawText.trim()}
              className="px-6 py-2.5 rounded-xl font-bold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs shadow-md shadow-purple-500/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              Procesar y Ver Vista Previa
            </button>
          ) : (
            <button
              onClick={handleFinalSubmit}
              disabled={isSubmitting || parsedList.length === 0}
              className="px-7 py-2.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs shadow-md shadow-emerald-500/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isSubmitting
                ? 'Guardando preguntas...'
                : `Confirmar e Insertar ${parsedList.length} Preguntas`}
            </button>
          )}
        </div>


      </div>
    </div>
  );
}
