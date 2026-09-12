-- 0001_content.sql — cities, locations, packages, occasions and the named
-- routes the city pages publish fares for.
--
-- Everything a visitor reads lives in these tables so staff can edit it in the
-- admin panel; nothing here is hardcoded in the app.

-- Shared updated_at trigger, used by every table below that carries the column.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── cities ────────────────────────────────────────────────────────────────
-- `multiplier` scales every package base rate: Kochi 1.00, Mumbai 1.15.
create table public.cities (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  name            text not null,
  state           text not null,
  multiplier      numeric(4, 2) not null default 1.00 check (multiplier > 0),
  -- Marketing headline ("350 cars"), not live inventory.
  car_count       integer not null default 0 check (car_count >= 0),
  lat             double precision not null check (lat between -90 and 90),
  lng             double precision not null check (lng between -180 and 180),
  hero_image      text,
  seo_title       text,
  seo_description text,
  is_active       boolean not null default true,
  sort            integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index cities_active_sort_idx on public.cities (is_active, sort);

create trigger cities_touch
  before update on public.cities
  for each row execute function public.touch_updated_at();

-- ── locations ─────────────────────────────────────────────────────────────
-- Pickup and drop points. lat/lng drive every distance calculation; there is
-- no routing API, see lib/distance.ts.
create table public.locations (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  city_id    uuid not null references public.cities (id) on delete cascade,
  lat        double precision not null check (lat between -90 and 90),
  lng        double precision not null check (lng between -180 and 180),
  is_airport boolean not null default false,
  is_active  boolean not null default true,
  sort       integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index locations_city_idx on public.locations (city_id, sort);

create trigger locations_touch
  before update on public.locations
  for each row execute function public.touch_updated_at();

-- ── car types ─────────────────────────────────────────────────────────────
-- "Luxury sedan", "MUV", … — also the Browse page's "Car type" filter facet.
create table public.car_types (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  sort       integer not null default 0,
  created_at timestamptz not null default now()
);

-- ── packages ──────────────────────────────────────────────────────────────
-- The three hour/km bundles every quote is built from. `rate_key` names which
-- of a car's three rate columns this package draws from.
create table public.packages (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  label      text not null,
  hours      numeric(4, 1) not null check (hours > 0),
  km         integer not null check (km > 0),
  rate_key   text not null check (rate_key in ('rate_8h', 'rate_12h', 'rate_full')),
  sub        text not null default '',
  icon       text not null default 'ph-clock',
  is_active  boolean not null default true,
  sort       integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger packages_touch
  before update on public.packages
  for each row execute function public.touch_updated_at();

-- ── occasions ─────────────────────────────────────────────────────────────
-- Both a quote input (the surcharge) and a landing page (everything else).
create table public.occasions (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  icon          text not null default 'ph-star-four',
  tagline       text not null default '',
  surcharge     integer not null default 0 check (surcharge >= 0),
  -- The note printed beside the surcharge on the quote line.
  handling_note text not null default '',
  -- Landing page copy.
  kicker        text not null default '',
  title         text not null default '',
  blurb         text not null default '',
  h2            text not null default '',
  fleet_title   text not null default '',
  cta_title     text not null default '',
  note          text not null default '',
  hero_image    text,
  is_active     boolean not null default true,
  sort          integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger occasions_touch
  before update on public.occasions
  for each row execute function public.touch_updated_at();

create table public.occasion_includes (
  id          uuid primary key default gen_random_uuid(),
  occasion_id uuid not null references public.occasions (id) on delete cascade,
  title       text not null,
  detail      text not null default '',
  sort        integer not null default 0
);

create index occasion_includes_occasion_idx on public.occasion_includes (occasion_id, sort);

-- Indicative "from" prices shown as ready-made packages. Stored as text
-- because they are editorial figures, not computed quotes.
create table public.occasion_packages (
  id          uuid primary key default gen_random_uuid(),
  occasion_id uuid not null references public.occasions (id) on delete cascade,
  name        text not null,
  detail      text not null default '',
  price       text not null,
  unit        text not null default '',
  sort        integer not null default 0
);

create index occasion_packages_occasion_idx on public.occasion_packages (occasion_id, sort);

-- ── city routes ───────────────────────────────────────────────────────────
-- "Fares people ask for most" on each city page. `km_override` publishes the
-- exact road distance; without it the fare uses the haversine estimate.
create table public.city_routes (
  id               uuid primary key default gen_random_uuid(),
  city_id          uuid not null references public.cities (id) on delete cascade,
  from_location_id uuid not null references public.locations (id) on delete cascade,
  to_location_id   uuid not null references public.locations (id) on delete cascade,
  km_override      integer check (km_override is null or km_override > 0),
  is_active        boolean not null default true,
  sort             integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (city_id, from_location_id, to_location_id),
  check (from_location_id <> to_location_id)
);

create index city_routes_city_idx on public.city_routes (city_id, sort);

create trigger city_routes_touch
  before update on public.city_routes
  for each row execute function public.touch_updated_at();
