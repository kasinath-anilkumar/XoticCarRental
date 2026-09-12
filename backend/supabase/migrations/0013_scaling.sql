-- Bounded admin worklists and complete date-window availability reads.
create index if not exists enquiries_created_id_idx on public.enquiries (created_at desc, id desc);
create index if not exists enquiries_status_created_id_idx on public.enquiries (status, created_at desc, id desc);
create index if not exists enquiries_open_followup_idx on public.enquiries (follow_up_on, created_at desc, id desc)
  where status in ('new', 'contacted', 'quoted', 'follow_up');
create index if not exists car_availability_ends_idx on public.car_availability (ends_on, starts_on, id);
create index if not exists cars_active_sort_id_idx on public.cars (sort, id) where is_active;

-- RLS limits rows, not columns. The old anonymous policy exposed private notes
-- and linked enquiries; public callers use the filtered server route instead.
drop policy if exists car_availability_public_read on public.car_availability;
drop policy if exists car_availability_admin_all on public.car_availability;
revoke all on public.car_availability from anon;
grant select, insert, update, delete on public.car_availability to authenticated;
create policy car_availability_admin_all on public.car_availability
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- A per-service/day counter serializes concurrent allocations in PostgreSQL.
-- It replaces reading every lead ID and racing on MAX + 1 in route handlers.
create table if not exists public.lead_reference_counters (
  prefix text not null,
  business_day date not null,
  sequence bigint not null check (sequence > 0),
  primary key (prefix, business_day)
);
alter table public.lead_reference_counters enable row level security;
revoke all on public.lead_reference_counters from anon, authenticated;

-- Seed existing references once, including days with more than 999 enquiries.
insert into public.lead_reference_counters (prefix, business_day, sequence)
select split_part(lead_id, '-', 1),
       to_date(split_part(lead_id, '-', 2), 'YYMMDD'),
       max(split_part(lead_id, '-', 3)::bigint)
from public.enquiries
where lead_id ~ '^[A-Z]{2,8}-[0-9]{6}-[0-9]+$'
group by 1, 2
on conflict (prefix, business_day) do update
set sequence = greatest(lead_reference_counters.sequence, excluded.sequence);

create or replace function public.allocate_lead_reference(p_prefix text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_day date := (current_timestamp at time zone 'Asia/Kolkata')::date;
  v_sequence bigint;
begin
  if p_prefix !~ '^[A-Z]{2,8}$' then
    raise exception 'Invalid reference prefix';
  end if;
  insert into public.lead_reference_counters (prefix, business_day, sequence)
  values (p_prefix, v_day, 1)
  on conflict (prefix, business_day) do update
    set sequence = lead_reference_counters.sequence + 1
  returning sequence into v_sequence;
  return p_prefix || '-' || to_char(v_day, 'YYMMDD') || '-' ||
    lpad(v_sequence::text, greatest(3, length(v_sequence::text)), '0');
end;
$$;
revoke all on function public.allocate_lead_reference(text) from public, anon, authenticated;
grant execute on function public.allocate_lead_reference(text) to service_role;
