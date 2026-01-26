-- Enable public updates on player_queue
-- This is critical for the client-side flows (skip queue, cleanup, etc) to work if not using RPCs for everything.
-- Ideally we move to strict RPCs, but for now this unblocks the "Stuck Queue" and "Skip Optimization" logic.

CREATE POLICY "Public update queue" ON public.player_queue
    FOR UPDATE USING (true);

-- Ensure Realtime is enabled for player_queue (It was in 004 but good to double check)
ALTER PUBLICATION supabase_realtime ADD TABLE public.player_queue;
