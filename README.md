# Xotic Car Rental

The latest engineering review, verification commands, deployment migrations and
remaining production requirements are documented in [AUDIT.md](AUDIT.md).
Development now records enquiries in `.data/store.json`; public production
requires Supabase. Use the audit guide for current behavior where older design
notes below differ.

Chauffeur-driven luxury car rental across India — a marketing site whose real job
is producing an itemised quote and handing it to WhatsApp.

Built from the Claude Design handoff in [`design/`](design/). Seven screens
(home, browse, car detail, price calculator, booking summary, occasion page,
city page) at desktop 1440 and mobile 390, rebuilt as one responsive Next.js app
with a Supabase backend and an admin panel.

```bash
npm install
npm run dev
```

The site runs immediately with no database — see **Running without Supabase**
below.

---

## What's where

```
app/                    Routes. Public pages, /admin, and the API routes.
components/             UI. CarCard, the calculator, the layout chrome.
lib/                    The domain: pricing, distance, the catalog, WhatsApp.
  pricing.ts              The quote engine. Pure, and pinned by pricing.test.ts.
  distance.ts             Haversine × circuity factor, with published overrides.
  quote.ts                Wires catalog + distance + pricing into one quote.
  content.ts              Loads the catalog from Supabase, or from the seed.
  geo/                    Live place search and reverse geocoding. Server-only.
  route/                  Driving routes: the map's line and the quote's km.
  net/                    Cache, throttle, rate limit and fetch, shared by both.
backend/                Schema, migrations, seed. Its own package.json.
design/                 The original handoff bundle, kept for reference.
data/india-cities.json  Generated town index — the offline floor under the geocoder.
public/media/           Generated test photography. `node scripts/media.mjs`.
```

### The quote engine is the important part

`lib/pricing.ts` is a direct port of the prototype's `calc()`, and
`lib/pricing.test.ts` pins every branch of it with literal expected figures.
These are the numbers the business quotes customers — if a rule needs to change,
change it there and update the fixtures in the same commit.

```bash
npm test
```

The same engine runs in three places, so they cannot disagree: the calculator in
the browser, the booking summary on the server, and the enquiry API — which
**recomputes the quote from the trip parameters and ignores the totals the
browser posted**.

---

## Connecting Supabase

Create a project at supabase.com, then:

1. `cp .env.local.example .env.local` and fill in the project URL, the anon key
   and the service-role key.
2. `cp backend/.env.local.example backend/.env.local` and set `SUPABASE_DB_URL`
   to the **Session pooler** URI (port 5432 — not the transaction pooler on
   6543; each migration runs in one `BEGIN`/`COMMIT`).
3. Apply the schema and load the content:

   ```bash
   npm run migrate
   npm run seed
   ```

4. Create your login under **Authentication → Users**, then grant it admin:

   ```sql
   insert into public.staff (user_id, email, is_admin)
   values ('<the-user-uuid>', '<your-email>', true);
   ```

5. Restart `npm run dev` and sign in at `/admin`.

**The Supabase CLI is not used.** Windows Smart App Control blocks its unsigned
binary on this machine, so `backend/scripts/migrate.js` applies
`backend/supabase/migrations/*.sql` over a direct Postgres connection instead —
each file once, in filename order, in its own transaction, tracked in
`_migrations.applied`. Re-running is safe. `npm run migrate -- --baseline` marks
every file applied without executing it, for a database built by hand.

`npm run seed` is idempotent (upsert by slug). `npm run seed -- --reset` clears
content first — it never touches enquiries or staff.

### Running without Supabase

With no credentials configured, `lib/content.ts` falls back to
`backend/seed-data.js`. Every public page renders, the calculator works, and the
build succeeds — but nothing is editable and enquiries are not recorded. `/admin`
redirects to `/admin/setup`, which explains what is missing. The fallback also
catches a database outage in production, so a Supabase incident degrades the site
to stale-but-correct content rather than taking it down.

---

## Distance

