-- Enable Row Level Security and policies for drivers
alter table drivers enable row level security;

-- Allow authenticated users to insert a driver row with their own user_id
create policy drivers_insert_auth on drivers
  for insert
  with check (auth.role() = 'authenticated' and auth.uid() = user_id);

-- Allow authenticated users to update only rows that match their user_id
create policy drivers_update_own on drivers
  for update using (auth.role() = 'authenticated' and (auth.uid() = user_id))
  with check (auth.uid() = user_id);

-- Allow authenticated users to select their own row
create policy drivers_select_own on drivers
  for select using (auth.role() = 'authenticated' and (auth.uid() = user_id));

-- Note: we expose a `public_drivers` view for anonymous selects as needed.
grant select on public_drivers to public;