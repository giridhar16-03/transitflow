alter table public.drivers
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table public.trips
  add column if not exists user_id uuid references auth.users (id) on delete cascade,
  add column if not exists bus_number text,
  add column if not exists bus_code text,
  add column if not exists route_name text,
  add column if not exists driver_name text;

create unique index if not exists drivers_user_id_key on public.drivers (user_id);
create index if not exists drivers_bus_code_idx on public.drivers (bus_code);
create index if not exists trips_user_id_idx on public.trips (user_id);

drop policy if exists "trips_select_public_or_member" on public.trips;
create policy "trips_select_self_or_member" on public.trips
  for select using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.institutions i
      join public.institution_users iu on iu.institution_id = i.id
      where i.id = trips.institution_id
        and iu.user_id = auth.uid()
    )
  );

create policy "drivers_manage_self" on public.drivers
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "trips_manage_self" on public.trips
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());