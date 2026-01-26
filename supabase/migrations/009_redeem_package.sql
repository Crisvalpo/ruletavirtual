-- Create a function to redeem a game package code
-- This will be called from the client when a user enters a code on the kiosk/payment screen.

CREATE OR REPLACE FUNCTION public.redeem_game_package(
    p_code TEXT, 
    p_screen_id INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of the creator (should be admin)
AS $$
DECLARE
    v_package RECORD;
    v_new_plays_used INTEGER;
BEGIN
    -- 1. Find the package
    SELECT * INTO v_package
    FROM public.game_packages
    WHERE code = p_code
    FOR UPDATE; -- Lock row to prevent race conditions

    -- 2. Validate existence
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Código inválido');
    END IF;

    -- 3. Validate status
    IF v_package.is_active = false THEN
        RETURN jsonb_build_object('success', false, 'message', 'El código está inactivo');
    END IF;

    IF v_package.valid_until < now() THEN
        RETURN jsonb_build_object('success', false, 'message', 'El código ha expirado');
    END IF;

    -- 4. Validate remaining plays
    IF v_package.plays_remaining <= 0 THEN
         RETURN jsonb_build_object('success', false, 'message', 'El código ya ha sido canjeado completamente');
    END IF;

    -- 5. Consume play
    v_new_plays_used := v_package.plays_used + 1;

    UPDATE public.game_packages
    SET plays_used = v_new_plays_used
    WHERE id = v_package.id;

    -- 6. Log usage? (Optional, maybe specific audit table, or just rely on updated timestamp)
    -- For now, we trust the count. 

    -- 7. Return success
    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Código canjeado con éxito',
        'plays_remaining', v_package.total_plays - v_new_plays_used,
        'package_type', v_package.package_type
    );
END;
$$;
