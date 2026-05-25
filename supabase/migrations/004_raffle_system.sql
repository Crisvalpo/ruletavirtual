-- =========================================================================
-- MIGRATION: 004_raffle_system.sql
-- Description: Creates the raffle_packages table, alters raffle_tickets to
-- support reservations/confirmations, enables RLS, and creates secured RPCs.
-- =========================================================================

-- 1. Crear tabla de paquetes/créditos de sorteo
CREATE TABLE IF NOT EXISTS public.raffle_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    total_options INTEGER NOT NULL CHECK (total_options > 0),
    remaining_options INTEGER NOT NULL CHECK (remaining_options >= 0),
    price_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
    player_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    valid_until TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'exhausted', 'expired'))
);

-- RLS para raffle_packages
ALTER TABLE public.raffle_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read own packages" ON public.raffle_packages
    FOR SELECT TO authenticated USING (auth.uid() = player_id);

CREATE POLICY "Staff and admin can manage all packages" ON public.raffle_packages
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role IN ('staff', 'admin')
        )
    );

-- 2. Modificar la tabla raffle_tickets para soportar estados y reservas
ALTER TABLE public.raffle_tickets ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmed' CHECK (status IN ('reserved', 'confirmed', 'cancelled'));
ALTER TABLE public.raffle_tickets ADD COLUMN IF NOT EXISTS reserved_until TIMESTAMPTZ;

-- Eliminar el índice único anterior si existe
ALTER TABLE public.raffle_tickets DROP CONSTRAINT IF EXISTS raffle_tickets_raffle_id_ticket_number_key;

-- Crear índice parcial de unicidad para boletos activos
CREATE UNIQUE INDEX IF NOT EXISTS idx_raffle_tickets_active_unique 
ON public.raffle_tickets(raffle_id, ticket_number) 
WHERE (status != 'cancelled');

-- RLS para raffle_tickets
ALTER TABLE public.raffle_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read tickets" ON public.raffle_tickets;
DROP POLICY IF EXISTS "Users can insert own tickets" ON public.raffle_tickets;
DROP POLICY IF EXISTS "Users can update own tickets" ON public.raffle_tickets;
DROP POLICY IF EXISTS "Staff can manage all tickets" ON public.raffle_tickets;

CREATE POLICY "Anyone can read tickets" ON public.raffle_tickets
    FOR SELECT USING (true);

CREATE POLICY "Users can insert own tickets" ON public.raffle_tickets
    FOR INSERT WITH CHECK (auth.uid() = player_id OR player_id IS NULL);

CREATE POLICY "Users can update own tickets" ON public.raffle_tickets
    FOR UPDATE USING (auth.uid() = player_id) WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Staff can manage all tickets" ON public.raffle_tickets
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role IN ('staff', 'admin')
        )
    );

