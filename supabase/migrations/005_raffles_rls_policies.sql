-- =========================================================================
-- MIGRATION: 005_raffles_rls_policies.sql
-- Description: Add RLS policy for public.raffles table to allow staff and 
-- admins to create, update, and delete raffles.
-- =========================================================================

-- 1. Asegurar que RLS está activo para raffles
ALTER TABLE public.raffles ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar política previa si existe para evitar duplicados
DROP POLICY IF EXISTS "Staff and admin can manage all raffles" ON public.raffles;

-- 3. Crear política para administración completa (INSERT, UPDATE, DELETE, SELECT)
CREATE POLICY "Staff and admin can manage all raffles" ON public.raffles
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role IN ('staff', 'admin')
        )
    );
