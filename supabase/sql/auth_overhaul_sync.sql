-- ============================================================
-- TransitFlow: Auth System Overhaul — Database Sync
-- Paste this ENTIRE script into the Supabase SQL Editor and run.
-- All statements use IF NOT EXISTS / IF EXISTS, so it's safe
-- to run multiple times without breaking anything.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. DRIVERS TABLE — add missing columns
-- ─────────────────────────────────────────────────────────────

-- user_id links a driver row to the auth.users row
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- display_name (shown in UI, separate from the 'name' column)
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS display_name text;

-- live GPS columns
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS latitude numeric(10,6);
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS longitude numeric(10,6);
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS last_seen timestamptz;

-- trip status for live tracking
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS trip_status text DEFAULT 'idle';

-- driving license
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS driving_license_number text;

-- Make user_id unique (needed for UPSERT onConflict: "user_id")
DO $$
BEGIN
  ALTER TABLE public.drivers ADD CONSTRAINT drivers_user_id_key UNIQUE (user_id);
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 2. PROFILES TABLE — create if missing, add email column
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'public_user',
  mobile text,
  mode text NOT NULL DEFAULT 'public' CHECK (mode IN ('public', 'private')),
  institution_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- ─────────────────────────────────────────────────────────────
-- 3. AUTH_ACCOUNTS TABLE — ensure it exists with all columns
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.auth_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('public-user', 'public-driver', 'private')),
  provider text NOT NULL CHECK (provider IN ('password', 'google')),
  has_password boolean NOT NULL DEFAULT false,
  display_name text,
  bus_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auth_accounts ENABLE ROW LEVEL SECURITY;

-- RLS: users can only manage their own auth_accounts row
DROP POLICY IF EXISTS auth_accounts_insert_own ON public.auth_accounts;
CREATE POLICY auth_accounts_insert_own ON public.auth_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS auth_accounts_update_own ON public.auth_accounts;
CREATE POLICY auth_accounts_update_own ON public.auth_accounts
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS auth_accounts_select_own ON public.auth_accounts;
CREATE POLICY auth_accounts_select_own ON public.auth_accounts
  FOR SELECT USING (auth.uid() = user_id);

-- Also drop the old "all" policy if it exists (from migration_live_tracking)
DROP POLICY IF EXISTS auth_accounts_own ON public.auth_accounts;

-- ─────────────────────────────────────────────────────────────
-- 4. RESOLVE ACCOUNT BY EMAIL — security definer RPC
--    (lets login check role by email without RLS blocking it)
-- ─────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.resolve_auth_account_by_email(text);

CREATE OR REPLACE FUNCTION public.resolve_auth_account_by_email(p_email text)
RETURNS TABLE (
  user_id uuid,
  email text,
  role text,
  provider text,
  has_password boolean,
  display_name text,
  bus_code text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    user_id,
    email,
    role,
    provider,
    has_password,
    display_name,
    bus_code
  FROM public.auth_accounts
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_auth_account_by_email(text) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 5. LOCK ROLE TRIGGER — prevents one email from having
--    two different roles (e.g. same Gmail as user AND driver)
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.lock_auth_account_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_role text;
BEGIN
  SELECT role
    INTO existing_role
  FROM public.auth_accounts
  WHERE lower(email) = lower(NEW.email)
    AND user_id <> NEW.user_id
  LIMIT 1;

  IF existing_role IS NOT NULL AND existing_role <> NEW.role THEN
    RAISE EXCEPTION 'This email is already registered as %', existing_role;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.role := COALESCE(OLD.role, NEW.role);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auth_accounts_lock_role ON public.auth_accounts;
CREATE TRIGGER auth_accounts_lock_role
BEFORE INSERT OR UPDATE ON public.auth_accounts
FOR EACH ROW EXECUTE FUNCTION public.lock_auth_account_role();

-- ─────────────────────────────────────────────────────────────
-- 6. DRIVERS RLS — let drivers manage their own rows
--    AND let all authenticated users read driver locations
-- ─────────────────────────────────────────────────────────────

-- Allow authenticated users to read all drivers (for live tracking)
DROP POLICY IF EXISTS drivers_select_all_authenticated ON public.drivers;
CREATE POLICY drivers_select_all_authenticated ON public.drivers
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow anon users to read drivers too (public tracking page)
DROP POLICY IF EXISTS drivers_select_anon ON public.drivers;
CREATE POLICY drivers_select_anon ON public.drivers
  FOR SELECT TO anon USING (true);

-- Allow a driver to INSERT their own row (registration)
DROP POLICY IF EXISTS drivers_insert_own ON public.drivers;
CREATE POLICY drivers_insert_own ON public.drivers
  FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() = created_by);

-- Allow a driver to UPDATE their own row (trip status, GPS, profile)
DROP POLICY IF EXISTS drivers_update_own ON public.drivers;
CREATE POLICY drivers_update_own ON public.drivers
  FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = created_by);

-- ─────────────────────────────────────────────────────────────
-- 7. PUBLIC_DRIVERS VIEW — for the commuter live tracking page
-- ─────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS public_drivers;
CREATE VIEW public_drivers AS
SELECT id, user_id, display_name, bus_code, bus_number, latitude, longitude, last_seen, trip_status
FROM public.drivers;

GRANT SELECT ON public_drivers TO anon;
GRANT SELECT ON public_drivers TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 8. REALTIME — enable for drivers table (live GPS updates)
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.drivers;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 9. TRIPS RLS & COLUMNS
-- ─────────────────────────────────────────────────────────────

-- Ensure user_id column exists on public.trips table
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Enable RLS on trips table
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

-- Drop any conflicting or restrictive policies
DROP POLICY IF EXISTS trips_manage_driver_or_admin ON public.trips;
DROP POLICY IF EXISTS trips_insert_own ON public.trips;
DROP POLICY IF EXISTS trips_update_own ON public.trips;
DROP POLICY IF EXISTS trips_select_own ON public.trips;
DROP POLICY IF EXISTS trips_select_public_or_member ON public.trips;
DROP POLICY IF EXISTS trips_select_all ON public.trips;

-- Create direct user_id based policies for public.trips
CREATE POLICY trips_insert_own ON public.trips
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY trips_update_own ON public.trips
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY trips_select_all ON public.trips
  FOR SELECT USING (true);

-- ─────────────────────────────────────────────────────────────
-- DONE! You can now register/login as User or Driver.
-- ─────────────────────────────────────────────────────────────
