-- Migration 031: Add base_url to venue_settings
-- This allows generating QRs with a customized domain (e.g. cloudflare) instead of localhost.

ALTER TABLE public.venue_settings 
ADD COLUMN IF NOT EXISTS base_url TEXT;

-- Update existing row to include a default if needed (optional, keeping it null means use window.location.origin)
UPDATE public.venue_settings SET base_url = NULL WHERE base_url IS NULL;
