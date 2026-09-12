-- Preserve existing quote amounts while making operational assumptions editable.
alter table public.site_settings add column pricing_rules jsonb not null default
  '{"localSpeedKph":32,"outstationSpeedKph":52,"oneWayReturnPercent":35,"nightStartHour":22,"nightEndHour":6}'::jsonb;

alter table public.site_settings add constraint site_settings_pricing_rules_check check (
  case when jsonb_typeof(pricing_rules) = 'object'
    and pricing_rules ?& array['localSpeedKph', 'outstationSpeedKph', 'oneWayReturnPercent', 'nightStartHour', 'nightEndHour']
    and jsonb_typeof(pricing_rules->'localSpeedKph') = 'number'
    and jsonb_typeof(pricing_rules->'outstationSpeedKph') = 'number'
    and jsonb_typeof(pricing_rules->'oneWayReturnPercent') = 'number'
    and jsonb_typeof(pricing_rules->'nightStartHour') = 'number'
    and jsonb_typeof(pricing_rules->'nightEndHour') = 'number'
  then
    (pricing_rules->>'localSpeedKph')::numeric between 1 and 160
    and (pricing_rules->>'outstationSpeedKph')::numeric between 1 and 160
    and (pricing_rules->>'oneWayReturnPercent')::numeric between 0 and 100
    and (pricing_rules->>'nightStartHour')::numeric between 0 and 23
    and (pricing_rules->>'nightEndHour')::numeric between 0 and 23
    and trunc((pricing_rules->>'nightStartHour')::numeric) = (pricing_rules->>'nightStartHour')::numeric
    and trunc((pricing_rules->>'nightEndHour')::numeric) = (pricing_rules->>'nightEndHour')::numeric
    and (pricing_rules->>'nightStartHour')::numeric <> (pricing_rules->>'nightEndHour')::numeric
  else false end
);
