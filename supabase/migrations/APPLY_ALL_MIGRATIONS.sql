-- ============================================================================
-- CONSOLIDATED MIGRATION SCRIPT
-- Execute this entire script in Supabase SQL Editor
-- ============================================================================
-- This script combines migrations 030-033 for multi-spin packages and 
-- intelligent screen switching features.
-- ============================================================================

-- ============================================================================
-- MIGRATION 030: Package Tracking
-- ============================================================================

-- Create package_tracking table
CREATE TABLE IF NOT EXISTS public.package_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_code TEXT NOT NULL UNIQUE,
  total_spins INTEGER NOT NULL CHECK (total_spins > 0),
  spins_consumed INTEGER DEFAULT 0 CHECK (spins_consumed >= 0 AND spins_consumed <= total_spins),
  device_fingerprint TEXT, -- Hash of device that redeemed the code
  first_redeemed_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add columns to player_queue for package tracking
ALTER TABLE public.player_queue 
ADD COLUMN IF NOT EXISTS package_tracking_id UUID REFERENCES public.package_tracking(id),
ADD COLUMN IF NOT EXISTS spin_number INTEGER; -- "Giro 3 de 6"

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_package_tracking_code ON public.package_tracking(package_code);
CREATE INDEX IF NOT EXISTS idx_package_tracking_device ON public.package_tracking(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_player_queue_package ON public.player_queue(package_tracking_id);

-- RLS Policies
ALTER TABLE public.package_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read packages" ON public.package_tracking;
CREATE POLICY "Public read packages" 
  ON public.package_tracking FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Public insert packages" ON public.package_tracking;
CREATE POLICY "Public insert packages" 
  ON public.package_tracking FOR INSERT 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public update packages" ON public.package_tracking;
CREATE POLICY "Public update packages" 
  ON public.package_tracking FOR UPDATE 
  USING (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_package_tracking_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_package_tracking_timestamp ON public.package_tracking;
CREATE TRIGGER set_package_tracking_timestamp
  BEFORE UPDATE ON public.package_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_package_tracking_timestamp();

COMMENT ON TABLE public.package_tracking IS 'Tracks multi-spin packages and their consumption per device';

-- ============================================================================
-- MIGRATION 031: Screen Switch Offers
-- ============================================================================

-- Create screen_switch_offers table
CREATE TABLE IF NOT EXISTS public.screen_switch_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_screen_number INTEGER NOT NULL CHECK (target_screen_number BETWEEN 1 AND 4),
  offered_to_queue_id UUID REFERENCES public.player_queue(id) ON DELETE CASCADE,
  offer_expires_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_active_offers 
  ON public.screen_switch_offers(target_screen_number, status) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_offers_by_queue 
  ON public.screen_switch_offers(offered_to_queue_id);

CREATE INDEX IF NOT EXISTS idx_offers_by_expiry 
  ON public.screen_switch_offers(offer_expires_at) 
  WHERE status = 'pending';

-- RLS Policies
ALTER TABLE public.screen_switch_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all offers" ON public.screen_switch_offers;
CREATE POLICY "Users can view all offers" 
  ON public.screen_switch_offers FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Users can update their own offers" ON public.screen_switch_offers;
CREATE POLICY "Users can update their own offers" 
  ON public.screen_switch_offers FOR UPDATE 
  USING (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_screen_switch_offers_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_screen_switch_offers_timestamp ON public.screen_switch_offers;
CREATE TRIGGER set_screen_switch_offers_timestamp
  BEFORE UPDATE ON public.screen_switch_offers
  FOR EACH ROW
  EXECUTE FUNCTION update_screen_switch_offers_timestamp();

COMMENT ON TABLE public.screen_switch_offers IS 'Tracks sequential screen switch offers to waiting players';

-- ============================================================================
-- MIGRATION 032: Package Tracking RPCs
-- ============================================================================

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

-- ============================================================================
-- MIGRATION 033: Screen Switch RPCs
-- ============================================================================

-- Function: Create screen switch offer
CREATE OR REPLACE FUNCTION create_screen_switch_offer(
  p_available_screen INTEGER
) RETURNS JSONB AS $$
DECLARE
  v_next_player RECORD;
  v_offer_id UUID;
BEGIN
  -- Verificar que la pantalla esté realmente idle
  IF NOT EXISTS (
    SELECT 1 FROM screen_state 
    WHERE screen_number = p_available_screen AND status = 'idle'
  ) THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'Pantalla no disponible'
    );
  END IF;
  
  -- Verificar que no haya oferta pendiente para esta pantalla
  IF EXISTS (
    SELECT 1 FROM screen_switch_offers 
    WHERE target_screen_number = p_available_screen 
      AND status = 'pending'
      AND offer_expires_at > now()
  ) THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'Ya existe oferta pendiente'
    );
  END IF;
  
  -- Buscar el siguiente jugador en espera (excluyendo la pantalla disponible)
  SELECT * INTO v_next_player
  FROM player_queue
  WHERE status = 'waiting'
    AND screen_number != p_available_screen
  ORDER BY queue_order ASC
  LIMIT 1;
  
  IF v_next_player IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'No hay jugadores esperando'
    );
  END IF;
  
  -- Crear oferta con timeout de 10 segundos
  INSERT INTO screen_switch_offers (
    target_screen_number,
    offered_to_queue_id,
    offer_expires_at
  ) VALUES (
    p_available_screen,
    v_next_player.id,
    now() + interval '10 seconds'
  ) RETURNING id INTO v_offer_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'offer_id', v_offer_id,
    'queue_id', v_next_player.id,
    'expires_at', now() + interval '10 seconds'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Process expired offers
