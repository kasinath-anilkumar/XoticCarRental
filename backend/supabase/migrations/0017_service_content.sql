-- Business offerings, indicative prices and enquiry fields are editable data.
-- Existing content is imported separately with seed-services.js; no live edits
-- are overwritten when that importer is run again.
create table public.services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  definition jsonb not null check (jsonb_typeof(definition) = 'object'),
  name text generated always as (definition->>'name') stored not null,
  group_key text generated always as (definition->>'group') stored not null,
  occasion_slug text generated always as (definition->>'occasionSlug') stored not null,
  is_active boolean not null default false,
  sort integer not null default 0,
  updated_at timestamptz not null default now(),
  check (coalesce(definition->>'slug', '') = slug),
  check (length(name) between 1 and 120),
  check (group_key in ('occasions', 'business', 'travel')),
  check (coalesce(jsonb_typeof(definition->'fields'), '') = 'array'),
  check (coalesce(jsonb_typeof(definition->'packages'), '') = 'array'),
  check (coalesce(jsonb_typeof(definition->'includes'), '') = 'array')
);
create index services_published_sort_idx on public.services (is_active, sort, slug);
alter table public.services enable row level security;
grant select on public.services to anon, authenticated;
grant insert, update, delete on public.services to authenticated;
create policy services_public_read on public.services for select using (is_active);
create policy services_admin_all on public.services for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
