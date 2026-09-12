-- 0011_car_photos.sql — vehicle photography, uploaded by staff.
--
-- §18 requires staff to upload photos without a developer. Until now the only
-- way a car got a picture was a row in `car_images` with a URL somebody had
-- pasted in, which in practice meant asking a developer to do it.
--
-- The bucket is public because the images are on public pages and a signed URL
-- per card would cost a round trip per image for no privacy at all — the
-- pictures are marketing. Writing is authenticated only.

insert into storage.buckets (id, name, public)
values ('car-photos', 'car-photos', true)
on conflict (id) do nothing;

-- Anyone may read a car photo; only signed-in staff may add or remove one.
drop policy if exists car_photos_public_read on storage.objects;
create policy car_photos_public_read on storage.objects
  for select to public
  using (bucket_id = 'car-photos');

drop policy if exists car_photos_staff_write on storage.objects;
create policy car_photos_staff_write on storage.objects
  for all to authenticated
  using (bucket_id = 'car-photos')
  with check (bucket_id = 'car-photos');

-- Alt text is not optional in practice (§24), but existing rows predate that,
-- so it stays nullable and the admin form is what insists.
comment on column public.car_images.alt is
  'Describes the photograph for screen readers and image search. Required by the admin form.';
