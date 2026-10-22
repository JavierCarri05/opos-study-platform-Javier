import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Obtiene o crea de forma transparente el subtopic_id asociado a un tema concreto.
 * De esta manera, el usuario clasifica únicamente por Bloque y Tema, sin tener que
 * gestionar subapartados, garantizando integridad referencial en la base de datos.
 * 
 * Es altamente tolerante a formatos devueltos por IA: UUID, número de tema ("3", "Tema 3") o título.
 */
export async function resolveTopicSubtopicId(
  topicId: string | null | undefined,
  topicsList: any[],
  supabase: SupabaseClient,
  preferredSubtopicId?: string | null
): Promise<string | null> {
  if (!topicId || typeof topicId !== 'string' || topicId.trim() === '') {
    if (preferredSubtopicId && typeof preferredSubtopicId === 'string' && preferredSubtopicId.trim() !== '') {
      return preferredSubtopicId.trim();
    }
    return null;
  }

  const cleanId = topicId.trim();

  // 1. Resolver el tema en memoria (por UUID exacto, número de orden o coincidencia de título)
  let topic = topicsList.find(t => t.id === cleanId);
  if (!topic) {
    const numMatch = cleanId.match(/\b(?:tema\s*)?(\d+)\b/i);
    if (numMatch) {
      const order = parseInt(numMatch[1], 10);
      topic = topicsList.find(t => t.order_index === order);
    }
  }
  if (!topic) {
    const lower = cleanId.toLowerCase();
    topic = topicsList.find(t => 
      t.title.toLowerCase().includes(lower) || lower.includes(t.title.toLowerCase())
    );
  }

  const effectiveTopicId = topic ? topic.id : cleanId;

  // 1.1 Si se especificó un subtopic_id preferido, comprobar y respetar siempre la elección
  if (preferredSubtopicId && typeof preferredSubtopicId === 'string' && preferredSubtopicId.trim() !== '') {
    const cleanSub = preferredSubtopicId.trim();
    if (topic?.subtopics && topic.subtopics.some((st: any) => st.id === cleanSub)) {
      return cleanSub;
    }
    // Si no está en memoria, verificar si existe en la base de datos
    try {
      const { data: checkSub } = await supabase
        .from('subtopics')
        .select('id, topic_id')
        .eq('id', cleanSub)
        .maybeSingle();
      if (checkSub?.id) return checkSub.id;
    } catch (_) {}
    // Respetar el subapartado indicado por el usuario
    return cleanSub;
  }

  // 2. Comprobar si el tema en memoria ya cuenta con un subtema cargado (priorizar 'General' o el primero)
  if (topic?.subtopics && topic.subtopics.length > 0) {
    const generalSub = topic.subtopics.find((st: any) => st.title?.toLowerCase() === 'general');
    return (generalSub || topic.subtopics[0]).id;
  }

  // 3. Comprobar en base de datos si existe algún subtema para este tema
  try {
    const { data: existingSub } = await supabase
      .from('subtopics')
      .select('id')
      .eq('topic_id', effectiveTopicId)
      .order('order_index', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingSub?.id) {
      if (topic) {
        if (!topic.subtopics) topic.subtopics = [];
        if (!topic.subtopics.some((s: any) => s.id === existingSub.id)) {
          topic.subtopics.push({ id: existingSub.id, order_index: 1, title: 'General', topic_id: effectiveTopicId });
        }
      }
      return existingSub.id;
    }

    // 4. Si no existe ninguno, crear automáticamente el subapartado 'General'
    const { data: newSub, error } = await supabase
      .from('subtopics')
      .insert({
        topic_id: effectiveTopicId,
        order_index: 1,
        title: 'General',
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creando subapartado por defecto para el tema:', error);
      return null;
    }

    // Actualizar objeto en memoria si existe para llamadas posteriores dentro de la misma sesión
    if (topic) {
      topic.subtopics = [{ id: newSub.id, order_index: 1, title: 'General', topic_id: effectiveTopicId }];
    }

    return newSub.id;
  } catch (err) {
    console.error('Excepción al resolver subapartado:', err);
    return null;
  }
}
