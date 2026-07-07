create table if not exists public.auth_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  role text not null check (role in ('public-user', 'public-driver', 'private')),
  provider text not null check (provider in ('password', 'google')),
  has_password boolean not null default false,
  display_name text,
  bus_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.auth_accounts enable row level security;

create policy "auth_accounts_insert_own" on public.auth_accounts
  for insert with check (auth.uid() = user_id);

create policy "auth_accounts_update_own" on public.auth_accounts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "auth_accounts_select_own" on public.auth_accounts
  for select using (auth.uid() = user_id);

create or replace function public.resolve_auth_account_by_email(p_email text)
returns table (
  user_id uuid,
  email text,
  role text,
  provider text,
  has_password boolean,
  display_name text,
  bus_code text
)
language sql
security definer
set search_path = public
as $$
  select
    user_id,
    email,
    role,
    provider,
    has_password,
    display_name,
    bus_code
  from public.auth_accounts
  where lower(email) = lower(trim(p_email))
  limit 1;
$$;

grant execute on function public.resolve_auth_account_by_email(text) to anon, authenticated;

create or replace function public.lock_auth_account_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_role text;
begin
  select role
    into existing_role
  from public.auth_accounts
  where lower(email) = lower(new.email)
    and user_id <> new.user_id
  limit 1;

  if existing_role is not null and existing_role <> new.role then
    raise exception 'This email is already registered as %', existing_role;
  end if;

  if tg_op = 'UPDATE' then
    new.role := coalesce(old.role, new.role);
  end if;

  return new;
end;
$$;

drop trigger if exists auth_accounts_lock_role on public.auth_accounts;
create trigger auth_accounts_lock_role
before insert or update on public.auth_accounts
for each row execute function public.lock_auth_account_role();