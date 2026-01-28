-- Migration 029: Prize Validation and Payout Tracking
-- Adds columns to player_queue to track when a prize has been delivered to the customer.

ALTER TABLE public.player_queue
ADD COLUMN prize_payout_status TEXT DEFAULT 'pending' CHECK (prize_payout_status IN ('pending', 'paid', 'not_applicable')),
ADD COLUMN prize_payout_at TIMESTAMPTZ,
ADD COLUMN prize_payout_by UUID; -- References auth.users if needed later

-- Index for staff to quickly find unpaid prizes
CREATE INDEX idx_queue_prize_payout ON public.player_queue(prize_payout_status) WHERE prize_payout_status = 'pending';

-- Column for spin_result was already added in previous versions, but let's ensure it exists
-- and is used for winning/losing logic.
-- Note: 'spin_result' is usually an integer representing the winning segment.
