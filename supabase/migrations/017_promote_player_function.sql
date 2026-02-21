-- Function to promote the next waiting player to the screen
CREATE OR REPLACE FUNCTION promote_next_player(p_screen_number INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_player RECORD;
BEGIN
  -- 1. Check if screen is actually free (idle)
  IF EXISTS (SELECT 1 FROM public.screen_state WHERE screen_number = p_screen_number AND status != 'idle') THEN
    RETURN FALSE; -- Screen is busy
  END IF;

  -- 2. Find oldest waiting player
  SELECT * INTO v_next_player
  FROM public.player_queue
  WHERE screen_number = p_screen_number
    AND status = 'waiting'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_next_player IS NULL THEN
    RETURN FALSE; -- No one waiting
  END IF;

  -- 3. Update Queue Status
  UPDATE public.player_queue
  SET status = 'playing'
  WHERE id = v_next_player.id;

  -- 4. Update Screen State (Show Player!)
  UPDATE public.screen_state
  SET 
    status = 'waiting_for_spin', -- Ready to spin
    player_id = v_next_player.player_id, -- Can be NULL for guests
    player_name = v_next_player.player_name, 
    player_emoji = v_next_player.player_emoji,
    current_queue_id = v_next_player.id -- VITAL: Links mobile client to screen
    -- We keep the current_wheel_id (Attract Mode theme) OR we could update it if the queue item had a specific wheel preference
    -- For now, let's assume the flow sets the wheel ID in the queue?
    -- The schema has `package_id` but maybe not `wheel_id`. 
    -- If we want to support switching wheels per player, we'd need that column.
    -- For now, we assume global wheel or pre-set.
  WHERE screen_number = p_screen_number;

  RETURN TRUE;
END;
$$;
