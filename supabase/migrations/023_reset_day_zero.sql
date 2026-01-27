-- Migration: 023_reset_day_zero
-- Purpose: Reset the database to "Day Zero" state (remove transactional data)

BEGIN;

-- 1. Truncate Transactional Tables (Order matters for FKs)
TRUNCATE TABLE public.game_history CASCADE;
TRUNCATE TABLE public.player_queue CASCADE;
TRUNCATE TABLE public.raffle_tickets CASCADE;
TRUNCATE TABLE public.raffles CASCADE;
TRUNCATE TABLE public.individual_wheels CASCADE; 
TRUNCATE TABLE public.players CASCADE;
TRUNCATE TABLE public.cash_register CASCADE;
TRUNCATE TABLE public.cash_closings CASCADE;

-- 2. Reset System State
UPDATE public.screen_state
SET 
    status = 'idle',
    current_game_id = NULL,
    current_wheel_id = NULL,
    player_name = NULL,
    player_emoji = NULL,
    last_spin_result = NULL,
    is_demo = false;

-- 3. Re-seed essential defaults
-- Mario is the only one with actual assets in the bucket
INSERT INTO public.individual_wheels (name, theme_category, segment_count, is_active, storage_path, background_image)
VALUES 
('Mario Bros', 'infantil', 12, true, 'mario', 'mario/background.jpg')
ON CONFLICT DO NOTHING;

-- 4. Ensure Screen rows exist (Restore defaults if table was empty)
INSERT INTO public.screen_state (screen_number, status, is_demo, current_wheel_id)
VALUES 
(1, 'idle', false, (SELECT id FROM public.individual_wheels WHERE name = 'Mario Bros' LIMIT 1)),
(2, 'idle', false, (SELECT id FROM public.individual_wheels WHERE name = 'Mario Bros' LIMIT 1)),
(3, 'idle', false, (SELECT id FROM public.individual_wheels WHERE name = 'Mario Bros' LIMIT 1)),
(4, 'idle', false, (SELECT id FROM public.individual_wheels WHERE name = 'Mario Bros' LIMIT 1))
ON CONFLICT (screen_number) DO UPDATE
SET 
    status = 'idle', 
    is_demo = false,
    current_wheel_id = (SELECT id FROM public.individual_wheels WHERE name = 'Mario Bros' LIMIT 1);

COMMIT;
