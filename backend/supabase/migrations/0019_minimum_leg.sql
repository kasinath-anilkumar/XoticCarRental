-- Keep the former six-kilometre billing floor as an editable business setting.
update public.site_settings
set pricing_rules = jsonb_build_object('minimumLegKm', 6) || pricing_rules;

alter table public.site_settings alter column pricing_rules set default
  '{"minimumLegKm":6,"localSpeedKph":32,"outstationSpeedKph":52,"oneWayReturnPercent":35,"nightStartHour":22,"nightEndHour":6}'::jsonb;

alter table public.site_settings add constraint site_settings_minimum_leg_check check (
  case when pricing_rules ? 'minimumLegKm' and jsonb_typeof(pricing_rules->'minimumLegKm') = 'number'
  then (pricing_rules->>'minimumLegKm')::numeric between 0 and 100
  else false end
);
