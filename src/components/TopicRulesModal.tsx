'use client';

import { useState, useEffect } from 'react';
import { Topic, TopicClassificationRules } from '@/lib/types';
import { 
  getTopicRules, 
  saveTopicRules, 
  generateSuggestedRulesForTopic, 
  classifyQuestionByKeywords 
} from '@/lib/autoClassifier';
import { 
  X, 
  Sparkles, 
  Plus, 
  Check, 
  AlertCircle, 
  BookOpen, 
  Scale, 
  Tag, 
  Ban, 
  Play, 
  Database,
  Save,
  HelpCircle
} from 'lucide-react';

interface TopicRulesModalProps {
  topic: Topic | null;
  allTopics: Topic[];
  supabase: any;
  isOpen: boolean;
  onClose: () => void;
  onRulesSaved: (topicId: string, rules: TopicClassificationRules) => void;
}

export function TopicRulesModal({
  topic,
  allTopics,
  supabase,
  isOpen,
  onClose,
  onRulesSaved
}: TopicRulesModalProps) {
  const [laws, setLaws] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [negativeWords, setNegativeWords] = useState<string[]>([]);

  // Input temporales
  const [lawInput, setLawInput] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [negativeInput, setNegativeInput] = useState('');

  // Sandbox de prueba dentro del modal
  const [testText, setTestText] = useState('');
  const [testResult, setTestResult] = useState<any>(null);

  // Estados de guardado
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (topic && isOpen) {
      const current = getTopicRules(topic);
      setLaws(current.laws || []);
      setKeywords(current.keywords || []);
      setNegativeWords(current.negativeWords || []);
      setLawInput('');
      setKeywordInput('');
      setNegativeInput('');
      setTestText('');
      setTestResult(null);
      setSaveSuccess(null);
    }
  }, [topic, isOpen]);

  if (!isOpen || !topic) return null;

  // Handlers para añadir tags (soporta separar por comas, puntos y comas o saltos de línea)
  const handleAddLaw = () => {
    const raw = lawInput.trim();
    if (!raw) return;
    const parts = raw.split(/[,;\n]+/).map(p => p.trim()).filter(Boolean);
    const newItems = parts.filter(p => !laws.some(l => l.toLowerCase() === p.toLowerCase()));
    if (newItems.length > 0) {
      setLaws([...laws, ...newItems]);
      setLawInput('');
    }
  };

  const handleAddKeyword = () => {
    const raw = keywordInput.trim();
    if (!raw) return;
    const parts = raw.split(/[,;\n]+/).map(p => p.trim()).filter(Boolean);
    const newItems = parts.filter(p => !keywords.some(k => k.toLowerCase() === p.toLowerCase()));
    if (newItems.length > 0) {
      setKeywords([...keywords, ...newItems]);
      setKeywordInput('');
    }
  };

  const handleAddNegative = () => {
    const raw = negativeInput.trim();
    if (!raw) return;
    const parts = raw.split(/[,;\n]+/).map(p => p.trim()).filter(Boolean);
    const newItems = parts.filter(p => !negativeWords.some(n => n.toLowerCase() === p.toLowerCase()));
    if (newItems.length > 0) {
      setNegativeWords([...negativeWords, ...newItems]);
      setNegativeInput('');
    }
  };

  // Sugerir automáticamente a partir del título y subtemas
  const handleGenerateSuggestions = () => {
    const suggested = generateSuggestedRulesForTopic(topic);
    // Unir sin duplicados
    const combinedLaws = Array.from(new Set([...laws, ...(suggested.laws || [])]));
    const combinedKws = Array.from(new Set([...keywords, ...(suggested.keywords || [])]));
    setLaws(combinedLaws);
    setKeywords(combinedKws);
    setSaveSuccess('✨ Reglas sugeridas añadidas. ¡Revisa y pulsa Guardar!');
    setTimeout(() => setSaveSuccess(null), 4000);
  };

  // Guardar reglas
  const handleSave = async () => {
    setIsSaving(true);
    const newRules: TopicClassificationRules = {
      laws,
      keywords,
      negativeWords
    };

    try {
      const res = await saveTopicRules(supabase, topic.id, newRules);
      onRulesSaved(topic.id, newRules);
      setIsSaving(false);
      if (res.syncedToDb) {
        setSaveSuccess('✅ Guardado en base de datos y memoria local con éxito.');
      } else {
        setSaveSuccess('✅ Guardado localmente listo para usar.');
      }
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setIsSaving(false);
      alert('Error al guardar reglas: ' + (err.message || 'Error'));
    }
  };

  // Ejecutar prueba sandbox
  const handleRunTest = () => {
    if (!testText.trim()) return;
    // Creamos una lista virtual de temas con las reglas actuales modificadas
    const virtualTopics = allTopics.map(t => {
      if (t.id === topic.id) {
        return {
          ...t,
          classification_rules: { laws, keywords, negativeWords }
        };
      }
      return t;
    });

    const match = classifyQuestionByKeywords(
      { question_text: '', explanation: testText },
      virtualTopics
    );
    setTestResult(match);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden">
        
        {/* CABECERA */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-purple-50 via-indigo-50 to-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-purple-600 text-white shadow-md shadow-purple-600/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[11px] font-extrabold uppercase">
                  Tema {topic.order_index}
                </span>
                <h2 className="text-base font-bold text-slate-900">
                  Reglas de Clasificación Automática
                </h2>
              </div>
              <p className="text-xs text-slate-600 truncate max-w-md font-medium">
                {topic.title}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleGenerateSuggestions}
              className="px-3 py-1.5 rounded-xl bg-purple-100/90 hover:bg-purple-200 text-purple-800 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Analiza el título y subtemas para proponerte leyes y palabras clave"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>Sugerir iniciales</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CONTENIDO SCROLLEABLE */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">

          {saveSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{saveSuccess}</span>
            </div>
          )}

          {/* EXPLICACIÓN BREVE */}
          <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 flex items-start gap-3">
            <Scale className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-xs text-indigo-950">
              <p className="font-extrabold">
                🎯 Búsqueda enfocada en la Justificación Legal de la pregunta
              </p>
              <p className="text-indigo-800/90 leading-relaxed">
                El sistema analiza principalmente la <strong>justificación / fundamento legal</strong> de cada pregunta (donde siempre se cita la ley y el artículo). Si la justificación contiene la ley o palabras clave de este tema, se asignará con precisión total (100% determinista, sin IA).
              </p>
            </div>
          </div>

          {/* 1. LEYES Y NORMAS OFICIALES */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-indigo-600" />
                Leyes y Normas Oficiales en la Justificación
                <span className="text-[11px] font-normal text-indigo-600 font-bold">
                  (+60 pts en justificación)
                </span>
              </label>
              <span className="text-[11px] text-slate-400 font-bold">
                {laws.length} {laws.length === 1 ? 'ley' : 'leyes'}
              </span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={lawInput}
                onChange={(e) => setLawInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddLaw();
                  }
                }}
                placeholder="Ej: 39/2015, TREBEP, CE 1978, Ley 7/1985..."
                className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddLaw}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Añadir</span>
              </button>
            </div>

            {/* Badges de Leyes */}
            <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2.5 rounded-xl bg-indigo-50/40 border border-indigo-100">
              {laws.length === 0 ? (
                <span className="text-xs text-slate-400 italic">No hay leyes añadidas aún.</span>
              ) : (
                laws.map((l, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold text-xs shadow-sm"
                  >
                    <span>{l}</span>
                    <button
                      type="button"
                      onClick={() => setLaws(laws.filter((_, idx) => idx !== i))}
                      className="hover:text-rose-200 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* 2. PALABRAS Y FRASES CLAVE */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-purple-600" />
                Palabras y Frases Clave
                <span className="text-[11px] font-normal text-slate-400">
                  (Frases: +25 pts | Palabras: +12 pts)
                </span>
              </label>
              <span className="text-[11px] text-slate-400 font-bold">
                {keywords.length} términos
              </span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddKeyword();
                  }
                }}
                placeholder="Ej: silencio administrativo, recurso de alzada, interesado, notificación..."
                className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddKeyword}
                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Añadir</span>
              </button>
            </div>

            {/* Badges de Keywords */}
            <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2.5 rounded-xl bg-purple-50/40 border border-purple-100">
              {keywords.length === 0 ? (
                <span className="text-xs text-slate-400 italic">No hay palabras clave añadidas aún.</span>
              ) : (
                keywords.map((kw, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-100 text-purple-900 border border-purple-200/80 font-bold text-xs"
                  >
                    <span>{kw}</span>
                    <button
                      type="button"
                      onClick={() => setKeywords(keywords.filter((_, idx) => idx !== i))}
                      className="hover:text-rose-600 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* 3. TÉRMINOS EXCLUYENTES / NEGATIVOS */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                <Ban className="w-4 h-4 text-rose-600" />
                Términos Excluyentes (Anti-error)
                <span className="text-[11px] font-normal text-slate-400">
                  (Si aparecen, resta -60 pts para no confundir con otros temas)
                </span>
              </label>
              <span className="text-[11px] text-slate-400 font-bold">
                {negativeWords.length} excluyentes
              </span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={negativeInput}
                onChange={(e) => setNegativeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddNegative();
                  }
                }}
                placeholder="Ej: contrato de obras, licitación, delito, tráfico..."
                className="flex-1 px-3 py-2 rounded-xl bg-white border border-rose-200 text-xs font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddNegative}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Añadir</span>
              </button>
            </div>

            {/* Badges de Negativas */}
            <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2.5 rounded-xl bg-rose-50/40 border border-rose-100">
              {negativeWords.length === 0 ? (
                <span className="text-xs text-slate-400 italic">Opcional: añade términos para evitar que este tema se dispute preguntas de otro tema.</span>
              ) : (
                negativeWords.map((nw, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-100 text-rose-900 border border-rose-200 font-bold text-xs"
                  >
                    <span>{nw}</span>
                    <button
                      type="button"
                      onClick={() => setNegativeWords(negativeWords.filter((_, idx) => idx !== i))}
                      className="hover:text-rose-700 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* 4. SANDBOX / PRUEBA EN VIVO */}
          <div className="p-4 rounded-2xl bg-slate-900 text-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Simulador Rápido por Justificación
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                Pega la justificación o fundamentación legal
              </span>
            </div>

            <textarea
              rows={2}
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder="Ej: Según el artículo 47 de la Ley 39/2015 del Procedimiento Administrativo Común..."
              className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-100 font-medium placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleRunTest}
                disabled={!testText.trim()}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Analizar texto</span>
              </button>
            </div>

            {/* Resultado del simulador */}
            {testResult && (
              <div className="mt-2 p-3 rounded-xl bg-slate-800/90 border border-slate-700 space-y-1.5 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">
                    Resultado del análisis:
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                    testResult.topic.id === topic.id
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {testResult.topic.id === topic.id
                      ? `✅ Ganador: Este Tema (${testResult.score} pts)`
                      : `⚠️ Asignaría a: Tema ${testResult.topic.order_index} (${testResult.score} pts)`}
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  {testResult.reason}
                </p>
                {testResult.matchedTerms && testResult.matchedTerms.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {testResult.matchedTerms.map((m: string, i: number) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                        {m}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

        {/* PIE DE ACCIONES */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 font-bold text-xs transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Guardando...' : 'Guardar Reglas del Tema'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
