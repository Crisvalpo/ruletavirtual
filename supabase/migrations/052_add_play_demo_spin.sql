-- Migration 052: Add play_demo_spin RPC
-- Enables "Modo Práctica" by allowing free spins that don't affect the queue or packages.

CREATE OR REPLACE FUNCTION play_demo_spin(
  p_screen_number INTEGER
) RETURNS JSONB AS $$
DECLARE
  v_result INTEGER;
  v_wheel_id UUID;
  v_segment_count INTEGER;
  v_rnd_index INTEGER;
BEGIN
  -- 1. Check if screen is IDLE or already in a state that allows demo
  -- (We don't want to overwrite a real player spin)
  IF EXISTS (
    SELECT 1 FROM player_queue 
    WHERE screen_number = p_screen_number 
    AND status IN ('waiting', 'playing', 'ready', 'spinning', 'selecting')
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'La pantalla está ocupada');
  END IF;

  -- 2. Determine Result (Logic mirrored from play_spin)
  
  -- A. Detect Active Wheel
  SELECT current_wheel_id INTO v_wheel_id
  FROM screen_state
  WHERE screen_number = p_screen_number;

  -- B. Calculate Result based on Wheel Type
  IF v_wheel_id IS NOT NULL THEN
     -- Custom Wheel: Count segments
     SELECT count(*) INTO v_segment_count
     FROM individual_wheel_segments
     WHERE wheel_id = v_wheel_id;

     IF v_segment_count > 0 THEN
        -- Pick a random segment index (0 to N-1)
        v_rnd_index := floor(random() * v_segment_count)::INTEGER;
        
        -- Get the ACTUAL position ID at that index
        SELECT position INTO v_result
        FROM individual_wheel_segments
        WHERE wheel_id = v_wheel_id
        ORDER BY position ASC
        LIMIT 1 OFFSET v_rnd_index;
     ELSE
        -- Fallback
        v_result := floor(random() * 12) + 1;
     END IF;
  ELSE
     -- Default Mode: Standard 36 Animals
     v_result := floor(random() * 36) + 1;
  END IF;

  -- 3. Update Screen State
  UPDATE screen_state
  SET 
    status = 'spinning',
    is_demo = true,
    player_name = 'Modo Práctica',
    player_emoji = '🎓',
    last_spin_result = v_result,
    updated_at = now()
  WHERE screen_number = p_screen_number;

  -- 4. Return Result
  RETURN jsonb_build_object(
    'success', true,
    'result_index', v_result
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION play_demo_spin IS 'Triggers a free demo spin for practice mode without touching the queue.';
