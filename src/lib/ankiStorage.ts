import { SupabaseClient } from '@supabase/supabase-js';
import { AnkiInterval, AnkiItemType, AnkiReview } from './types';

export const ANKI_INTERVALS: {
  days: AnkiInterval;
  label: string;
  sublabel: string;
  badgeClass: string;
  buttonClass: string;
  accentColor: string;
}[] = [
  {
    days: 1,
    label: '1 día',
    sublabel: 'Repasar mañana',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    buttonClass: 'hover:bg-rose-50 hover:border-rose-400 text-rose-950 border-rose-200 bg-rose-50/40 hover:ring-2 hover:ring-rose-300',
    accentColor: '#f43f5e',
  },
  {
    days: 3,
    label: '3 días',
    sublabel: 'Repasar en 3 d.',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    buttonClass: 'hover:bg-amber-50 hover:border-amber-400 text-amber-950 border-amber-200 bg-amber-50/40 hover:ring-2 hover:ring-amber-300',
    accentColor: '#f59e0b',
  },
  {
    days: 10,
    label: '10 días',
    sublabel: 'Consolidando',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
    buttonClass: 'hover:bg-sky-50 hover:border-sky-400 text-sky-950 border-sky-200 bg-sky-50/40 hover:ring-2 hover:ring-sky-300',
    accentColor: '#0ea5e9',
  },
  {
    days: 20,
    label: '20 días',
    sublabel: 'Bien aprendida',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    buttonClass: 'hover:bg-indigo-50 hover:border-indigo-400 text-indigo-950 border-indigo-200 bg-indigo-50/40 hover:ring-2 hover:ring-indigo-300',
    accentColor: '#6366f1',
  },
  {
    days: 30,
    label: '30 días',
    sublabel: 'Dominada (1 mes)',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    buttonClass: 'hover:bg-emerald-50 hover:border-emerald-400 text-emerald-950 border-emerald-200 bg-emerald-50/40 hover:ring-2 hover:ring-emerald-300',
    accentColor: '#10b981',
  },
];

export function getAnkiItemKey(itemType: string, itemId: string): string {
  return `${itemType}:${itemId}`;
}

const LOCAL_STORAGE_PREFIX = 'opos_anki_reviews_';

function getLocalKey(userId: string): string {
  if (!userId) return '';
  return `${LOCAL_STORAGE_PREFIX}${userId}`;
}

function getLocalReviews(userId: string): Record<string, AnkiReview> {
  if (!userId || typeof window === 'undefined') return {};
  try {
    const key = getLocalKey(userId);
    if (!key) return {};
    let raw = localStorage.getItem(key);
    // Fallback: verificar si existían reviews en clave legacy global y migrarlas
    if (!raw) {
      const legacy = localStorage.getItem('opos_anki_reviews');
      if (legacy) {
        raw = legacy;
        try {
          localStorage.setItem(key, legacy);
        } catch (_) {}
      }
    }
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('Error leyendo anki reviews de localStorage:', e);
    return {};
  }
}

function saveLocalReviews(userId: string, reviews: Record<string, AnkiReview>) {
  if (!userId || typeof window === 'undefined') return;
  try {
    const key = getLocalKey(userId);
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(reviews));
  } catch (e) {
    console.error('Error guardando anki reviews en localStorage:', e);
  }
}

/**
 * Carga todos los registros de repaso exclusivos del usuario (de Supabase y con fallback en localStorage)
 */
