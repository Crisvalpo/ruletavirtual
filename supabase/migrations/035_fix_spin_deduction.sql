-- Fix: Sync game_packages.plays_used when completing spins
-- This ensures that both package_tracking and game_packages stay in sync

DROP FUNCTION IF EXISTS complete_spin_and_check_package(INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION complete_spin_and_check_package(
  p_screen_number INTEGER,
  p_result_index INTEGER
) RETURNS JSONB AS $$
DECLARE
  v_current_player RECORD;
  v_package RECORD;
  v_spins_remaining INTEGER;
  v_package_code TEXT;
BEGIN
  -- Obtener jugador actual
  SELECT pq.*, pt.total_spins, pt.spins_consumed, pt.package_code
  INTO v_current_player
  FROM player_queue pq
  LEFT JOIN package_tracking pt ON pq.package_tracking_id = pt.id
  WHERE pq.screen_number = p_screen_number 
    AND pq.status = 'playing'
  ORDER BY pq.queue_order ASC
  LIMIT 1;
  
  IF v_current_player IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'No hay jugador activo'
    );
  END IF;
  
  -- Marcar giro como completado
  UPDATE player_queue 
  SET status = 'completed' 
  WHERE id = v_current_player.id;
  
  -- Actualizar screen_state a showing_result
  UPDATE screen_state
  SET status = 'showing_result',
      last_spin_result = p_result_index,
      updated_at = now()
  WHERE screen_number = p_screen_number;
  
  -- Si tiene paquete, incrementar contador en AMBAS tablas
  IF v_current_player.package_tracking_id IS NOT NULL THEN
    -- 1. Actualizar package_tracking
    UPDATE package_tracking 
    SET spins_consumed = spins_consumed + 1,
        last_used_at = now()
    WHERE id = v_current_player.package_tracking_id;
    
    -- 2. Actualizar game_packages (tabla original)
    UPDATE game_packages
    SET plays_used = plays_used + 1
    WHERE code = v_current_player.package_code;
    
    -- Calcular giros restantes
    v_spins_remaining := v_current_player.total_spins - (v_current_player.spins_consumed + 1);
    
    RETURN jsonb_build_object(
      'success', true,
      'spins_remaining', v_spins_remaining,
      'package_id', v_current_player.package_tracking_id,
      'has_more_spins', v_spins_remaining > 0
    );
  END IF;
  
  -- Sin paquete (pago individual)
  RETURN jsonb_build_object(
    'success', true,
    'spins_remaining', 0,
    'has_more_spins', false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION complete_spin_and_check_package IS 'Marks spin as complete and syncs both package_tracking and game_packages';
