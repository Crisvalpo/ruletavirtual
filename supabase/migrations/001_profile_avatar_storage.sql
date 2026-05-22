-- Ensure the storage bucket exists
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Create policies for storage.objects on bucket 'avatars'
drop policy if exists "Allow public read access for avatars" on storage.objects;
drop policy if exists "Allow upload to avatars folder" on storage.objects;
drop policy if exists "Allow update to own avatars" on storage.objects;
drop policy if exists "Allow delete from own avatars" on storage.objects;

-- 1. Read access
create policy "Allow public read access for avatars"
on storage.objects for select
using (bucket_id = 'avatars');

-- 2. Insert/Upload access for users to their own folder
create policy "Allow upload to avatars folder"
on storage.objects for insert
with check (
    bucket_id = 'avatars'
    and (auth.uid()::text = (storage.foldername(name))[1])
);

-- 3. Update access for users to their own folder
create policy "Allow update to own avatars"
on storage.objects for update
using (
    bucket_id = 'avatars'
    and (auth.uid()::text = (storage.foldername(name))[1])
)
with check (
    bucket_id = 'avatars'
    and (auth.uid()::text = (storage.foldername(name))[1])
);

-- 4. Delete access for users to their own folder
create policy "Allow delete from own avatars"
on storage.objects for delete
using (
    bucket_id = 'avatars'
    and (auth.uid()::text = (storage.foldername(name))[1])
);
