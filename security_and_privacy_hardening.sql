-- ==============================================================================
-- AUDITORÍA Y BLINDAJE INTEGRAL DE SEGURIDAD Y PRIVACIDAD (SUPABASE RLS)
-- Copia y pega todo este archivo en: Supabase Dashboard -> SQL Editor -> Run
-- ==============================================================================

-- 1. ASEGURAR QUE LAS FUNCIONES DE VERIFICACIÓN SON 'SECURITY DEFINER'
-- (Se ejecutan con permisos elevados internos para verificar rol/estado sin bucles)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_approved()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND status = 'approved'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. ACTIVAR ROW LEVEL SECURITY (RLS) EN EL 100% DE LAS TABLAS DEL SISTEMA
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subtopics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.official_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.official_exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.anki_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.question_challenges ENABLE ROW LEVEL SECURITY;

-- FORZAR RLS INCLUSO PARA LOS PROPIETARIOS DE LAS TABLAS
ALTER TABLE IF EXISTS public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.blocks FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.topics FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subtopics FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.questions FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.flashcards FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.official_exams FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.official_exam_questions FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exam_attempts FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.anki_reviews FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.question_challenges FORCE ROW LEVEL SECURITY;

-- ==============================================================================
-- 3. POLÍTICAS DE PERFILES (profiles)
-- Nadie puede ver alumnos ajenos, ni autoproclamarse admin
-- ==============================================================================
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;

CREATE POLICY "profiles_select_own" ON public.profiles 
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_select_admin" ON public.profiles 
    FOR SELECT USING (public.is_admin());

CREATE POLICY "profiles_update_admin" ON public.profiles 
    FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ==============================================================================
-- 4. POLÍTICAS DE TEMARIO: BLOQUES, TEMAS Y SUBAPARTADOS
-- Solo alumnos aprobados o administradores pueden ver el temario
-- Solo los administradores pueden añadir, modificar o borrar
-- ==============================================================================
DROP POLICY IF EXISTS "blocks_select" ON public.blocks;
DROP POLICY IF EXISTS "blocks_all_admin" ON public.blocks;
CREATE POLICY "blocks_select" ON public.blocks FOR SELECT USING (public.is_approved() OR public.is_admin());
CREATE POLICY "blocks_all_admin" ON public.blocks FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "topics_select" ON public.topics;
DROP POLICY IF EXISTS "topics_all_admin" ON public.topics;
CREATE POLICY "topics_select" ON public.topics FOR SELECT USING (public.is_approved() OR public.is_admin());
CREATE POLICY "topics_all_admin" ON public.topics FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "subtopics_select" ON public.subtopics;
DROP POLICY IF EXISTS "subtopics_all_admin" ON public.subtopics;
CREATE POLICY "subtopics_select" ON public.subtopics FOR SELECT USING (public.is_approved() OR public.is_admin());
CREATE POLICY "subtopics_all_admin" ON public.subtopics FOR ALL USING (public.is_admin());

-- ==============================================================================
-- 5. POLÍTICAS DE PREGUNTAS Y FLASHCARDS
-- El material académico está blindado contra usuarios anónimos o rechazados
-- Solo el administrador puede crear, importar o editar preguntas
-- ==============================================================================
DROP POLICY IF EXISTS "questions_select" ON public.questions;
DROP POLICY IF EXISTS "questions_all_admin" ON public.questions;
CREATE POLICY "questions_select" ON public.questions FOR SELECT USING (public.is_approved() OR public.is_admin());
CREATE POLICY "questions_all_admin" ON public.questions FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "flashcards_select" ON public.flashcards;
DROP POLICY IF EXISTS "flashcards_all_admin" ON public.flashcards;
CREATE POLICY "flashcards_select" ON public.flashcards FOR SELECT USING (public.is_approved() OR public.is_admin());
CREATE POLICY "flashcards_all_admin" ON public.flashcards FOR ALL USING (public.is_admin());

-- ==============================================================================
-- 6. POLÍTICAS DE EXÁMENES OFICIALES
-- ==============================================================================
DROP POLICY IF EXISTS "official_exams_select" ON public.official_exams;
DROP POLICY IF EXISTS "official_exams_admin" ON public.official_exams;
CREATE POLICY "official_exams_select" ON public.official_exams FOR SELECT USING (public.is_approved() OR public.is_admin());
CREATE POLICY "official_exams_admin" ON public.official_exams FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "official_exam_questions_select" ON public.official_exam_questions;
DROP POLICY IF EXISTS "official_exam_questions_admin" ON public.official_exam_questions;
CREATE POLICY "official_exam_questions_select" ON public.official_exam_questions FOR SELECT USING (public.is_approved() OR public.is_admin());
CREATE POLICY "official_exam_questions_admin" ON public.official_exam_questions FOR ALL USING (public.is_admin());

-- ==============================================================================
-- 7. POLÍTICAS DE REPASOS ESPACIADOS (ANKI) Y RESULTADOS
-- Aislamiento estricto: ningún alumno puede ver ni alterar el progreso de otro
-- ==============================================================================
DROP POLICY IF EXISTS "anki_reviews_select_own" ON public.anki_reviews;
DROP POLICY IF EXISTS "anki_reviews_insert_own" ON public.anki_reviews;
DROP POLICY IF EXISTS "anki_reviews_update_own" ON public.anki_reviews;
DROP POLICY IF EXISTS "anki_reviews_delete_own" ON public.anki_reviews;
DROP POLICY IF EXISTS "anki_reviews_admin_all" ON public.anki_reviews;

CREATE POLICY "anki_reviews_select_own" ON public.anki_reviews FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "anki_reviews_insert_own" ON public.anki_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "anki_reviews_update_own" ON public.anki_reviews FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "anki_reviews_delete_own" ON public.anki_reviews FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "anki_reviews_admin_all" ON public.anki_reviews FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "attempts_user_all" ON public.exam_attempts;
DROP POLICY IF EXISTS "attempts_admin_select" ON public.exam_attempts;
CREATE POLICY "attempts_user_all" ON public.exam_attempts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "attempts_admin_select" ON public.exam_attempts FOR SELECT USING (public.is_admin());

-- ==============================================================================
-- 8. POLÍTICAS DE IMPUGNACIONES (question_challenges)
-- ==============================================================================
DROP POLICY IF EXISTS "Users can insert their own challenges" ON public.question_challenges;
DROP POLICY IF EXISTS "Users can select their own challenges" ON public.question_challenges;
DROP POLICY IF EXISTS "Admins can select all challenges" ON public.question_challenges;
DROP POLICY IF EXISTS "Admins can update challenges" ON public.question_challenges;
DROP POLICY IF EXISTS "Admins can delete challenges" ON public.question_challenges;

CREATE POLICY "Users can insert their own challenges" ON public.question_challenges FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can select their own challenges" ON public.question_challenges FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can select all challenges" ON public.question_challenges FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can update challenges" ON public.question_challenges FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete challenges" ON public.question_challenges FOR DELETE TO authenticated USING (public.is_admin());

-- 9. RECARGAR CACHÉ DE ESQUEMAS EN SUPABASE
NOTIFY pgrst, 'reload schema';

SELECT '✅ BLINDAJE DE SEGURIDAD RLS APLICADO CON ÉXITO EN TODAS LAS TABLAS' AS resultado;