A trip is **routed** (`lib/route`): the calculator asks a router for the drive
through its stops and gets back the road geometry and a distance per leg. The
map draws the first and the quote bills the second, so the line a customer is
looking at and the kilometres they are charged for are the same journey.

Three sources, in this order:

1. a **published route fare** — somebody measured it, the city page prints it,
   and it wins everywhere so the two pages can never disagree
2. the **router** — real roads, for every trip that has no published fare
3. **haversine × circuity factor** (default 1.25, editable in admin) — the old
   estimate, now only the fallback for when there is no router to ask

The default router is OSRM over OpenStreetMap, which needs no key;
`ROUTER_PROVIDER=openrouteservice` and a key moves to an account with an SLA,
and `ROUTER_URL` points at your own OSRM. See `.env.local.example`.

Routing happens in three places and they agree because they share one cache:
the calculator (through `/api/directions`), the booking summary, and the
enquiry route that recomputes a quote before recording it. Indicative prices —
the city fare tables, the fleet cards, the home page preview — stay on the
published-or-estimated numbers rather than routing at build time.

If the router says nothing, every one of them falls back to the estimate, which
is what the whole site quoted before there was a router.

Coordinates for a place come from a **live geocoder** (`lib/geo`). Nothing is
predefined: there is no curated list in front of it and no static town list
mixed into its results, because a fixed list answered "Kochi" well and
"Komalapuram" not at all.

The bundled `data/india-cities.json` — the `all-the-cities` GeoNames dataset,
trimmed by `npm --prefix backend run geocode` — is kept strictly as a
**fallback**, used only when the geocoder cannot answer at all. It never
dilutes a live result, since it holds only towns the geocoder already knows.

The default provider is **Photon**, Komoot's OpenStreetMap search. It needs no
key and no account, and unlike Nominatim it indexes prefixes, which is the
whole feature for a search box: "Vadakkench" finds Vadakkenchery. Any provider
`node-geocoder` speaks (Nominatim, LocationIQ, OpenCage, Google, Mapbox, HERE…)
is a `GEOCODER_PROVIDER` and a key away; see `.env.local.example`. Repeat
queries are cached in memory, identical queries in flight share one upstream
call, calls are spaced to the provider's rate limit, and every failure degrades
to the bundled index rather than to an error — a geocoding incident must not
take the booking flow down.

### A trip can start anywhere

A pickup or drop is a **place token**, not a location id (`lib/places.ts`):

```
kochi-marine              one of our curated pickup points, by slug
@10.0889,77.0595,Munnar   anywhere else in India, by coordinates
```

Both price identically — distance is haversine over coordinates either way.
The difference is that only a curated point can match a **published road
distance**, because overrides are keyed by slug. A free place always falls
through to the estimate rather than borrowing someone else's number.

The combobox (`components/ui/LocationCombobox.tsx`, built on `downshift`)
offers exactly two things: **Use my current location**, and whatever
`/api/places` finds. Our own pickup points are still valid values — a city
page's fare table links to them, and an old quote's link still resolves to the
right name — they are simply not suggested.

Current location is on every location field: pickup, drop, return drop, and the
admin's new-pickup-point form. The browser's position is reverse geocoded
through `/api/places/reverse` for a name, but priced from **the visitor's own
coordinates**, not the town centre the name belongs to — so a failed lookup
costs a nice label, not the pickup. Once a position is known, every other field
on the page ranks its suggestions near it.

An empty list distinguishes its two causes. "Nothing on the map matches this"
and "we could not ask" are different sentences, because telling somebody their
village does not exist when the truth is that the geocoder timed out is the
worse of the two mistakes.

The name comes last in the token so it may contain commas. Tokens travel in the
URL, so a quote to an obscure town is still a shareable link.

### Every image slot is filled, and none of them are photographs

`components/ui/Media.tsx` renders a dark well wherever a photograph has not
been uploaded — right in production, useless for judging a layout. You cannot
tell whether a price still reads over a car, or whether the fleet grid holds
together, when every card is the same empty rectangle.

