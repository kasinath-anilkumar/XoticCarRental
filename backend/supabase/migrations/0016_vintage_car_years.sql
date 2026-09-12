-- The catalogue includes a 1957 Chevrolet Bel Air. Keep a realistic bounded
-- model year while permitting the vintage vehicles the fleet already sells.
alter table public.cars drop constraint cars_year_check;
alter table public.cars
  add constraint cars_year_check check (year between 1900 and 2100);