-- 3. Crear función RPC: Vincular paquete físico a un jugador
CREATE OR REPLACE FUNCTION public.redeem_raffle_package(
  p_code TEXT,
  p_player_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_package RECORD;
BEGIN
  -- 1. Buscar paquete
  SELECT * INTO v_package FROM public.raffle_packages 
  WHERE upper(code) = upper(p_code);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Código de ticket no encontrado.');
  END IF;

  -- 2. Validar estado y expiración
  IF v_package.status = 'exhausted' OR v_package.remaining_options <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Este ticket ya no tiene opciones disponibles.');
  END IF;

  IF v_package.status = 'expired' OR v_package.valid_until < now() THEN
    UPDATE public.raffle_packages SET status = 'expired' WHERE id = v_package.id;
    RETURN jsonb_build_object('success', false, 'message', 'Este ticket ha expirado.');
  END IF;

  IF v_package.player_id IS NOT NULL AND v_package.player_id != p_player_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Este ticket ya está vinculado a otra cuenta.');
  END IF;

  -- 3. Vincular al jugador
  UPDATE public.raffle_packages 
  SET player_id = p_player_id
  WHERE id = v_package.id;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Ticket de Sorteo vinculado con éxito.', 
    'remaining_options', v_package.remaining_options,
    'total_options', v_package.total_options
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Crear función RPC: Comprar boletos de sorteo directamente
CREATE OR REPLACE FUNCTION public.buy_raffle_tickets(
  p_raffle_id UUID,
  p_ticket_numbers INTEGER[],
  p_player_id UUID,
  p_package_code TEXT
) RETURNS JSONB AS $$
DECLARE
  v_package RECORD;
  v_ticket_count INTEGER;
  v_number INTEGER;
  v_player_name TEXT;
  v_player_email TEXT;
BEGIN
  -- 1. Buscar y validar paquete del jugador
  SELECT * INTO v_package FROM public.raffle_packages 
  WHERE upper(code) = upper(p_package_code) AND (player_id = p_player_id OR player_id IS NULL);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Código de ticket no válido.');
  END IF;

  IF v_package.status = 'exhausted' OR v_package.remaining_options <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Este ticket ya no tiene opciones disponibles.');
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

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Compra de ' || v_ticket_count || ' boleto(s) confirmada con éxito.',
    'remaining_options', v_package.remaining_options - v_ticket_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Crear función RPC: Realizar sorteo y calcular ganadores
CREATE OR REPLACE FUNCTION public.draw_raffle(
  p_raffle_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_winning_number INTEGER;
  v_winner_ticket RECORD;
  v_raffle RECORD;
  v_winner_name TEXT := 'Nadie';
BEGIN
  -- 1. Obtener y validar el sorteo
  SELECT * INTO v_raffle FROM public.raffles WHERE id = p_raffle_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Sorteo no encontrado.');
  END IF;

  IF v_raffle.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Este sorteo ya ha sido finalizado.');
  END IF;

  -- 2. Generar número ganador (1 a 36)
  v_winning_number := floor(random() * 36)::INTEGER + 1;

  -- 3. Buscar si hay un ticket ganador confirmado para este sorteo
  SELECT * INTO v_winner_ticket 
  FROM public.raffle_tickets 
  WHERE raffle_id = p_raffle_id 
    AND ticket_number = v_winning_number 
    AND status = 'confirmed'
  LIMIT 1;

  -- 4. Actualizar el sorteo
  UPDATE public.raffles 
  SET status = 'completed',
      winning_number = v_winning_number,
      winner_ticket_id = v_winner_ticket.id
  WHERE id = p_raffle_id;

  -- 5. Sincronizar la TV central
  UPDATE public.screen_state
  SET status = 'result',
      last_spin_result = v_winning_number,
      updated_at = now()
  WHERE screen_number = (SELECT central_screen_id FROM public.venue_settings LIMIT 1);

  IF v_winner_ticket.id IS NOT NULL THEN
    v_winner_name := coalesce(v_winner_ticket.buyer_name, 'Jugador');
    RETURN jsonb_build_object(
      'success', true, 
      'message', 'Sorteo finalizado con éxito. Número ganador: ' || v_winning_number || '. ¡Tenemos un ganador: ' || v_winner_name || '!',
      'winning_number', v_winning_number,
      'winner_ticket_id', v_winner_ticket.id
    );
  ELSE
    RETURN jsonb_build_object(
      'success', true, 
      'message', 'Sorteo finalizado con éxito. Número ganador: ' || v_winning_number || '. El premio se declara acumulado ya que nadie compró ese número.',
      'winning_number', v_winning_number,
      'winner_ticket_id', NULL
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Modificaciones a venue_settings para gestionar sorteo activo y pantalla de cartelera
ALTER TABLE public.venue_settings ADD COLUMN IF NOT EXISTS active_raffle_id UUID REFERENCES public.raffles(id) ON DELETE SET NULL;
ALTER TABLE public.venue_settings ADD COLUMN IF NOT EXISTS raffle_billboard_screen_id INTEGER DEFAULT 4;

-- Habilitar réplica en tiempo real para las tablas del sistema de sorteo (de forma segura)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'raffle_packages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.raffle_packages;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'raffle_tickets') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.raffle_tickets;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'raffles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.raffles;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'venue_settings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.venue_settings;
  END IF;
END $$;