So `node scripts/media.mjs` writes one: a studio-lit side profile for each car
(with an interior, a rear three-quarter and a wheel for its gallery), a skyline
for each city, a motif for each occasion. They are plainly drawings and nobody
should ship them, but they carry the tonal range and the subject placement of
the real thing, so a layout can be judged against something.

The generator is dependency-free — a PNG is a zlib stream in four chunks, and
the shapes are rasterised with 3×3 supersampling — and deterministic, so a diff
of `public/media` is a diff of the script rather than of a random seed. The
plates are wired in through the **seed** catalog only (`lib/content.ts`), by
slug convention. Configure Supabase and the images come from the database
instead, as they should.

### The map is real

`components/map/RouteMap.tsx` draws the trip on OpenStreetMap tiles via
**Leaflet**, loaded browser-only, following the roads the router returned. Until
that answer arrives — and if it never does — it falls back to a dashed straight
line, which is honest about being a direction rather than a road. It replaced a schematic SVG that projected
invented coordinates.

Leaflet is driven directly rather than through `react-leaflet`: the wrapper is
published under the Hippocratic licence, which is not OSI-approved and is a poor
fit for a commercial site. Leaflet itself is BSD-2. Doing without the wrapper
costs one `useEffect`.

The line between stops is a straight geodesic, not a driven route — there is no
routing service, which is the same reason the distance is an estimate. It shows
*where* the trip goes, not which roads it takes. OSM's attribution control is
required by their tile policy and is deliberately left visible.

---

## Brand and design system

The palette is the logo's: **a white page, black ink, bright orange accent** —
with the header, heroes, footer and feature bands dropping to the logo's own
black plate.

| | | |
|---|---|---|
| `--color-accent-solid` | `#ff7a00` | the brand orange at full strength — solid fills, and everything on black |
| `--color-accent` | `#e86e00` | the same hue, taken to exactly 3:1 on white so an icon or a border is visible |
| `--color-accent-text` | `#b15300` | the accent as *running text* — see below |
| `--color-bg` | `#fafafa` | the page |
| `--color-surface` | `#ffffff` | cards |
| `--color-text` | `#0f0f0f` | ink |

The greys carry **no hue at all**. They used to hold a whisper of the accent,
which sounds tasteful and in practice laid a beige cast over every white on the
site. The orange does all the warming now, and only where it is used.

Bright orange on white is 2.5:1, which is below the 3:1 floor for a non-text
mark — so the light zone darkens the hue until it clears exactly that, and the
full brightness is kept for the two places it is unimpeachable: under black ink
on a solid fill (7.6:1) and anywhere on the black bands (8:1).

**Two zones.** `:root` is the light page; `.on-dark` is a black band. Marking an
element `on-dark` re-declares the same token names, so every component inside
works unchanged — a card reading `var(--color-surface)` simply resolves to the
dark surface. The ramps run the other way in each zone, because on a dark ground
a low step number means "lighter, more prominent" and on a light one it has to
mean "darker" for the same rule to keep its meaning. An element marked
`on-dark` must paint its own background.

**The accent has two forms.** `--color-accent` is the mark itself and reaches
only 3.2:1 on white — right for borders, icons and large type, not for a 14px
label. Anything setting the accent as running text uses `--color-accent-text`.
Text sitting *on* a solid orange fill uses `--color-accent-ink` (near-black:
white on the orange is only 3.4:1).

**The ramps are generated, not hand-picked.** `scripts/palette.mjs` holds the
OKLCH maths:

```bash
node scripts/palette.mjs            # the :root block, ready to paste
node scripts/palette.mjs --report   # OKLCH working + the full WCAG table
```

It reproduces each ramp step at the *same perceptual lightness* the design
system was built on, moving only hue and chroma onto the brand — so every
spacing, elevation and contrast relationship the layouts were verified against
still holds. Retune `BRAND_ORANGE` and re-run; don't edit a ramp step by hand.

