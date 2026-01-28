-- Migration 027: Brute force protection for ticket redemption
CREATE TABLE IF NOT EXISTS public.redemption_attempts (
    screen_id INTEGER PRIMARY KEY,
    failed_count INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMPTZ DEFAULT now(),
    cooldown_until TIMESTAMPTZ
);

ALTER TABLE public.redemption_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read attempts" ON public.redemption_attempts FOR SELECT USING (true);
-- Update will be handled by the redeem_game_package function (SECURITY DEFINER)
