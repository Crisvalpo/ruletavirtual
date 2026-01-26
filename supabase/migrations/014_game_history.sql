-- Create game_history table
create table public.game_history (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  screen_id integer not null, -- The physical screen number (e.g., 1, 2)
  wheel_id uuid references public.individual_wheels(id), -- The design being played (optional, can be null if generic)
  result_index integer not null, -- The winning segment index (0-based or 1-based depending on logic, let's store what the wheel returns)
  player_name text, -- Optional: who spun it
  
  -- Foreign key to auth.users not strictly needed for anonymous screen history,
  -- but good for audit if we tracked user_id. For now, keep simple.

  constraint game_history_screen_id_check check (screen_id > 0)
);

-- Enable RLS
alter table public.game_history enable row level security;

-- Policies
-- Public read access (screens need to show history)
create policy "Enable read access for all users"
on public.game_history for select
using (true);

-- Insert access (screens insert result)
-- ideally authenticated, but assuming anon key for now for screens
create policy "Enable insert for all users"
on public.game_history for insert
with check (true);

-- Indexes for performance (querying by screen is the main use case)
create index game_history_screen_id_idx on public.game_history (screen_id);
create index game_history_created_at_idx on public.game_history (created_at desc);
