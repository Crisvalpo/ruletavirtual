-- Create venue_settings table for Global Control
create table public.venue_settings (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  current_mode text not null default 'individual', -- 'individual' OR 'group_event'
  central_screen_id integer not null default 1 -- Which screen is the 'Master' in event mode
);

-- Enable RLS
alter table public.venue_settings enable row level security;

-- Policies
create policy "Enable read access for all users"
on public.venue_settings for select using (true);

create policy "Enable update for all users"
on public.venue_settings for update using (true) with check (true); 
-- Note: 'update' ideally restricted to admins, but using 'true' for now for simplicity/testing. 
-- In prod, this should be restricted.

-- Insert DEFAULT row (Critical: The app expects 1 single row to exist)
insert into public.venue_settings (current_mode, central_screen_id)
values ('individual', 1);
