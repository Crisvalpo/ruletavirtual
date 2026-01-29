-- MIGRATION 040: RESCUE PLAN - IRON CORE RPCs
-- Implements "Server Authority" architecture where the DB decides the result.

-- 1. RPC: play_spin
-- This is the single source of truth for spinning.
-- It generates the result, deducts the credit, and updates all states atomically.

DROP FUNCTION IF EXISTS play_spin(UUID, INTEGER);

CREATE OR REPLACE FUNCTION play_spin(
  p_queue_id UUID,
  p_screen_number INTEGER
) RETURNS JSONB AS $$
DECLARE
  v_player RECORD;
  v_result INTEGER;
  v_spins_remaining INTEGER;
BEGIN
  -- 1. VERIFY IDENTITY & STATE
  -- Check if this specific queue_id is currently allowed to play on this screen
  SELECT pq.*, pt.total_spins, pt.spins_consumed, pt.package_code
  INTO v_player
  FROM player_queue pq
  LEFT JOIN package_tracking pt ON pq.package_tracking_id = pt.id
  WHERE pq.id = p_queue_id 
    AND pq.screen_number = p_screen_number
    -- Allow 'selecting' or 'playing', or 'ready' depending on previous flow.
    -- Usually user selects -> becomes 'ready' or just 'playing'.
    -- Let's be flexible: status must NOT be 'completed' or 'waiting'.
    AND pq.status IN ('selecting', 'playing', 'ready');

  IF v_player IS NULL THEN
     RETURN jsonb_build_object('success', false, 'message', 'Jugador no autorizado o estado inválido');
  END IF;

  -- 2. VERIFY PACKAGE BALANCE (Double Check)
  IF v_player.package_tracking_id IS NOT NULL THEN
     IF (v_player.spins_consumed >= v_player.total_spins) THEN
        RETURN jsonb_build_object('success', false, 'message', 'No quedan giros disponibles');
     END IF;
  END IF;

  -- 3. DETERMINE RESULT (Server Authority)
  -- Random number 1-12 (Assuming 12 segments for now, or fetch from wheel if complex)
  -- For stability, we default to 12 segments standard.
  v_result := floor(random() * 12) + 1;

  -- 4. ATOMIC UPDATE (The "Commit")
  
  -- A. Update Player Queue
  -- Mark as 'completed' immediately? Or 'spinning'?
  -- If we mark 'completed', the client might leave too early?
  -- Better: Mark as 'spinning' with the result. Client sees 'spinning'.
  -- Completion happens when animation ends? 
  -- RESCUE PLAN SAYS: "Client is tonto".
  -- So we mark it as 'completed' logically here regarding COUNTS, but state=spinning?
  -- Let's keep state='playing' or 'spinning' so UI knows.
  -- The previous flow used 'completed' at the END.
  -- Let's use 'spinning' now, and allow a separate 'finalize' call or timeout?
  -- NO, let's simplify.
  -- We set result NOW. 
  
  UPDATE player_queue
  SET 
    spin_result = v_result,
    status = 'playing' -- Ensures they are considered "playing"
  WHERE id = p_queue_id;

  -- B. Update Screen State (Signal the TV)
  UPDATE screen_state
  SET 
    status = 'spinning',
    last_spin_result = v_result,
    updated_at = now()
  WHERE screen_number = p_screen_number;

  -- C. Deduct Credit (Instant)
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

  -- 5. RETURN RESULT TO CLIENT
  RETURN jsonb_build_object(
    'success', true,
    'result_index', v_result,
    'spins_remaining', v_spins_remaining
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION play_spin IS 'Server Authority: Calculates result, updates state, and deducts credit in one transaction.';
