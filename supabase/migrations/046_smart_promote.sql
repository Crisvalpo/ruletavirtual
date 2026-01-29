-- Migration 046: Smart Promote Logic (Fast Lane) - Fixed
-- Modifies promote_next_player to check if selections already exist.

-- Drop first to allow signature changes cleanly
DROP FUNCTION IF EXISTS promote_next_player(integer);

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
      -- Legacy flow: user must select on screen (or mobile while on screen)
      v_next_status := 'selecting'; 
  END IF;

  -- 4. Update Queue Status
  UPDATE public.player_queue
  SET status = 'playing' -- They are now the active player
  WHERE id = v_next_player.id;

  -- 5. Update Screen State
  UPDATE public.screen_state
  SET 
    status = v_next_status, -- 'waiting_for_spin' or 'selecting'
    player_id = v_next_player.player_id,
    player_name = v_next_player.player_name, 
    player_emoji = v_next_player.player_emoji
  WHERE screen_number = p_screen_number;

  RETURN TRUE;
END;
$$;
