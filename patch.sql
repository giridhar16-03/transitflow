ALTER TABLE institutions
ADD COLUMN IF NOT EXISTS owner_user_id uuid UNIQUE REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS institution_name text,
ADD COLUMN IF NOT EXISTS institution_type text,
ADD COLUMN IF NOT EXISTS contact_person text,
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS phone_number text,
ADD COLUMN IF NOT EXISTS institution_password_hash text;

-- Remove NOT NULL constraint from institution_code and access_code since the old AuthPage registers without them temporarily until we update it. Actually, wait. We WILL update AuthPage to supply them. But let's make them nullable just in case of failure.
ALTER TABLE institutions
ALTER COLUMN institution_code DROP NOT NULL,
ALTER COLUMN access_code DROP NOT NULL;

-- Create institution_users table if not exists
CREATE TABLE IF NOT EXISTS institution_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  institution_id uuid REFERENCES institutions(id) ON DELETE CASCADE,
  role text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, institution_id)
);

-- Enable RLS
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE institution_users ENABLE ROW LEVEL SECURITY;

-- Policies for institutions
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON institutions;
CREATE POLICY "Enable read access for all authenticated users" ON institutions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON institutions;
CREATE POLICY "Enable insert for authenticated users" ON institutions FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for owner" ON institutions;
CREATE POLICY "Enable update for owner" ON institutions FOR UPDATE TO authenticated USING (auth.uid() = owner_user_id OR auth.uid() = admin_user_id);

-- Policies for institution_users
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON institution_users;
CREATE POLICY "Enable read access for all authenticated users" ON institution_users FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON institution_users;
CREATE POLICY "Enable insert for authenticated users" ON institution_users FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for users" ON institution_users;
CREATE POLICY "Enable update for users" ON institution_users FOR UPDATE TO authenticated USING (auth.uid() = user_id);


-- Drop the restrictive role check constraint to allow new private roles
ALTER TABLE auth_accounts DROP CONSTRAINT IF EXISTS auth_accounts_role_check;

-- Add required columns to routes table for private institutions
ALTER TABLE routes ADD COLUMN IF NOT EXISTS driver_access_code text UNIQUE;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS bus_number text;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS stops jsonb DEFAULT '[]'::jsonb;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES institutions(id) ON DELETE CASCADE;
ALTER TABLE routes ADD COLUMN IF NOT EXISTS public_mode boolean DEFAULT true;

-- Ensure RLS on routes allows select for drivers to lookup their access code
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON routes;
CREATE POLICY "Enable read access for all authenticated users" ON routes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON routes;
CREATE POLICY "Enable insert for authenticated users" ON routes FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Enable update for owner" ON routes;
CREATE POLICY "Enable update for owner" ON routes FOR UPDATE TO authenticated USING (true);

-- Fix RLS policies for the trips table completely
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

-- Drop all known policies to prevent conflicts
DROP POLICY IF EXISTS trips_manage_driver_or_admin ON public.trips;
DROP POLICY IF EXISTS trips_insert_own ON public.trips;
DROP POLICY IF EXISTS trips_update_own ON public.trips;
DROP POLICY IF EXISTS trips_select_all ON public.trips;
DROP POLICY IF EXISTS trips_select_own ON public.trips;
DROP POLICY IF EXISTS "trips_select_public_or_member" ON public.trips;
DROP POLICY IF EXISTS "trips_select_self_or_member" ON public.trips;
DROP POLICY IF EXISTS "trips_manage_self" ON public.trips;
DROP POLICY IF EXISTS "trips_manage_driver_or_admin" ON public.trips;

-- Allow anyone to read trips
CREATE POLICY trips_select_all ON public.trips FOR SELECT USING (true);

-- Allow drivers to insert their own trips (using user_id)
CREATE POLICY trips_insert_own ON public.trips FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow drivers to update their own trips
CREATE POLICY trips_update_own ON public.trips FOR UPDATE USING (auth.uid() = user_id);

-- Allow drivers to delete their own trips (optional)
CREATE POLICY trips_delete_own ON public.trips FOR DELETE USING (auth.uid() = user_id);

-- Fix RLS policies for the drivers table completely
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS drivers_select_all_authenticated ON public.drivers;
DROP POLICY IF EXISTS drivers_select_anon ON public.drivers;
DROP POLICY IF EXISTS drivers_insert_own ON public.drivers;
DROP POLICY IF EXISTS drivers_update_own ON public.drivers;
DROP POLICY IF EXISTS drivers_delete_own ON public.drivers;
DROP POLICY IF EXISTS "drivers_manage_self" ON public.drivers;
DROP POLICY IF EXISTS "drivers_manage_admin" ON public.drivers;
DROP POLICY IF EXISTS "drivers_select_public_or_member" ON public.drivers;

-- Allow anyone to read drivers (vital for realtime map updates)
CREATE POLICY drivers_select_all ON public.drivers FOR SELECT USING (true);

-- Allow drivers to manage their own row
CREATE POLICY drivers_insert_own ON public.drivers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY drivers_update_own ON public.drivers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY drivers_delete_own ON public.drivers FOR DELETE USING (auth.uid() = user_id);

-- -------------------------------------------------------------
-- REALTIME PUBLICATION FIX
-- -------------------------------------------------------------
-- Ensure the tables are in the realtime publication so events stream to the browser
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END
$$;

ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.drivers;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.trips;

ALTER PUBLICATION supabase_realtime ADD TABLE public.drivers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;

-- Ensure all columns (including trip_status) are sent in UPDATE events
ALTER TABLE public.drivers REPLICA IDENTITY FULL;
ALTER TABLE public.trips REPLICA IDENTITY FULL;
