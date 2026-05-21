-- Migration 053: Robust complete_spin_and_check_package
-- Fixes empty error {} by adding EXCEPTION handling and explicit column selection

CREATE OR REPLACE FUNCTION complete_spin_and_check_package(
  p_screen_number INTEGER,
  p_result_index INTEGER
) RETURNS JSONB AS $$
DECLARE
  v_current_player RECORD;
  v_spins_remaining INTEGER;
BEGIN
  -- 1. Obtener jugador actual (Status = playing)
  -- Usamos columnas explícitas para evitar cualquier ambigüedad de RECORD
  SELECT 
    pq.id, 
    pq.package_tracking_id, 
    pq.selected_animals,
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
  
  -- 3. Marcar giro como completado y GUARDAR EL RESULTADO en el player_queue
  UPDATE player_queue 
  SET status = 'completed',
      spin_result = p_result_index,
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
    -- El giro ya fue descontado en play_spin, aquí solo calculamos para la UI
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
  -- IMPORTANTE: Capturar el error real para que no regrese un objeto vacío {}
  RETURN jsonb_build_object(
    'success', false,
    'message', SQLERRM,
    'detail', SQLSTATE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
