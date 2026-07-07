/**
 * SQL to run in the Supabase SQL editor to fix the RLS policies for drivers table.
 * 
 * Run this SQL in your Supabase Dashboard -> SQL Editor:
 * https://app.supabase.com/project/sqnexwoxccgjjrnwlzef/sql/new
 */

-- Drop the old policy that only allows drivers to see their own row
DROP POLICY IF EXISTS drivers_select_own ON drivers;

-- Allow any authenticated user to SELECT all driver rows
-- (needed for the public commuter tracking page to see all active buses)
CREATE POLICY drivers_select_all_authenticated ON drivers
  FOR SELECT USING (auth.role() = 'authenticated');

-- Also allow anonymous users (unauthenticated) to read the drivers table
-- (needed if the public page is accessed without logging in)
CREATE POLICY drivers_select_anon ON drivers
  FOR SELECT TO anon USING (true);
