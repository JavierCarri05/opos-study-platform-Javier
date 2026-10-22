-- ACTUALIZACIÓN: Vincular preguntas de exámenes oficiales a temas y subtemas del temario
-- Permite clasificar cada pregunta de examen oficial en su tema/subtema correspondiente

ALTER TABLE public.official_exam_questions
ADD COLUMN IF NOT EXISTS subtopic_id UUID REFERENCES public.subtopics(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_official_exam_questions_subtopic ON public.official_exam_questions(subtopic_id);
