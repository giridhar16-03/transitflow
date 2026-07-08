-- Fix RLS policies for drivers table
-- Ensure user_id column exists
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Ensure drivers table has RLS enabled
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS drivers_insert_own ON public.drivers;
DROP POLICY IF EXISTS drivers_update_own ON public.drivers;

-- Recreate policies using only user_id
CREATE POLICY drivers_insert_own ON public.drivers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY drivers_update_own ON public.drivers
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
