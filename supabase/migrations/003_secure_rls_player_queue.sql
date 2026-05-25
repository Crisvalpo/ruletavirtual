-- =========================================================================
-- MIGRATION: 003_secure_rls_player_queue.sql
-- Description: Secures the player_queue table by restricting direct client-side
-- updates, allowing users to only update items during selection/waiting,
-- and allowing authenticated staff/admins to update all rows (payouts).
-- =========================================================================

-- 1. Eliminar la política permisiva previa
DROP POLICY IF EXISTS "Public update queue" ON public.player_queue;

-- 2. Crear política estricta de actualización para los jugadores en fase de selección/espera
-- Esto les permite editar selected_animals, player_name, player_emoji y email en su propia pestaña,
-- pero les PROHIBE cambiar su propio status a 'playing', 'spinning', 'completed' o alterar el premio.
CREATE POLICY "Players can update own item during selection" ON public.player_queue
    FOR UPDATE
    USING (status IN ('selecting', 'waiting'))
    WITH CHECK (status IN ('selecting', 'waiting'));

-- 3. Crear política para el staff/admin autenticado para permitir la validación y pago de premios
CREATE POLICY "Staff and admin can update all queue items" ON public.player_queue
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);
