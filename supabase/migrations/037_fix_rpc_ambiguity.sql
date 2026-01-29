-- Fix: Remove ambiguity in RPC column selection
-- Explicitly select columns to avoid "ambiguous column reference" errors

DROP FUNCTION IF EXISTS complete_spin_and_check_package(INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION complete_spin_and_check_package(
  p_screen_number INTEGER,
  p_result_index INTEGER
) RETURNS JSONB AS $$
DECLARE
  v_current_player RECORD;
  v_spins_remaining INTEGER;
BEGIN
  -- Obtener jugador actual con columnas EXPLICITAS
  SELECT 
    pq.id, 
    pq.package_tracking_id,
    pt.total_spins, 
    pt.spins_consumed, 
    pt.package_code
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
      'message', 'No hay jugador activo status=playing en esta pantalla'
    );
  END IF;
  
  -- Marcar giro como completado Y GUARDAR RESULTADO
  UPDATE player_queue 
  SET status = 'completed',
      spin_result = p_result_index
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
    -- Verificar primero si tenemos package_code (debería, si hay package_tracking)
    IF v_current_player.package_code IS NOT NULL THEN
        UPDATE game_packages
        SET plays_used = COALESCE(plays_used, 0) + 1
        WHERE code = v_current_player.package_code;
    END IF;
    
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
EXCEPTION WHEN OTHERS THEN
    -- Capturar y retornar cualquier error SQL
    RETURN jsonb_build_object(
      'success', false,
      'message', SQLERRM,
      'code', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION complete_spin_and_check_package IS 'Marks spin as complete. Fixed ambiguity and added error handling.';
