-- MIGRATION 041: CLEAN SLATE FOR TESTING
-- Updated for Server Authority architecture tests

-- 1. Reset Session State (Screen & Queue)
TRUNCATE TABLE player_queue CASCADE;
UPDATE screen_state SET status = 'idle', player_name = NULL, player_emoji = NULL, last_spin_result = NULL;

-- 2. Reset Package Tracking (Optional: Uncomment if you want to wipe history)
-- TRUNCATE TABLE package_tracking CASCADE;
-- UPDATE game_packages SET plays_used = 0, spins_consumed = 0; -- Reset original packages

-- 3. Reset Offers
TRUNCATE TABLE screen_switch_offers CASCADE;

-- 4. Verify RPCs
-- Re-apply play_spin just in case (redundant if 040 ran, but safe)
