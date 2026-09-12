-- 0006_rls.sql — row level security.
--
-- Shape of the rules:
--   * Content is world-readable (it is a public marketing site), but only the
--     active rows, so unpublishing a car really does hide it from the API.
--   * Every write goes through public.is_admin().
--   * Enquiries have NO anonymous policy at all. They are written by the
--     server route with the service role key, which bypasses RLS, so the
--     public API surface never exposes a way to read or forge a lead. This is
--     tighter than a public insert policy: quotes carry customer phone numbers.

-- Make sure the API roles can see the tables at all before RLS narrows them.
grant usage on schema public to anon, authenticated;
grant select on
  public.cities, public.locations, public.car_types, public.packages,
  public.occasions, public.occasion_includes, public.occasion_packages,
  public.city_routes, public.cars, public.car_images, public.car_occasions,
  public.site_settings
  to anon, authenticated;
grant select, insert, update, delete on
  public.cities, public.locations, public.car_types, public.packages,
  public.occasions, public.occasion_includes, public.occasion_packages,
  public.city_routes, public.cars, public.car_images, public.car_occasions,
  public.site_settings, public.enquiries, public.staff
  to authenticated;

alter table public.cities             enable row level security;
alter table public.locations          enable row level security;
alter table public.car_types          enable row level security;
alter table public.packages           enable row level security;
alter table public.occasions          enable row level security;
alter table public.occasion_includes  enable row level security;
alter table public.occasion_packages  enable row level security;
alter table public.city_routes        enable row level security;
alter table public.cars               enable row level security;
alter table public.car_images         enable row level security;
alter table public.car_occasions      enable row level security;
alter table public.site_settings      enable row level security;
alter table public.enquiries          enable row level security;
alter table public.staff              enable row level security;

-- ── public reads ──────────────────────────────────────────────────────────

create policy cities_read on public.cities
  for select to anon, authenticated using (is_active);

create policy locations_read on public.locations
  for select to anon, authenticated using (is_active);

create policy car_types_read on public.car_types
  for select to anon, authenticated using (true);

create policy packages_read on public.packages
  for select to anon, authenticated using (is_active);

create policy occasions_read on public.occasions
  for select to anon, authenticated using (is_active);

-- Children are reachable only through a parent that is already filtered.
create policy occasion_includes_read on public.occasion_includes
  for select to anon, authenticated using (
    exists (select 1 from public.occasions o where o.id = occasion_id and o.is_active)
  );

create policy occasion_packages_read on public.occasion_packages
  for select to anon, authenticated using (
    exists (select 1 from public.occasions o where o.id = occasion_id and o.is_active)
  );

create policy city_routes_read on public.city_routes
  for select to anon, authenticated using (is_active);

create policy cars_read on public.cars
  for select to anon, authenticated using (is_active);

create policy car_images_read on public.car_images
  for select to anon, authenticated using (
    exists (select 1 from public.cars c where c.id = car_id and c.is_active)
  );

create policy car_occasions_read on public.car_occasions
  for select to anon, authenticated using (
    exists (select 1 from public.cars c where c.id = car_id and c.is_active)
  );

create policy site_settings_read on public.site_settings
  for select to anon, authenticated using (true);

-- ── admin writes ──────────────────────────────────────────────────────────
-- One "for all" policy per table: read-everything (including inactive rows,
-- which admins must be able to see to republish them) plus full write.

create policy cities_admin on public.cities
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy locations_admin on public.locations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy car_types_admin on public.car_types
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy packages_admin on public.packages
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy occasions_admin on public.occasions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy occasion_includes_admin on public.occasion_includes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy occasion_packages_admin on public.occasion_packages
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy city_routes_admin on public.city_routes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy cars_admin on public.cars
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy car_images_admin on public.car_images
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy car_occasions_admin on public.car_occasions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy site_settings_admin on public.site_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ── enquiries — admin only ────────────────────────────────────────────────
-- No anon policy: inserts arrive from the server route under the service role.

create policy enquiries_admin on public.enquiries
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ── staff ─────────────────────────────────────────────────────────────────
-- Everyone signed in may read their own row (that is how the admin shell
-- decides whether to render). Only admins may read or change anyone else's.

create policy staff_read_self on public.staff
  for select to authenticated using (user_id = auth.uid());

create policy staff_admin on public.staff
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
