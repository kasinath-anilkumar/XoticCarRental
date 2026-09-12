# Business data and location sources

Published database records drive the live website. Source files under `backend/`
contain explicit preview/import data; they are used without a configured database
or when an operator deliberately runs a seed command. A configured database outage
does not substitute demo vehicles, locations, contact details or prices.

| Information | Source | Management |
| --- | --- | --- |
| Location search and coordinates | Existing geocoder integration through `/api/places` and `/api/admin/geocode` | Provider configuration; staff can correct map coordinates |
| Service coverage | Published `cities` records | Admin → Cities |
| Saved pickup points and vehicle bases | `locations` and `garages` | Admin → Locations / Garages |
| Vehicles, images and car types | Published fleet relations | Admin → Fleet |
| Service pages, indicative prices and enquiry questions | `services.definition` | Admin → Services |
| Vehicle package allowances | `packages` | Admin → Packages |
| Tax, deposits, charges and pricing assumptions | `site_settings` | Admin → Settings |
| Peak pricing | `seasons` | Admin → Seasons |
| Gallery categories and photos | Published vehicle types and `car_images` | Existing fleet photo management |

Location searches return real geocoder suggestions. Choosing a service city only
filters coverage; it does not invent a pickup address. A location field must retain
an explicitly selected result, and editing its text clears stale coordinates.
Service enquiry messages show the place name, while saved details also preserve
the selected token and coordinates.

Vehicle links preserve pickup, package and schedule parameters. A new trip starts
without an invented itinerary or pickup time. A return date is included in the
quote's rental duration and the availability check.

Admin reference controls request 20 choices at a time after interaction. Fleet,
city, garage, pickup-point, route and service worklists use database pagination.
Public service/package listings use 24-service pages. Public reads share a cache;
authenticated writes invalidate it. The public pricing engine still consumes a
cached catalog snapshot, fetched in bounded batches, because matching and route
pricing need related fleet data. This is not an unbounded live database query per
visitor, but a very large fleet may warrant moving matching into a database query.
Builds pre-render up to 100 vehicle, city and service detail pages each, and 256
service/city combinations. Other published detail pages render on demand, avoiding
a deployment that grows with every possible service/city combination.

The existing geo integration caches and coalesces requests, limits queues and
supports cancellation. The bundled geographic index is used during provider
failure, not to override an authoritative empty result. These limits are per
server instance; deployments with multiple instances need provider capacity or
shared quota management. The public Nominatim endpoint is not used for autocomplete.

## Existing installations

Apply pending migrations with `npm run migrate`. Import the former embedded
service content with `npm run seed:services`; this command inserts missing services
and preserves existing admin edits. The ordinary sample seed also includes services.
Do not use the complete sample seed as a content migration: it intentionally updates
the sample fleet and settings.

New enquiry references derive their prefix from the service slug: uppercase letters,
capped at eight, with `ENQ` when no letters remain. A one-letter prefix is padded
with `X`. For example, new wedding references use `WEDDING-YYMMDD-NNN`, and new
corporate references use `CORPORAT-YYMMDD-NNN`. Prefix collisions share the same
daily sequence; each enquiry retains its full service slug and name. Previously
issued references such as `WED-...` and `CORP-...` remain stored and readable exactly
as issued. No reference migration or renumbering is required.

Application enums, accessibility labels, layout constants and defensive request
limits remain in code. They are implementation rules, rather than editable business
records or preset customer locations.

## Verification

`npm test` covers business validation, geocoder behavior, booking parameters and
admin queries. `npm run test:db` runs migrations and permission checks in disposable
PostgreSQL. Browser tests run against a production build with installed Chrome:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm run build
npm run test:e2e
npx playwright test --config playwright.admin.config.ts
```

The standalone admin browser suite exercises the real controls with mocked API
responses. It does not bypass production authentication or create a staff account.
Database and route tests separately verify authorization and write boundaries.