export async function loadAnkiReviews(
  supabase: SupabaseClient,
  userId: string
): Promise<Record<string, AnkiReview>> {
  if (!userId) return {};

  const localMap = getLocalReviews(userId);

  try {
    const { data, error } = await supabase
      .from('anki_reviews')
      .select('*')
      .eq('user_id', userId);

    if (!error && Array.isArray(data)) {
      // Reconstruir el mapa exclusivamente para este usuario desde la base de datos
      const userMap: Record<string, AnkiReview> = {};
      for (const row of data) {
        if (row.user_id !== userId) continue;
        const key = getAnkiItemKey(row.item_type, row.item_id);
        userMap[key] = {
          id: row.id,
          user_id: row.user_id,
          item_type: row.item_type,
          item_id: row.item_id,
          interval_days: row.interval_days as AnkiInterval,
          next_review_at: row.next_review_at,
          last_reviewed_at: row.last_reviewed_at,
          review_count: row.review_count,
          last_result: row.last_result,
          created_at: row.created_at,
          updated_at: row.updated_at,
        };
      }

      // Sincronizar revisiones locales offline pendientes exclusivas de este usuario
      for (const [key, localRev] of Object.entries(localMap)) {
        if (!localRev.user_id || localRev.user_id === userId) {
          const remoteRev = userMap[key];
          if (!remoteRev || new Date(localRev.last_reviewed_at) > new Date(remoteRev.last_reviewed_at)) {
            userMap[key] = { ...localRev, user_id: userId };
            // Intentar sincronizar en segundo plano a Supabase si no estaba o era más reciente
            supabase
              .from('anki_reviews')
              .upsert({
                user_id: userId,
                item_type: localRev.item_type,
                item_id: localRev.item_id,
                interval_days: localRev.interval_days,
                next_review_at: localRev.next_review_at,
                last_reviewed_at: localRev.last_reviewed_at,
                review_count: localRev.review_count || 1,
                last_result: localRev.last_result,
                updated_at: localRev.updated_at || new Date().toISOString(),
              }, { onConflict: 'user_id,item_type,item_id' })
              .then(({ error: syncErr }) => {
                if (syncErr) {
                  console.warn('Sync pendiente de Anki review en Supabase:', syncErr.message);
                }
              });
          }
        }
      }

      saveLocalReviews(userId, userMap);
      return userMap;
    }
  } catch (e) {
    console.warn('Uso de almacenamiento local para Anki (tabla remota no disponible):', e);
  }

  return localMap;
}

/**
 * Guarda o actualiza la programación de repaso para una pregunta o flashcard vinculada estrictamente al usuario
 */
export async function saveAnkiReview(
  supabase: SupabaseClient,
  userId: string,
  itemType: AnkiItemType,
  itemId: string,
  intervalDays: AnkiInterval,
  lastResult?: 'correct' | 'incorrect' | 'revealed'
): Promise<AnkiReview> {
  if (!userId) {
    throw new Error('Se requiere un ID de usuario válido para registrar el repaso Anki.');
  }

  const now = new Date();
  const nextDate = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);

  const localMap = getLocalReviews(userId);
  const key = getAnkiItemKey(itemType, itemId);
  const existing = localMap[key];

  const review: AnkiReview = {
    id: existing?.id,
    user_id: userId,
    item_type: itemType,
    item_id: itemId,
    interval_days: intervalDays,
    next_review_at: nextDate.toISOString(),
    last_reviewed_at: now.toISOString(),
    review_count: (existing?.review_count || 0) + 1,
    last_result: lastResult,
    updated_at: now.toISOString(),
  };

  // Guardar en local storage con clave de usuario de inmediato para 0ms de latencia
  localMap[key] = review;
  saveLocalReviews(userId, localMap);

  // Sincronizar de forma atómica en Supabase vinculando siempre el user_id del estudiante
  try {
    const payload = {
      user_id: userId,
      item_type: itemType,
      item_id: itemId,
      interval_days: intervalDays,
      next_review_at: nextDate.toISOString(),
      last_reviewed_at: now.toISOString(),
      review_count: review.review_count,
      last_result: lastResult,
      updated_at: now.toISOString(),
    };

    const { data, error } = await supabase
      .from('anki_reviews')
      .upsert(payload, { onConflict: 'user_id,item_type,item_id' })
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error al sincronizar review de Anki en Supabase para el usuario:', userId, error);
    } else if (data) {
      review.id = data.id;
      localMap[key] = review;
      saveLocalReviews(userId, localMap);
    }
  } catch (err) {
    console.warn('Guardado en localStorage exitoso; tabla remota pendiente:', err);
  }

  return review;
}

/**
 * Comprueba si un elemento toca repasarlo hoy:
 * - Es nuevo (no tiene review registrada).
 * - O bien su next_review_at es anterior o igual al momento actual.
 */
export function isItemDueForReview(review?: AnkiReview | null): boolean {
  if (!review || !review.next_review_at) {
    return true; // Es nueva: toca estudiarla
  }
  return new Date(review.next_review_at).getTime() <= Date.now();
}

export type AnkiItemStatus = 'overdue' | 'due_today' | 'new' | 'future';

export type AnkiSessionMode =
  | 'balanced'       // Mix inteligente: Repasos pendientes intercalados con contenido nuevo (Anti-bucle)
  | 'prioritize_due' // Repasos primero (por orden de urgencia temporal), luego nuevas
  | 'due_only'       // Solo pendientes (vencidas + tocan hoy)
  | 'new_only'       // Solo contenido virgen / nunca estudiado
  | 'all';           // Todas las preguntas/tarjetas sin restricción

