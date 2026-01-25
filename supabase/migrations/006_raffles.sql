-- Create raffles table
CREATE TABLE public.raffles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    
    code TEXT UNIQUE NOT NULL, -- 'ROSA-001'
    name TEXT, -- 'Sorteo 15:00'
    
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed_for_sales', 'spinning', 'completed', 'cancelled')),
    
    -- Configuration
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    base_price DECIMAL(10,2) DEFAULT 1000,
    jackpot_price DECIMAL(10,2) DEFAULT 1000,
    
    -- Stats
    tickets_sold INTEGER DEFAULT 0,
    total_collected DECIMAL(10,2) DEFAULT 0,
    current_jackpot DECIMAL(10,2) DEFAULT 0,
    
    -- Result
    winning_number INTEGER, -- 1-36
    winner_ticket_id UUID,
    
    -- Optimization
    is_special_event BOOLEAN DEFAULT false
);

-- RLS
ALTER TABLE public.raffles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read raffles" ON public.raffles
    FOR SELECT USING (true);
