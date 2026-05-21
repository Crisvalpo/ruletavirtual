-- Migration 055: Concurrency Control and Expected Queue Verification
-- Enforces row locking (FOR UPDATE) on screen_state during transitions and 
-- updates force_advance_queue to check for expected_queue_id to prevent skipping turns.

-- 1. Drop existing functions to update signatures cleanly
DROP FUNCTION IF EXISTS public.force_advance_queue(INTEGER);
DROP FUNCTION IF EXISTS public.force_advance_queue(INTEGER, UUID);

-- 2. Create updated force_advance_queue with p_expected_queue_id parameter
CREATE OR REPLACE FUNCTION public.force_advance_queue(
  p_screen_number INTEGER,
  p_expected_queue_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_active_queue_id UUID;
BEGIN
  -- Bloquear la fila de screen_state para evitar colisiones de concurrencia
  PERFORM 1 
  FROM public.screen_state 
  WHERE screen_number = p_screen_number 
  FOR UPDATE;

  -- Obtener el current_queue_id activo de la pantalla
  SELECT current_queue_id INTO v_active_queue_id
  FROM public.screen_state
  WHERE screen_number = p_screen_number;

  -- Si se espera un ID específico y no coincide, salir inmediatamente (evita carreras críticas)
  IF p_expected_queue_id IS NOT NULL AND (v_active_queue_id IS NULL OR v_active_queue_id != p_expected_queue_id) THEN
    RAISE NOTICE 'Skipping force advance: expected queue ID %, but found %', p_expected_queue_id, v_active_queue_id;
    RETURN;
  END IF;

  -- 1. Cerrar el jugador activo correspondiente si tiene un queue_id válido
  IF v_active_queue_id IS NOT NULL THEN
    UPDATE public.player_queue
    SET status = 'completed'
    WHERE id = v_active_queue_id 
      AND status IN ('playing', 'selecting');
  ELSE
    -- Limpieza de seguridad en caso de registros huérfanos sin queue_id en la pantalla
    UPDATE public.player_queue
    SET status = 'completed'
    WHERE screen_number = p_screen_number 
      AND status IN ('playing', 'selecting');
  END IF;

  -- 2. Reiniciar el estado de la pantalla
  UPDATE public.screen_state
  SET status = 'idle',
      player_id = NULL,
      player_name = NULL,
      player_emoji = NULL,
      last_spin_result = NULL,
      current_queue_id = NULL,
      is_demo = false,
      updated_at = NOW()
  WHERE screen_number = p_screen_number;

  -- 3. Promover al siguiente jugador
  PERFORM public.promote_next_player(p_screen_number);
END;
$$;

COMMENT ON FUNCTION public.force_advance_queue IS 'Advances the screen queue safely, optionally validating the expected active queue ID to prevent concurrent race conditions.';

-- 3. Re-create promote_next_player to include row locking (FOR UPDATE)
CREATE OR REPLACE FUNCTION public.promote_next_player(p_screen_number INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_player RECORD;
  v_next_status TEXT;
BEGIN
  -- Bloquear fila de la pantalla para evitar dobles asignaciones concurrentes
  PERFORM 1 
  FROM public.screen_state 
  WHERE screen_number = p_screen_number 
  FOR UPDATE;

  -- 1. Check if screen is free
  IF EXISTS (SELECT 1 FROM public.screen_state WHERE screen_number = p_screen_number AND status != 'idle') THEN
    RETURN FALSE; 
  END IF;

  -- 2. Find oldest waiting player
  SELECT * INTO v_next_player
  FROM public.player_queue
  WHERE screen_number = p_screen_number
    AND status = 'waiting'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_next_player IS NULL THEN
    RETURN FALSE; 
  END IF;

  -- 3. Determine next state (Fast Lane)
  IF v_next_player.selected_animals IS NOT NULL AND jsonb_array_length(v_next_player.selected_animals) > 0 THEN
      v_next_status := 'waiting_for_spin';
  ELSE
      v_next_status := 'selecting'; 
  END IF;

  -- 4. Update Queue Status
  UPDATE public.player_queue
  SET status = 'playing'
  WHERE id = v_next_player.id;

  -- 5. Update Screen State
  UPDATE public.screen_state
  SET 
    status = v_next_status,
    player_id = v_next_player.player_id,
    player_name = v_next_player.player_name, 
    player_emoji = v_next_player.player_emoji,
    current_wheel_id = v_next_player.selected_wheel_id,
    current_queue_id = v_next_player.id,
    updated_at = NOW()
  WHERE screen_number = p_screen_number;

  RETURN TRUE;
END;
$$;
