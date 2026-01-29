-- RPC Functions for Screen Switch Offers
-- Implements sequential offer system

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
