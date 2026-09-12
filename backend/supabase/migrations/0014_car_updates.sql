-- A fleet edit is one unit: rate card, occasions and service restrictions.
-- Any invalid relation rolls back the entire edit instead of clearing links.
create or replace function public.save_car_details(
  p_car_id uuid,
  p_values jsonb,
  p_occasion_ids uuid[],
  p_service_city_ids uuid[]
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  incoming public.cars;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  -- Lock the parent so simultaneous edits cannot interleave child replacements.
  perform id from public.cars where id = p_car_id for update;
  if not found then
    raise exception 'Vehicle not found' using errcode = 'P0002';
  end if;
  select * into incoming from jsonb_populate_record(null::public.cars, p_values);

  update public.cars set
    name = incoming.name,
    year = incoming.year,
    seats = incoming.seats,
    transmission = incoming.transmission,
    fuel = incoming.fuel,
    car_type_id = incoming.car_type_id,
    home_city_id = incoming.home_city_id,
    garage_id = incoming.garage_id,
    rating = incoming.rating,
    badge = incoming.badge,
    rate_8h = incoming.rate_8h,
    rate_12h = incoming.rate_12h,
    rate_full = incoming.rate_full,
    extra_km_rate = incoming.extra_km_rate,
    extra_hr_rate = incoming.extra_hr_rate,
    bata = incoming.bata,
    night_charge = incoming.night_charge,
    is_active = incoming.is_active,
    sort = incoming.sort
  where id = p_car_id;

  delete from public.car_occasions where car_id = p_car_id;
  insert into public.car_occasions (car_id, occasion_id)
    select p_car_id, chosen from unnest(coalesce(p_occasion_ids, '{}'::uuid[])) as chosen;

  delete from public.car_service_cities where car_id = p_car_id;
  insert into public.car_service_cities (car_id, city_id)
    select p_car_id, chosen from unnest(coalesce(p_service_city_ids, '{}'::uuid[])) as chosen;
end;
$$;

revoke all on function public.save_car_details(uuid, jsonb, uuid[], uuid[]) from public, anon;
grant execute on function public.save_car_details(uuid, jsonb, uuid[], uuid[]) to authenticated;
