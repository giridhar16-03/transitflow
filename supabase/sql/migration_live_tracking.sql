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

-- 2. Update the public_drivers view to include bus_number and trip_status, and EXCLUDE private drivers
DROP VIEW IF EXISTS public_drivers;
CREATE VIEW public_drivers AS
SELECT id, display_name, bus_code, bus_number, latitude, longitude, last_seen, trip_status
FROM drivers
WHERE institution_id IS NULL;

-- 3. Grant SELECT on the public_drivers view to both authenticated and anon users
GRANT SELECT ON public_drivers TO anon;
GRANT SELECT ON public_drivers TO authenticated;

-- 4. Fix RLS policies on the drivers table
-- Remove the old restrictive select-own policy
DROP POLICY IF EXISTS drivers_select_own ON drivers;

-- Allow authenticated users to see public drivers OR drivers in their institution
DROP POLICY IF EXISTS drivers_select_all_authenticated ON drivers;
CREATE POLICY drivers_select_all_authenticated ON drivers
  FOR SELECT USING (
    institution_id IS NULL 
    OR 
    institution_id IN (SELECT id FROM institutions WHERE admin_user_id = auth.uid() OR owner_user_id = auth.uid())
    OR 
    institution_id IN (SELECT institution_id FROM institution_users WHERE user_id = auth.uid())
    OR
    user_id = auth.uid() -- A driver can always see their own row
  );

-- Allow anonymous users (unauthenticated commuters) to read ONLY public driver rows
DROP POLICY IF EXISTS drivers_select_anon ON drivers;
CREATE POLICY drivers_select_anon ON drivers
  FOR SELECT TO anon USING (institution_id IS NULL);

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
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'drivers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE drivers;
  END IF;
END
$$;

-- 8. Add institution_id and route_id to trips table for private tracking history
ALTER TABLE trips ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES institutions(id);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS route_id uuid REFERENCES routes(id);

-- 9. Redefine get_private_buses to ONLY return buses with an active trip
CREATE OR REPLACE FUNCTION get_private_buses(p_inst_code text, p_access_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inst_id uuid;
  v_result json;
BEGIN
  -- Validate credentials
  SELECT id INTO v_inst_id
  FROM institutions
  WHERE institution_code = p_inst_code AND access_code = p_access_code;

  IF v_inst_id IS NULL THEN
    RETURN '[]'::json; -- Return empty array if invalid credentials
  END IF;

  -- Fetch ONLY drivers that are on an active trip and their routes for this institution
  SELECT COALESCE(json_agg(
    json_build_object(
      'id', d.id,
      'display_name', d.display_name,
      'bus_code', d.bus_code,
      'bus_number', d.bus_number,
      'latitude', d.latitude,
      'longitude', d.longitude,
      'last_seen', d.last_seen,
      'route_name', r.route_name,
      'route_stops', r.stops
    )
  ), '[]'::json) INTO v_result
  FROM drivers d
  LEFT JOIN routes r ON d.route_id = r.id
  WHERE d.institution_id = v_inst_id 
    AND d.trip_status = 'active';

  RETURN v_result;
END;
$$;
