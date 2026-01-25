-- Create screen_state table
CREATE TABLE public.screen_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    screen_number INTEGER UNIQUE NOT NULL CHECK (screen_number BETWEEN 1 AND 4),
    
    -- Current Configuration
    current_wheel_id UUID REFERENCES public.individual_wheels(id),
    
    -- Status
    status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'waiting_for_spin', 'spinning', 'showing_result')),
    
    -- Active Game Data
    current_game_id UUID, -- Link to specific game instance if needed
    last_spin_result INTEGER,
    
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Realtime
ALTER TABLE public.screen_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read screen state" ON public.screen_state
    FOR SELECT USING (true);
    
-- Update trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_screen_state_timestamp
    BEFORE UPDATE ON public.screen_state
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at();

-- Methods to initialize screens 1-4
INSERT INTO public.screen_state (screen_number, status)
VALUES (1, 'idle'), (2, 'idle'), (3, 'idle'), (4, 'idle')
ON CONFLICT (screen_number) DO NOTHING;
