-- 0005_auth.sql — who may use the admin panel.
--
-- There are no customer accounts. Auth exists only so staff can sign in to
-- /admin; a row here with is_admin = true is what grants that.

create table public.staff (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text,
  full_name  text,
  is_admin   boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger staff_touch
  before update on public.staff
  for each row execute function public.touch_updated_at();

-- Security definer so the policies in 0006 can call it without recursing back
-- through staff's own RLS. search_path is pinned so the function cannot be
-- redirected by a caller's search_path.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.staff s
    where s.user_id = auth.uid()
      and s.is_admin
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
