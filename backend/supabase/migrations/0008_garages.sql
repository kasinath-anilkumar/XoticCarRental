-- 0008_garages.sql — where each vehicle actually lives.
--
-- Requirement §9 makes the priced distance garage-to-garage:
--
--   vehicle garage → pickup → event(s) → final drop → vehicle garage
--
-- so a car's base is a pricing input, not a label. It is a table rather than
-- two columns on `cars` because §6 requires identical models in different
-- garages to be separate inventory units, and §18 requires staff to move a
-- vehicle between garages without a developer.
--
-- The garage is INTERNAL. §9: "Do not expose internal garage details unless
-- Xotic chooses to show them." Nothing renders `name` or the coordinates to a
-- visitor; the quote shows the transfer distance as one line, which is what a
-- customer needs in order to understand the total.

create table public.garages (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  -- Internal: "Kochi — Kaloor yard". Never rendered on the public site.
  name        text not null,
  city_id     uuid not null references public.cities (id),
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index garages_city_idx on public.garages (city_id);

alter table public.cars
  add column if not exists garage_id uuid references public.garages (id);

create index if not exists cars_garage_idx on public.cars (garage_id);

comment on table public.garages is
  'Vehicle bases. Internal — drives garage-to-garage pricing, never shown to customers.';
comment on column public.cars.garage_id is
  'Where this unit is based. Null falls back to the home city centre for pricing.';

-- Staff read and write; the public reads nothing here. RLS mirrors 0006.
alter table public.garages enable row level security;

create policy garages_admin_all on public.garages
  for all to authenticated using (true) with check (true);
