-- 0004_enquiries.sql — captured quotes.
--
-- Nothing is charged on the site; a booking is confirmed in a WhatsApp
-- conversation. This table is the lead record: the complete quote as the
-- customer saw it, stored the moment they hand off to WhatsApp, so the
-- operator can answer with the same numbers.
--
-- Totals are recomputed server-side before insert (app/api/enquiries/route.ts)
-- rather than trusted from the browser.

create table public.enquiries (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),

  -- Optional: the visitor may hand off without leaving details.
  customer_name       text,
  customer_phone      text,

  car_id              uuid references public.cars (id) on delete set null,
  package_id          uuid references public.packages (id) on delete set null,
  occasion_id         uuid references public.occasions (id) on delete set null,

  trip_type           text not null check (trip_type in ('local', 'oneway', 'round')),
  from_location_id    uuid references public.locations (id) on delete set null,
  to_location_id      uuid references public.locations (id) on delete set null,
  return_location_id  uuid references public.locations (id) on delete set null,

  pickup_date         date not null,
  pickup_time         time not null,
  halt_hours          numeric(4, 1) not null default 0,

  -- The computed trip.
  km                  integer not null,
  hours               numeric(5, 1) not null,
  days                integer not null,

  -- The itemised breakdown exactly as quoted: [{ label, note, amount }].
  -- Denormalised on purpose — a later rate change must not rewrite history.
  lines               jsonb not null default '[]'::jsonb,
  subtotal            numeric(12, 2) not null,
  gst                 numeric(12, 2) not null,
  total               numeric(12, 2) not null,
  advance             numeric(12, 2) not null,

  -- The message handed to WhatsApp, kept verbatim.
  wa_text             text not null default '',

  status              text not null default 'new'
                        check (status in ('new', 'quoted', 'confirmed', 'lost')),
  -- Which screen the handoff came from.
  source              text not null default 'summary',
  notes               text
);

create index enquiries_created_idx on public.enquiries (created_at desc);
create index enquiries_status_idx on public.enquiries (status, created_at desc);
