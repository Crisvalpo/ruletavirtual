-- Migration 049: Fix Double Deduction Bug in complete_spin_and_check_package
-- The function was deducting spins twice: once in play_spin and again here.
-- This migration removes the duplicate deduction.

CREATE OR REPLACE FUNCTION complete_spin_and_check_package(
  p_screen_number INTEGER,
  p_result_index INTEGER
) RETURNS JSONB AS $$
DECLARE
  v_current_player RECORD;
  v_package RECORD;
  v_spins_remaining INTEGER;
BEGIN
  -- Obtener jugador actual
  SELECT pq.*, pt.total_spins, pt.spins_consumed
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
  
  -- REMOVED: Double deduction bug fix
  -- The spin was already deducted in play_spin RPC
  -- We only need to calculate remaining spins for display
  
  IF v_current_player.package_tracking_id IS NOT NULL THEN
    -- Calcular giros restantes (ya fueron consumidos en play_spin)
    v_spins_remaining := v_current_player.total_spins - v_current_player.spins_consumed;
    
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

COMMENT ON FUNCTION complete_spin_and_check_package IS 'Marks spin as complete and transitions screen state. Spin deduction happens in play_spin only.';
