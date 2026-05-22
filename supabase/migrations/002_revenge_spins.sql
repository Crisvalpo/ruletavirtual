-- ==========================================
-- SOURCE: 059_revenge_spins.sql
-- ==========================================

-- 1. Agregar columna is_revenge a player_queue y game_history
ALTER TABLE public.player_queue ADD COLUMN IF NOT EXISTS is_revenge BOOLEAN DEFAULT false;
ALTER TABLE public.game_history ADD COLUMN IF NOT EXISTS is_revenge BOOLEAN DEFAULT false;

-- 2. Modificar la función play_spin
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

  -- 2. VERIFY PACKAGE BALANCE (Only if it's NOT a revenge spin)
  IF v_player.package_tracking_id IS NOT NULL AND NOT COALESCE(v_player.is_revenge, false) THEN
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
        SELECT position INTO v_result
        FROM individual_wheel_segments
        WHERE wheel_id = v_wheel_id
        ORDER BY position ASC
        LIMIT 1 OFFSET v_rnd_index;
     ELSE
        -- Fallback if wheel has no segments
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

  -- C. Deduct Credit (Only if NOT a revenge spin)
  IF v_player.package_tracking_id IS NOT NULL AND NOT COALESCE(v_player.is_revenge, false) THEN
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
    -- If it's a revenge spin or no package, spins_consumed does not change
    IF v_player.package_tracking_id IS NOT NULL THEN
      v_spins_remaining := v_player.total_spins - v_player.spins_consumed;
    ELSE
      v_spins_remaining := 0;
    END IF;
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

COMMENT ON FUNCTION play_spin IS 'Updated Server Authority with Revenge Spin support: Dynamically generates result and updates state without deducting credit if it is a revenge spin.';

-- 3. Modificar la función complete_spin_and_check_package
CREATE OR REPLACE FUNCTION complete_spin_and_check_package(
  p_screen_number INTEGER,
  p_result_index INTEGER
) RETURNS JSONB AS $$
DECLARE
  v_current_player RECORD;
  v_spins_remaining INTEGER;
  v_is_winner BOOLEAN := false;
BEGIN
  -- 1. Obtener jugador actual (Status = playing)
  SELECT 
    pq.id, 
    pq.package_tracking_id, 
    pq.selected_animals,
    pq.is_revenge,
    pt.total_spins, 
    pt.spins_consumed
  INTO v_current_player
  FROM player_queue pq
  LEFT JOIN package_tracking pt ON pq.package_tracking_id = pt.id
  WHERE pq.screen_number = p_screen_number 
    AND pq.status = 'playing'
  ORDER BY pq.queue_order ASC
  LIMIT 1;
  
  -- 2. Validar existencia
  IF v_current_player IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'No se encontró un jugador activo con estado "playing" en la pantalla ' || p_screen_number::text
    );
  END IF;
  
  -- Evaluar si es ganador
  IF v_current_player.selected_animals IS NOT NULL AND jsonb_typeof(v_current_player.selected_animals) = 'array' THEN
    v_is_winner := v_current_player.selected_animals @> jsonb_build_array(p_result_index);
  END IF;
  
  -- 3. Marcar giro como completado, guardar resultado y calcular premio
  UPDATE player_queue 
  SET status = 'completed',
      spin_result = p_result_index,
      prize_won = CASE 
        WHEN v_is_winner THEN 
          CASE WHEN COALESCE(v_current_player.is_revenge, false) THEN 'PREMIO NIVEL 2' ELSE 'PREMIO NIVEL 1' END
        ELSE NULL 
      END,
      prize_payout_status = CASE WHEN v_is_winner THEN 'pending' ELSE 'not_applicable' END,
      updated_at = now()
  WHERE id = v_current_player.id;
  
  -- 4. Actualizar estado de la pantalla
  UPDATE screen_state
  SET status = 'showing_result',
      last_spin_result = p_result_index,
      updated_at = now()
  WHERE screen_number = p_screen_number;
  
  -- 5. Retornar info de giros restantes (si aplica)
  IF v_current_player.package_tracking_id IS NOT NULL THEN
    v_spins_remaining := v_current_player.total_spins - v_current_player.spins_consumed;
    
    RETURN jsonb_build_object(
      'success', true,
      'spins_remaining', v_spins_remaining,
      'package_id', v_current_player.package_tracking_id,
      'has_more_spins', v_spins_remaining > 0
    );
  END IF;
  
  -- Sin paquete
  RETURN jsonb_build_object(
    'success', true,
    'spins_remaining', 0,
    'has_more_spins', false
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'message', SQLERRM,
    'detail', SQLSTATE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION complete_spin_and_check_package IS 'Marks spin as complete, transitions screen state, and awards PREMIO NIVEL 2 if is_revenge is true.';
