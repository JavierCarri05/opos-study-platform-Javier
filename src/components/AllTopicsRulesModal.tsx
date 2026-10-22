'use client';

import { useState, useEffect, useMemo } from 'react';
import { Topic, Block, TopicClassificationRules } from '@/lib/types';
import { 
  getTopicRules, 
  saveStoredTopicRules, 
  getStoredTopicRules,
  generateSuggestedRulesForTopic 
} from '@/lib/autoClassifier';
import { 
  X, 
  Sparkles, 
  Check, 
  Save, 
  Scale, 
  Tag, 
  Search, 
  BookOpen,
  Boxes,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  ArrowUpDown
} from 'lucide-react';

interface AllTopicsRulesModalProps {
  topics: Topic[];
  blocks?: Block[];
  supabase: any;
  isOpen: boolean;
  onClose: () => void;
  onAllRulesSaved: (updatedMap: Record<string, TopicClassificationRules>) => void;
}

interface EditableTopicRow {
  topicId: string;
  blockId: string;
  blockTitle: string;
  blockOrderIndex: number;
  orderIndex: number;
  title: string;
  lawsText: string;
  keywordsText: string;
  negativeText: string;
}

interface BlockGroup {
  blockId: string;
  blockTitle: string;
  blockOrderIndex: number;
  rows: EditableTopicRow[];
  configuredCount: number;
}

