CREATE OR REPLACE FUNCTION public.force_advance_queue(p_screen_number integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_next_id UUID;
  v_next_name TEXT;
  v_next_emoji TEXT;
  v_next_player_id UUID;
BEGIN
  -- 1. FORCE CLEANUP: Mark any active session as completed
  UPDATE public.player_queue
  SET status = 'completed'
  WHERE screen_number = p_screen_number
    AND status IN ('playing', 'selecting', 'ready', 'spinning');

  -- 2. FORCE IDLE: Reset screen state
  UPDATE public.screen_state
  SET 
    status = 'idle',
    player_name = NULL,
    player_emoji = NULL,
    player_id = NULL,
    is_demo = false
  WHERE screen_number = p_screen_number;

  -- 3. FIND NEXT
  SELECT id, player_name, player_emoji, player_id
  INTO v_next_id, v_next_name, v_next_emoji, v_next_player_id
  FROM public.player_queue
  WHERE screen_number = p_screen_number
    AND status = 'waiting'
  ORDER BY created_at ASC
  LIMIT 1;

  -- 4. PROMOTE IF FOUND
  IF v_next_id IS NOT NULL THEN
    -- Update Queue
    UPDATE public.player_queue
    SET status = 'playing'
    WHERE id = v_next_id;

    -- Update Screen
    UPDATE public.screen_state
    SET 
      status = 'waiting_for_spin',
      player_id = v_next_player_id,
      player_name = v_next_name,
      player_emoji = v_next_emoji
    WHERE screen_number = p_screen_number;
    
    RETURN jsonb_build_object('success', true, 'message', 'Promoted: ' || v_next_name);
  ELSE
    RETURN jsonb_build_object('success', true, 'message', 'Screen Cleared. Queue Empty.');
  END IF;

END;
$function$;
