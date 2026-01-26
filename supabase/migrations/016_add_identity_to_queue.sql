-- Add guest identity columns to player_queue
ALTER TABLE public.player_queue
ADD COLUMN player_name TEXT,
ADD COLUMN player_emoji TEXT;
