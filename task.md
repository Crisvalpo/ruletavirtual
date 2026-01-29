# Task Checklist: Ruleta Virtual - Mobile & Game Logic

## 🚀 Critical Mobile & Game Logic Fixes
Status: **In Progress**

- [x] **Database & State Cleanup**
  - [x] Investigate "stuck" states (`playing` vs `spinning`) - *Resolved via DB reset & Logic fixes*
  - [x] Ensure `player_queue` and `screen_state` are consistent
  - [x] Create Reset/Cleanup SQL tools if needed

- [x] **Mobile Flow Refinement (Individual Mode)**
  - [x] Fix "Permission Denied" on `finish_active_spin` (Added anonymous permissions)
  - [x] Fix `play_spin` RPC to use DYNAMIC segment counts (Fixed "erroneous results" bug)
  - [x] Prevent result page from appearing too early on mobile (Added strict `isCompleted` check)
  - [x] Synchronize Mobile Result with Big Screen Animation

- [x] **Spin Logic & Timing**
  - [x] Fix "Infinite Spin" (Client-side `handleSpinComplete` timing)
  - [x] Server-side: `complete_spin_and_check_package` updates `spin_result`
  - [x] Fix "Erroneous Results" (Dynamic segment count in `play_spin` RPC)
  - [x] Mobile: Result page appears too early (Wait for `isCompleted` status)
  - [x] **UX: Disable auto-rejoin on WIN (Allow prize claim first)**
  - [x] **UX: Disable "Play Again" buttons while waiting for roulette idle**

- [x] **Dynamic Wheel Selection (Multi-Wheel Support)**
  - [x] **Backend**: Added `selected_wheel_id` column to `player_queue` (Migration 047)
  - [x] **Backend**: Updated `promote_next_player` to sync wheel selection to `screen_state.current_wheel_id`
  - [x] **Frontend**: `PreSelectPage` saves wheel selection when creating queue entry
  - [x] **Frontend**: `DynamicAnimalSelector` adapts to chosen wheel's segments via `wheelId` prop
  - [x] **Sync**: Display screen uses `activeWheelId` from store (synced via `useRealtimeGame`)

- [/] **Verification & Testing**
  - [ ] E2E Test: Full Package Flow (Loss -> Auto-Rejoin)
  - [ ] E2E Test: Win Flow (Prize Claim -> Manual Continue)
  - [ ] Verify "Continue Playing" button visibility for winners
  - [ ] E2E Test: Multi-Wheel Selection (Player chooses wheel → Screen switches)

## 📝 Notes
- **Supabase RPCs**: `play_spin`, `complete_spin_and_check_package`, and `redeem_or_continue_package` are the core logic handlers.
- **Mobile Sync**: The mobile client now strictly listens for `status='completed'` or `screen_state='showing_result'` before showing the win/loss screen.
- **Win State**: Winners are NO LONGER auto-rejoined. They must manually click "Sig. Giro" after claiming their prize.
- **Wheel Selection**: When a player is promoted, their `selected_wheel_id` overrides the current screen wheel (if different), ensuring players always see their chosen game.
