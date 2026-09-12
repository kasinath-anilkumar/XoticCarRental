-- Services (§2, §12).
--
-- The site now sells ten named services — wedding, photoshoot, corporate,
-- monthly chauffeur and the rest — while `occasions` remains the four-way
-- pricing dimension it always was. They are not the same thing: `vip-transfers`
-- and `leisure` have no row in occasions and never will, so the service a lead
-- came in on is recorded on the lead itself. The occasion link stays for the
-- handling charge it drives.
--
-- `details` holds what that service's own form asked, as label/value pairs. It
-- is jsonb rather than a column per question because the questions differ by
-- service and will be reworded as staff learn which ones earn their place; a
-- schema that needs a migration for every rewording stops being edited.

alter table public.enquiries
  add column if not exists service_slug text,
  add column if not exists service_name text,
  add column if not exists details jsonb not null default '[]'::jsonb;

-- Existing rows came in on an occasion, so the service is that occasion.
update public.enquiries e
set service_slug = o.slug,
    service_name = o.name
from public.occasions o
where e.occasion_id = o.id
  and e.service_slug is null;

-- A service enquiry has no route and often no time, so these cannot stay
-- mandatory. The trip_type check survives untouched: a check passes on NULL.
alter table public.enquiries alter column trip_type drop not null;
alter table public.enquiries alter column pickup_date drop not null;
alter table public.enquiries alter column pickup_time drop not null;

create index if not exists enquiries_service_idx on public.enquiries (service_slug);
