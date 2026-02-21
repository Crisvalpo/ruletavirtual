-- Migration 054: Allow self-healing profiles
-- Adds INSERT policy to profiles table so the client can create its own profile if missing

BEGIN;

-- 1. Add INSERT policy (Only for authenticated users creating their OWN profile)
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

-- 2. Ensure Admin Role for the owner
-- We can't do this for every user, but we can make sure the primary admin email is handled correctly in the handle_new_user function if it's called
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email, avatar_url, role)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Staff'), 
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    CASE 
      WHEN new.email = 'cristianluke@gmail.com' THEN 'admin'
      ELSE 'player' 
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

COMMENT ON POLICY "Users can insert their own profile" ON public.profiles IS 'Allows the application to self-heal if a profile record is missing for an existing auth user';
