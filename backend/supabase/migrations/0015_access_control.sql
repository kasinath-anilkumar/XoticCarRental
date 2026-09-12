-- Later feature tables must retain the staff allowlist from 0006. Signing in
-- is not, by itself, permission to change a fleet, a price or uploaded photos.
drop policy if exists garages_admin_all on public.garages;
create policy garages_admin_all on public.garages
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- The current quote calculator uses garage coordinates as pricing inputs.
-- Its public catalogue uses the anonymous role, so active garages need a read
-- policy just like active vehicles. This is public data under this architecture.
drop policy if exists garages_public_read on public.garages;
create policy garages_public_read on public.garages
  for select to anon, authenticated using (is_active);

drop policy if exists seasons_admin_all on public.seasons;
create policy seasons_admin_all on public.seasons
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists car_service_cities_admin_all on public.car_service_cities;
create policy car_service_cities_admin_all on public.car_service_cities
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists car_service_cities_public_read on public.car_service_cities;
create policy car_service_cities_public_read on public.car_service_cities
  for select to anon, authenticated using (
    exists (select 1 from public.cars c where c.id = car_id and c.is_active)
  );

-- These grants were missing in the feature migrations, which otherwise relied
-- on project-specific Supabase default privileges.
grant select on public.garages, public.seasons, public.car_service_cities to anon;
grant select, insert, update, delete on public.garages, public.seasons, public.car_service_cities to authenticated;

drop policy if exists car_photos_staff_write on storage.objects;
create policy car_photos_staff_write on storage.objects
  for all to authenticated
  using (bucket_id = 'car-photos' and public.is_admin())
  with check (bucket_id = 'car-photos' and public.is_admin());
