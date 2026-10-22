-- ============================================================
-- TABLA DE REPASO ESPACIADO ANKI (PREGUNTAS Y FLASHCARDS)
-- Ejecuta este script en Supabase Dashboard -> SQL Editor
-- ============================================================

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
    UNIQUE (user_id, item_type, item_id)
);

-- Índices para consultas ultra rápidas
CREATE INDEX IF NOT EXISTS idx_anki_reviews_user_next 
    ON public.anki_reviews (user_id, next_review_at);

CREATE INDEX IF NOT EXISTS idx_anki_reviews_user_item 
    ON public.anki_reviews (user_id, item_type, item_id);

-- Activar Row Level Security (RLS)
ALTER TABLE public.anki_reviews ENABLE ROW LEVEL SECURITY;

-- Limpieza de políticas previas si existían
DROP POLICY IF EXISTS "anki_reviews_select_own" ON public.anki_reviews;
DROP POLICY IF EXISTS "anki_reviews_insert_own" ON public.anki_reviews;
DROP POLICY IF EXISTS "anki_reviews_update_own" ON public.anki_reviews;
DROP POLICY IF EXISTS "anki_reviews_delete_own" ON public.anki_reviews;
DROP POLICY IF EXISTS "anki_reviews_admin_all" ON public.anki_reviews;

-- Políticas para permitir a cada estudiante gestionar sus propios repasos
CREATE POLICY "anki_reviews_select_own" ON public.anki_reviews 
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "anki_reviews_insert_own" ON public.anki_reviews 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "anki_reviews_update_own" ON public.anki_reviews 
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "anki_reviews_delete_own" ON public.anki_reviews 
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "anki_reviews_admin_all" ON public.anki_reviews 
    FOR ALL USING (public.is_admin());
