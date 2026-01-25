-- Create game_packages table (Combos)
CREATE TABLE public.game_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    
    code TEXT UNIQUE NOT NULL, -- 'COMBO-XXXX'
    package_type TEXT NOT NULL, -- '3x', '6x', '10x', '20x'
    
    total_plays INTEGER NOT NULL,
    plays_used INTEGER DEFAULT 0,
    plays_remaining INTEGER GENERATED ALWAYS AS (total_plays - plays_used) STORED,
    
    price_paid DECIMAL(10,2) NOT NULL,
    
    -- Buyer info
    buyer_name TEXT,
    buyer_email TEXT,
    buyer_phone TEXT,
    
    -- Validity
    valid_until TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT true,
    
    -- Origin
    created_via TEXT DEFAULT 'staff', -- 'staff', 'web', 'kiosk'
    payment_reference TEXT
);

-- RLS
ALTER TABLE public.game_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active packages" ON public.game_packages
    FOR SELECT USING (true); -- Usually restricted, but for validating via API might need public read or secure function

CREATE INDEX idx_packages_code ON public.game_packages(code);
