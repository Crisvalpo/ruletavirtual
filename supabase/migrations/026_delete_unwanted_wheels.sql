-- Migration: 026_delete_unwanted_wheels
-- Purpose: Remove 'Clásica Chilena', 'Paw Patrol', and 'Emojis', leaving only 'Mario Bros'.

BEGIN;

-- Delete wheels by name. Cascade will handle segments.
DELETE FROM public.individual_wheels
WHERE name IN ('Clásica Chilena', 'Paw Patrol', 'Emojis');

COMMIT;
