'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Sidebar } from '@/components/Sidebar';
import { Profile, Topic, Flashcard, Block } from '@/lib/types';
import { 
  Sparkles, 
  Plus, 
  Trash2, 
  Edit3, 
  X, 
  Search, 
  BookOpen, 
  Save, 
  CheckCheck, 
  Zap, 
  Layers, 
  ArrowRight, 
  Boxes,
  ArrowUp,
  ArrowDown,
  MoveVertical,
  Check,
  ListOrdered
} from 'lucide-react';
import { resolveTopicSubtopicId } from '@/lib/topicHelper';
import { invalidateFlashcardCountsCache } from '@/lib/supabaseHelper';

export const parseBulkFlashcardLines = (rawText: string) => {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const results: { front: string; back: string; hint: string | null }[] = [];

  for (const line of lines) {
    let parts: string[] = [];
    if (line.includes(' /// ')) parts = line.split(' /// ');
    else if (line.includes('///')) parts = line.split('///');
    else if (line.includes('\t')) parts = line.split('\t');
    else if (line.includes(' | ')) parts = line.split(' | ');
    else if (line.includes(';')) parts = line.split(';');
    else if (line.includes(' = ')) parts = line.split(' = ');
    else if (line.includes(' -- ')) parts = line.split(' -- ');
    else if (line.includes(' - ')) parts = line.split(' - ');
    else if (line.includes(': ') && line.indexOf(': ') === line.lastIndexOf(': ')) {
      parts = line.split(': ');
    }

    if (parts.length >= 2) {
      let front = parts[0].trim();
      // Eliminar numeraciones automáticas como "1. ", "2) ", "10.- " al inicio
      front = front.replace(/^\d+[\.\)\-:]+\s+/, '');
      const back = parts[1].trim();
      const hint = parts[2]?.trim() || null;
      if (front && back) {
        results.push({ front, back, hint });
      }
    }
  }
  return results;
};

export const getTopicIdOfCard = (fc: any): string => {
  return fc?.subtopics?.topic_id || fc?.subtopics?.topics?.id || fc?.subtopic_id || '';
};

const isOrderColumnMissing = (err: any) => {
  if (!err) return false;
  const msg = String(err.message || '').toLowerCase();
  const details = String(err.details || '').toLowerCase();
  return (
    err.code === '42703' ||
    err.code === 'PGRST204' ||
    msg.includes('order_index') ||
    details.includes('order_index')
  );
};

