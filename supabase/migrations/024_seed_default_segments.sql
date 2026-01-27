-- Migration: 024_seed_default_segments
-- Purpose: Seed segments for the Mario Bros default wheel.

BEGIN;

DO $$
DECLARE
    v_mario_id UUID;
BEGIN
    SELECT id INTO v_mario_id FROM public.individual_wheels WHERE name = 'Mario Bros';

    -- Seed Segments for 'Mario Bros' (12 segments from storage)
    -- Using paths verified: mario/segments/1.png ... 12.png
    -- And selector thumbnails: mario/selector/1.jpg ... 12.jpg
    IF v_mario_id IS NOT NULL THEN
        DELETE FROM public.individual_wheel_segments WHERE wheel_id = v_mario_id;

        FOR i IN 1..12 LOOP
            INSERT INTO public.individual_wheel_segments (wheel_id, position, name, segment_image, selector_image, color)
            VALUES (
                v_mario_id, 
                i, 
                'Item ' || i, 
                'mario/segments/' || i || '.png',
                'mario/selector/' || i || '.jpg',
                'transparent'
            );
        END LOOP;
    END IF;

END $$;

COMMIT;
