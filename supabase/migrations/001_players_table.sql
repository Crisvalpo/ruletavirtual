-- Create players table
CREATE TABLE public.players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    
    -- Auth linkage (optional if using Supabase Auth)
    auth_user_id UUID REFERENCES auth.users(id),
    
    -- Profile
    google_id TEXT UNIQUE,
    email TEXT,
    current_nickname TEXT NOT NULL,
    current_emoji TEXT NOT NULL,
    is_guest BOOLEAN DEFAULT false,
    
    -- Stats
    total_plays INTEGER DEFAULT 0,
    total_wins INTEGER DEFAULT 0,
    last_played_at TIMESTAMPTZ,
    
    -- Metadata
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- Allow read/write for own user (based on auth_user_id or creates)
CREATE POLICY "Users can read own profile" ON public.players
    FOR SELECT USING (auth.uid() = auth_user_id OR auth_user_id IS NULL);

CREATE POLICY "Users can update own profile" ON public.players
    FOR UPDATE USING (auth.uid() = auth_user_id OR auth_user_id IS NULL);

-- Index
CREATE INDEX idx_players_email ON public.players(email);
CREATE INDEX idx_players_google_id ON public.players(google_id);
