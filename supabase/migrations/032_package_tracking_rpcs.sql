-- RPC Functions for Package Tracking
-- Implements multi-spin package redemption and continuation logic

-- Function: Redeem or continue package
CREATE OR REPLACE FUNCTION redeem_or_continue_package(
  p_code TEXT,
  p_device_fingerprint TEXT,
  p_screen_number INTEGER,
  p_player_name TEXT,
  p_player_emoji TEXT,
  p_player_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_package RECORD;
  v_next_spin INTEGER;
  v_package_id UUID;
  v_combo RECORD;
BEGIN
  -- Buscar paquete existente
  SELECT * INTO v_package FROM package_tracking WHERE package_code = p_code;
  
  IF v_package IS NULL THEN
    -- Código nuevo - validar con sistema de combos
    SELECT * INTO v_combo FROM ticket_packages WHERE code = p_code AND is_active = true;
    
    IF v_combo IS NULL THEN
      RETURN jsonb_build_object(
        'success', false, 
        'message', 'Código inválido o ya usado'
      );
    END IF;
    
    -- Crear nuevo package_tracking
    INSERT INTO package_tracking (
      package_code,
      total_spins,
      spins_consumed,
      device_fingerprint,
      first_redeemed_at
    ) VALUES (
      p_code,
      v_combo.spins,
      0,
      p_device_fingerprint,
      now()
    ) RETURNING id INTO v_package_id;
    
    -- Marcar combo como usado
    UPDATE ticket_packages SET is_active = false WHERE id = v_combo.id;
    
    RETURN jsonb_build_object(
      'success', true,
      'package_id', v_package_id,
      'spin_number', 1,
      'total_spins', v_combo.spins,
      'is_new', true
    );
    
  ELSIF v_package.device_fingerprint != p_device_fingerprint THEN
    -- Código ya usado por otro dispositivo
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'Este código ya está siendo usado en otro dispositivo'
    );
    
  ELSIF v_package.spins_consumed >= v_package.total_spins THEN
    -- Sin giros restantes
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'Este código ya no tiene giros disponibles'
    );
    
  ELSE
    -- Continuar con siguiente giro
    v_next_spin := v_package.spins_consumed + 1;
    
    -- Actualizar last_used_at
    UPDATE package_tracking 
    SET last_used_at = now()
    WHERE id = v_package.id;
    
    RETURN jsonb_build_object(
      'success', true, 
      'package_id', v_package.id,
      'spin_number', v_next_spin,
      'total_spins', v_package.total_spins,
      'is_new', false
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Complete spin and check package
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
  
  -- Si tiene paquete, incrementar contador
  IF v_current_player.package_tracking_id IS NOT NULL THEN
    UPDATE package_tracking 
    SET spins_consumed = spins_consumed + 1,
        last_used_at = now()
    WHERE id = v_current_player.package_tracking_id;
    
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

COMMENT ON FUNCTION redeem_or_continue_package IS 'Redeems a new package or continues an existing one for the same device';
COMMENT ON FUNCTION complete_spin_and_check_package IS 'Marks spin as complete and checks if package has remaining spins';
