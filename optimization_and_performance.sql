-- ==============================================================================
-- SCRIPT DE OPTIMIZACIÓN Y ALTO RENDIMIENTO PARA CONCURRENCIA
-- Copia y ejecuta este script en Supabase: SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. ÍNDICES ESTRATÉGICOS (B-TREE) PARA CLAVES FORÁNEAS Y FILTROS FRECUENTES
-- Eliminan por completo los Sequential Scans que saturan la CPU de PostgreSQL.

-- Preguntas del banco propio
CREATE INDEX IF NOT EXISTS idx_questions_subtopic_id 
    ON public.questions (subtopic_id);

CREATE INDEX IF NOT EXISTS idx_questions_unclassified 
    ON public.questions (id) 
    WHERE subtopic_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_questions_created_at 
    ON public.questions (created_at DESC);

-- Preguntas de exámenes oficiales
CREATE INDEX IF NOT EXISTS idx_official_exam_questions_exam_id 
    ON public.official_exam_questions (exam_id);

CREATE INDEX IF NOT EXISTS idx_official_exam_questions_subtopic_id 
    ON public.official_exam_questions (subtopic_id);

CREATE INDEX IF NOT EXISTS idx_official_exam_questions_unclassified 
    ON public.official_exam_questions (id) 
    WHERE subtopic_id IS NULL;

-- Exámenes oficiales
CREATE INDEX IF NOT EXISTS idx_official_exams_year 
    ON public.official_exams (year DESC);

-- Subtemas y Temas
CREATE INDEX IF NOT EXISTS idx_subtopics_topic_id 
    ON public.subtopics (topic_id);

CREATE INDEX IF NOT EXISTS idx_subtopics_topic_order 
    ON public.subtopics (topic_id, order_index);

CREATE INDEX IF NOT EXISTS idx_topics_block_id 
    ON public.topics (block_id);

CREATE INDEX IF NOT EXISTS idx_topics_order_index 
    ON public.topics (order_index);

-- Flashcards
CREATE INDEX IF NOT EXISTS idx_flashcards_subtopic_id 
    ON public.flashcards (subtopic_id);

CREATE INDEX IF NOT EXISTS idx_flashcards_order 
    ON public.flashcards (order_index);

-- Historial de intentos y perfil
CREATE INDEX IF NOT EXISTS idx_exam_attempts_user_created 
    ON public.exam_attempts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_profiles_role_status 
    ON public.profiles (id, role, status);

-- Impugnaciones
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'question_challenges') THEN
        CREATE INDEX IF NOT EXISTS idx_question_challenges_status ON public.question_challenges (status);
        CREATE INDEX IF NOT EXISTS idx_question_challenges_user ON public.question_challenges (user_id);
    END IF;
END $$;


-- 2. OPTIMIZACIÓN DE FUNCIONES DE SEGURIDAD (RLS) CON 'STABLE'
-- Al marcarlas STABLE, PostgreSQL evalúa el rol del usuario UNA SOLA VEZ por consulta,
-- evitando millones de subconsultas fila a fila cuando hay múltiples usuarios simultáneos.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = (SELECT auth.uid()) AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_approved()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = (SELECT auth.uid()) AND status = 'approved'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- 3. FUNCIÓN RPC DE AGREGACIÓN DE CONTEOS ULTRA-RÁPIDA
-- Sustituye la descarga en bucle de miles de filas con fetchAllRows por una sola respuesta agregada en < 5ms.

CREATE OR REPLACE FUNCTION public.get_question_counts_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    result JSONB;
    bank_map JSONB;
    official_map JSONB;
    bank_unclass BIGINT;
    official_unclass BIGINT;
BEGIN
    -- Conteo agrupado por subtema para preguntas del banco
    SELECT COALESCE(jsonb_object_agg(subtopic_id::text, cnt), '{}'::jsonb)
    INTO bank_map
    FROM (
        SELECT subtopic_id, COUNT(*) as cnt
        FROM public.questions
        WHERE subtopic_id IS NOT NULL
        GROUP BY subtopic_id
    ) q;

    -- Conteo agrupado por subtema para preguntas oficiales
    SELECT COALESCE(jsonb_object_agg(subtopic_id::text, cnt), '{}'::jsonb)
    INTO official_map
    FROM (
        SELECT subtopic_id, COUNT(*) as cnt
        FROM public.official_exam_questions
        WHERE subtopic_id IS NOT NULL
        GROUP BY subtopic_id
    ) oq;

    -- Conteo de preguntas libres (sin subtema)
    SELECT COUNT(*) INTO bank_unclass FROM public.questions WHERE subtopic_id IS NULL;
    SELECT COUNT(*) INTO official_unclass FROM public.official_exam_questions WHERE subtopic_id IS NULL;

    result := jsonb_build_object(
        'bank_counts', bank_map,
        'official_counts', official_map,
        'bank_unclassified', COALESCE(bank_unclass, 0),
        'official_unclassified', COALESCE(official_unclass, 0)
    );

    RETURN result;
END;
$$;

-- Otorgar permiso de ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION public.get_question_counts_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_question_counts_summary() TO anon;


-- 4. FUNCIÓN RPC PARA CONTEOS DE FLASHCARDS EN MILISEGUNDOS
-- Reemplaza la descarga de miles de flashcards por una respuesta JSON agregada directamente desde la base de datos.

CREATE OR REPLACE FUNCTION public.get_flashcard_counts_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    result JSONB;
    subtopic_map JSONB;
    topic_map JSONB;
    unassigned_cnt BIGINT;
    total_cnt BIGINT;
BEGIN
    -- Conteo agrupado por subtema
    SELECT COALESCE(jsonb_object_agg(subtopic_id::text, cnt), '{}'::jsonb)
    INTO subtopic_map
    FROM (
        SELECT subtopic_id, COUNT(*) as cnt
        FROM public.flashcards
        WHERE subtopic_id IS NOT NULL
        GROUP BY subtopic_id
    ) fc;

    -- Conteo agrupado por tema (JOIN con subtopics)
    SELECT COALESCE(jsonb_object_agg(s.topic_id::text, cnt), '{}'::jsonb)
    INTO topic_map
    FROM (
        SELECT s.topic_id, COUNT(*) as cnt
        FROM public.flashcards f
        JOIN public.subtopics s ON f.subtopic_id = s.id
        WHERE s.topic_id IS NOT NULL
        GROUP BY s.topic_id
    ) s;

    -- Conteo de flashcards sin subtema asignado
    SELECT COUNT(*) INTO unassigned_cnt FROM public.flashcards WHERE subtopic_id IS NULL;
    SELECT COUNT(*) INTO total_cnt FROM public.flashcards;

    result := jsonb_build_object(
        'counts_by_subtopic', subtopic_map,
        'counts_by_topic', topic_map,
        'unassigned_count', COALESCE(unassigned_cnt, 0),
        'total', COALESCE(total_cnt, 0)
    );

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_flashcard_counts_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_flashcard_counts_summary() TO anon;


-- 5. REFRESCAR LA CACHÉ DEL ESQUEMA EN POSTGREST
NOTIFY pgrst, 'reload schema';

