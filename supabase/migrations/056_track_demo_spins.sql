-- Migration 056: Track and Limit Demo Spins by Email/Profile
-- Adds demo_spins_used to profiles and updates play_demo_spin to restrict usage.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS demo_spins_used INTEGER NOT NULL DEFAULT 0;

-- Drop all existing overloaded versions of play_demo_spin to avoid signature conflicts
DROP FUNCTION IF EXISTS play_demo_spin(integer);
DROP FUNCTION IF EXISTS play_demo_spin(integer, text, text);
DROP FUNCTION IF EXISTS play_demo_spin(integer, text, text, uuid);

CREATE OR REPLACE FUNCTION play_demo_spin(
  p_screen_number INTEGER
) RETURNS JSONB AS $$
DECLARE
  v_result INTEGER;
  v_wheel_id UUID;
  v_segment_count INTEGER;
  v_rnd_index INTEGER;
  v_user_id UUID;
  v_spins_used INTEGER;
BEGIN
  -- 1. Check if user is authenticated
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Debes iniciar sesión para usar el modo de práctica.');
  END IF;

  -- 2. Check if screen is IDLE and queue is empty
  -- (We don't want to overwrite a real player spin)
  IF EXISTS (
    SELECT 1 FROM player_queue 
    WHERE screen_number = p_screen_number 
    AND status IN ('waiting', 'playing', 'ready', 'spinning', 'selecting')
  ) OR EXISTS (
    SELECT 1 FROM screen_state
    WHERE screen_number = p_screen_number
    AND status != 'idle'
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'La pantalla está ocupada');
  END IF;

  -- 3. Check demo spin limits from user profile
  SELECT COALESCE(demo_spins_used, 0) INTO v_spins_used
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_spins_used IS NULL THEN
    v_spins_used := 0;
  END IF;

  IF v_spins_used >= 2 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Has agotado tus giros de práctica gratuitos (máximo 2)');
  END IF;

  -- 4. Determine Result (Logic mirrored from play_spin)
  
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

  -- 5. Increment user's demo spin count
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
    UPDATE public.profiles
    SET demo_spins_used = v_spins_used + 1,
        updated_at = now()
    WHERE id = v_user_id;
  ELSE
    INSERT INTO public.profiles (id, display_name, email, demo_spins_used)
    VALUES (
      v_user_id,
      COALESCE(auth.jwt() ->> 'name', 'Jugador'),
      COALESCE(auth.jwt() ->> 'email', 'unknown@ejemplo.com'),
      1
    );
  END IF;

  -- 6. Update Screen State
  UPDATE screen_state
  SET 
    status = 'spinning',
    is_demo = true,
    player_name = 'Modo Práctica',
    player_emoji = '🎓',
    last_spin_result = v_result,
    updated_at = now()
  WHERE screen_number = p_screen_number;

  -- 7. Return Result
  RETURN jsonb_build_object(
    'success', true,
    'result_index', v_result
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION play_demo_spin IS 'Triggers a free demo spin for practice mode for authenticated users, checking limits and screen availability.';
