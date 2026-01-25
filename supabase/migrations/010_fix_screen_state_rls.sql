-- Allow anonymous/public updates to screen_state for the demo flow
-- In production, this should be stricter (e.g. only verified players in the queue)

CREATE POLICY "Public update screen state" ON public.screen_state
    FOR UPDATE USING (true);