export function AllTopicsRulesModal({
  topics,
  blocks,
  supabase,
  isOpen,
  onClose,
  onAllRulesSaved
}: AllTopicsRulesModalProps) {
  const [internalBlocks, setInternalBlocks] = useState<Block[]>(blocks || []);
  const [rows, setRows] = useState<EditableTopicRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Asegurar que disponemos de los bloques (vía props o cargándolos directamente de Supabase)
  useEffect(() => {
    if (!isOpen) return;

    if (blocks && blocks.length > 0) {
      setInternalBlocks(blocks);
      return;
    }

    async function fetchBlocks() {
      if (!supabase) return;
      try {
        const { data } = await supabase
          .from('blocks')
          .select('*')
          .order('order_index', { ascending: true });
        if (data && data.length > 0) {
          setInternalBlocks(data);
        }
      } catch (err) {
        console.error('Error cargando bloques en AllTopicsRulesModal:', err);
      }
    }

    fetchBlocks();
  }, [isOpen, blocks, supabase]);

  // Inicializar filas mapeando temas con sus bloques correspondientes
  useEffect(() => {
    if (isOpen && topics.length > 0) {
      const initialRows: EditableTopicRow[] = topics.map(t => {
        const rules = getTopicRules(t);
        const block = internalBlocks.find(b => b.id === t.block_id);
        const bTitle = block?.title || (t as any).blocks?.title || 'Otros Temas / Sin Bloque Asignado';
        const bOrder = block ? block.order_index : 999;
        const bId = t.block_id || 'unassigned';

        return {
          topicId: t.id,
          blockId: bId,
          blockTitle: bTitle,
          blockOrderIndex: bOrder,
          orderIndex: t.order_index,
          title: t.title,
          lawsText: (rules.laws || []).join(', '),
          keywordsText: (rules.keywords || []).join(', '),
          negativeText: (rules.negativeWords || []).join(', ')
        };
      });

      // Ordenar temas por número de tema dentro de su bloque
      initialRows.sort((a, b) => {
        if (a.blockOrderIndex !== b.blockOrderIndex) {
          return a.blockOrderIndex - b.blockOrderIndex;
        }
        return a.orderIndex - b.orderIndex;
      });

      setRows(initialRows);
      setSearchTerm('');
      setSuccessMsg(null);

      // Expandir todos los bloques inicialmente por defecto
      const expMap: Record<string, boolean> = { unassigned: true };
      internalBlocks.forEach(b => {
        expMap[b.id] = true;
      });
      setExpandedBlocks(expMap);
    }
  }, [isOpen, topics, internalBlocks]);

  // Filtrado de filas según el término de búsqueda
  const filteredRows = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return rows;

    return rows.filter(r => 
      r.title.toLowerCase().includes(q) ||
      r.blockTitle.toLowerCase().includes(q) ||
      `tema ${r.orderIndex}`.includes(q) ||
      r.lawsText.toLowerCase().includes(q) ||
      r.keywordsText.toLowerCase().includes(q)
    );
  }, [rows, searchTerm]);

  // Agrupación estructurada de filas por Bloques
  const blockGroups = useMemo(() => {
    const groupsMap = new Map<string, BlockGroup>();

    filteredRows.forEach(r => {
      let grp = groupsMap.get(r.blockId);
      if (!grp) {
        grp = {
          blockId: r.blockId,
          blockTitle: r.blockTitle,
          blockOrderIndex: r.blockOrderIndex,
          rows: [],
          configuredCount: 0
        };
        groupsMap.set(r.blockId, grp);
      }
      grp.rows.push(r);
      if (r.lawsText.trim() || r.keywordsText.trim()) {
        grp.configuredCount++;
      }
    });

    // Ordenar bloques por su índice oficial
    const sortedGroups = Array.from(groupsMap.values());
    sortedGroups.sort((a, b) => a.blockOrderIndex - b.blockOrderIndex);
    return sortedGroups;
  }, [filteredRows]);

  if (!isOpen) return null;

  // Toggle de expansión individual de bloque
  const toggleBlock = (blockId: string) => {
    setExpandedBlocks(prev => ({
      ...prev,
      [blockId]: !prev[blockId]
    }));
  };

  // Expandir o plegar todos los bloques de golpe
  const setAllExpanded = (expanded: boolean) => {
    const newMap: Record<string, boolean> = {};
    blockGroups.forEach(g => {
      newMap[g.blockId] = expanded;
    });
    setExpandedBlocks(newMap);
  };

  // Actualizar un campo específico de una fila
  const handleFieldChange = (topicId: string, field: 'lawsText' | 'keywordsText' | 'negativeText', val: string) => {
    setRows(prev => prev.map(r => r.topicId === topicId ? { ...r, [field]: val } : r));
  };

  // Sugerir reglas para un tema individual
  const handleSuggestSingle = (topicId: string) => {
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return;
    const suggested = generateSuggestedRulesForTopic(topic);
    setRows(prev => prev.map(r => {
      if (r.topicId !== topicId) return r;
      const curLaws = r.lawsText.split(',').map(s => s.trim()).filter(Boolean);
      const curKws = r.keywordsText.split(',').map(s => s.trim()).filter(Boolean);
      const combLaws = Array.from(new Set([...curLaws, ...(suggested.laws || [])]));
      const combKws = Array.from(new Set([...curKws, ...(suggested.keywords || [])]));
      return {
        ...r,
        lawsText: combLaws.join(', '),
        keywordsText: combKws.join(', ')
      };
    }));
  };

  // Autocompletar sugerencias para todos los temas que estén vacíos en un bloque específico
  const handleSuggestBlock = (bId: string) => {
    let count = 0;
    setRows(prev => prev.map(r => {
      if (r.blockId !== bId) return r;
      if (r.lawsText.trim() || r.keywordsText.trim()) return r;
      const topic = topics.find(t => t.id === r.topicId);
      if (!topic) return r;
      count++;
      const suggested = generateSuggestedRulesForTopic(topic);
      return {
        ...r,
        lawsText: (suggested.laws || []).join(', '),
        keywordsText: (suggested.keywords || []).join(', ')
      };
    }));
    setSuccessMsg(`✨ Sugerencias añadidas a ${count} temas vacíos del bloque.`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Autocompletar sugerencias para todos los temas que estén vacíos globalmente
  const handleSuggestAllEmpty = () => {
    let count = 0;
    setRows(prev => prev.map(r => {
      if (r.lawsText.trim() || r.keywordsText.trim()) return r;
      const topic = topics.find(t => t.id === r.topicId);
      if (!topic) return r;
      count++;
      const suggested = generateSuggestedRulesForTopic(topic);
      return {
        ...r,
        lawsText: (suggested.laws || []).join(', '),
        keywordsText: (suggested.keywords || []).join(', ')
      };
    }));
    setSuccessMsg(`✨ Sugerencias autocompletadas para ${count} temas vacíos. Revisa y pulsa Guardar.`);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Guardar todas las reglas a la vez en paralelo
  const handleSaveAll = async () => {
    setIsSaving(true);
    setSuccessMsg(null);

    const rulesMap: Record<string, TopicClassificationRules> = {};
    const splitClean = (str: string) => 
      str.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);

    for (const r of rows) {
      rulesMap[r.topicId] = {
        laws: splitClean(r.lawsText),
        keywords: splitClean(r.keywordsText),
        negativeWords: splitClean(r.negativeText)
      };
    }

    // 1. Guardar en localStorage de inmediato para persistencia instantánea
    const existingStored = getStoredTopicRules();
    const updatedMap = { ...existingStored, ...rulesMap };
    saveStoredTopicRules(updatedMap);

    // 2. Guardar en Supabase en paralelo por lotes
    try {
      await Promise.all(
        Object.entries(rulesMap).map(([topicId, rules]) =>
          supabase
            .from('topics')
            .update({ classification_rules: rules })
            .eq('id', topicId)
        )
      );
    } catch (err) {
      console.warn('Aviso sincronizando reglas en Supabase:', err);
    }

    onAllRulesSaved(rulesMap);
    setIsSaving(false);
    setSuccessMsg(`✅ ¡Guardado con éxito! ${rows.length} temas clasificados por bloque.`);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-6xl w-full max-h-[94vh] flex flex-col border border-slate-200 overflow-hidden">
        
        {/* CABECERA */}
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-purple-50 via-indigo-50 to-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-purple-600 text-white shadow-md shadow-purple-600/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  Clasificador de Materias por Bloques y Temas
                </h2>
                <span className="px-2.5 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[11px] font-black uppercase">
                  {topics.length} Temas
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[11px] font-black uppercase">
                  {internalBlocks.length} Bloques
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium mt-0.5">
                Organizado por bloques temáticos. Define las <strong>leyes oficiales</strong> y <strong>palabras clave</strong> de cada tema para clasificar preguntas automáticamente.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
            <button
              type="button"
              onClick={handleSuggestAllEmpty}
              className="px-3 py-1.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-900 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Autocompletar leyes y palabras sugeridas en los temas que estén en blanco"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>Sugerir para temas vacíos</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* BARRA DE BÚSQUEDA Y ACCIONES DE PLEGADO */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por bloque, tema, título, ley o palabra clave..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setAllExpanded(true)}
              className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <FolderOpen className="w-3.5 h-3.5 text-purple-600" />
              <span>Expandir todos</span>
            </button>

            <button
              type="button"
              onClick={() => setAllExpanded(false)}
              className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
              <span>Plegar todos</span>
            </button>
          </div>
        </div>



        {/* MENSAJE DE ÉXITO */}
        {successMsg && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* CONTENEDOR PRINCIPAL: BLOQUES Y TEMAS */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {blockGroups.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
              <Boxes className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-600">No se encontraron temas con el filtro actual</p>
              <p className="text-xs text-slate-400 mt-1">Intenta con otra búsqueda o selecciona "Todos los Bloques".</p>
            </div>
          ) : (
            blockGroups.map(group => {
              const isExpanded = expandedBlocks[group.blockId] ?? true;

              return (
                <div 
                  key={group.blockId} 
                  className="border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs bg-white transition-all hover:border-slate-300"
                >
                  {/* CABECERA DEL BLOQUE */}
                  <div 
                    onClick={() => toggleBlock(group.blockId)}
                    className="p-4 bg-gradient-to-r from-purple-50/70 via-indigo-50/40 to-white hover:from-purple-100/60 transition-colors border-b border-purple-100/80 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <Boxes className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {group.blockOrderIndex !== 999 && (
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-100 text-purple-800">
                              Bloque {group.blockOrderIndex}
                            </span>
                          )}
                          <h3 className="text-sm sm:text-base font-black text-slate-900 truncate">
                            {group.blockTitle}
                          </h3>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white border border-purple-200 text-purple-700 shadow-2xs">
                            {group.rows.length} {group.rows.length === 1 ? 'tema' : 'temas'}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            group.configuredCount === group.rows.length 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {group.configuredCount} / {group.rows.length} con reglas
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleSuggestBlock(group.blockId)}
                        className="px-2.5 py-1 rounded-lg bg-white border border-purple-200 hover:bg-purple-50 text-purple-700 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                        title="Sugerir leyes y palabras clave para los temas vacíos de este bloque"
                      >
                        <Sparkles className="w-3 h-3 text-purple-600" />
                        <span>Sugerir bloque</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleBlock(group.blockId)}
                        className="p-1.5 rounded-lg bg-white border border-purple-200 text-purple-700 hover:bg-purple-100 transition-colors cursor-pointer"
                        title={isExpanded ? "Plegar bloque" : "Expandir bloque"}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* TABLA DE TEMAS DEL BLOQUE */}
                  {isExpanded && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-100/70 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                            <th className="py-2.5 px-4 w-1/4">Tema Oficial</th>
                            <th className="py-2.5 px-4 w-[36%]">
                              <span className="flex items-center gap-1.5 text-indigo-900">
                                <Scale className="w-3.5 h-3.5 text-indigo-600" />
                                Leyes y Normas Oficiales
                              </span>
                            </th>
                            <th className="py-2.5 px-4 w-[36%]">
                              <span className="flex items-center gap-1.5 text-purple-900">
                                <Tag className="w-3.5 h-3.5 text-purple-600" />
                                Palabras y Frases Clave de la Justificación
                              </span>
                            </th>
                            <th className="py-2.5 px-3 text-center w-16">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {group.rows.map(r => (
                            <tr key={r.topicId} className="hover:bg-slate-50/70 transition-colors">
                              {/* TEMA INFO */}
                              <td className="py-3 px-4 align-top">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200/80 text-indigo-800 text-[10px] font-black uppercase shrink-0">
                                    Tema {r.orderIndex}
                                  </span>
                                </div>
                                <p className="font-bold text-slate-900 leading-snug line-clamp-2" title={r.title}>
                                  {r.title}
                                </p>
                              </td>

                              {/* LEYES INPUT */}
                              <td className="py-3 px-4 align-top">
                                <textarea
                                  rows={2}
                                  value={r.lawsText}
                                  onChange={(e) => handleFieldChange(r.topicId, 'lawsText', e.target.value)}
                                  placeholder="Ej: 39/2015, LPAC, Ley 39/2015"
                                  className="w-full px-3 py-1.5 rounded-xl bg-indigo-50/40 border border-indigo-200 text-xs text-slate-900 font-medium placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none leading-relaxed"
                                />
                              </td>

                              {/* PALABRAS CLAVE INPUT */}
                              <td className="py-3 px-4 align-top">
                                <textarea
                                  rows={2}
                                  value={r.keywordsText}
                                  onChange={(e) => handleFieldChange(r.topicId, 'keywordsText', e.target.value)}
                                  placeholder="Ej: silencio administrativo, recurso de alzada, notificacion..."
                                  className="w-full px-3 py-1.5 rounded-xl bg-purple-50/40 border border-purple-200 text-xs text-slate-900 font-medium placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none leading-relaxed"
                                />
                              </td>

                              {/* BOTÓN SUGERIR */}
                              <td className="py-3 px-3 align-middle text-center">
                                <button
                                  type="button"
                                  onClick={() => handleSuggestSingle(r.topicId)}
                                  className="p-2 rounded-xl text-purple-600 hover:text-purple-900 hover:bg-purple-100 transition-colors cursor-pointer"
                                  title="Autocompletar sugerencias para este tema"
                                >
                                  <Sparkles className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* PIE DE ACCIONES */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            Mostrando {filteredRows.length} de {rows.length} temas en {blockGroups.length} bloques.
          </span>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 font-bold text-xs transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-purple-600/20 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Guardando...' : `Guardar Reglas de Todos los Temas (${rows.length})`}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
