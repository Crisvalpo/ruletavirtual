-- Migration 048: Fix Promote Player Function (Complete)
-- Restores missing updates for current_wheel_id and current_queue_id that were lost in previous migrations.

CREATE OR REPLACE FUNCTION promote_next_player(p_screen_number INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_player RECORD;
  v_next_status TEXT;
BEGIN
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

  -- 3. DETERMINE NEXT STATE (Fast Lane)
  -- If user already selected animals/numbers, we skip 'selecting' and go straight to 'waiting_for_spin'
  IF v_next_player.selected_animals IS NOT NULL AND jsonb_array_length(v_next_player.selected_animals) > 0 THEN
      v_next_status := 'waiting_for_spin';
  ELSE
      v_next_status := 'selecting'; 
  END IF;

  -- 4. Update Queue Status
  UPDATE public.player_queue
  SET status = 'playing'
  WHERE id = v_next_player.id;

  -- 5. Update Screen State (CRITICAL FIXES HERE)
  UPDATE public.screen_state
  SET 
    status = v_next_status,
    player_id = v_next_player.player_id,
    player_name = v_next_player.player_name, 
    player_emoji = v_next_player.player_emoji,
    -- CRITICAL: Update Wheel ID so screen changes design
    current_wheel_id = v_next_player.selected_wheel_id,
    -- CRITICAL: Update Queue ID so mobile client syncs correctly
    current_queue_id = v_next_player.id,
    updated_at = now()
  WHERE screen_number = p_screen_number;

  RETURN TRUE;
END;
$$;
