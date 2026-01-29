-- Migration 047: Restore Wheel Selection Logic
-- Adds selected_wheel_id to player_queue and updates promotion logic to sync it to screen_state.

-- 1. Add selected_wheel_id to player_queue if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_queue' AND column_name = 'selected_wheel_id') THEN
        ALTER TABLE public.player_queue
        ADD COLUMN selected_wheel_id UUID REFERENCES public.individual_wheels(id);
    END IF;
END $$;

-- Drop functions first to ensure clean recreation
DROP FUNCTION IF EXISTS promote_next_player(integer);
DROP FUNCTION IF EXISTS force_advance_queue(integer);

-- 2. Update promote_next_player to sync wheel selection
CREATE OR REPLACE FUNCTION promote_next_player(p_screen_number INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_player RECORD;
  v_next_status TEXT;
  v_default_wheel UUID;
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
  IF v_next_player.selected_animals IS NOT NULL AND jsonb_array_length(v_next_player.selected_animals) > 0 THEN
      v_next_status := 'waiting_for_spin';
  ELSE
      v_next_status := 'selecting'; 
  END IF;

  -- 4. Update Queue Status
  UPDATE public.player_queue
  SET status = 'playing'
  WHERE id = v_next_player.id;

  -- 5. Update Screen State (INCLUDING WHEEL SELECTION)
  -- If player has specific wheel, use it. Otherwise keep current or default.
  
  UPDATE public.screen_state
  SET 
    status = v_next_status,
    player_id = v_next_player.player_id,
    player_name = v_next_player.player_name, 
    player_emoji = v_next_player.player_emoji,
    current_wheel_id = COALESCE(v_next_player.selected_wheel_id, current_wheel_id)
  WHERE screen_number = p_screen_number;

  RETURN TRUE;
END;
$$;

-- 3. Update force_advance_queue as well (for manual overrides)
CREATE OR REPLACE FUNCTION force_advance_queue(p_screen_number INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_next_player RECORD;
BEGIN
    -- 1. Close current active player if any
    UPDATE public.player_queue
    SET status = 'completed'
    WHERE screen_number = p_screen_number 
    AND status IN ('playing', 'selecting');

    -- 2. Reset Screen State
    UPDATE public.screen_state
    SET status = 'idle',
        player_id = NULL,
        player_name = NULL,
        player_emoji = NULL,
        last_spin_result = NULL
    WHERE screen_number = p_screen_number;

    -- 3. Promote Next
    -- We can just call promote_next_player now as it handles the logic
    PERFORM promote_next_player(p_screen_number);
END;
$$;
