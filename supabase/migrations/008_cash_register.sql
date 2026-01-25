-- Create cash_register table
CREATE TABLE public.cash_register (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('income', 'expense')),
    game_type TEXT CHECK (game_type IN ('individual', 'group', 'special', 'kiosk', 'other')),
    
    amount DECIMAL(10,2) NOT NULL,
    
    -- References
    reference_code TEXT, -- Ticket ID, Combo Code, etc.
    staff_id UUID, -- Link to auth.users if using Supabase Auth for staff
    
    payment_method TEXT DEFAULT 'cash',
    notes TEXT
);

-- RLS (Restrict to Staff only ideally)
ALTER TABLE public.cash_register ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read cash register" ON public.cash_register
    FOR SELECT USING (auth.role() = 'authenticated'); 
    -- Assuming staff are authenticated users. 
    -- For development we might allow public insert if simulating from client, 
    -- but usually this is server-side or protected.

-- Create cash_closings table (End of day)
CREATE TABLE public.cash_closings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    closed_at TIMESTAMPTZ DEFAULT now(),
    
    staff_id UUID,
    
    total_cash_expected DECIMAL(10,2),
    total_cash_counted DECIMAL(10,2),
    difference DECIMAL(10,2),
    
    notes TEXT
);
