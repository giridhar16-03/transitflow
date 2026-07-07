create extension if not exists pgcrypto;

do $$
begin
  create type public.user_role as enum (
    'public_user',
    'driver',
    'private_institution_admin',
    'private_institution_user'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.trip_status as enum (
    'scheduled',
    'active',
    'completed'
  );
exception
  when duplicate_object then null;
end $$;

create sequence if not exists public.driver_key_seq start with 1 increment by 1;
create sequence if not exists public.private_driver_key_seq start with 1 increment by 1;
create sequence if not exists public.institution_code_seq start with 1001 increment by 1;

create or replace function public.next_driver_key_id()
returns text
language sql
as $$
  select 'DRV-' || lpad(nextval('public.driver_key_seq')::text, 6, '0');
$$;

create or replace function public.next_private_driver_key_id()
returns text
language sql
as $$
  select 'PDRV-' || lpad(nextval('public.private_driver_key_seq')::text, 6, '0');
$$;

create or replace function public.next_institution_code()
returns text
language sql
as $$
  select 'INST-' || lpad(nextval('public.institution_code_seq')::text, 4, '0');
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  role public.user_role not null,
  mobile text,
  mode text not null default 'public' check (mode in ('public', 'private')),
  institution_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  institution_code text not null unique default public.next_institution_code(),
  institution_name text not null,
  institution_type text not null,
  institution_password_hash text not null,
  address text,
  contact_person text,
  email text not null unique,
  phone_number text,
  owner_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institutions (id) on delete cascade,
  mode text not null default 'public' check (mode in ('public', 'private')),
  bus_number text not null,
  bus_code text not null,
  vehicle_number text not null,
  route_name text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  driver_key_id text not null unique default public.next_driver_key_id(),
  private_driver_key_id text unique,
  institution_id uuid references public.institutions (id) on delete cascade,
  name text not null,
  age integer not null,
  mobile text,
  email text not null unique,
  bus_number text not null,
  bus_code text not null,
  vehicle_number text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institutions (id) on delete cascade,
  public_mode boolean not null default true,
  route_name text not null,
  start_location text not null,
  end_location text not null,
  polyline text,
  scenic_score integer not null default 0,
  eta_minutes integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institutions (id) on delete cascade,
  driver_key_id text not null references public.drivers (driver_key_id) on delete cascade,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  route_id uuid references public.routes (id) on delete set null,
  status public.trip_status not null default 'scheduled',
  start_time timestamptz,
  end_time timestamptz,
  last_latitude numeric(10,6),
  last_longitude numeric(10,6),
  created_at timestamptz not null default now()
);

create table if not exists public.live_locations (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institutions (id) on delete cascade,
  driver_key_id text not null references public.drivers (driver_key_id) on delete cascade,
  trip_id uuid references public.trips (id) on delete cascade,
  bus_code text not null,
  latitude numeric(10,6) not null,
  longitude numeric(10,6) not null,
  speed_kmh numeric(5,2),
  heading numeric(5,2),
  created_at timestamptz not null default now()
);

create table if not exists public.institution_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  institution_id uuid not null references public.institutions (id) on delete cascade,
  role text not null default 'private_institution_user',
  created_at timestamptz not null default now(),
  unique (user_id, institution_id)
);

alter table public.profiles enable row level security;
alter table public.institutions enable row level security;
alter table public.vehicles enable row level security;
alter table public.drivers enable row level security;
alter table public.routes enable row level security;
alter table public.trips enable row level security;
alter table public.live_locations enable row level security;
alter table public.institution_users enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

create policy "institutions_select_owner_or_member" on public.institutions
  for select using (
    auth.uid() = owner_user_id
    or exists (
      select 1 from public.institution_users iu
      where iu.user_id = auth.uid() and iu.institution_id = institutions.id
    )
  );

create policy "institutions_insert_authenticated" on public.institutions
  for insert with check (auth.uid() = owner_user_id);

create policy "vehicles_select_public_or_member" on public.vehicles
  for select using (
    mode = 'public'
    or exists (
      select 1
      from public.institutions i
      join public.institution_users iu on iu.institution_id = i.id
      where i.id = vehicles.institution_id
        and iu.user_id = auth.uid()
    )
  );

create policy "vehicles_manage_member" on public.vehicles
  for all using (
    exists (
      select 1
      from public.institutions i
      join public.institution_users iu on iu.institution_id = i.id
      where i.id = vehicles.institution_id
        and iu.user_id = auth.uid()
        and iu.role = 'private_institution_admin'
    )
  ) with check (
    exists (
      select 1
      from public.institutions i
      join public.institution_users iu on iu.institution_id = i.id
      where i.id = vehicles.institution_id
        and iu.user_id = auth.uid()
        and iu.role = 'private_institution_admin'
    )
  );

