alter table public.profiles
  add column if not exists email text;

update public.profiles p
set email = au.email
from auth.users au
where au.id = p.id
  and (p.email is null or p.email = '');

create or replace function public.resolve_login_account(p_email text)
returns table (
  user_id uuid,
  app_role text,
  profile_role text,
  display_name text,
  email text
)
language sql
security definer
set search_path = public, auth
as $$
  select
    au.id as user_id,
    case
      when p.role = 'driver' or d.user_id is not null then 'public-driver'
      when p.role = 'public_user' then 'public-user'
      when p.role in ('private_institution_admin', 'private_institution_user') then 'private'
      else null
    end as app_role,
    p.role as profile_role,
    coalesce(p.name, d.display_name, split_part(au.email, '@', 1)) as display_name,
    au.email
  from auth.users au
  left join public.profiles p on p.id = au.id
  left join public.drivers d on d.user_id = au.id
  where lower(au.email) = lower(trim(p_email))
  limit 1;
$$;

grant execute on function public.resolve_login_account(text) to anon, authenticated;