-- ==============================================================================
-- NORMALIZAR POSICIONES DE FLASHCARDS POR TEMA (1, 2, 3...)
-- Ejecuta este script en el Editor SQL de Supabase si deseas asegurar a nivel de
-- base de datos que las flashcards de cada tema comiencen estrictamente en la posición #1.
-- ==============================================================================

-- 1. Asegurar que la columna order_index existe
ALTER TABLE public.flashcards 
ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 1;

-- 2. Renumerar cada tarjeta comenzando en 1 para cada tema/subtema
WITH ranked AS (
  SELECT 
    id, 
    ROW_NUMBER() OVER (
      PARTITION BY subtopic_id 
      ORDER BY COALESCE(order_index, 999999) ASC, created_at ASC
    ) as correct_order
  FROM public.flashcards
)
UPDATE public.flashcards f
SET order_index = r.correct_order
FROM ranked r
WHERE f.id = r.id;

-- 3. Notificar a PostgREST para refrescar la caché
NOTIFY pgrst, 'reload schema';
