-- ==============================================================================
-- BORRAR TODAS LAS FLASHCARDS DEL TEMA 1 (CONSTITUCIÓN ESPAÑOLA)
-- Ejecutar en Supabase Dashboard -> SQL Editor -> Run
-- ==============================================================================

DO $$
DECLARE
    v_topic_ids UUID[];
    v_subtopic_ids UUID[];
    v_flashcard_ids UUID[];
    v_fc_count INT := 0;
    v_anki_count INT := 0;
BEGIN
    -- 1. Identificar el Tema 1 (por order_index = 1 o que contenga Constitución en el título)
    SELECT ARRAY_AGG(id) INTO v_topic_ids
    FROM public.topics
    WHERE order_index = 1 
       OR title ILIKE '%Constituci%' 
       OR title ILIKE '%Constitución%';

    IF v_topic_ids IS NULL OR array_length(v_topic_ids, 1) = 0 THEN
        RAISE NOTICE '⚠️ No se encontró ningún tema con order_index = 1 o título Constitución.';
        RETURN;
    END IF;

    -- 2. Localizar todos los subtemas asociados a dicho tema
    SELECT ARRAY_AGG(id) INTO v_subtopic_ids
    FROM public.subtopics
    WHERE topic_id = ANY(v_topic_ids);

    IF v_subtopic_ids IS NULL OR array_length(v_subtopic_ids, 1) = 0 THEN
        RAISE NOTICE '⚠️ No se encontraron subtemas vinculados al Tema 1.';
        RETURN;
    END IF;

    -- 3. Obtener todas las flashcards a eliminar
    SELECT ARRAY_AGG(id) INTO v_flashcard_ids
    FROM public.flashcards
    WHERE subtopic_id = ANY(v_subtopic_ids);

    IF v_flashcard_ids IS NULL OR array_length(v_flashcard_ids, 1) = 0 THEN
        RAISE NOTICE 'ℹ️ No hay flashcards registradas para el Tema 1 (Constitución Española). Ya está vacío.';
        RETURN;
    END IF;

    v_fc_count := array_length(v_flashcard_ids, 1);

    -- 4. Eliminar repasos de Anki vinculados a esas flashcards para mantener la base de datos limpia
    DELETE FROM public.anki_reviews
    WHERE item_type = 'flashcard' 
      AND item_id = ANY(v_flashcard_ids);
    GET DIAGNOSTICS v_anki_count = ROW_COUNT;

    -- 5. Eliminar las flashcards
    DELETE FROM public.flashcards
    WHERE id = ANY(v_flashcard_ids);

    RAISE NOTICE '✅ ÉXITO: Se han eliminado % flashcards y % registros de Anki del Tema 1 (Constitución Española).', v_fc_count, v_anki_count;
END $$;
