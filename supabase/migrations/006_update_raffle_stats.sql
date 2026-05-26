-- =========================================================================
-- MIGRATION: 006_update_raffle_stats.sql
-- Description: 
-- 1. Create secure update_raffle_status RPC to bypass table RLS restrictions.
-- 2. Modify buy_raffle_tickets RPC to automatically update stats in public.raffles.
-- 3. Run initial query to sync current stats for existing raffles.
-- =========================================================================

-- 1. Crear función RPC segura para actualizar el estado del sorteo
CREATE OR REPLACE FUNCTION public.update_raffle_status(
  p_raffle_id UUID,
  p_status TEXT
) RETURNS JSONB AS $$
BEGIN
  -- Validar que el rol del usuario autenticado sea staff o admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('staff', 'admin')
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'No autorizado. Se requiere rol de Staff o Administrador.');
  END IF;

  UPDATE public.raffles
  SET status = p_status
  WHERE id = p_raffle_id;

  RETURN jsonb_build_object('success', true, 'message', 'Estado del sorteo actualizado a ' || p_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Modificar RPC buy_raffle_tickets para actualizar estadísticas de raffles
CREATE OR REPLACE FUNCTION public.buy_raffle_tickets(
  p_raffle_id UUID,
  p_ticket_numbers INTEGER[],
  p_player_id UUID,
  p_package_code TEXT
) RETURNS JSONB AS $$
DECLARE
  v_package RECORD;
  v_number INTEGER;
  v_ticket_count INTEGER;
  v_player_name TEXT;
  v_player_email TEXT;
BEGIN
  -- 1. Obtener y validar el paquete de tickets del jugador
  SELECT * INTO v_package 
  FROM public.raffle_packages 
  WHERE code = p_package_code 
    AND player_id = p_player_id
    AND status = 'active'
  FOR UPDATE; -- Bloqueo preventivo de concurrencia en la fila del paquete
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ticket de sorteo no encontrado o no está activo.');
  END IF;

  IF v_package.status = 'expired' OR v_package.valid_until < now() THEN
    UPDATE public.raffle_packages SET status = 'expired' WHERE id = v_package.id;
    RETURN jsonb_build_object('success', false, 'message', 'Este ticket ha expirado.');
  END IF;

  v_ticket_count := array_length(p_ticket_numbers, 1);
  IF v_ticket_count IS NULL OR v_ticket_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'No has seleccionado ningún boleto.');
  END IF;

  IF v_package.remaining_options < v_ticket_count THEN
    RETURN jsonb_build_object('success', false, 'message', 'No tienes suficientes créditos en tu ticket. Saldo disponible: ' || v_package.remaining_options);
  END IF;

  -- Obtener nombre y correo del jugador para poblar en raffle_tickets
  SELECT display_name, email INTO v_player_name, v_player_email 
  FROM public.profiles WHERE id = p_player_id;

  -- 2. Validar que ninguno de los números solicitados esté ocupado
  FOREACH v_number IN ARRAY p_ticket_numbers LOOP
    IF EXISTS (
      SELECT 1 FROM public.raffle_tickets 
      WHERE raffle_id = p_raffle_id 
        AND ticket_number = v_number 
        AND status != 'cancelled'
    ) THEN
      RETURN jsonb_build_object(
        'success', false, 
        'message', '¡Para la próxima sé más rápido, ya escogieron el animal #' || v_number || '!'
      );
    END IF;
  END LOOP;

  -- 3. Insertar boletos en estado 'confirmed'
  FOREACH v_number IN ARRAY p_ticket_numbers LOOP
    BEGIN
      INSERT INTO public.raffle_tickets (
        raffle_id, 
        ticket_number, 
        player_id, 
        status, 
        amount_paid, 
        payment_method,
        buyer_name,
        buyer_email
      ) VALUES (
        p_raffle_id, 
        v_number, 
        p_player_id, 
        'confirmed', 
        v_package.price_paid / v_package.total_options,
        'kiosk',
        coalesce(v_player_name, 'Jugador'),
        v_player_email
      );
    EXCEPTION WHEN unique_violation THEN
      -- Capturar colisión concurrente
      RETURN jsonb_build_object(
        'success', false, 
        'message', '¡Para la próxima sé más rápido, ya escogieron el animal #' || v_number || '!'
      );
    END;
  END LOOP;

  -- 4. Descontar las opciones del paquete
  UPDATE public.raffle_packages 
  SET remaining_options = remaining_options - v_ticket_count,
      player_id = coalesce(player_id, p_player_id),
      status = CASE WHEN remaining_options - v_ticket_count = 0 THEN 'exhausted' ELSE 'active' END
  WHERE id = v_package.id;

  -- 5. Actualizar estadísticas del sorteo en la tabla public.raffles
  UPDATE public.raffles 
  SET tickets_sold = tickets_sold + v_ticket_count,
      total_collected = total_collected + (v_package.price_paid / v_package.total_options) * v_ticket_count
  WHERE id = p_raffle_id;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Compra de ' || v_ticket_count || ' boleto(s) confirmada con éxito.',
    'remaining_options', v_package.remaining_options - v_ticket_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Sincronizar las estadísticas iniciales para los sorteos existentes en base a los boletos reales
UPDATE public.raffles r
SET tickets_sold = COALESCE((
      SELECT count(*)::INTEGER 
      FROM public.raffle_tickets t 
      WHERE t.raffle_id = r.id AND t.status = 'confirmed'
    ), 0),
    total_collected = COALESCE((
      SELECT sum(t.amount_paid)::DECIMAL(10,2) 
      FROM public.raffle_tickets t 
      WHERE t.raffle_id = r.id AND t.status = 'confirmed'
    ), 0);
