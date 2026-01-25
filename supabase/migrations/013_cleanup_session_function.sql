-- Function to clean up a screen session after game completion
CREATE OR REPLACE FUNCTION cleanup_screen_session(p_screen_number INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Mark current 'playing' queue item as completed
  UPDATE public.player_queue
  SET status = 'completed'
  WHERE screen_number = p_screen_number
    AND status = 'playing';

  -- 2. Reset the screen state to Idle
  UPDATE public.screen_state
  SET 
    status = 'idle',
    -- Clear identity
    player_id = NULL,
    player_name = NULL,
    player_emoji = NULL,
    -- Clear wheel selection (return to default or prompt)
    current_wheel_id = NULL
  WHERE screen_number = p_screen_number;
END;
$$;