Everything reads from tokens — `app/globals.css` `:root` is the only place a
colour is decided. Four values are necessarily duplicated because they cannot
resolve a CSS variable, and must be kept in step by hand:
`viewport.themeColor` in `app/layout.tsx`, the two fills in `app/icon.svg`,
`--color-bg-rgb` (the decimal channels of `--color-bg`, used to build every
translucent scrim), and `BRAND_ORANGE` in the generator.

Two colour families sit outside the brand on purpose: WhatsApp's green, because
it *is* the affordance, and the admin's confirmed/failed status tints, because a
booking's outcome must not read as orange.

Elevation has two idioms to match. The light zone casts a soft shadow; the dark
zone uses a **hairline ring**, because black on black shows nothing. Both are
`--shadow-sm/md/lg`, redefined inside `.on-dark`.

Styling is CSS Modules over those tokens, not Tailwind. The prototype expresses
everything as inline styles reading `var(--color-*)`, so keeping that structure
made the rebuild faithful and made this recolour a token change rather than a
rewrite.

The prototype ships two fixed widths; this is one responsive implementation.
Desktop is ≥1024px, the 390 frame is <768px. The patterns that must survive a
refactor: the sticky bottom action bars, the horizontal `.scroll-x` rails, and
the `CarCard` reflowing to its compact horizontal form below 768px — one DOM,
not two.

---

## What is deliberately absent

The site has no reviews, no ratings platform, no booking counts and no live
availability. Several patterns every competitor ships were therefore left out
rather than faked: testimonial walls, "X,000 weddings served" counters, star
ratings, driver profile cards, response-time badges, and scarcity of any kind.

For the same reason `Car.rating` no longer renders as a star and no longer
emits `aggregateRating` structured data — there is no review behind the number,
and asserting one to Google is not a thing to ship. The field is still in the
schema; if it is an internal fleet-condition grade, relabel it as one.

## Rendering

Home, both index pages, and every car, city and occasion page are prerendered
and revalidate hourly. Browse (filters in the URL), the calculator, the booking
summary and all of `/admin` are dynamic. `npm run build` prints the breakdown.

---

## Before launch

- [ ] **Set the real WhatsApp number** in `/admin/settings`. The seed carries the
      prototype's placeholder (`919876543210`), and every enquiry button on the
      site points at it. The admin overview warns while it is still in place.
- [ ] Replace `hello@xotic.example` and the phone number in the same screen.
- [ ] Upload car photography. The home banner is in
      (`public/brand/xotic_hero.png`); every other slot still renders a
      placeholder, so no screen is broken — but the fleet has no pictures yet.
      The banner is a 2.4 MB PNG served through Next's optimiser; re-export it
      as a JPEG or WebP to cut the source weight.
- [ ] **Supply the logo as an SVG.** `public/brand/logo-source.jpeg` is the
      artwork the palette was sampled from, but it is a JPEG with a car
      photograph baked into it, so it cannot be used as the header mark. The
      header currently draws a steering-wheel icon beside the word XOTIC in the
      accent. A flat SVG of the wordmark would replace it in
      `components/layout/SiteHeader.tsx`, and would also improve `app/icon.svg`,
      which is a simplified stand-in drawn from the logo's shapes.
- [ ] Set `NEXT_PUBLIC_SITE_URL` so canonical URLs, the sitemap and JSON-LD point
      at the real domain.
- [ ] Check the seeded rate card against what you actually charge. It is the
      prototype's data.

### One pricing decision to make

`days = ceil(hours / package hours)` means the **"Extra hours" line can never
fire**: time past the package always rolls into another whole package day. Three
hours over an 8hr/₹6,500 package costs a second ₹6,500, not 3 × ₹350 — while the
rate card on every car page advertises "Extra time · ₹350 / hr".

This is carried over from the prototype deliberately rather than silently
changed, because it moves real prices. `lib/pricing.test.ts` documents it. Decide
which behaviour you want; the change is a few lines in `computeQuote`.
