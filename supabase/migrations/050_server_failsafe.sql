-- Migration 050: Server-Side Failsafe for Stuck Spins
-- Automatically completes spins that are stuck for more than 2 minutes

CREATE OR REPLACE FUNCTION auto_complete_stuck_spins()
RETURNS TABLE(fixed_screens INTEGER[], fixed_players INTEGER[]) AS $$
DECLARE
  v_fixed_screens INTEGER[] := ARRAY[]::INTEGER[];
  v_fixed_players INTEGER[] := ARRAY[]::INTEGER[];
  v_screen RECORD;
  v_player RECORD;
BEGIN
  -- 1. Fix screens stuck in 'spinning' or 'showing_result' for > 2 minutes
  FOR v_screen IN 
    SELECT screen_number, status, updated_at
    FROM screen_state
    WHERE status IN ('spinning', 'showing_result')
      AND updated_at < NOW() - INTERVAL '2 minutes'
  LOOP
    -- Force advance to next player
    PERFORM force_advance_queue(v_screen.screen_number);
    
    v_fixed_screens := array_append(v_fixed_screens, v_screen.screen_number);
    
    RAISE NOTICE 'Auto-fixed stuck screen %: was in % for > 2 min', 
      v_screen.screen_number, v_screen.status;
  END LOOP;

  -- 2. Mark players stuck in 'playing' for > 5 minutes as abandoned
  FOR v_player IN
    SELECT id, screen_number, player_name
    FROM player_queue
    WHERE status = 'playing'
      AND created_at < NOW() - INTERVAL '5 minutes'
  LOOP
    UPDATE player_queue
    SET status = 'cancelled'
    WHERE id = v_player.id;
    
    v_fixed_players := array_append(v_fixed_players, v_player.screen_number);
    
    RAISE NOTICE 'Auto-abandoned stuck player % on screen %', 
      v_player.player_name, v_player.screen_number;
  END LOOP;

  RETURN QUERY SELECT v_fixed_screens, v_fixed_players;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION auto_complete_stuck_spins IS 'Failsafe: Auto-completes screens stuck in spinning/showing_result for >2min and marks players stuck in playing for >5min as abandoned';

-- NOTE: This function should be called periodically by:
-- 1. A cron job (pg_cron extension)
-- 2. OR a scheduled Edge Function
-- 3. OR called manually when debugging

-- Example cron setup (requires pg_cron extension):
-- SELECT cron.schedule(
--   'auto-complete-stuck-spins',
--   '*/2 * * * *', -- Every 2 minutes
--   $$SELECT auto_complete_stuck_spins();$$
-- );
