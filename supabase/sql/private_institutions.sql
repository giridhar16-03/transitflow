-- Private Institutions Schema Additions

-- 1. Create institutions table
CREATE TABLE IF NOT EXISTS institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES auth.users(id),
  name text NOT NULL,
  institution_code text UNIQUE NOT NULL,
  access_code text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 2. Create routes table
CREATE TABLE IF NOT EXISTS routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES institutions(id) ON DELETE CASCADE,
  route_name text NOT NULL,
  start_time text,
  stops jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 3. Modify drivers table
ALTER TABLE drivers 
ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES institutions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS route_id uuid REFERENCES routes(id) ON DELETE SET NULL;

-- 4. Update public_drivers view to exclude private drivers
DROP VIEW IF EXISTS public_drivers;

CREATE VIEW public_drivers AS
SELECT id, display_name, bus_code, bus_number, latitude, longitude, last_seen
FROM drivers
WHERE institution_id IS NULL;

-- 5. Create RPC function for secure access to private buses
-- This takes the institution_code and access_code, verifies them, and returns driver locations
CREATE OR REPLACE FUNCTION get_private_buses(p_inst_code text, p_access_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER -- Run as DB owner to bypass RLS if any
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

  -- Fetch drivers and their routes for this institution
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
  WHERE d.institution_id = v_inst_id;

  RETURN v_result;
END;
$$;
