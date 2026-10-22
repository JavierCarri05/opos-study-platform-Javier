-- MIGRACIÓN PARA REGLAS DE CLASIFICACIÓN DE PREGUNTAS POR TEMA (SIN IA)
-- Copia y pega esto en: Supabase Dashboard -> SQL Editor -> New Query -> RUN

ALTER TABLE public.topics 
ADD COLUMN IF NOT EXISTS classification_rules JSONB DEFAULT '{"keywords":[], "laws":[], "negativeWords":[]}'::jsonb;

-- Comentario explicativo
COMMENT ON COLUMN public.topics.classification_rules IS 'Reglas de clasificación determinista: leyes, palabras clave y términos excluyentes';
