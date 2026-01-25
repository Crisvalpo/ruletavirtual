-- Add player identity fields to screen_state for Realtime display
ALTER TABLE public.screen_state 
ADD COLUMN player_name TEXT,
ADD COLUMN player_emoji TEXT;
