-- TABLA DEDICADA A FLASHCARDS (MEMORIZACIÓN ACTIVA)
CREATE TABLE IF NOT EXISTS public.flashcards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subtopic_id UUID NOT NULL REFERENCES public.subtopics(id) ON DELETE CASCADE,
    front_text TEXT NOT NULL,          -- Anverso / Pregunta / Término / Artículo
    back_text TEXT NOT NULL,           -- Reverso / Respuesta / Plazo / Definición legal
    hint TEXT,                         -- Pista / Norma de referencia (opcional)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS para Flashcards
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "flashcards_select" ON public.flashcards;
DROP POLICY IF EXISTS "flashcards_all_admin" ON public.flashcards;

CREATE POLICY "flashcards_select" ON public.flashcards FOR SELECT USING (public.is_approved() OR public.is_admin());
CREATE POLICY "flashcards_all_admin" ON public.flashcards FOR ALL USING (public.is_admin());
