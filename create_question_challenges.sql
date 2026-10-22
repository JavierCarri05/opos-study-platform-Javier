-- ==============================================================================
-- TABLA DE IMPUGNACIONES DE PREGUNTAS (question_challenges)
-- Permite a los alumnos impugnar preguntas y argumentar fallos para revisión docente.
-- La pregunta continúa en la rueda de Anki mientras se genera un aviso en el panel de administración.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.question_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id TEXT NOT NULL,
    question_type TEXT NOT NULL DEFAULT 'bank', -- 'bank' | 'official'
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email TEXT,
    user_name TEXT,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'resolved' | 'dismissed'
    admin_response TEXT,
    question_text TEXT,
    options JSONB,
    correct_option INTEGER,
    explanation TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- Índices de alto rendimiento
CREATE INDEX IF NOT EXISTS idx_question_challenges_status ON public.question_challenges(status);
CREATE INDEX IF NOT EXISTS idx_question_challenges_question_id ON public.question_challenges(question_id);
CREATE INDEX IF NOT EXISTS idx_question_challenges_user_id ON public.question_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_question_challenges_created_at ON public.question_challenges(created_at DESC);

-- Habilitar Seguridad por Fila (RLS)
ALTER TABLE public.question_challenges ENABLE ROW LEVEL SECURITY;

-- 1. Alumnos y usuarios autenticados pueden registrar impugnaciones
DROP POLICY IF EXISTS "Users can insert their own challenges" ON public.question_challenges;
CREATE POLICY "Users can insert their own challenges"
ON public.question_challenges
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 2. Alumnos pueden consultar sus propias impugnaciones
DROP POLICY IF EXISTS "Users can select their own challenges" ON public.question_challenges;
CREATE POLICY "Users can select their own challenges"
ON public.question_challenges
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 3. Administradores pueden consultar todas las impugnaciones de todos los alumnos
DROP POLICY IF EXISTS "Admins can select all challenges" ON public.question_challenges;
CREATE POLICY "Admins can select all challenges"
ON public.question_challenges
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

-- 4. Administradores pueden actualizar el estado de las impugnaciones y responder
DROP POLICY IF EXISTS "Admins can update challenges" ON public.question_challenges;
CREATE POLICY "Admins can update challenges"
ON public.question_challenges
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

-- 5. Administradores pueden eliminar impugnaciones
DROP POLICY IF EXISTS "Admins can delete challenges" ON public.question_challenges;
CREATE POLICY "Admins can delete challenges"
ON public.question_challenges
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

-- Confirmación de ejecución exitosa
SELECT 'Tabla public.question_challenges y políticas RLS creadas con éxito' AS resultado;
