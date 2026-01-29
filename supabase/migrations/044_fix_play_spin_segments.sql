-- Migration 044: Fix play_spin to use Dynamic Segments
-- Addresses "erroneous results" by respecting the actual segment count of the active wheel

CREATE OR REPLACE FUNCTION play_spin(
  p_queue_id UUID,
  p_screen_number INTEGER
) RETURNS JSONB AS $$
DECLARE
  v_player RECORD;
  v_result INTEGER;
  v_spins_remaining INTEGER;
  v_wheel_id UUID;
  v_segment_count INTEGER;
  v_rnd_index INTEGER;
BEGIN
  -- 1. VERIFY IDENTITY & STATE
  SELECT pq.*, pt.total_spins, pt.spins_consumed, pt.package_code
  INTO v_player
  FROM player_queue pq
  LEFT JOIN package_tracking pt ON pq.package_tracking_id = pt.id
  WHERE pq.id = p_queue_id 
    AND pq.screen_number = p_screen_number
    AND pq.status IN ('selecting', 'playing', 'ready');

  IF v_player IS NULL THEN
     RETURN jsonb_build_object('success', false, 'message', 'Jugador no autorizado o estado inválido');
  END IF;

  -- 2. VERIFY PACKAGE BALANCE
  IF v_player.package_tracking_id IS NOT NULL THEN
     IF (v_player.spins_consumed >= v_player.total_spins) THEN
        RETURN jsonb_build_object('success', false, 'message', 'No quedan giros disponibles');
     END IF;
  END IF;

  -- 3. DETERMINE RESULT (Dynamic Server Authority)
  
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
        -- (This handles non-contiguous positions safely)
        SELECT position INTO v_result
        FROM individual_wheel_segments
        WHERE wheel_id = v_wheel_id
        ORDER BY position ASC
        LIMIT 1 OFFSET v_rnd_index;
     ELSE
        -- Fallback if wheel has no segments (should not happen)
        v_result := floor(random() * 12) + 1;
     END IF;
  ELSE
     -- Default / Group Mode: Standard 36 Animals
     v_result := floor(random() * 36) + 1;
  END IF;

  -- 4. ATOMIC UPDATE
  
  -- A. Update Player Queue
  UPDATE player_queue
  SET 
    spin_result = v_result,
    status = 'playing'
  WHERE id = p_queue_id;

  -- B. Update Screen State
  UPDATE screen_state
  SET 
    status = 'spinning',
    last_spin_result = v_result,
    updated_at = now()
  WHERE screen_number = p_screen_number;

  -- C. Deduct Credit
  IF v_player.package_tracking_id IS NOT NULL THEN
    UPDATE package_tracking 
    SET spins_consumed = spins_consumed + 1, last_used_at = now()
    WHERE id = v_player.package_tracking_id;
    
    IF v_player.package_code IS NOT NULL THEN
        UPDATE game_packages
        SET plays_used = COALESCE(plays_used, 0) + 1
        WHERE code = v_player.package_code;
    END IF;
    
    v_spins_remaining := v_player.total_spins - (v_player.spins_consumed + 1);
  ELSE
    v_spins_remaining := 0;
  END IF;

  -- 5. RETURN RESULT
  RETURN jsonb_build_object(
    'success', true,
    'result_index', v_result,
    'spins_remaining', v_spins_remaining
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION play_spin IS 'Updated Server Authority: Dynamically generates result based on active wheel segments (or 36 for default).';
