-- Migration: RLS Policies for Winners Board
-- Description: Permite al staff ver y actualizar registros completados en player_queue

-- 1. Política para que staff pueda ver registros completados
CREATE POLICY "staff_view_completed_games"
ON player_queue
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('staff', 'admin')
  )
  AND status IN ('completed', 'abandoned')
);

-- 2. Política para que staff pueda actualizar el estado de pago
CREATE POLICY "staff_update_payout_status"
ON player_queue
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('staff', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('staff', 'admin')
  )
);

-- 3. Comentarios para documentación
COMMENT ON POLICY "staff_view_completed_games" ON player_queue IS 
'Permite al staff ver todos los registros de partidas completadas o abandonadas para la pizarra de ganadores';

COMMENT ON POLICY "staff_update_payout_status" ON player_queue IS 
'Permite al staff actualizar el estado de pago de los premios después de verificar la identidad del jugador';
