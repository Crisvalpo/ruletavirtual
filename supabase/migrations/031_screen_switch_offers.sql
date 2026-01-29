-- Migration: Screen Switch Offers
-- Implements sequential offer system for intelligent screen switching

-- Create screen_switch_offers table
CREATE TABLE IF NOT EXISTS public.screen_switch_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_screen_number INTEGER NOT NULL CHECK (target_screen_number BETWEEN 1 AND 4),
  offered_to_queue_id UUID REFERENCES public.player_queue(id) ON DELETE CASCADE,
  offer_expires_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_active_offers 
  ON public.screen_switch_offers(target_screen_number, status) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_offers_by_queue 
  ON public.screen_switch_offers(offered_to_queue_id);

CREATE INDEX IF NOT EXISTS idx_offers_by_expiry 
  ON public.screen_switch_offers(offer_expires_at) 
  WHERE status = 'pending';

-- RLS Policies
ALTER TABLE public.screen_switch_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all offers" 
  ON public.screen_switch_offers FOR SELECT 
  USING (true);

CREATE POLICY "Users can update their own offers" 
  ON public.screen_switch_offers FOR UPDATE 
  USING (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_screen_switch_offers_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_screen_switch_offers_timestamp
  BEFORE UPDATE ON public.screen_switch_offers
  FOR EACH ROW
  EXECUTE FUNCTION update_screen_switch_offers_timestamp();

-- Comment
COMMENT ON TABLE public.screen_switch_offers IS 'Tracks sequential screen switch offers to waiting players';