CREATE OR REPLACE FUNCTION process_expired_offers()
RETURNS void AS $$
DECLARE
  v_expired_offer RECORD;
BEGIN
  -- Marcar ofertas expiradas
  UPDATE screen_switch_offers
  SET status = 'expired'
  WHERE status = 'pending' 
    AND offer_expires_at <= now();
  
  -- Para cada pantalla con oferta expirada reciente, crear nueva oferta
  FOR v_expired_offer IN 
    SELECT DISTINCT target_screen_number 
    FROM screen_switch_offers 
    WHERE status = 'expired' 
      AND created_at > now() - interval '1 minute'
  LOOP
    -- Verificar si la pantalla sigue idle
    IF EXISTS (
      SELECT 1 FROM screen_state 
      WHERE screen_number = v_expired_offer.target_screen_number 
        AND status = 'idle'
    ) THEN
      -- Crear nueva oferta para siguiente jugador
      PERFORM create_screen_switch_offer(v_expired_offer.target_screen_number);
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Switch player screen
CREATE OR REPLACE FUNCTION switch_player_screen(
  p_queue_id UUID,
  p_new_screen_number INTEGER
) RETURNS BOOLEAN AS $$
BEGIN
  -- Verificar que la nueva pantalla esté idle
  IF NOT EXISTS (
    SELECT 1 FROM screen_state 
    WHERE screen_number = p_new_screen_number AND status = 'idle'
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- Actualizar queue entry
  UPDATE player_queue 
  SET screen_number = p_new_screen_number
  WHERE id = p_queue_id AND status = 'waiting';
  
  -- Intentar promover inmediatamente
  PERFORM promote_next_player(p_new_screen_number);
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_screen_switch_offer IS 'Creates a screen switch offer for the next waiting player';
COMMENT ON FUNCTION process_expired_offers IS 'Processes expired offers and creates new ones for next players';
COMMENT ON FUNCTION switch_player_screen IS 'Switches a player to a different screen atomically';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- All migrations have been applied successfully!
-- You can now use the new multi-spin package tracking and screen switching features.
-- ============================================================================
