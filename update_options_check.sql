-- ACTUALIZAR RESTRICCIÓN DE CORRECT_OPTION PARA ADMITIR ENTRE 0 Y 3
ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_correct_option_check;
ALTER TABLE public.questions ADD CONSTRAINT questions_correct_option_check CHECK (correct_option BETWEEN 0 AND 3);

ALTER TABLE public.official_exam_questions DROP CONSTRAINT IF EXISTS official_exam_questions_correct_option_check;
ALTER TABLE public.official_exam_questions ADD CONSTRAINT official_exam_questions_correct_option_check CHECK (correct_option BETWEEN 0 AND 3);
