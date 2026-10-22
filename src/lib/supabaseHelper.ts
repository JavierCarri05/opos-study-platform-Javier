import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Estructura agregada de conteos por subtema para banco propio y exámenes oficiales
 */
export interface QuestionCountsSummary {
  bankCounts: Record<string, number>;
  officialCounts: Record<string, number>;
  bankUnclassified: number;
  officialUnclassified: number;
}

// Caché en memoria de corta duración para evitar ráfagas duplicadas al navegar entre pestañas
let countsCache: { data: QuestionCountsSummary; timestamp: number } | null = null;
const COUNTS_CACHE_TTL_MS = 30000; // 30 segundos de caché fresca

/**
 * Obtiene los conteos agregados de preguntas mediante RPC de PostgreSQL en milisegundos.
 * Sustituye la descarga pesada de todas las filas completas.
 */
export async function getQuestionCountsSummary(
  supabase: SupabaseClient,
  forceRefresh = false
): Promise<QuestionCountsSummary> {
  const now = Date.now();
  if (!forceRefresh && countsCache && now - countsCache.timestamp < COUNTS_CACHE_TTL_MS) {
    return countsCache.data;
  }

  try {
    // 1. Intentar llamar a la función RPC optimizada de Supabase
    const { data, error } = await supabase.rpc('get_question_counts_summary');

    if (!error && data) {
      const summary: QuestionCountsSummary = {
        bankCounts: data.bank_counts || {},
        officialCounts: data.official_counts || {},
        bankUnclassified: Number(data.bank_unclassified) || 0,
        officialUnclassified: Number(data.official_unclassified) || 0,
      };

      countsCache = { data: summary, timestamp: now };
      return summary;
    }
  } catch (rpcErr) {
    console.warn('RPC get_question_counts_summary no disponible o falló, recurriendo a consulta ligera:', rpcErr);
  }

  // 2. Fallback ligero en caso de que aún no se haya ejecutado la función RPC en Supabase
  const fallbackSummary: QuestionCountsSummary = {
    bankCounts: {},
    officialCounts: {},
    bankUnclassified: 0,
    officialUnclassified: 0,
  };

  try {
    const [
      { data: bankData },
      { data: officialData },
      { count: bUnclass },
      { count: offUnclass }
    ] = await Promise.all([
      supabase.from('questions').select('subtopic_id').not('subtopic_id', 'is', null).limit(5000),
      supabase.from('official_exam_questions').select('subtopic_id').not('subtopic_id', 'is', null).limit(5000),
      supabase.from('questions').select('id', { count: 'exact', head: true }).is('subtopic_id', null),
      supabase.from('official_exam_questions').select('id', { count: 'exact', head: true }).is('subtopic_id', null),
    ]);

    if (bankData) {
      bankData.forEach((q: any) => {
        if (q.subtopic_id) {
          fallbackSummary.bankCounts[q.subtopic_id] = (fallbackSummary.bankCounts[q.subtopic_id] || 0) + 1;
        }
      });
    }

    if (officialData) {
      officialData.forEach((oq: any) => {
        if (oq.subtopic_id) {
          fallbackSummary.officialCounts[oq.subtopic_id] = (fallbackSummary.officialCounts[oq.subtopic_id] || 0) + 1;
        }
      });
    }

    fallbackSummary.bankUnclassified = bUnclass || 0;
    fallbackSummary.officialUnclassified = offUnclass || 0;

    countsCache = { data: fallbackSummary, timestamp: now };
  } catch (err) {
    console.error('Error en fallback de conteos de preguntas:', err);
  }

  return fallbackSummary;
}

/**
 * Invalida manualmente la caché de conteos (por ejemplo, tras importar o reasignar preguntas)
 */
export function invalidateQuestionCountsCache() {
  countsCache = null;
}

/**
 * Estructura agregada de conteos de flashcards por subtema y por tema oficial
 */
export interface FlashcardCountsSummary {
  countsBySubtopic: Record<string, number>;
  countsByTopic: Record<string, number>;
  unassignedCount: number;
  total: number;
}

let flashcardCountsCache: { data: FlashcardCountsSummary; timestamp: number } | null = null;

/**
 * Obtiene los conteos de flashcards agrupados por subtema y tema en milisegundos con caché en memoria.
 */
