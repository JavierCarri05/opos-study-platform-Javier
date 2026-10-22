-- ==============================================================================
-- CONFIGURACIÓN INDIVIDUALIZADA DE ANKI Y FLASHCARDS POR USUARIO
-- Ejecutar en Supabase Dashboard -> SQL Editor -> Run
-- ==============================================================================

-- 1. Asegurar la tabla de repasos Anki con clave única por usuario y tarjeta/pregunta
CREATE TABLE IF NOT EXISTS public.anki_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL CHECK (item_type IN ('question', 'official_question', 'flashcard')),
    item_id UUID NOT NULL,
    interval_days INT NOT NULL CHECK (interval_days IN (1, 3, 10, 20, 30)),
    next_review_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    review_count INT NOT NULL DEFAULT 1,
    last_result TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Clave única compuesta: Cada usuario tiene su propio registro independiente por cada tarjeta o pregunta
    UNIQUE (user_id, item_type, item_id)
);

-- 2. Índices de alta velocidad por usuario
CREATE INDEX IF NOT EXISTS idx_anki_reviews_user_next 
    ON public.anki_reviews (user_id, next_review_at);

CREATE INDEX IF NOT EXISTS idx_anki_reviews_user_item 
    ON public.anki_reviews (user_id, item_type, item_id);

-- 3. Activar y forzar Seguridad por Fila (Row Level Security - RLS)
ALTER TABLE public.anki_reviews ENABLE ROW LEVEL SECURITY;

-- 4. Recrear políticas de aislamiento estricto por usuario
DROP POLICY IF EXISTS "anki_reviews_select_own" ON public.anki_reviews;
DROP POLICY IF EXISTS "anki_reviews_insert_own" ON public.anki_reviews;
DROP POLICY IF EXISTS "anki_reviews_update_own" ON public.anki_reviews;
DROP POLICY IF EXISTS "anki_reviews_delete_own" ON public.anki_reviews;
DROP POLICY IF EXISTS "anki_reviews_admin_all" ON public.anki_reviews;

-- Cada estudiante SOLO puede leer sus propios repasos
CREATE POLICY "anki_reviews_select_own" ON public.anki_reviews 
    FOR SELECT USING (auth.uid() = user_id);

-- Cada estudiante SOLO puede insertar repasos para su propio ID
CREATE POLICY "anki_reviews_insert_own" ON public.anki_reviews 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Cada estudiante SOLO puede modificar sus propios repasos
CREATE POLICY "anki_reviews_update_own" ON public.anki_reviews 
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Cada estudiante SOLO puede eliminar sus propios repasos
CREATE POLICY "anki_reviews_delete_own" ON public.anki_reviews 
    FOR DELETE USING (auth.uid() = user_id);

-- El administrador tiene acceso global para tareas de gestión y depuración
CREATE POLICY "anki_reviews_admin_all" ON public.anki_reviews 
    FOR ALL USING (public.is_admin());

-- 5. Notificar a PostgREST para refrescar la caché del esquema
NOTIFY pgrst, 'reload schema';
