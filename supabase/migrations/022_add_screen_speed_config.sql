ALTER TABLE public.screen_state
ADD COLUMN idle_speed FLOAT DEFAULT 1.0;

-- Optional: Add check to ensure positive speed
ALTER TABLE public.screen_state
ADD CONSTRAINT screen_state_idle_speed_check CHECK (idle_speed > 0);