export interface AnkiItemAnalysis {
  status: AnkiItemStatus;
  overdueDays: number;
  daysRemaining: number;
  nextReviewDate: Date | null;
  label: string;
  badgeClass: string;
  isDue: boolean;
}

/**
 * Analiza en profundidad el estado de repaso de un elemento:
 * - Si nunca se ha repasado: 'new'
 * - Si venció hace días (se quedó pendiente): 'overdue' (persiste indefinidamente hasta que se haga)
 * - Si vence hoy: 'due_today'
 * - Si vence en el futuro: 'future'
 */
export function analyzeAnkiItem(review?: AnkiReview | null): AnkiItemAnalysis {
  if (!review || !review.next_review_at) {
    return {
      status: 'new',
      overdueDays: 0,
      daysRemaining: 0,
      nextReviewDate: null,
      label: 'Nueva',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      isDue: true,
    };
  }

  const now = Date.now();
  const nextTime = new Date(review.next_review_at).getTime();
  const diffMs = nextTime - now;

  // Si nextTime <= now, la tarjeta está pendiente de repasar
  if (diffMs <= 0) {
    const overdueDays = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
    if (overdueDays >= 1) {
      return {
        status: 'overdue',
        overdueDays,
        daysRemaining: 0,
        nextReviewDate: new Date(nextTime),
        label: overdueDays === 1 ? 'Atrasada (desde ayer)' : `Atrasada (${overdueDays} días)`,
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
        isDue: true,
      };
    } else {
      return {
        status: 'due_today',
        overdueDays: 0,
        daysRemaining: 0,
        nextReviewDate: new Date(nextTime),
        label: 'Toca repasar hoy',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
        isDue: true,
      };
    }
  }

  // Programada para días futuros
  const daysRemaining = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  return {
    status: 'future',
    overdueDays: 0,
    daysRemaining,
    nextReviewDate: new Date(nextTime),
    label: daysRemaining === 1 ? 'Toca mañana' : `Toca en ${daysRemaining} días`,
    badgeClass: 'bg-slate-50 text-slate-600 border-slate-200',
    isDue: false,
  };
}

export interface AnkiQueueBreakdown {
  total: number;
  dueCount: number;      // overdue + due_today
  overdueCount: number;
  dueTodayCount: number;
  newCount: number;
  futureCount: number;
}

/**
 * Calcula el desglose detallado de un conjunto de ítems según su estado en Anki
 */
export function getAnkiQueueBreakdown<T>(
  items: T[],
  getItemKey: (item: T) => string,
  reviewsMap: Record<string, AnkiReview>
): AnkiQueueBreakdown {
  let overdueCount = 0;
  let dueTodayCount = 0;
  let newCount = 0;
  let futureCount = 0;

  for (const item of items) {
    const key = getItemKey(item);
    const rev = reviewsMap[key];
    const analysis = analyzeAnkiItem(rev);
    if (analysis.status === 'overdue') overdueCount++;
    else if (analysis.status === 'due_today') dueTodayCount++;
    else if (analysis.status === 'new') newCount++;
    else if (analysis.status === 'future') futureCount++;
  }

  return {
    total: items.length,
    dueCount: overdueCount + dueTodayCount,
    overdueCount,
    dueTodayCount,
    newCount,
    futureCount,
  };
}

export interface BuildQueueOptions {
  mode: AnkiSessionMode;
  orderPreference?: 'random' | 'sequential';
}

/**
 * Construye la cola de estudio Anki optimizada evitando bucles cerrados.
 *
 * Características clave:
 * 1. Persistencia de atrasadas: Las tarjetas que no se hicieron ayer o antes se mantienen en pendiente
 *    y se priorizan por proximidad temporal (urgencia: de más atrasadas a más recientes).
 * 2. Modo equilibrado (Anti-bucle): Intercala repasos pendientes con contenido virgen/nuevo
 *    para que el estudiante nunca quede bloqueado solo haciendo repasos antiguos.
 */