create policy "drivers_select_public_or_member" on public.drivers
  for select using (
    institution_id is null
    or exists (
      select 1
      from public.institutions i
      join public.institution_users iu on iu.institution_id = i.id
      where i.id = drivers.institution_id
        and iu.user_id = auth.uid()
    )
  );

create policy "drivers_manage_admin" on public.drivers
  for all using (
    exists (
      select 1
      from public.institutions i
      join public.institution_users iu on iu.institution_id = i.id
      where i.id = drivers.institution_id
        and iu.user_id = auth.uid()
        and iu.role = 'private_institution_admin'
    )
  ) with check (
    exists (
      select 1
      from public.institutions i
      join public.institution_users iu on iu.institution_id = i.id
      where i.id = drivers.institution_id
        and iu.user_id = auth.uid()
        and iu.role = 'private_institution_admin'
    )
  );

create policy "routes_select_public_or_member" on public.routes
  for select using (
    public_mode = true
    or exists (
      select 1
      from public.institutions i
      join public.institution_users iu on iu.institution_id = i.id
      where i.id = routes.institution_id
        and iu.user_id = auth.uid()
    )
  );

create policy "routes_manage_admin" on public.routes
  for all using (
    exists (
      select 1
      from public.institutions i
      join public.institution_users iu on iu.institution_id = i.id
      where i.id = routes.institution_id
        and iu.user_id = auth.uid()
        and iu.role = 'private_institution_admin'
    )
  ) with check (
    exists (
      select 1
      from public.institutions i
      join public.institution_users iu on iu.institution_id = i.id
      where i.id = routes.institution_id
        and iu.user_id = auth.uid()
        and iu.role = 'private_institution_admin'
    )
  );

create policy "trips_select_public_or_member" on public.trips
  for select using (
    institution_id is null
    or exists (
      select 1
      from public.institutions i
      join public.institution_users iu on iu.institution_id = i.id
      where i.id = trips.institution_id
        and iu.user_id = auth.uid()
    )
  );

create policy "trips_manage_driver_or_admin" on public.trips
  for all using (
    exists (
      select 1 from public.drivers d where d.driver_key_id = trips.driver_key_id and d.created_by = auth.uid()
    )
    or exists (
      select 1
      from public.institutions i
      join public.institution_users iu on iu.institution_id = i.id
      where i.id = trips.institution_id
        and iu.user_id = auth.uid()
        and iu.role = 'private_institution_admin'
    )
  ) with check (
    exists (
      select 1 from public.drivers d where d.driver_key_id = trips.driver_key_id and d.created_by = auth.uid()
    )
    or exists (
      select 1
      from public.institutions i
      join public.institution_users iu on iu.institution_id = i.id
      where i.id = trips.institution_id
        and iu.user_id = auth.uid()
        and iu.role = 'private_institution_admin'
    )
  );

create policy "live_locations_select_public_or_member" on public.live_locations
  for select using (
    institution_id is null
    or exists (
      select 1
      from public.institutions i
      join public.institution_users iu on iu.institution_id = i.id
      where i.id = live_locations.institution_id
        and iu.user_id = auth.uid()
    )
  );

create policy "live_locations_insert_driver_or_admin" on public.live_locations
  for insert with check (
    exists (
      select 1 from public.drivers d where d.driver_key_id = live_locations.driver_key_id and d.created_by = auth.uid()
    )
    or exists (
      select 1
      from public.institutions i
      join public.institution_users iu on iu.institution_id = i.id
      where i.id = live_locations.institution_id
        and iu.user_id = auth.uid()
        and iu.role = 'private_institution_admin'
    )
  );

create policy "institution_users_select_own" on public.institution_users
  for select using (auth.uid() = user_id);

create policy "institution_users_manage_admin" on public.institution_users
  for all using (
    exists (
      select 1
      from public.institutions i
      where i.id = institution_users.institution_id
        and i.owner_user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1
      from public.institutions i
      where i.id = institution_users.institution_id
        and i.owner_user_id = auth.uid()
    )
  );

create index if not exists vehicles_bus_code_idx on public.vehicles (bus_code);
create index if not exists drivers_driver_key_idx on public.drivers (driver_key_id);
create index if not exists live_locations_driver_key_idx on public.live_locations (driver_key_id);
create index if not exists trips_driver_key_idx on public.trips (driver_key_id);
