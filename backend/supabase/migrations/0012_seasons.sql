-- 0012_seasons.sql — peak-season rates and the charges Xotic may bill (§10).
--
-- Two things the pricing engine was asked for and did not have.
--
-- A SEASON is a recurring window written as MM-DD, not a pair of dates. The
-- wedding months are a time of year; storing them as 2026-11-01..2027-02-28
-- would mean somebody re-entering all of them every January, and forgetting
-- one December. A window whose end sorts before its start wraps the year end,
-- which is exactly what "November to February" is.
--
-- The CHARGES are settings rather than a table: there are three of them, they
-- are edited together, and each is a switch and a number. They ship inactive,
-- because the policy the site states today is that tolls, parking and permits
-- are paid at actuals — see site_settings.exclusions, which says so in words.
-- Turning one on and leaving that sentence in place would make the site
-- contradict itself, so the admin form says as much next to the switch.

create table public.seasons (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  -- MM-DD, inclusive at both ends.
  starts_on   text not null check (starts_on ~ '^\d{2}-\d{2}$'),
  ends_on     text not null check (ends_on ~ '^\d{2}-\d{2}$'),
  -- 1.0 is no change. Capped at 3 so a typo cannot triple a quote unnoticed.
  multiplier  numeric(4, 2) not null default 1.0 check (multiplier between 0.5 and 3.0),
  note        text not null default '',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger seasons_touch
  before update on public.seasons
  for each row execute function public.touch_updated_at();

comment on table public.seasons is
  'Recurring peak windows. The multiplier applies to the package base only.';

alter table public.site_settings
  add column if not exists charges jsonb not null default '[]'::jsonb;

comment on column public.site_settings.charges is
  'Permits, parking and tolls where Xotic bills them rather than passing them through at actuals (§10).';

-- Anyone may read a season — it is on the public quote. Only staff may write.
alter table public.seasons enable row level security;

create policy seasons_public_read on public.seasons
  for select to anon, authenticated using (is_active);

create policy seasons_admin_all on public.seasons
  for all to authenticated using (true) with check (true);

-- ── where a vehicle may be sent (§6) ──────────────────────────────────────
--
-- "Serviceable states/cities" per inventory unit. A join table rather than a
-- column, because it is a list and because the admin edits it as checkboxes.
--
-- No rows means no restriction. That is the honest default — most of the fleet
-- travels — and it is why adding this table changed nothing for the cars that
-- were already going anywhere.

create table public.car_service_cities (
  car_id  uuid not null references public.cars (id) on delete cascade,
  city_id uuid not null references public.cities (id) on delete cascade,
  primary key (car_id, city_id)
);

create index car_service_cities_city_idx on public.car_service_cities (city_id);

comment on table public.car_service_cities is
  'Cities a vehicle may be sent to. Empty for a car with no restriction.';

alter table public.car_service_cities enable row level security;

create policy car_service_cities_public_read on public.car_service_cities
  for select to anon, authenticated using (true);

create policy car_service_cities_admin_all on public.car_service_cities
  for all to authenticated using (true) with check (true);
