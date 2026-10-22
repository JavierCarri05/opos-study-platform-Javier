-- MIGRACIÓN PARA INCORPORAR BLOQUES (BLOQUES > TEMAS > SUBAPARTADOS)

-- 1. CREAR TABLA DE BLOQUES
CREATE TABLE IF NOT EXISTS public.blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_index INT NOT NULL DEFAULT 1,
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. VINCULAR TEMAS CON BLOQUES (OPCIONAL/NULLABLE PARA COMPATIBILIDAD)
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS block_id UUID REFERENCES public.blocks(id) ON DELETE SET NULL;

-- 3. SEGURIDAD RLS PARA BLOQUES
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blocks_select" ON public.blocks;
DROP POLICY IF EXISTS "blocks_all_admin" ON public.blocks;

CREATE POLICY "blocks_select" ON public.blocks FOR SELECT USING (public.is_approved() OR public.is_admin());
CREATE POLICY "blocks_all_admin" ON public.blocks FOR ALL USING (public.is_admin());
