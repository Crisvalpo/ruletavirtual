-- Seed Initial Data

-- 1. Insert Chilean Animals (Group Mode / Classic)
-- Assuming we might have a 'classic_animals' table or just store them in code/config.
-- But let's create a 'Classic' wheel in individual_wheels for reference.

INSERT INTO public.individual_wheels (name, theme_category, segment_count, is_active)
VALUES 
('Clásica Chilena', 'general', 36, true),
('Paw Patrol', 'infantil', 12, true),
('Emojis', 'general', 12, true)
ON CONFLICT DO NOTHING;

-- We can populate segments for these wheels later via Admin UI or more seed SQL
-- For now, ensuring wheels exist is good enough for development start.

-- 2. Reset Screen States
UPDATE public.screen_state SET status = 'idle', current_game_id = NULL;

-- 3. Clear queues (Dev only)
-- TRUNCATE public.player_queue;
