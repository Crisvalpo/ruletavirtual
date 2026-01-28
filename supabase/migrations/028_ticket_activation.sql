-- Migration 028: Ticket activation and sales status
ALTER TABLE public.game_packages
ADD COLUMN IF NOT EXISTS is_activated BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS sale_status TEXT DEFAULT 'sold' CHECK (sale_status IN ('pre_printed', 'sold')),
ADD COLUMN IF NOT EXISTS sold_at TIMESTAMPTZ;

-- Function to activate a single ticket (Converts pre_printed to sold)
CREATE OR REPLACE FUNCTION public.activate_single_ticket(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_package RECORD;
BEGIN
    SELECT * INTO v_package FROM public.game_packages WHERE code = p_code FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Ticket no encontrado');
    END IF;

    IF v_package.sale_status = 'sold' THEN
        RETURN jsonb_build_object('success', true, 'message', 'El ticket ya estaba activo');
    END IF;

    UPDATE public.game_packages
    SET is_activated = true,
        sale_status = 'sold',
        sold_at = now()
    WHERE code = p_code;

    RETURN jsonb_build_object('success', true, 'message', 'Venta registrada y ticket activado');
END;
$$;

-- Function to activate a batch of tickets (legacy/bulk)
CREATE OR REPLACE FUNCTION public.activate_ticket_batch(p_created_via TEXT, p_created_at_after TIMESTAMPTZ)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE public.game_packages
    SET is_activated = true,
        sale_status = 'sold',
        sold_at = now()
    WHERE created_via = p_created_via 
      AND created_at >= p_created_at_after
      AND is_activated = false;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;
