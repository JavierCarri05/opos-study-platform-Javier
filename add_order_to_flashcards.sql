-- ==============================================================================
-- MIGRACIÓN: Añadir orden/posición personalizable a las Flashcards
-- Copia y pega todo este contenido en el Editor SQL de tu panel de Supabase y pulsa 'RUN'
-- ==============================================================================

-- 1. Añadir la columna order_index si aún no existe
ALTER TABLE public.flashcards 
ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 1;

-- 2. Asignar orden secuencial a las flashcards ya creadas
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY subtopic_id ORDER BY created_at ASC) as rn
  FROM public.flashcards
)
UPDATE public.flashcards f
SET order_index = n.rn
FROM numbered n
WHERE f.id = n.id;

-- 3. Recargar la caché de esquemas de PostgREST para que la API reconozca la nueva columna inmediatamente
NOTIFY pgrst, 'reload schema';
