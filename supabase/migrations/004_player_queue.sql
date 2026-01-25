-- Create player_queue table
CREATE TABLE public.player_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    
    screen_number INTEGER NOT NULL REFERENCES public.screen_state(screen_number),
    player_id UUID REFERENCES public.players(id),
    
    -- Status
    status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'selecting', 'ready', 'playing', 'completed', 'cancelled')),
    
    -- Game Selection
    selected_animals JSONB, -- Array of selected indices/names
    
    -- Payment
    has_paid BOOLEAN DEFAULT false,
    payment_method TEXT, -- 'cash', 'mercadopago', 'combo'
    payment_reference TEXT,
    
    package_id UUID, -- If using a combo
    
    -- Priority/Order
    queue_order SERIAL
);

-- Enable Realtime
ALTER TABLE public.player_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read queue" ON public.player_queue
    FOR SELECT USING (true);

CREATE POLICY "Players can join queue" ON public.player_queue
    FOR INSERT WITH CHECK (true);

-- Index for fast queue lookups
CREATE INDEX idx_queue_screen_status ON public.player_queue(screen_number, status);
