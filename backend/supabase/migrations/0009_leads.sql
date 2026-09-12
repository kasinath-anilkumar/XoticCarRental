-- 0009_leads.sql — turning a captured quote into a managed lead.
--
-- §14/§15/§16 are one requirement wearing three hats: every enquiry gets a
-- reference the customer and the operator can both say out loud, a status that
-- covers what actually happens to a lead, an owner, and a date somebody is
-- meant to act on. The brief is blunt about why — "the current business problem
-- is enquiries being delayed or lost on WhatsApp".
--
-- §17 is here too: a vehicle's availability is a date range with a reason, not
-- a boolean, and a booked car must not be offered for an overlapping day.

-- ── the lead ────────────────────────────────────────────────────────────────

alter table public.enquiries
  -- XWC-260821-001: service prefix, date, and the day's sequence.
  add column if not exists lead_id       text,
  -- Where the CUSTOMER was, which is not where the car was wanted (§3).
  add column if not exists customer_place text,
  -- The itinerary as the customer entered it: [{ name, role }]. Denormalised
  -- for the same reason `lines` is — a later edit must not rewrite history.
  add column if not exists stops         jsonb not null default '[]'::jsonb,
  -- The dead-head kilometres inside `km`, so staff can see the split (§9).
  add column if not exists transfer_km   integer not null default 0,
  add column if not exists assigned_to   text,
  add column if not exists follow_up_on  date;

create unique index if not exists enquiries_lead_id_idx on public.enquiries (lead_id);
create index if not exists enquiries_follow_up_idx on public.enquiries (follow_up_on)
  where follow_up_on is not null;
create index if not exists enquiries_assigned_idx on public.enquiries (assigned_to);

-- The four statuses the site shipped with could not express "we called them"
-- or "they cancelled", which are the two things staff most need to record.
alter table public.enquiries drop constraint if exists enquiries_status_check;
alter table public.enquiries
  add constraint enquiries_status_check check (
    status in ('new', 'contacted', 'quoted', 'follow_up', 'confirmed', 'lost', 'cancelled')
  );

comment on column public.enquiries.lead_id is
  'Customer-facing reference, e.g. XWC-260821-001. Unique, generated on capture.';
comment on column public.enquiries.follow_up_on is
  'The date this lead is due a chase. Overdue rows head the dashboard.';

-- ── availability ────────────────────────────────────────────────────────────

create table if not exists public.car_availability (
  id          uuid primary key default gen_random_uuid(),
  car_id      uuid not null references public.cars (id) on delete cascade,
  -- What the vehicle is doing, not merely whether it is on the site.
  status      text not null check (status in ('booked', 'unavailable', 'maintenance', 'hold')),
  starts_on   date not null,
  ends_on     date not null,
  note        text,
  enquiry_id  uuid references public.enquiries (id) on delete set null,
  created_at  timestamptz not null default now(),

  constraint car_availability_range check (ends_on >= starts_on)
);

create index car_availability_lookup_idx
  on public.car_availability (car_id, starts_on, ends_on);

comment on table public.car_availability is
  'Date-bounded holds on a vehicle (§17). A car with a row covering a date is not offerable for it.';

alter table public.car_availability enable row level security;

create policy car_availability_admin_all on public.car_availability
  for all to authenticated using (true) with check (true);

-- The public site needs to know that a car is spoken for, but not why or for
-- whom: the read policy exposes the dates and the fact, never the note.
create policy car_availability_public_read on public.car_availability
  for select to anon using (true);
