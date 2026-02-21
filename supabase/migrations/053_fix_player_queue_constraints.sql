-- Migration 053: Fix player_queue status constraints
-- Expands the allowed statuses to include all states used by the system (including failsafes and legacy logic)

BEGIN;

-- 1. Identify and drop the existing check constraint
-- The default name from migration 004 is player_queue_status_check
ALTER TABLE public.player_queue DROP CONSTRAINT IF EXISTS player_queue_status_check;

-- 2. Add the expanded check constraint
-- Added: 'abandoned' (used in failsafe 050), 'spinning', 'showing_result', 'waiting_for_spin' (used in various RPCs/Where clauses)
ALTER TABLE public.player_queue ADD CONSTRAINT player_queue_status_check 
  CHECK (status IN ('waiting', 'selecting', 'ready', 'playing', 'completed', 'cancelled', 'abandoned', 'spinning', 'showing_result', 'waiting_for_spin'));

-- 3. Cleanup: If any rows currently have an invalid status (should not happen if constraint was active, 
-- but good for robustness), we don't need to do anything as we just expanded the list.

COMMIT;

COMMENT ON CONSTRAINT player_queue_status_check ON public.player_queue IS 'Expanded list of allowed player states for system robustness';
