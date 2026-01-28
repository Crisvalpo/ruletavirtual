-- Migration 030: Secure redemption logic (FIXED)
-- Validates that the ticket is activated (is_activated = true)
-- Implements brute force protection: 3 failures block the screen/IP for 5 minutes.

CREATE OR REPLACE FUNCTION public.redeem_game_package(
    p_code TEXT, 
    p_screen_id INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_package RECORD;
    v_new_plays_used INTEGER;
    v_attempt RECORD;
    v_max_attempts CONSTANT INTEGER := 3;
    v_cooldown_minutes CONSTANT INTEGER := 5;
BEGIN
    -- 1. Check for Brute Force Cooldown
    SELECT * INTO v_attempt 
    FROM public.redemption_attempts 
    WHERE screen_id = p_screen_id;

    IF v_attempt.cooldown_until > now() THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'Demasiados intentos fallidos. Por favor, espere unos minutos.',
            'cooldown_until', v_attempt.cooldown_until
        );
    END IF;

    -- 2. Find the package
    SELECT * INTO v_package
    FROM public.game_packages
    WHERE code = p_code
    FOR UPDATE; -- Lock row

    -- 3. Validate existence & Activation
    IF NOT FOUND OR v_package.is_activated = false THEN
        -- Log failed attempt
        IF v_attempt IS NULL THEN
            INSERT INTO public.redemption_attempts (screen_id, failed_count, last_attempt_at)
            VALUES (p_screen_id, 1, now());
        ELSE
            IF v_attempt.failed_count + 1 >= v_max_attempts THEN
                UPDATE public.redemption_attempts 
                SET failed_count = 0, 
                    last_attempt_at = now(),
                    cooldown_until = now() + (v_cooldown_minutes || ' minutes')::interval
                WHERE screen_id = p_screen_id;
            ELSE
                UPDATE public.redemption_attempts 
                SET failed_count = failed_count + 1, 
                    last_attempt_at = now()
                WHERE screen_id = p_screen_id;
            END IF;
        END IF;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'message', 'Código inválido');
        ELSE
            RETURN jsonb_build_object('success', false, 'message', 'Este ticket aún no ha sido activado por el personal');
        END IF;
    END IF;

    -- 4. Reset failed attempts on success
    UPDATE public.redemption_attempts SET failed_count = 0, cooldown_until = NULL WHERE screen_id = p_screen_id;

    -- 5. Validate older status checks
    IF v_package.is_active = false THEN
        RETURN jsonb_build_object('success', false, 'message', 'El código está inactivo');
    END IF;

    IF v_package.valid_until < now() THEN
        RETURN jsonb_build_object('success', false, 'message', 'El código ha expirado');
    END IF;

    -- 6. Validate remaining plays
    IF (v_package.total_plays - v_package.plays_used) <= 0 THEN
         RETURN jsonb_build_object('success', false, 'message', 'El código ya ha sido canjeado completamente');
    END IF;

    -- 7. Consume play
    v_new_plays_used := v_package.plays_used + 1;

    UPDATE public.game_packages
    SET plays_used = v_new_plays_used
    WHERE id = v_package.id;

    -- 8. Return success
    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Código canjeado con éxito',
        'plays_remaining', v_package.total_plays - v_new_plays_used,
        'package_type', v_package.package_type
    );
END;
$$;