export function buildBalancedAnkiQueue<T>(
  items: T[],
  getItemKey: (item: T) => string,
  reviewsMap: Record<string, AnkiReview>,
  options: BuildQueueOptions
): {
  queue: T[];
  breakdown: AnkiQueueBreakdown;
} {
  const { mode, orderPreference = 'random' } = options;

  const overdueItems: { item: T; nextTime: number }[] = [];
  const dueTodayItems: { item: T; nextTime: number }[] = [];
  const newItems: T[] = [];
  const futureItems: { item: T; nextTime: number }[] = [];

  for (const item of items) {
    const key = getItemKey(item);
    const rev = reviewsMap[key];
    const analysis = analyzeAnkiItem(rev);

    if (analysis.status === 'overdue') {
      overdueItems.push({
        item,
        nextTime: analysis.nextReviewDate ? analysis.nextReviewDate.getTime() : 0,
      });
    } else if (analysis.status === 'due_today') {
      dueTodayItems.push({
        item,
        nextTime: analysis.nextReviewDate ? analysis.nextReviewDate.getTime() : 0,
      });
    } else if (analysis.status === 'new') {
      newItems.push(item);
    } else {
      futureItems.push({
        item,
        nextTime: analysis.nextReviewDate ? analysis.nextReviewDate.getTime() : 0,
      });
    }
  }

  // Ordenar los pendientes por urgencia temporal:
  // Los que llevan más tiempo atrasados (nextTime más antiguo / menor) VAN PRIMERO.
  overdueItems.sort((a, b) => a.nextTime - b.nextTime);
  dueTodayItems.sort((a, b) => a.nextTime - b.nextTime);

  const sortedDueItems: T[] = [
    ...overdueItems.map(x => x.item),
    ...dueTodayItems.map(x => x.item),
  ];

  let sortedNewItems = [...newItems];
  if (orderPreference === 'random') {
    sortedNewItems.sort(() => 0.5 - Math.random());
  }

  const breakdown: AnkiQueueBreakdown = {
    total: items.length,
    dueCount: sortedDueItems.length,
    overdueCount: overdueItems.length,
    dueTodayCount: dueTodayItems.length,
    newCount: sortedNewItems.length,
    futureCount: futureItems.length,
  };

  let queue: T[] = [];

  switch (mode) {
    case 'due_only':
      queue = sortedDueItems;
      break;

    case 'new_only':
      queue = sortedNewItems;
      break;

    case 'prioritize_due':
      // Primero todos los pendientes ordenados por urgencia temporal, luego las nuevas
      queue = [...sortedDueItems, ...sortedNewItems];
      break;

    case 'all':
      // Todas: pendientes por urgencia, nuevas, y futuras por fecha
      futureItems.sort((a, b) => a.nextTime - b.nextTime);
      queue = [...sortedDueItems, ...sortedNewItems, ...futureItems.map(x => x.item)];
      break;

    case 'balanced':
    default: {
      // MODO EQUILIBRADO (ANTI-BUCLE):
      // Intercalamos de forma 1 a 1 (o proporcional) los repasos pendientes con contenido virgen.
      // Garantiza que el alumno siempre avanza en temario nuevo a la vez que sanea lo pendiente.
      const dueQueue = [...sortedDueItems];
      const newQueue = [...sortedNewItems];
      const balancedResult: T[] = [];

      while (dueQueue.length > 0 || newQueue.length > 0) {
        if (dueQueue.length > 0) {
          balancedResult.push(dueQueue.shift()!);
        }
        if (newQueue.length > 0) {
          balancedResult.push(newQueue.shift()!);
        }
      }
      queue = balancedResult;
      break;
    }
  }

  return { queue, breakdown };
}

/**
 * Devuelve el número de días restantes hasta el próximo repaso
 */
export function getDaysUntilNextReview(review?: AnkiReview | null): number {
  if (!review || !review.next_review_at) return 0;
  const diffMs = new Date(review.next_review_at).getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Devuelve un texto legible sobre cuándo le toca repasar
 */
export function formatReviewTiming(review?: AnkiReview | null): {
  text: string;
  isDue: boolean;
  daysRemaining: number;
} {
  const analysis = analyzeAnkiItem(review);
  return {
    text: analysis.label,
    isDue: analysis.isDue,
    daysRemaining: analysis.daysRemaining,
  };
}

/**
 * Resetea el historial de una pregunta o flashcard en Anki para este usuario
 */
export async function resetAnkiReview(
  supabase: SupabaseClient,
  userId: string,
  itemType: AnkiItemType,
  itemId: string
) {
  if (!userId) return;

  const localMap = getLocalReviews(userId);
  const key = getAnkiItemKey(itemType, itemId);
  delete localMap[key];
  saveLocalReviews(userId, localMap);

  try {
    await supabase
      .from('anki_reviews')
      .delete()
      .match({ user_id: userId, item_type: itemType, item_id: itemId });
  } catch (e) {
    console.warn('Error eliminando anki review remota:', e);
  }
}

