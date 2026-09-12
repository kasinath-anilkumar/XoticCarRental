-- 0002_fleet.sql — the cars, their photography and their rate cards.
--
-- Rates are whole rupees (integer): every price in the design is a round
-- figure and quotes round to the rupee anyway, so there is no paise to lose.

create table public.cars (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  year          integer not null check (year between 1990 and 2100),
  car_type_id   uuid not null references public.car_types (id),
  seats         integer not null check (seats > 0),
  transmission  text not null default 'Automatic',
  fuel          text not null default 'Diesel',
  -- The city whose multiplier prices this car.
  home_city_id  uuid not null references public.cities (id),
  rating        numeric(2, 1) not null default 4.5 check (rating between 0 and 5),
  badge         text not null default '',

  -- Rate card. The three package rates are named for the packages.rate_key
  -- values that select them.
  rate_8h       integer not null check (rate_8h >= 0),
  rate_12h      integer not null check (rate_12h >= 0),
  rate_full     integer not null check (rate_full >= 0),
  extra_km_rate integer not null check (extra_km_rate >= 0),
  extra_hr_rate integer not null check (extra_hr_rate >= 0),
  -- The driver's daily food-and-stay allowance.
  bata          integer not null check (bata >= 0),
  night_charge  integer not null check (night_charge >= 0),

  is_active     boolean not null default true,
  sort          integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index cars_active_sort_idx on public.cars (is_active, sort);
create index cars_home_city_idx on public.cars (home_city_id);
create index cars_type_idx on public.cars (car_type_id);

create trigger cars_touch
  before update on public.cars
  for each row execute function public.touch_updated_at();

-- One hero shot plus the interior / rear / detail thumbnails the detail page
-- lays out under the gallery.
create table public.car_images (
  id         uuid primary key default gen_random_uuid(),
  car_id     uuid not null references public.cars (id) on delete cascade,
  url        text not null,
  kind       text not null default 'hero' check (kind in ('hero', 'interior', 'rear', 'detail')),
  alt        text,
  sort       integer not null default 0,
  created_at timestamptz not null default now()
);

create index car_images_car_idx on public.car_images (car_id, sort);

-- Which occasions a car is curated for — drives the occasion page's fleet
-- grid and the Browse page's occasion filter.
create table public.car_occasions (
  car_id      uuid not null references public.cars (id) on delete cascade,
  occasion_id uuid not null references public.occasions (id) on delete cascade,
  primary key (car_id, occasion_id)
);

create index car_occasions_occasion_idx on public.car_occasions (occasion_id);
