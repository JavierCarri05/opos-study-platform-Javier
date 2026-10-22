-- TABLA DE EXÁMENES OFICIALES (CONVOCATORIAS / MODELOS)
CREATE TABLE IF NOT EXISTS public.official_exams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,                     -- Ej. "Examen OEP 2023 - Administrativo JCCM"
    year INT NOT NULL DEFAULT 2023,          -- Año de la convocatoria
    description TEXT,                        -- Ej. "Turno Libre - Primer Ejercicio"
    duration_minutes INT NOT NULL DEFAULT 90,-- Tiempo oficial en minutos
    penalty_ratio NUMERIC(4, 2) NOT NULL DEFAULT 0.33, -- Cuánto resta cada fallo
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- TABLA DE PREGUNTAS VINCULADAS AL EXAMEN OFICIAL
CREATE TABLE IF NOT EXISTS public.official_exam_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID NOT NULL REFERENCES public.official_exams(id) ON DELETE CASCADE,
    question_number INT NOT NULL,            -- Ej. 1, 2, ... 90 (Preguntas de reserva: 91...)
    question_text TEXT NOT NULL,
    options JSONB NOT NULL,                  -- Array ["A", "B", "C", "D"]
    correct_option INT NOT NULL CHECK (correct_option BETWEEN 0 AND 3),
    explanation TEXT NOT NULL,               -- Fundamento o artículo legal oficial
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
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