export async function getFlashcardCountsSummary(
  supabase: SupabaseClient,
  forceRefresh = false
): Promise<FlashcardCountsSummary> {
  const now = Date.now();
  if (!forceRefresh && flashcardCountsCache && now - flashcardCountsCache.timestamp < COUNTS_CACHE_TTL_MS) {
    return flashcardCountsCache.data;
  }

  const summary: FlashcardCountsSummary = {
    countsBySubtopic: {},
    countsByTopic: {},
    unassignedCount: 0,
    total: 0,
  };

  // 1. Intentar RPC optimizada en PostgreSQL (< 5ms)
  try {
    const { data, error } = await supabase.rpc('get_flashcard_counts_summary');
    if (!error && data) {
      summary.countsBySubtopic = data.counts_by_subtopic || {};
      summary.countsByTopic = data.counts_by_topic || {};
      summary.unassignedCount = Number(data.unassigned_count) || 0;
      summary.total = Number(data.total) || 0;
      flashcardCountsCache = { data: summary, timestamp: now };
      return summary;
    }
  } catch (_) {
    // Si la RPC no existe aún en supabase, recurrir a consulta ligera
  }

  // 2. Consulta select ligera sin descargar toda la tabla con fetchAllRows
  try {
    const [
      { data: fcData },
      { count: totalCount },
      { count: unassignedCount }
    ] = await Promise.all([
      supabase.from('flashcards').select('subtopic_id, subtopics(topic_id)').not('subtopic_id', 'is', null).limit(10000),
      supabase.from('flashcards').select('id', { count: 'exact', head: true }),
      supabase.from('flashcards').select('id', { count: 'exact', head: true }).is('subtopic_id', null)
    ]);

    summary.total = totalCount ?? 0;
    summary.unassignedCount = unassignedCount ?? 0;

    if (fcData && fcData.length > 0) {
      fcData.forEach((fc: any) => {
        if (fc.subtopic_id) {
          summary.countsBySubtopic[fc.subtopic_id] = (summary.countsBySubtopic[fc.subtopic_id] || 0) + 1;
        }
        const topId = fc.subtopics?.topic_id;
        if (topId) {
          summary.countsByTopic[topId] = (summary.countsByTopic[topId] || 0) + 1;
        }
      });
    }

    flashcardCountsCache = { data: summary, timestamp: now };
  } catch (err) {
    console.error('Error al obtener conteos de flashcards:', err);
  }

  return summary;
}

/**
 * Invalida manualmente la caché de conteos de flashcards
 */
export function invalidateFlashcardCountsCache() {
  flashcardCountsCache = null;
}

// Caché en memoria del perfil de usuario para navegación fluida
let cachedUserProfile: { user: any; profile: any; timestamp: number } | null = null;
const PROFILE_CACHE_TTL_MS = 120000; // 2 minutos

export async function getCachedUserProfile(
  supabase: SupabaseClient,
  forceRefresh = false
): Promise<{ user: any; profile: any }> {
  const now = Date.now();
  if (!forceRefresh && cachedUserProfile && now - cachedUserProfile.timestamp < PROFILE_CACHE_TTL_MS) {
    return { user: cachedUserProfile.user, profile: cachedUserProfile.profile };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    cachedUserProfile = null;
    return { user: null, profile: null };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  cachedUserProfile = { user, profile, timestamp: now };
  return { user, profile };
}

export function invalidateUserProfileCache() {
  cachedUserProfile = null;
}


let topicsBlocksCache: {
  blocks: any[];
  topics: any[];
  timestamp: number;
} | null = null;
const TOPICS_CACHE_TTL_MS = 600000; // 10 minutos

export async function getCachedTopicsAndBlocks(
  supabase: SupabaseClient,
  forceRefresh = false
): Promise<{ blocks: any[]; topics: any[] }> {
  const now = Date.now();
  if (!forceRefresh && topicsBlocksCache && now - topicsBlocksCache.timestamp < TOPICS_CACHE_TTL_MS) {
    return {
      blocks: topicsBlocksCache.blocks,
      topics: topicsBlocksCache.topics,
    };
  }

  const [{ data: blocksData }, { data: topicsData }] = await Promise.all([
    supabase.from('blocks').select('*').order('order_index'),
    supabase.from('topics').select('*, subtopics(*)').order('order_index'),
  ]);

  const blocks = blocksData || [];
  const topics = topicsData || [];

  topicsBlocksCache = { blocks, topics, timestamp: now };
  return { blocks, topics };
}

export function invalidateTopicsBlocksCache() {
  topicsBlocksCache = null;
}

/**
 * Helper to fetch all rows across PostgREST pagination limits (default 1000 rows).
 * Performs iterative chunked fetching using .range() until all records are retrieved.
 */
export async function fetchAllRows<T = any>(
  supabase: any,
  table: string,
  selectQuery: string,
  orderBy?: string,
  ascending = true,
  filters?: (query: any) => any
): Promise<T[]> {
  let allRows: T[] = [];
  let from = 0;
  const step = 1000;

  while (true) {
    let query = supabase.from(table).select(selectQuery).range(from, from + step - 1);
    if (orderBy) {
      query = query.order(orderBy, { ascending });
    }
    if (filters) {
      query = filters(query);
    }
    const { data, error } = await query;
    if (error) {
      console.error(`Error in fetchAllRows for ${table}:`, error);
      break;
    }
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < step) break;
    from += step;
  }

  return allRows;
}
