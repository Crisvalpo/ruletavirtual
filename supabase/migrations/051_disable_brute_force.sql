-- Migration 051: Disable Brute Force Protection
-- Removes rate limiting for testing purposes while maintaining code validation

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
  -- ========================================
  -- 🔓 BRUTE FORCE PROTECTION DISABLED
  -- All rate limiting checks removed for testing
  -- ========================================
  
  -- ========================================
  -- 1. PACKAGE LOOKUP & VALIDATION
  -- ========================================
  
  -- Buscar paquete existente en package_tracking
  SELECT * INTO v_package FROM package_tracking WHERE package_code = p_code;
  
  IF v_package IS NULL THEN
    -- Código nuevo - validar con sistema de game_packages
    SELECT * INTO v_combo FROM game_packages 
    WHERE code = p_code 
      AND is_active = true
      AND (is_activated = true OR is_activated IS NULL);
    
    IF v_combo IS NULL THEN
      -- Código inválido - sin rate limiting
      RETURN jsonb_build_object(
        'success', false, 
        'message', 'Código inválido o ya usado'
      );
    END IF;
    
    -- Verificar que tenga jugadas disponibles
    IF v_combo.plays_remaining <= 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'Este código ya no tiene giros disponibles'
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
      v_combo.total_plays,
      0,
      p_device_fingerprint,
      now()
    ) RETURNING id INTO v_package_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'package_id', v_package_id,
      'spin_number', 1,
      'total_spins', v_combo.total_plays,
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

COMMENT ON FUNCTION redeem_or_continue_package IS 'Redeems a new package or continues an existing one for the same device (BRUTE FORCE PROTECTION DISABLED)';
