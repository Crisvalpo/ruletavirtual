-- Migration 045: Consolidate Identity and Cleanup (Fixed)
-- 1. Drop constraints on ALL tables referencing players
-- 2. Drop old table
-- 3. Update profiles
-- 4. Re-create FKs pointing to profiles

-- 1. DROP FKs from dependent tables
ALTER TABLE public.player_queue DROP CONSTRAINT IF EXISTS player_queue_player_id_fkey;
ALTER TABLE public.screen_state DROP CONSTRAINT IF EXISTS screen_state_player_id_fkey;
ALTER TABLE public.raffle_tickets DROP CONSTRAINT IF EXISTS raffle_tickets_player_id_fkey;

-- 2. DROP players table
DROP TABLE IF EXISTS public.players;

-- 3. ENRICH profiles table with stats
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS total_plays INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_wins INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_played_at TIMESTAMPTZ;

-- 4. UPDATE FKs to reference profiles
-- player_queue
ALTER TABLE public.player_queue 
ADD CONSTRAINT player_queue_player_id_fkey 
FOREIGN KEY (player_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- screen_state
ALTER TABLE public.screen_state 
ADD CONSTRAINT screen_state_player_id_fkey 
FOREIGN KEY (player_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- raffle_tickets (Future feature, but let's keep schema valid)
ALTER TABLE public.raffle_tickets 
ADD CONSTRAINT raffle_tickets_player_id_fkey 
FOREIGN KEY (player_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 5. RE-CREATE RLS for player_queue
ALTER TABLE public.player_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can update their own queue items" 
ON public.player_queue FOR UPDATE 
USING (auth.uid() = player_id);

CREATE POLICY "Users can cancel their own waiting item" 
ON public.player_queue FOR DELETE 
USING (auth.uid() = player_id AND status = 'waiting');

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_total_wins ON public.profiles(total_wins DESC);

COMMENT ON TABLE public.profiles IS 'Central identity table linked to Auth. Includes stats.';
