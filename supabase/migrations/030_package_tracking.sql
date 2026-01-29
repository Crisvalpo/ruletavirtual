-- Migration: Package Tracking for Multi-Spin Packages
-- Implements "One Device = One Package" logic (Opción C)

-- Create package_tracking table
CREATE TABLE IF NOT EXISTS public.package_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_code TEXT NOT NULL UNIQUE,
  total_spins INTEGER NOT NULL CHECK (total_spins > 0),
  spins_consumed INTEGER DEFAULT 0 CHECK (spins_consumed >= 0 AND spins_consumed <= total_spins),
  device_fingerprint TEXT, -- Hash of device that redeemed the code
  first_redeemed_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add columns to player_queue for package tracking
ALTER TABLE public.player_queue 
ADD COLUMN IF NOT EXISTS package_tracking_id UUID REFERENCES public.package_tracking(id),
ADD COLUMN IF NOT EXISTS spin_number INTEGER; -- "Giro 3 de 6"

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_package_tracking_code ON public.package_tracking(package_code);
CREATE INDEX IF NOT EXISTS idx_package_tracking_device ON public.package_tracking(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_player_queue_package ON public.player_queue(package_tracking_id);

-- RLS Policies
ALTER TABLE public.package_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read packages" 
  ON public.package_tracking FOR SELECT 
  USING (true);

CREATE POLICY "Public insert packages" 
  ON public.package_tracking FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Public update packages" 
  ON public.package_tracking FOR UPDATE 
  USING (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_package_tracking_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_package_tracking_timestamp
  BEFORE UPDATE ON public.package_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_package_tracking_timestamp();

-- Comment
COMMENT ON TABLE public.package_tracking IS 'Tracks multi-spin packages and their consumption per device';