export default function AdminFlashcardsPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [flashcards, setFlashcards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Reordenación y feedback
  const [reordering, setReordering] = useState(false);
  const [orderFeedback, setOrderFeedback] = useState<string | null>(null);

  // Filtros
  const [selectedTopicFilter, setSelectedTopicFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Formulario Flashcard
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string>('all');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [frontText, setFrontText] = useState('');
  const [backText, setBackText] = useState('');
  const [hint, setHint] = useState('');
  const [saving, setSaving] = useState(false);
  const [successToast, setSuccessToast] = useState(false);

  // Importador en lote
  const [bulkText, setBulkText] = useState('');
  const [bulkBlockId, setBulkBlockId] = useState<string>('all');
  const [bulkTopicId, setBulkTopicId] = useState('');
  const [bulkStatus, setBulkStatus] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: myProf } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
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
      if (topicsData.length > 0 && !selectedTopicId) {
        setSelectedTopicId(topicsData[0].id);
        setBulkTopicId(topicsData[0].id);
      }
    }

    // Traer flashcards
    let fcDataResult: any[] = [];
    const { data: fcData, error: fcErr } = await supabase
      .from('flashcards')
      .select('*, subtopics(id, title, topic_id, topics(id, title, order_index, block_id))')
      .order('order_index', { ascending: true });

    let rawList: any[] = [];
    if (isOrderColumnMissing(fcErr)) {
      const { data: fallbackData } = await supabase
        .from('flashcards')
        .select('*, subtopics(id, title, topic_id, topics(id, title, order_index, block_id))')
        .order('created_at', { ascending: true });
      if (fallbackData) rawList = fallbackData;
    } else if (fcData) {
      rawList = fcData;
    }

    // Normalizar orden secuencial estrictamente POR TEMA (1, 2, 3...)
    const cardsByTopic = new Map<string, any[]>();
    for (const card of rawList) {
      const tId = getTopicIdOfCard(card) || 'unassigned';
      if (!cardsByTopic.has(tId)) cardsByTopic.set(tId, []);
      cardsByTopic.get(tId)!.push(card);
    }

    const cardsToUpdateInDb: { id: string; order_index: number }[] = [];

    for (const [, cards] of cardsByTopic.entries()) {
      // Ordenar respetando el orden relativo actual (o created_at)
      cards.sort((a, b) => {
        const oA = a.order_index ?? 999999;
        const oB = b.order_index ?? 999999;
        if (oA !== oB) return oA - oB;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      cards.forEach((card, idx) => {
        const expectedOrder = idx + 1;
        if (card.order_index !== expectedOrder) {
          cardsToUpdateInDb.push({ id: card.id, order_index: expectedOrder });
        }
        fcDataResult.push({ ...card, order_index: expectedOrder });
      });
    }

    setFlashcards(fcDataResult);
    setLoading(false);

    // Corregir de forma asíncrona en la base de datos si había números globales inflados (ej. #227 en lugar de #1)
    if (cardsToUpdateInDb.length > 0) {
      try {
        await Promise.all(
          cardsToUpdateInDb.map(c =>
            supabase.from('flashcards').update({ order_index: c.order_index }).eq('id', c.id)
          )
        );
      } catch {
        // Ignorar si no se puede actualizar inmediatamente
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTopicChange = (topId: string) => {
    setSelectedTopicId(topId);
  };

  const currentTopicObj = topics.find(t => t.id === selectedTopicId);
  const bulkTopicObj = topics.find(t => t.id === bulkTopicId);
  const filterTopicObj = topics.find(t => t.id === selectedTopicFilter);

  const handleStartEdit = (fc: any) => {
    setEditingId(fc.id);
    const topicId = fc.subtopics?.topic_id || '';
    const bId = fc.subtopics?.topics?.block_id || 'all';
    setSelectedBlockId(bId);
    setSelectedTopicId(topicId);
    setFrontText(fc.front_text);
    setBackText(fc.back_text);
    setHint(fc.hint || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFrontText('');
    setBackText('');
    setHint('');
  };

  const handleSaveFlashcard = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const targetSubtopicId = await resolveTopicSubtopicId(selectedTopicId, topics, supabase);

      if (!targetSubtopicId) {
        alert('Debes seleccionar un tema válido para esta flashcard.');
        setSaving(false);
        return;
      }

      if (editingId) {
        const { error: updErr } = await supabase
          .from('flashcards')
          .update({
            subtopic_id: targetSubtopicId,
            front_text: frontText.trim(),
            back_text: backText.trim(),
            hint: hint.trim() || null,
          })
          .eq('id', editingId);

        if (updErr) throw updErr;
        setEditingId(null);
      } else {
        // Calcular el orden máximo dentro del TEMA SELECCIONADO (nunca a nivel global)
        const topicCards = flashcards.filter(fc => getTopicIdOfCard(fc) === selectedTopicId);
        const maxOrder = topicCards.reduce((max, fc) => Math.max(max, fc.order_index ?? 0), 0);
        let insPayload: any = {
          subtopic_id: targetSubtopicId,
          front_text: frontText.trim(),
          back_text: backText.trim(),
          hint: hint.trim() || null,
          order_index: maxOrder + 1,
        };
        const { error: insErr } = await supabase.from('flashcards').insert(insPayload);

        if (isOrderColumnMissing(insErr)) {
          delete insPayload.order_index;
          const { error: retryErr } = await supabase.from('flashcards').insert(insPayload);
          if (retryErr) throw retryErr;
        } else if (insErr) {
          throw insErr;
        }
      }

      setFrontText('');
      setBackText('');
      setHint('');
      setSaving(false);
      setSuccessToast(true);
      setTimeout(() => setSuccessToast(false), 3000);
      invalidateFlashcardCountsCache();
      fetchData();
    } catch (err: any) {
      alert('Error al guardar la flashcard: ' + (err.message || 'Error desconocido'));
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Deseas eliminar permanentemente esta flashcard?')) return;
    const { error } = await supabase.from('flashcards').delete().eq('id', id);
    if (error) {
      alert('Error al eliminar la flashcard: ' + error.message);
      return;
    }
    if (editingId === id) handleCancelEdit();
    invalidateFlashcardCountsCache();
    fetchData();
  };

  const handleDeleteTopicFlashcards = async (topicId: string) => {
    const topicObj = topics.find(t => t.id === topicId);
    const topicName = topicObj ? `Tema ${topicObj.order_index}: ${topicObj.title}` : 'este tema';
    const cardsToDelete = flashcards.filter(fc => fc.subtopics?.topic_id === topicId);

    if (cardsToDelete.length === 0) {
      alert(`No hay flashcards para eliminar en ${topicName}.`);
      return;
    }

    const confirmMsg = `¿Deseas eliminar permanentemente TODAS las ${cardsToDelete.length} flashcards de ${topicName}?\n\nEsta acción eliminará las tarjetas y sus repasos Anki. No se puede deshacer.`;
    if (!confirm(confirmMsg)) return;

    try {
      setLoading(true);
      const cardIds = cardsToDelete.map(c => c.id);

      // Eliminar posibles revisiones de Anki vinculadas
      await supabase
        .from('anki_reviews')
        .delete()
        .eq('item_type', 'flashcard')
        .in('item_id', cardIds);

      // Eliminar las flashcards
      const { error } = await supabase
        .from('flashcards')
        .delete()
        .in('id', cardIds);

      if (error) throw error;

      alert(`✅ Se han eliminado correctamente las ${cardsToDelete.length} flashcards de ${topicName}.`);
      invalidateFlashcardCountsCache();
      await fetchData();
    } catch (err: any) {
      alert('Error al eliminar las flashcards: ' + (err.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  // Estado derivado para previsualizar tarjetas en lote
  const previewCards = useMemo(() => parseBulkFlashcardLines(bulkText), [bulkText]);
  const topicCardsForBulk = flashcards.filter(fc => getTopicIdOfCard(fc) === bulkTopicId);
  const topicMaxOrderForBulk = topicCardsForBulk.reduce((max, fc) => Math.max(max, fc.order_index ?? 0), 0);

  // Importar en bloque optimizado para introducir y colocar en orden exacto
  const handleBulkImport = async () => {
    if (!bulkTopicId) {
      alert('Selecciona el tema correspondiente.');
      return;
    }
    if (!bulkText.trim()) return;

    try {
      setBulkStatus('Procesando tarjetas...');
      const targetSub = await resolveTopicSubtopicId(bulkTopicId, topics, supabase);
      if (!targetSub) throw new Error('No se pudo asociar el tema.');

      const parsed = parseBulkFlashcardLines(bulkText);

      if (parsed.length === 0) {
        setBulkStatus('❌ No se ha podido procesar el formato. Usa "Pregunta /// Respuesta" o separadores como ";", tabulador, " - " o " = " en cada línea.');
        return;
      }

      // Asignar orden estrictamente continuo a las tarjetas existentes de este tema
      const startOrder = topicMaxOrderForBulk;
      const payload = parsed.map((item, idx) => ({
        subtopic_id: targetSub,
        front_text: item.front,
        back_text: item.back,
        hint: item.hint,
        order_index: startOrder + idx + 1,
      }));

      let { error } = await supabase.from('flashcards').insert(payload);
      if (isOrderColumnMissing(error)) {
        const parsedWithoutOrder = payload.map(({ order_index, ...rest }) => rest);
        const { error: err2 } = await supabase.from('flashcards').insert(parsedWithoutOrder);
        if (err2) throw err2;
      } else if (error) {
        throw error;
      }

      setBulkStatus(`✅ ¡Se han importado ${payload.length} flashcards en orden exacto (posiciones #${startOrder + 1} a #${startOrder + payload.length})!`);
      setBulkText('');
      // Activar el filtro del tema para que aparezcan directamente ordenadas en pantalla
      setSelectedTopicFilter(bulkTopicId);
      invalidateFlashcardCountsCache();
      fetchData();
    } catch (err: any) {
      setBulkStatus(`Error en la importación: ${err.message}`);
    }
  };

  // Reordenación y cambio de posición dentro del tema con desplazamiento automático
  const handleMovePosition = async (cardId: string, targetPosition: number) => {
    const targetCard = flashcards.find(c => c.id === cardId);
    if (!targetCard) return;

    const cardTopicId = getTopicIdOfCard(targetCard);
    // Obtener todas las tarjetas del mismo tema ordenadas
    const topicCards = flashcards
      .filter(c => getTopicIdOfCard(c) === cardTopicId)
      .sort((a, b) => (a.order_index ?? 999999) - (b.order_index ?? 999999));

    const currentIndex = topicCards.findIndex(c => c.id === cardId);
    if (currentIndex === -1) return;

    const newIndex = Math.max(0, Math.min(topicCards.length - 1, targetPosition - 1));
    if (currentIndex === newIndex) return;

    // Extraer y reinsertar en la nueva posición dentro del tema
    const reorderedTopicCards = [...topicCards];
    const [movedCard] = reorderedTopicCards.splice(currentIndex, 1);
    reorderedTopicCards.splice(newIndex, 0, movedCard);

    // Reasignar posiciones secuenciales dentro del tema (1, 2, 3...)
    const updatedCards = reorderedTopicCards.map((card, idx) => ({
      ...card,
      order_index: idx + 1,
    }));

    // Actualización optimista de estado
    const updatedMap = new Map(updatedCards.map(c => [c.id, c]));
    const nextGlobal = flashcards.map(c => updatedMap.get(c.id) || c);
    setFlashcards(nextGlobal);

    setReordering(true);
    setOrderFeedback(`Moviendo flashcard a la posición #${targetPosition} de su tema...`);

    try {
      const updates = updatedCards.map(c =>
        supabase.from('flashcards').update({ order_index: c.order_index }).eq('id', c.id)
      );
      const results = await Promise.all(updates);
      const hasError = results.some(r => isOrderColumnMissing(r.error));

      if (hasError) {
        setOrderFeedback(`Posición actualizada en pantalla.`);
      } else {
        setOrderFeedback(`¡Posición actualizada! La tarjeta ahora está en la posición #${targetPosition} de su tema.`);
      }
    } catch {
      setOrderFeedback(`Posición actualizada en pantalla.`);
    } finally {
      setReordering(false);
      setTimeout(() => setOrderFeedback(null), 4000);
    }
  };

  // Normalizar posiciones manualmente (1..N)
  const handleNormalizePositions = async () => {
    try {
      setReordering(true);
      const targetTopicId = selectedTopicFilter;
      const topicName = targetTopicId === 'all' 
        ? 'todos los temas' 
        : (topics.find(t => t.id === targetTopicId)?.title || 'el tema actual');

      setOrderFeedback(`Normalizando posiciones (1, 2, 3...) de ${topicName}...`);

      const cardsToProcess = targetTopicId === 'all'
        ? [...flashcards]
        : flashcards.filter(fc => getTopicIdOfCard(fc) === targetTopicId);

      // Agrupar por tema
      const byTopic = new Map<string, any[]>();
      for (const card of cardsToProcess) {
        const tId = getTopicIdOfCard(card) || 'unassigned';
        if (!byTopic.has(tId)) byTopic.set(tId, []);
        byTopic.get(tId)!.push(card);
      }

      const updates: { id: string; order_index: number }[] = [];
      const updatedMap = new Map<string, any>();

      for (const [, cards] of byTopic.entries()) {
        cards.sort((a, b) => {
          const oA = a.order_index ?? 999999;
          const oB = b.order_index ?? 999999;
          if (oA !== oB) return oA - oB;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });

        cards.forEach((card, idx) => {
          const newOrder = idx + 1;
          updates.push({ id: card.id, order_index: newOrder });
          updatedMap.set(card.id, { ...card, order_index: newOrder });
        });
      }

      const nextGlobal = flashcards.map(c => updatedMap.get(c.id) || c);
      setFlashcards(nextGlobal);

      await Promise.all(
        updates.map(u => supabase.from('flashcards').update({ order_index: u.order_index }).eq('id', u.id))
      );

      setOrderFeedback(`✅ ¡Posiciones renumeradas correctamente desde la #1 en cada tema!`);
      invalidateFlashcardCountsCache();
    } catch (err: any) {
      setOrderFeedback(`Error al normalizar: ${err.message}`);
    } finally {
      setReordering(false);
      setTimeout(() => setOrderFeedback(null), 4000);
    }
  };

  const filteredCards = useMemo(() => {
    return flashcards
      .filter(fc => {
        const matchesSearch =
          fc.front_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
          fc.back_text.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTopic =
          selectedTopicFilter === 'all' || getTopicIdOfCard(fc) === selectedTopicFilter;
        return matchesSearch && matchesTopic;
      })
      .sort((a, b) => {
        const topA = a.subtopics?.topics?.order_index ?? 999999;
        const topB = b.subtopics?.topics?.order_index ?? 999999;
        if (topA !== topB) return topA - topB;
        return (a.order_index ?? 999999) - (b.order_index ?? 999999);
      });
  }, [flashcards, searchTerm, selectedTopicFilter]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900 w-full max-w-full overflow-x-clip overflow-x-hidden overscroll-x-none">
      <Sidebar profile={profile} />

      <main className="flex-1 min-w-0 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-8 space-y-8 overflow-y-auto overflow-x-clip overflow-x-hidden overscroll-x-none [touch-action:pan-y]">
        {/* Cabecera */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-6">
          <div>
            <span className="text-xs font-bold text-purple-600 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Sparkles className="w-4 h-4" />
              Gestor Especializado de Flashcards (Anki)
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Banco y Editor de Flashcards
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Crea tarjetas de memorización activa (Anverso: Pregunta/Plazo → Reverso: Respuesta/Definición legal).
            </p>
          </div>

          <div className="flex rounded-2xl bg-slate-200/80 p-1 text-xs">
            <button
              onClick={() => setActiveTab('single')}
              className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all ${
                activeTab === 'single'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Plus className="w-4 h-4" />
              {editingId ? 'Editando Flashcard' : 'Crear 1 a 1'}
            </button>
            <button
              onClick={() => setActiveTab('bulk')}
              className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all ${
                activeTab === 'bulk'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap className="w-4 h-4" />
              Importar Lote Rápido
            </button>
          </div>
        </div>

        {/* Formulario 1 a 1 */}
        {activeTab === 'single' && (
          <div className={`p-6 sm:p-8 rounded-3xl border transition-all shadow-sm ${
            editingId ? 'bg-amber-50/70 border-amber-300' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${editingId ? 'bg-amber-500 text-white' : 'bg-purple-600 text-white'}`}>
                  {editingId ? <Edit3 className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {editingId ? 'Modificando Flashcard Seleccionada' : 'Añadir Nueva Flashcard'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {editingId
                      ? 'Corrige el anverso o reverso y pulsa en "Actualizar Flashcard".'
                      : 'Define el concepto/pregunta y la respuesta para memorización activa.'}
                  </p>
                </div>
              </div>

              {editingId && (
                <button
                  onClick={handleCancelEdit}
                  className="px-3 py-1.5 rounded-xl bg-slate-200 text-xs text-slate-700 hover:bg-slate-300 flex items-center gap-1 font-semibold"
                >
                  <X className="w-4 h-4" />
                  Cancelar edición
                </button>
              )}
            </div>

            {successToast && (
              <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCheck className="w-4 h-4 text-emerald-600" />
                ¡Flashcard guardada con éxito! Lista para crear la siguiente.
              </div>
            )}

            <form onSubmit={handleSaveFlashcard} className="space-y-6">
              <div className={`grid grid-cols-1 ${blocks.length > 0 ? 'sm:grid-cols-2' : ''} gap-4`}>
                {blocks.length > 0 && (
                  <div className="min-w-0">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                      1. Bloque
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
                      className="w-full max-w-full truncate px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
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

                <div className="min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      {blocks.length > 0 ? '2. Tema' : '1. Tema'}
                    </label>
                    {currentTopicObj && (
                      <span className="text-[11px] font-bold text-purple-700 bg-purple-100/80 px-2 py-0.5 rounded-md border border-purple-200 truncate max-w-[200px]" title={`Tema ${currentTopicObj.order_index}: ${currentTopicObj.title}`}>
                        Actual: Tema {currentTopicObj.order_index}
                      </span>
                    )}
                  </div>
                  <select
                    value={selectedTopicId}
                    onChange={(e) => handleTopicChange(e.target.value)}
                    className="w-full max-w-full truncate px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                  >
                    {/* Opción destacada del tema actual al abrir el desplegable */}
                    {currentTopicObj && (
                      <optgroup label="📍 TEMA ACTUALMENTE SELECCIONADO">
                        <option
                          value={currentTopicObj.id}
                          style={{ fontWeight: 'bold', backgroundColor: '#f3e8ff', color: '#6b21a8' }}
                        >
                          ✓ ⭐ Tema {currentTopicObj.order_index}: {currentTopicObj.title} ({flashcards.filter(fc => getTopicIdOfCard(fc) === currentTopicObj.id).length}) [ACTUAL]
                        </option>
                      </optgroup>
                    )}

                    {selectedBlockId === 'all' ? (
                      <>
                        {blocks.map(b => {
                          const bTopics = topics.filter(t => t.block_id === b.id).sort((x, y) => (x.order_index ?? 0) - (y.order_index ?? 0));
                          if (bTopics.length === 0) return null;
                          return (
                            <optgroup key={b.id} label={`Bloque ${b.order_index}: ${b.title}`}>
                              {bTopics.map(t => {
                                const isSelected = t.id === selectedTopicId;
                                const count = flashcards.filter(fc => getTopicIdOfCard(fc) === t.id).length;
                                return (
                                  <option
                                    key={t.id}
                                    value={t.id}
                                    style={isSelected ? { fontWeight: 'bold', backgroundColor: '#f3e8ff', color: '#6b21a8' } : undefined}
                                  >
                                    {isSelected ? '✓ ⭐ ' : '    '}Tema {t.order_index}: {t.title} ({count}){isSelected ? '  ← [ACTUAL]' : ''}
                                  </option>
                                );
                              })}
                            </optgroup>
                          );
                        })}
                        {topics.some(t => !t.block_id) && (
                          <optgroup label="Temas Sin Bloque">
                            {topics.filter(t => !t.block_id).sort((x, y) => (x.order_index ?? 0) - (y.order_index ?? 0)).map(t => {
                              const isSelected = t.id === selectedTopicId;
                              const count = flashcards.filter(fc => getTopicIdOfCard(fc) === t.id).length;
                              return (
                                <option
                                  key={t.id}
                                  value={t.id}
                                  style={isSelected ? { fontWeight: 'bold', backgroundColor: '#f3e8ff', color: '#6b21a8' } : undefined}
                                >
                                  {isSelected ? '✓ ⭐ ' : '    '}Tema {t.order_index}: {t.title} ({count}){isSelected ? '  ← [ACTUAL]' : ''}
                                </option>
                              );
                            })}
                          </optgroup>
                        )}
                      </>
                    ) : (
                      (selectedBlockId === 'unassigned'
                        ? topics.filter(t => !t.block_id)
                        : topics.filter(t => t.block_id === selectedBlockId)
                      ).sort((x, y) => (x.order_index ?? 0) - (y.order_index ?? 0)).map(t => {
                        const isSelected = t.id === selectedTopicId;
                        const count = flashcards.filter(fc => getTopicIdOfCard(fc) === t.id).length;
                        return (
                          <option
                            key={t.id}
                            value={t.id}
                            style={isSelected ? { fontWeight: 'bold', backgroundColor: '#f3e8ff', color: '#6b21a8' } : undefined}
                          >
                            {isSelected ? '✓ ⭐ ' : '    '}Tema {t.order_index}: {t.title} ({count}){isSelected ? '  ← [ACTUAL]' : ''}
                          </option>
                        );
                      })
                    )}
                  </select>
                </div>
              </div>

              {/* Anverso / Cara Delantera */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Anverso (Cara Delantera / Pregunta / Plazo a memorizar)
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Ej. Plazo para interponer recurso de alzada contra acto expreso:"
                  value={frontText}
                  onChange={(e) => setFrontText(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Reverso / Cara Trasera */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Reverso (Cara Trasera / Respuesta exacta / Artículo de ley)
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Ej. 1 mes (Art. 122.1 Ley 39/2015). Si el acto fuera presunto, en cualquier momento a partir del día siguiente a producirse los efectos del silencio."
                  value={backText}
                  onChange={(e) => setBackText(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Pista o Ley de referencia */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Pista o Ley de Referencia (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej. Ley 39/2015, del Procedimiento Administrativo Común"
                  value={hint}
                  onChange={(e) => setHint(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                {editingId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-sm transition-colors"
                  >
                    Descartar cambios
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className={`px-8 py-3 rounded-xl font-bold text-sm shadow-md flex items-center gap-2 cursor-pointer transition-all ${
                    editingId
                      ? 'bg-amber-600 hover:bg-amber-500 text-white'
                      : 'bg-purple-600 hover:bg-purple-700 text-white'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  {saving
                    ? 'Guardando...'
                    : editingId
                    ? 'Actualizar Flashcard'
                    : 'Guardar Flashcard'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Formulario en Lote */}
        {activeTab === 'bulk' && (
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-600" />
                Importar Batería de Flashcards en 1 Segundo
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Escribe o pega una tarjeta por línea separando el anverso y reverso con tres barras (///) o punto y coma (;).
              </p>
            </div>

            <div className={`grid grid-cols-1 ${blocks.length > 0 ? 'sm:grid-cols-2' : ''} gap-4`}>
              {blocks.length > 0 && (
                <div className="min-w-0">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                    1. Bloque (Opcional)
                  </label>
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
                      } else {
                        setBulkTopicId('');
                      }
                    }}
                    className="w-full max-w-full truncate px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
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

              <div className={`min-w-0 ${blocks.length > 0 ? '' : 'sm:col-span-1'}`}>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    {blocks.length > 0 ? '2. Tema' : 'Tema'}
                  </label>
                  {bulkTopicObj && (
                    <span className="text-[11px] font-bold text-purple-700 bg-purple-100/80 px-2 py-0.5 rounded-md border border-purple-200 truncate max-w-[200px]" title={`Tema ${bulkTopicObj.order_index}: ${bulkTopicObj.title}`}>
                      Actual: Tema {bulkTopicObj.order_index}
                    </span>
                  )}
                </div>
                <select
                  value={bulkTopicId}
                  onChange={(e) => setBulkTopicId(e.target.value)}
                  className="w-full max-w-full truncate px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                >
                  <option value="">-- Selecciona el Tema --</option>
                  {bulkTopicObj && (
                    <optgroup label="📍 TEMA ACTUALMENTE SELECCIONADO">
                      <option
                        value={bulkTopicObj.id}
                        style={{ fontWeight: 'bold', backgroundColor: '#f3e8ff', color: '#6b21a8' }}
                      >
                        ✓ ⭐ Tema {bulkTopicObj.order_index}: {bulkTopicObj.title} ({flashcards.filter(fc => getTopicIdOfCard(fc) === bulkTopicObj.id).length}) [ACTUAL]
                      </option>
                    </optgroup>
                  )}
                  {bulkBlockId === 'all' ? (
                    <>
                      {blocks.map(b => {
                        const bTopics = topics.filter(t => t.block_id === b.id).sort((x, y) => (x.order_index ?? 0) - (y.order_index ?? 0));
                        if (bTopics.length === 0) return null;
                        return (
                          <optgroup key={b.id} label={`Bloque ${b.order_index}: ${b.title}`}>
                            {bTopics.map(t => {
                              const isSelected = t.id === bulkTopicId;
                              const count = flashcards.filter(fc => getTopicIdOfCard(fc) === t.id).length;
                              return (
                                <option
                                  key={t.id}
                                  value={t.id}
                                  style={isSelected ? { fontWeight: 'bold', backgroundColor: '#f3e8ff', color: '#6b21a8' } : undefined}
                                >
                                  {isSelected ? '✓ ⭐ ' : '    '}Tema {t.order_index}: {t.title} ({count}){isSelected ? '  ← [ACTUAL]' : ''}
                                </option>
                              );
                            })}
                          </optgroup>
                        );
                      })}
                      {topics.some(t => !t.block_id) && (
                        <optgroup label="Temas Sin Bloque">
                          {topics.filter(t => !t.block_id).sort((x, y) => (x.order_index ?? 0) - (y.order_index ?? 0)).map(t => {
                            const isSelected = t.id === bulkTopicId;
                            const count = flashcards.filter(fc => getTopicIdOfCard(fc) === t.id).length;
                            return (
                              <option
                                key={t.id}
                                value={t.id}
                                style={isSelected ? { fontWeight: 'bold', backgroundColor: '#f3e8ff', color: '#6b21a8' } : undefined}
                              >
                                {isSelected ? '✓ ⭐ ' : '    '}Tema {t.order_index}: {t.title} ({count}){isSelected ? '  ← [ACTUAL]' : ''}
                              </option>
                            );
                          })}
                        </optgroup>
                      )}
                    </>
                  ) : (
                    (bulkBlockId === 'unassigned'
                      ? topics.filter(t => !t.block_id)
                      : topics.filter(t => t.block_id === bulkBlockId)
                    ).sort((x, y) => (x.order_index ?? 0) - (y.order_index ?? 0)).map(t => {
                      const isSelected = t.id === bulkTopicId;
                      const count = flashcards.filter(fc => getTopicIdOfCard(fc) === t.id).length;
                      return (
                        <option
                          key={t.id}
                          value={t.id}
                          style={isSelected ? { fontWeight: 'bold', backgroundColor: '#f3e8ff', color: '#6b21a8' } : undefined}
                        >
                          {isSelected ? '✓ ⭐ ' : '    '}Tema {t.order_index}: {t.title} ({count}){isSelected ? '  ← [ACTUAL]' : ''}
                        </option>
                      );
                    })
                  )}
                </select>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold uppercase text-slate-700">
                  Tarjetas (Línea por línea)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setBulkText(
`Plazo recurso de alzada acto expreso /// 1 mes (Art. 122 LPAC)
Plazo recurso potestativo de reposición acto expreso /// 1 mes (Art. 124 LPAC)
Silencio administrativo en recurso de alzada /// Desestimatorio, salvo excepción del Art. 24.1 (doble silencio positivo)
Mayoría para aprobar una Ley Orgánica /// Mayoría absoluta del Congreso en votación final sobre el conjunto del proyecto`
                    );
                  }}
                  className="text-xs text-purple-600 hover:text-purple-700 font-bold underline"
                >
                  Cargar ejemplo de plazos
                </button>
              </div>

              <textarea
                rows={8}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder="Pregunta o plazo /// Respuesta o artículo"
                className="w-full font-mono text-xs px-4 py-3 rounded-2xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              {previewCards.length > 0 && (
                <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-indigo-950">
                    <span className="flex items-center gap-1.5">
                      <ListOrdered className="w-4 h-4 text-indigo-600" />
                      Vista previa del orden correlativo ({previewCards.length} tarjetas detectadas)
                    </span>
                    <span className="text-[11px] font-extrabold text-indigo-700 bg-white px-2.5 py-0.5 rounded-full border border-indigo-200 shadow-2xs">
                      Se asignarán posiciones: #{topicMaxOrderForBulk + 1} a #{topicMaxOrderForBulk + previewCards.length}
                    </span>
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 text-xs">
                    {previewCards.slice(0, 10).map((p, i) => (
                      <div key={i} className="flex items-center gap-2.5 p-2 rounded-xl bg-white border border-indigo-100 shadow-2xs">
                        <span className="font-black text-[11px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/60 shrink-0">
                          #{topicMaxOrderForBulk + i + 1}
                        </span>
                        <div className="flex-1 truncate">
                          <span className="font-bold text-slate-800">{p.front}</span>
                          <span className="text-slate-400 mx-1.5">➔</span>
                          <span className="text-slate-600">{p.back}</span>
                          {p.hint && (
                            <span className="text-slate-400 italic text-[11px] ml-2">({p.hint})</span>
                          )}
                        </div>
                      </div>
                    ))}
                    {previewCards.length > 10 && (
                      <p className="text-[11px] text-indigo-600 text-center font-bold pt-1">
                        ... y {previewCards.length - 10} tarjetas más que se insertarán en este mismo orden correlativo.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {bulkText.trim() && previewCards.length === 0 && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold">
                  ⚠️ No se ha detectado ninguna tarjeta en el texto. Asegúrate de separar anverso y reverso con <code className="bg-amber-100 px-1 py-0.5 rounded">///</code>, punto y coma <code className="bg-amber-100 px-1 py-0.5 rounded">;</code>, o tabulador.
                </div>
              )}
            </div>

            {bulkStatus && (
              <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-900 font-semibold">
                {bulkStatus}
              </div>
            )}

            <button
              onClick={handleBulkImport}
              disabled={!bulkText.trim()}
              className="w-full py-3.5 rounded-xl font-bold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <Zap className="w-4 h-4" />
              Guardar Flashcards en la Base de Datos
            </button>
          </div>
        )}

        {/* Listado de Flashcards */}
        <section className="space-y-4 pt-4 min-w-0 max-w-full">
          {/* Fila 1: Título y descripción ocupan su propia fila para evitar colapso de texto */}
          <div className="border-b border-slate-200/80 pb-3">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600 shrink-0" />
              <span>Flashcards Registradas ({filteredCards.length})</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Cambia la posición de una flashcard con el selector o flechas (las demás se desplazan automáticamente).
            </p>
          </div>

          {/* Fila 2: Barra de herramientas (Filtros, Renumerar, Borrar, Buscar) */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 w-full min-w-0">
            {/* Selector de tema filtrado */}
            <div className="flex-1 min-w-0">
              <select
                value={selectedTopicFilter}
                onChange={(e) => setSelectedTopicFilter(e.target.value)}
                className="w-full max-w-full px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium truncate"
              >
                <option value="all">-- Todos los temas ({flashcards.length}) --</option>
                {selectedTopicFilter !== 'all' && filterTopicObj && (
                  <optgroup label="📍 TEMA FILTRADO ACTUAL">
                    <option
                      value={filterTopicObj.id}
                      style={{ fontWeight: 'bold', backgroundColor: '#f3e8ff', color: '#6b21a8' }}
                    >
                      ✓ ⭐ Tema {filterTopicObj.order_index}: {filterTopicObj.title} ({flashcards.filter(fc => getTopicIdOfCard(fc) === filterTopicObj.id).length}) [FILTRADO]
                    </option>
                  </optgroup>
                )}
                {blocks.map(b => {
                  const bTopics = topics.filter(t => t.block_id === b.id).sort((x, y) => (x.order_index ?? 0) - (y.order_index ?? 0));
                  if (bTopics.length === 0) return null;
                  return (
                    <optgroup key={b.id} label={`Bloque ${b.order_index}: ${b.title}`}>
                      {bTopics.map(t => {
                        const isSelected = t.id === selectedTopicFilter;
                        const count = flashcards.filter(fc => getTopicIdOfCard(fc) === t.id).length;
                        return (
                          <option
                            key={t.id}
                            value={t.id}
                            style={isSelected ? { fontWeight: 'bold', backgroundColor: '#f3e8ff', color: '#6b21a8' } : undefined}
                          >
                            {isSelected ? '✓ ⭐ ' : '    '}Tema {t.order_index}: {t.title} ({count}){isSelected ? '  ← [ACTUAL]' : ''}
                          </option>
                        );
                      })}
                    </optgroup>
                  );
                })}
                {topics.some(t => !t.block_id) && (
                  <optgroup label="Temas Sin Bloque">
                    {topics.filter(t => !t.block_id).sort((x, y) => (x.order_index ?? 0) - (y.order_index ?? 0)).map(t => {
                      const isSelected = t.id === selectedTopicFilter;
                      const count = flashcards.filter(fc => getTopicIdOfCard(fc) === t.id).length;
                      return (
                        <option
                          key={t.id}
                          value={t.id}
                          style={isSelected ? { fontWeight: 'bold', backgroundColor: '#f3e8ff', color: '#6b21a8' } : undefined}
                        >
                          {isSelected ? '✓ ⭐ ' : '    '}Tema {t.order_index}: {t.title} ({count}){isSelected ? '  ← [ACTUAL]' : ''}
                        </option>
                      );
                    })}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Botones de acción y buscador */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                type="button"
                onClick={handleNormalizePositions}
                disabled={reordering || flashcards.length === 0}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                title="Renumerar secuencialmente (1, 2, 3...) las tarjetas para corregir desajustes de orden"
              >
                <ListOrdered className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>Renumerar (1..N)</span>
              </button>

              {selectedTopicFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => handleDeleteTopicFlashcards(selectedTopicFilter)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                  title="Eliminar todas las flashcards de este tema seleccionado"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span>Borrar flashcards del tema</span>
                </button>
              )}

              <div className="relative w-full sm:w-56">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar por anverso o reverso..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Feedback de reordenación */}
          {orderFeedback && (
            <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-950 text-xs font-semibold flex items-center gap-2 shadow-xs animate-in fade-in">
              <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>{orderFeedback}</span>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 w-full min-w-0">
            {filteredCards.map((fc, index) => {
              const cardTopicId = getTopicIdOfCard(fc);
              const topicCards = flashcards
                .filter(c => getTopicIdOfCard(c) === cardTopicId)
                .sort((a, b) => (a.order_index ?? 999999) - (b.order_index ?? 999999));
              const cardPositionInTopic = fc.order_index ?? (topicCards.findIndex(c => c.id === fc.id) + 1);
              const totalCardsInTopic = topicCards.length;

              return (
              <div
                key={fc.id}
                className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between space-y-3 hover:border-slate-300 transition-all min-w-0 max-w-full overflow-hidden"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      {/* Badge de posición dentro del tema */}
                      <span 
                        className="text-[10px] font-black px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center gap-0.5 shrink-0"
                        title={`Tarjeta #${cardPositionInTopic} de ${totalCardsInTopic} en este tema`}
                      >
                        <MoveVertical className="w-3 h-3 text-indigo-500" />
                        #{cardPositionInTopic}
                      </span>

                      {(() => {
                        const bId = fc.subtopics?.topics?.block_id;
                        const blockObj = blocks.find(b => b.id === bId);
                        const blockPrefix = blockObj ? `[Bloque ${blockObj.order_index}] ` : '';
                        const topicText = fc.subtopics?.topics 
                          ? `Tema ${fc.subtopics.topics.order_index}: ${fc.subtopics.topics.title}` 
                          : (fc.subtopics?.title || 'General');
                        return (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700 truncate max-w-[180px] sm:max-w-[260px]">
                            {blockPrefix}{topicText}
                          </span>
                        );
                      })()}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Botones de subir / bajar dentro del tema */}
                      <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMovePosition(fc.id, cardPositionInTopic - 1)}
                          disabled={cardPositionInTopic <= 1 || reordering}
                          className="p-1 rounded text-slate-600 hover:text-indigo-600 hover:bg-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                          title="Subir posición (mover hacia adelante)"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMovePosition(fc.id, cardPositionInTopic + 1)}
                          disabled={cardPositionInTopic >= totalCardsInTopic || reordering}
                          className="p-1 rounded text-slate-600 hover:text-indigo-600 hover:bg-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                          title="Bajar posición (mover hacia atrás)"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Selector directo de posición dentro del tema */}
                      <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg px-2 py-0.5 shrink-0">
                        <span className="text-[9px] font-bold text-slate-500">Mover a:</span>
                        <select
                          value={cardPositionInTopic}
                          onChange={(e) => handleMovePosition(fc.id, Number(e.target.value))}
                          disabled={reordering || totalCardsInTopic <= 1}
                          className="text-[11px] font-bold text-indigo-700 bg-transparent focus:outline-none cursor-pointer"
                          title="Mover a otra posición dentro de este tema"
                        >
                          {Array.from({ length: totalCardsInTopic }).map((_, i) => (
                            <option key={i + 1} value={i + 1}>
                              Posición #{i + 1}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        onClick={() => handleStartEdit(fc)}
                        className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-purple-600 text-slate-700 hover:text-white text-xs font-bold transition-colors shrink-0"
                      >
                        Retocar
                      </button>
                      <button
                        onClick={() => handleDelete(fc.id)}
                        className="p-1 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 transition-colors shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 mb-2 break-words [overflow-wrap:anywhere]">
                    {fc.front_text}
                  </h3>

                  <div className="p-3 rounded-xl bg-purple-50/50 border border-purple-100 text-xs text-slate-800 leading-relaxed break-words [overflow-wrap:anywhere]">
                    <span className="font-bold text-purple-800 block mb-0.5">Reverso:</span>
                    {fc.back_text}
                  </div>
                </div>

                {fc.hint && (
                  <span className="text-[11px] text-slate-400 italic break-words [overflow-wrap:anywhere]">
                    Referencia: {fc.hint}
                  </span>
                )}
              </div>
            );
          })}
          </div>
        </section>
      </main>
    </div>
  );
}
