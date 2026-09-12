-- 0003_settings.sql — the single settings row.
--
-- The prototype hardcoded the WhatsApp number, GST rate and advance share in
-- its logic block. They belong in one editable place: a changed phone number
-- should not need a deploy.

create table public.site_settings (
  -- Singleton: the check constraint means only one row can ever exist.
  id              boolean primary key default true check (id),

  whatsapp_number text not null,          -- digits only, country code first
  phone_display   text not null,          -- as printed, e.g. "+91 98765 43210"
  email           text not null,

  gst_percent     numeric(5, 2) not null default 5.00 check (gst_percent >= 0),
  advance_percent numeric(5, 2) not null default 25.00 check (advance_percent between 0 and 100),

  -- Road distance ÷ straight-line distance. Haversine underestimates Indian
  -- road distance by roughly a quarter; see lib/distance.ts.
  circuity_factor numeric(4, 2) not null default 1.25 check (circuity_factor >= 1),

  inclusions      text[] not null default '{}',
  exclusions      text[] not null default '{}',
  -- [{ icon, title, body }] — the "Why Xotic" row.
  why_items       jsonb not null default '[]'::jsonb,

  updated_at      timestamptz not null default now()
);

create trigger site_settings_touch
  before update on public.site_settings
  for each row execute function public.touch_updated_at();
