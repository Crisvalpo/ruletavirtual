-- NEW RPC: force_advance_queue
-- This function is the "Nuclear Option" to fix a stuck screen.
-- It cleans up EVERYTHING and attempts to promote the next player immediately.

CREATE OR REPLACE FUNCTION force_advance_queue(p_screen_number INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_promoted BOOLEAN;
  v_next_player RECORD;
BEGIN
  -- 1. FORCE CLEANUP: Mark any active session as completed
  UPDATE public.player_queue
  SET status = 'completed'
  WHERE screen_number = p_screen_number
    AND status IN ('playing', 'selecting', 'ready', 'spinning'); -- Include all active states

  -- 2. FORCE IDLE: Reset screen state
  UPDATE public.screen_state
  SET 
    status = 'idle',
    player_name = NULL,
    player_emoji = NULL,
    is_demo = false
  WHERE screen_number = p_screen_number;

  -- 3. IMMEDIATELY PROMOTE
  -- We call the existing logic (or inline it for safety)
  -- Let's inline a simple promotion to be safe against dependency issues
  
  -- Find next
  SELECT * INTO v_next_player
  FROM public.player_queue
  WHERE screen_number = p_screen_number
    AND status = 'waiting'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_next_player IS NOT NULL THEN
    -- Update Queue
    UPDATE public.player_queue
    SET status = 'playing' -- Skip 'ready', go straight to playing for auto-start
    WHERE id = v_next_player.id;

    -- Update Screen
    UPDATE public.screen_state
    SET 
      status = 'waiting_for_spin',
      player_id = v_next_player.player_id,
      player_name = v_next_player.player_name,
      player_emoji = v_next_player.player_emoji
    WHERE screen_number = p_screen_number;
    
    RETURN jsonb_build_object('success', true, 'message', 'Promoted: ' || v_next_player.player_name);
  ELSE
    RETURN jsonb_build_object('success', true, 'message', 'Screen Cleared. Queue Empty.');
  END IF;

END;
$$;
