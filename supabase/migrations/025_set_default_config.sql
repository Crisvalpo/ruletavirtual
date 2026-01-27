-- Migration: 025_set_default_config
-- Purpose: Set default Venue Mode to 'individual' (Parque) and all screens to 'Mario Bros'.

BEGIN;

DO $$
DECLARE
    v_mario_id UUID;
BEGIN
    -- 1. Find Mario Bros Wheel ID
    SELECT id INTO v_mario_id FROM public.individual_wheels WHERE name = 'Mario Bros';

    -- 2. Update Venue Settings to 'individual' (Modo Parque)
    -- Assuming only one row usually, but update all to be safe or insert if missing
    UPDATE public.venue_settings
    SET current_mode = 'individual';

    -- If no settings row exists, insert it
    INSERT INTO public.venue_settings (current_mode, central_screen_id)
    SELECT 'individual', 1
    WHERE NOT EXISTS (SELECT 1 FROM public.venue_settings);

    -- 3. Update All Screens to use Mario Bros Wheel
    -- Removed invalid column 'is_spinning' based on previous schema checks
    IF v_mario_id IS NOT NULL THEN
        UPDATE public.screen_state
        SET 
            current_wheel_id = v_mario_id,
            status = 'idle',
            player_name = NULL,
            player_emoji = NULL,
            last_spin_result = NULL
        WHERE screen_number BETWEEN 1 AND 4;
    END IF;

END $$;

COMMIT;
