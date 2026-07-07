-- Supabase schema for drivers and public view
create extension if not exists "pgcrypto";

-- drivers table: one row per driver (updated in-place)
create table if not exists drivers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique,
  driver_key_id text not null,
  display_name text,
  email text,
  bus_code text not null,
  bus_number text,
  age integer,
  driving_license_number text,
  secret_key uuid default gen_random_uuid(),
  latitude double precision,
  longitude double precision,
  last_seen timestamptz default now(),
  created_at timestamptz default now()
);

-- public view without secret_key or user identifiers
create or replace view public_drivers as
select id, display_name, bus_code, bus_number, latitude, longitude, last_seen
from drivers;

-- helpful indexes
create index if not exists idx_drivers_bus_code on drivers (bus_code);
create index if not exists idx_drivers_last_seen on drivers (last_seen);
create index if not exists idx_drivers_user_id on drivers (user_id);