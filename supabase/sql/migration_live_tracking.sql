-- ============================================================
-- TransitFlow: DB migration to support live driver tracking
-- Run this in the Supabase SQL Editor:
-- https://app.supabase.com/project/sqnexwoxccgjjrnwlzef/sql/new
-- ============================================================

-- 0. Drop the foreign key on trips.driver_key_id — it's a text label, not a relational FK
ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_driver_key_id_fkey;

-- 1. Add missing columns to the drivers table (if not already present)
-- 1. Add missing columns to the drivers table (if not already present)
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS driver_key_id text;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS bus_number text;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS age integer;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS driving_license_number text;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS trip_status text DEFAULT 'idle';

-- 2. Update the public_drivers view to include bus_number and trip_status
DROP VIEW IF EXISTS public_drivers;
CREATE VIEW public_drivers AS
SELECT id, display_name, bus_code, bus_number, latitude, longitude, last_seen, trip_status
FROM drivers;

-- 3. Grant SELECT on the public_drivers view to both authenticated and anon users
GRANT SELECT ON public_drivers TO anon;
GRANT SELECT ON public_drivers TO authenticated;

-- 4. Fix RLS policies on the drivers table
-- Remove the old restrictive select-own policy
DROP POLICY IF EXISTS drivers_select_own ON drivers;

-- Allow authenticated users to see ALL driver rows (needed for commuter public page)
DROP POLICY IF EXISTS drivers_select_all_authenticated ON drivers;
CREATE POLICY drivers_select_all_authenticated ON drivers
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow anonymous users (unauthenticated commuters) to also read driver rows
DROP POLICY IF EXISTS drivers_select_anon ON drivers;
CREATE POLICY drivers_select_anon ON drivers
  FOR SELECT TO anon USING (true);

-- 5. Make sure the trips table exists with the right columns
CREATE TABLE IF NOT EXISTS trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  driver_key_id text,
  bus_number text,
  bus_code text,
  route_name text,
  driver_name text,
  status text DEFAULT 'active',
  start_time timestamptz DEFAULT now(),
  end_time timestamptz,
  last_latitude double precision,
  last_longitude double precision,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on trips
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

-- Driver can insert their own trips
DROP POLICY IF EXISTS trips_insert_own ON trips;
CREATE POLICY trips_insert_own ON trips
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Driver can update their own trips
DROP POLICY IF EXISTS trips_update_own ON trips;
CREATE POLICY trips_update_own ON trips
  FOR UPDATE USING (auth.uid() = user_id);

-- Driver can read their own trips
DROP POLICY IF EXISTS trips_select_own ON trips;
CREATE POLICY trips_select_own ON trips
  FOR SELECT USING (auth.uid() = user_id);

-- 6. Create the auth_accounts table if it doesn't exist
CREATE TABLE IF NOT EXISTS auth_accounts (
  user_id uuid PRIMARY KEY,
  email text,
  role text,
  provider text,
  has_password boolean DEFAULT false,
  display_name text,
  bus_code text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on auth_accounts
ALTER TABLE auth_accounts ENABLE ROW LEVEL SECURITY;

-- Users can only see/edit their own auth_account
DROP POLICY IF EXISTS auth_accounts_own ON auth_accounts;
CREATE POLICY auth_accounts_own ON auth_accounts
  FOR ALL USING (auth.uid() = user_id);

-- 7. Enable realtime for drivers table so PublicPage gets live updates
ALTER PUBLICATION supabase_realtime ADD TABLE drivers;
