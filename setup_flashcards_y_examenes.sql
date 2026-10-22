-- =========================================================================
-- SCRIPT CONSOLIDADO: FLASHCARDS Y EXÁMENES OFICIALES (EJECUTAR EN SUPABASE)
-- =========================================================================

-- 1. TABLA DEDICADA A FLASHCARDS
CREATE TABLE IF NOT EXISTS public.flashcards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subtopic_id UUID NOT NULL REFERENCES public.subtopics(id) ON DELETE CASCADE,
    front_text TEXT NOT NULL,
    back_text TEXT NOT NULL,
    hint TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "flashcards_select" ON public.flashcards;
DROP POLICY IF EXISTS "flashcards_all_admin" ON public.flashcards;
CREATE POLICY "flashcards_select" ON public.flashcards FOR SELECT USING (public.is_approved() OR public.is_admin());
CREATE POLICY "flashcards_all_admin" ON public.flashcards FOR ALL USING (public.is_admin());


-- 2. TABLA DE EXÁMENES OFICIALES (CONVOCATORIAS)
CREATE TABLE IF NOT EXISTS public.official_exams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    year INT NOT NULL DEFAULT 2023,
    description TEXT,
    duration_minutes INT NOT NULL DEFAULT 90,
    penalty_ratio NUMERIC(4, 2) NOT NULL DEFAULT 0.33,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABLA DE PREGUNTAS DEL EXAMEN OFICIAL
CREATE TABLE IF NOT EXISTS public.official_exam_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID NOT NULL REFERENCES public.official_exams(id) ON DELETE CASCADE,
    question_number INT NOT NULL,
    question_text TEXT NOT NULL,
    options JSONB NOT NULL,
    correct_option INT NOT NULL CHECK (correct_option BETWEEN 0 AND 3),
    explanation TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.official_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_exam_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "official_exams_select" ON public.official_exams;
DROP POLICY IF EXISTS "official_exams_admin" ON public.official_exams;
DROP POLICY IF EXISTS "official_exam_questions_select" ON public.official_exam_questions;
DROP POLICY IF EXISTS "official_exam_questions_admin" ON public.official_exam_questions;

CREATE POLICY "official_exams_select" ON public.official_exams FOR SELECT USING (public.is_approved() OR public.is_admin());
CREATE POLICY "official_exams_admin" ON public.official_exams FOR ALL USING (public.is_admin());

CREATE POLICY "official_exam_questions_select" ON public.official_exam_questions FOR SELECT USING (public.is_approved() OR public.is_admin());
CREATE POLICY "official_exam_questions_admin" ON public.official_exam_questions FOR ALL USING (public.is_admin());
