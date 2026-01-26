-- Add is_demo column to screen_state to flag practice spins
ALTER TABLE public.screen_state
ADD COLUMN is_demo BOOLEAN DEFAULT false;
