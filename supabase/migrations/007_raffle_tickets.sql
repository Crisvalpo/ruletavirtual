-- Create raffle_tickets table
CREATE TABLE public.raffle_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    
    raffle_id UUID REFERENCES public.raffles(id),
    ticket_number INTEGER NOT NULL CHECK (ticket_number BETWEEN 1 AND 36),
    
    -- Buyer
    buyer_name TEXT,
    buyer_phone TEXT,
    buyer_email TEXT,
    player_id UUID REFERENCES public.players(id), -- Optional link to registered player
    
    -- Payment
    amount_paid DECIMAL(10,2) NOT NULL,
    payment_method TEXT NOT NULL,
    payment_reference TEXT,
    
    -- Jackpot
    jackpot_bet BOOLEAN DEFAULT false,
    jackpot_number INTEGER CHECK (jackpot_number BETWEEN 1 AND 36),
    jackpot_amount DECIMAL(10,2) DEFAULT 0,
    
    -- Status
    is_physical_ticket BOOLEAN DEFAULT false,
    prize_claimed BOOLEAN DEFAULT false,
    prize_claimed_at TIMESTAMPTZ,
    
    -- Constraints
    UNIQUE(raffle_id, ticket_number) -- One ticket per number per raffle
);

-- RLS
ALTER TABLE public.raffle_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read tickets" ON public.raffle_tickets
    FOR SELECT USING (true);
