-- 0007_enquiry_places.sql — record where a trip actually went.
--
-- A pickup or drop used to be one of the curated rows in `locations`, so an
-- enquiry could point at it with a foreign key. It no longer has to be: the
-- calculator now accepts anywhere in India, priced from its coordinates, so a
-- customer can ask for a car to a town we have never published.
--
-- The foreign keys stay — they are still the right thing for a served point,
-- and they keep the admin's joins working. These columns carry the NAME as the
-- customer chose it, for every enquiry, served or not. Storing both means the
-- lead is readable even when the location row is later renamed or removed.

alter table public.enquiries
  add column if not exists from_place   text,
  add column if not exists to_place     text,
  add column if not exists return_place text;

comment on column public.enquiries.from_place is
  'Pickup as the customer chose it. Set for every enquiry; from_location_id is set only when it was one of our own pickup points.';
comment on column public.enquiries.to_place is
  'Drop as the customer chose it.';
comment on column public.enquiries.return_place is
  'Return drop as the customer chose it, or null for a one-way drop.';
