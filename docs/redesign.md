# Xotic application redesign

The public site and staff workspace use a bright white canvas, white navigation and cards, charcoal text, orange booking actions, self-hosted Manrope headings and Inter body text. Prominent journey search, comparable vehicle cards and readable package prices support browsing and booking. The staff workspace has its own navigation and avoids customer navigation, floating contact buttons and public footers.

Customer and admin interfaces share a 3px corner radius. Cards, controls, badges, menus, map panels and calendar controls use the shared radius token. Connected edges and fullscreen panels retain their flush corners.

## References

The current marketplace direction follows a live desktop/mobile review on 13 September 2026 of [Revv](https://www.revv.co.in/) and [Zoomcar](https://www.zoomcar.com/). Revv groups rental plans into clear cards and presents vehicle specifications beside period-based prices. Zoomcar brings location/date search, vehicle categories and inventory together. Its mobile homepage currently opens with an app promotion. Xotic applies the useful search, comparison and information hierarchy patterns to its chauffeur service; booking remains available on the website.

Reference markdown and desktop/mobile screenshots are saved under `.firecrawl/revv-*` and `.firecrawl/zoomcar-*`. These are review artifacts; competitor branding, photographs, discounts, reviews and fleet claims are not application content.

The implemented changes include:

- A full-width animated hero, with pickup/date/package search immediately below it and a direct booking anchor.
- A compact fleet journey editor that preserves intermediate stops, final drop, customer current location, package and other filters; updates reset pagination once submitted.
- Vehicle cards with explicit home-city base rates, specifications and a clear details action. Availability is distinguished from an undated inventory count.
- Vehicle gallery and sticky booking panel together on desktop, with section links for rates, availability, inclusions and questions.
- A connected calculator roadmap with a sticky route map on the left on desktop. Mobile prioritizes route entry, package selection and the quote, with an expandable map. Booking summaries show the compact vehicle recap, then price and contact details.
- Lighter city/service discovery, compact information sections, consistent navigation and 3px corner tokens.

The original dark hero and its “Luxury cars. Extraordinary journeys.” headline were restored after the marketplace review. Small screens keep separate space for copy, the contained car animation and booking controls; landscape phones use two columns. The calendar opens in a viewport-positioned portal, clears persistent navigation/actions, and restores focus after selection or Escape. Category counts keep their hidden accessible text inside the rail, preventing document overflow. The compact mobile sorter retains its accessible name.

Hero restoration validation: production build, TypeScript, scoped lint and 23 focused unit tests passed. All 25 active desktop/mobile browser checks passed, with seven intentional viewport skips; these cover animation, native touch, resizing, fallback states, calendar placement, accessibility and pickup retention. Desktop/mobile homepage accessibility checks also passed after restoring the solid orange fleet button. Four visual reviews found no overflow or obscured controls. Review captures are in `.data/hero-restored-review`; final homepage captures are in `.data/hero-restored-final-results`.

The previous editorial direction also reviewed these primary business sites on 12 September 2026:

- [Blacklane](https://www.blacklane.com/en/): prominent journey inputs and clear service choices.
- [SIXT ride](https://www.sixt.com/ride/): route-first booking and vehicle-class comparison.
- [mph club](https://mphclub.com/): inventory-led discovery and direct quote actions.
- [Hype](https://hype.luxury/): large cinematic imagery and restrained navigation.

These informed hierarchy and interaction patterns. Competitor photographs, copy, customer counts, reviews and operational promises were not imported. Research downloads remain in the ignored `.firecrawl` directory.

## Coverage

- Home: animated showcase, journey search, featured collection, services, editorial story, destination discovery, booking steps, live package preview and progressively loaded fleet.
- Fleet and vehicle detail: larger image cards, clearer filters and pricing, interactive vehicle gallery, specifications, rate table and booking panel.
- Calculator and summary: an all-in-one planner with route, schedule, vehicle, package and map sections, receipt-style charges, itinerary and a shared customer enquiry form.
- Services and city pages: editorial introductions, readable content sections, local routes/rates, service enquiry and city discovery.
- Gallery, packages, about and contact: consistent headings, image layouts, clear actions, contact choices and enquiry forms.
- Navigation and system states: responsive menu, footer, mobile actions, loading, missing-page and error treatments.
- Admin: grouped navigation, responsive workspace, dashboard metrics and recent enquiries, searchable worklists, collapsible creation forms, clearer editors, staff login and error states.

## Performance and accessibility

The hero retains its bounded frame cache, on-demand loading and canvas renderer. Animation works on short phones and landscape screens, with responsive space for the copy, image and booking controls. Resizing keeps the player active. Reduced-motion and data-saving fallbacks remain static. The scroll sequence is shorter; it does not intercept wheel or touch events. Reveal effects animate only transform and opacity, run once and leave content readable without JavaScript. Image zoom effects respect reduced motion.

Existing server caching, bounded catalog reads, pagination, database-backed choices, lazy gallery loading and image optimization remain in place. The design adds no animation library. Scrollbar tracks are hidden globally while native scrolling and the reusable horizontal rail's arrow/keyboard controls remain available. Desktop filters, quotes, summary receipts and admin navigation use document scrolling. Bounded mobile panels and suggestion lists use edge cues; modal scroll regions also remain keyboard focusable.

Mobile navigation and filters use native modal dialogs with focus containment and restoration. Availability responses are invalidated when their dates change, so an earlier request cannot label a new date as available.

## Content and review

The current seeded fleet contains sample illustrations. The redesign renders the database image URLs; real vehicle images can be managed through the admin vehicle photo editor. Larger showcase layouts will benefit from those real photographs. The existing supplied hero sequence and brand image remain in use.

Browser review captures are under `.data/redesign-review` and `.data/content-redesign-review`; admin control captures are `.data/admin-design-desktop.png` and `.data/admin-design-mobile.png`. These are local review artifacts, not application assets.

Validation commands: `npm run build`, `npm run typecheck`, `npm test`, `npm run lint`, `npm run test:db`, and Chrome Playwright suites using `PLAYWRIGHT_CHANNEL=chrome`. Browser tests exercise actual public routes and authenticated-route redirects. Admin component tests use a separate fixture with mocked actions/options and the real CSS; they do not claim authenticated production writes or a production load test.

Initial editorial redesign validation: production build and TypeScript passed; 369 unit tests and 20 database/migration tests passed. That public browser run covered 84 executable desktop/mobile cases, with six intentional viewport-specific skips; initial failures were corrected and the affected cases rerun successfully. All 10 standalone admin browser cases passed. Populated summaries passed accessibility and retained-contact checks on both viewports without submitting an enquiry. Lint had no errors and retained one existing warning in `backend/scripts/create-admin.js`. Later refinements and their validation are recorded below.

## Fleet filter refinement — 13 September 2026

The fleet now has a grouped desktop filter panel and a mobile sheet with fixed actions. Both share searchable service-city and vehicle-type controls, passenger choices, a custom budget, travel dates and sorting. Location and vehicle-type options come from the published catalog; longer option lists expand in batches of eight. Applying a draft makes one navigation and resets pagination while retaining pickup, package and journey details. The vehicle-type rail and compact results sorter remain immediate shortcuts. Applied filters appear as labelled, removable chips.

Validation for this refinement: production build and TypeScript pass; 41 focused unit checks and 26 desktop/mobile browser tests pass, with two desktop skips for mobile-only cases. Browser coverage includes expanded-panel accessibility, invalid-budget focus, date ranges, location search, draft cancellation, browser Back, sorting, pickup preservation and pagination. Visual checks at 1440px, 390px and 320px found no horizontal page overflow. Captures are under `.data/filter-design-review`. Lint has no new warnings; the existing admin-script warning remains.

## Car detail pricing refinement — 13 September 2026

The starting-price panel now contains a compact package selector, its home-city base price, additional-charge disclosure and the two enquiry actions. It has no constrained height or internal scrolling and appears immediately after the gallery on mobile. On desktop it sticks below the header at every screen height; a card taller than the available space scrolls up enough to keep its booking actions reachable. Its offset adapts to content size without a scroll listener. Availability and chauffeur requirements have separate sections in the main content.

Responsive package cards replace the horizontally scrolling rate table. Selecting a package updates the booking panel and calculator links immediately without a request. Extra charges use wrapping definition rows; searchable city comparisons remain catalog-backed and show eight choices at a time. The comparison city and the booking estimate's home city are labelled separately.

Validation: production build and TypeScript pass; 123 focused pricing, journey, availability and incomplete-catalog unit checks pass. All 15 executable desktop/mobile browser checks pass, with one intentional mobile skip for the short-desktop case. They cover 1440×900, 1280×650 and 390×844 layouts, no nested scrolling, visible prices and actions, package synchronization, city-rate comparisons, accessibility and stale availability responses. Review screenshots are in `.data/car-pricing-review`. Lint has no new warnings.

Sticky-panel follow-up: removed the 800px viewport-height cutoff. Production build, TypeScript and scoped lint pass. All nine active pricing browser cases pass, with three mobile skips for desktop-only cases; these verify actual pinning at 1280×650 and 1440×900, reachable actions at 1280×480, mobile document flow, package synchronization and accessibility.

## Calculator and full vehicle journey — 13 September 2026

The calculator displays every planning section together, with section links and one complete quote in normal page flow. Its desktop layout puts route and schedule controls on the left and a large map on the right, with car/package choices and the quote below them. The garage distance breakdown follows the vehicle choices. Mobile follows route → map → vehicle → quote → distance, using the same inputs and quote. The mobile estimate bar links to that quote; the full receipt has no internal scroll area.

Before any stops are entered, the map shows the selected vehicle's base area without creating a passenger marker or requesting directions. The map still loads near the viewport, has a bounded height, and preserves native page scrolling. Cleared share links retain blank pickup and drop inputs. Map-layout validation passed the production build, TypeScript, scoped lint and 21 active browser cases, with five intentional viewport skips; layout and accessibility checks include 1440×900, 1280×650, 390×844 and 320×740. Current design captures are under `.data/calculator-map-review`.

Client directions and server quote recomputation now route the complete journey: garage → pickup → destination and other stops → customer drop → garage. Each consecutive leg has its own measured distance, including directional return travel. An explicit final drop is respected; a two-stop round trip adds a return to the pickup. Matching coordinates contribute zero distance. The calculator and booking summary display every leg and the total, distinguishing road routing from fallback estimates. Published distances and configured minimum billing rules still apply.

The existing per-car kilometre rate remains configurable in the fleet editor. Package base prices and included kilometre allowances are retained pending the owner's decision whether the new base fare should include an allowance or be added to a per-kilometre charge for every kilometre. A separate legacy one-way return percentage is no longer added when garage-return distance is already counted. This change requires no database migration.

Two-stop round trips keep two editable fields, labelled pickup and destination, while the map, quote, message and saved enquiry include the inferred final drop at pickup. Garage endpoints are distinguished from customer locations even when a customer location is named or sluggified as garage. Map popups derive roles from the itinerary and render place labels as text.

Directions remain bounded to 12 customer stops plus garage endpoints, with the existing cache, request cancellation and throttling. Invalid or incomplete provider responses are rejected before pricing or caching. Synthetic routing fixtures verify the Kochi/Alappuzha/Chennai example; their distances are test values, not real road measurements.

Validation: production build and TypeScript pass; all 446 unit tests pass. The public regression run passed 77 desktop/mobile browser cases with five intentional viewport-specific skips. After final route and map fixes, all 17 affected calculator/summary cases passed, including two new round-trip cases, with one intentional viewport skip. All 10 admin component browser cases also passed. Coverage includes complete vehicle routing, calculator section links, retained input, accessible summaries, hidden-scrollbar keyboard and wheel interaction, suggestion selection, mobile navigation and filters, carousels, availability races and page accessibility/overflow checks. Lint has no errors and retains the existing admin-script warning. Review captures are under `.data/calculator-route-review`.

## Revv and Zoomcar implementation validation — 13 September 2026

The final production build generated all 289 routes successfully, and TypeScript and all 446 unit tests passed. The full public Chrome run passed 136 cases with 22 intentional viewport-specific skips. Four failures were resolved: the mobile sort needed an accessible name, and scrolling tests needed to wait for native scroll completion or position controls clear of persistent bottom actions before measuring movement. All eight affected desktop/mobile checks passed against the final build, covering all 140 executable public cases across the full and focused runs. All 10 admin component browser cases also passed; these use fixtures and do not perform authenticated production writes. Lint reports no errors and three existing backend-script warnings.

Final visual captures and measurements are in `.data/marketplace-review`. All 13 reviewed page/viewport combinations returned 200 without JavaScript errors or horizontal document overflow. Calendar reviews include 320px and 390px screens; mobile filters retain focus and usable controls. Hero browser coverage includes forward/reverse frame progression, native touch, portrait/landscape resizing, visible animation on short screens, bounded downloads and reduced-motion/data-saving fallbacks. The final focused browser output is `.data/marketplace-final-results`; admin fixture output is `.data/marketplace-admin-results`.

## Mobile journey restructure — 13 September 2026

Phone layouts now prioritize vehicles, prices and enquiry actions. Typography, spacing and form controls are sized for 320px and 390px screens. The original animated hero remains, with a shorter mobile scroll track and direct access to journey search. Featured cars use a mobile carousel with arrows and a visible next-card preview. Desktop keeps its three-column showcase.

Fleet browsing begins with inventory and compact controls. Journey editing expands on demand; filters and sorting stay below the header throughout the results. Searches, filters and pagination focus the updated results while preserving the customer's route and selected package. Vehicle details put the gallery, starting price and booking package before secondary information. One fixed mobile action carries the selected car and price into the calculator. Rates and availability remain visible; supporting explanations, inclusions, questions and similar cars expand when needed. Desktop pricing keeps its existing sticky behavior, including short windows and oversized booking panels.

Mobile calculator order is now route and schedule → vehicle and package → quote → optional map → optional distance breakdown. Required fields stay visible; optional trip details retain their values when collapsed. Its persistent action focuses the first missing detail or continues to the booking summary. The summary puts the estimate and contact form before the itinerary, retains the full itemized charges, and focuses submission errors without clearing input. Desktop keeps the map to the right of route entry.

Service pages put enquiry before supporting content. Configured required questions remain visible; optional questions expand on demand and stay mounted, preserving answers on submission. Invalid collapsed fields reopen and receive focus. Desktop retains the original field order. City directories use compact rows, city pages prioritize their fleet, package listings paginate six services at a time, and gallery photos use two columns. Navigation, footer groups and secondary homepage sections take less vertical space. Mobile admin styles increase label/input sizes and touch targets and reduce unnecessary spacing.

Explicit section links reveal their target and move keyboard focus after navigation. Ordinary page scrolling and browser restoration stay native. Calculator query synchronization preserves initial fragments and does not interrupt typing. Location suggestion keyboard navigation scrolls both the menu and document so selected results remain visible above persistent actions. Hidden scrollbars retain keyboard, touch and arrow navigation. Existing quote calculations, catalog sources, request caching, pagination, lazy media and the 3px corner radius are retained.

Final 390px measurements use the same catalog, reduced motion and initially collapsed supporting sections:

| Page | Previous document height | Final document height | Reduction |
| --- | ---: | ---: | ---: |
| Home | 15,241px | 4,914px | 68% |
| Vehicle detail | 9,728px | 2,982px | 69% |
| Cities directory | 14,099px | 6,375px | 55% |
| Packages | 14,392px | 4,601px | 68% |
| Gallery | 6,703px | 2,658px | 60% |

The wedding enquiry form itself is 48–51% shorter at 390px and 320px with optional questions collapsed. These are layout measurements; conversion effects require analytics. Final captures and JSON measurements for 15 routes at both widths are in `.data/mobile-ux-review/final`. All 30 visits returned 200 with no runtime errors or horizontal document overflow. Additional populated booking and service form captures are under `.data/calculator-mobile-review` and `.data/mobile-ux-review/discovery`.

Validation: the final production build generated all 289 routes; TypeScript and all 446 unit tests passed. Lint has no errors or new warnings, retaining three existing backend-script warnings. The full public browser run passed 152 cases and identified three remaining failures; the final affected run passed all 83 active cases, including those corrections and two new carousel cases. Across the full and affected runs, all 157 executable public cases were verified, with 35 intentional viewport-specific skips in the complete suite. Coverage includes mobile priority, initial fragment focus, optional-field validation/retention, sticky controls, complete journey preservation, carousel navigation, native scrolling, hero resizing/touch, accessibility and generated-route responses. Browser tests used installed Chrome, including 320px/390px phones, landscape and short desktop windows. Final browser output is `.data/mobile-verified-results`.

All 10 final admin component browser cases passed with the real shared styles and mocked actions/options (`.data/mobile-admin-final-results`). Authenticated production admin writes and physical-device Safari behavior were not exercised. The mobile restructure makes no database or pricing-rule changes.

## Journey roadmap and white canvas — 13 September 2026

The calculator now places its map on the left on desktop, beside a connected route and schedule → car and package → quote roadmap. All planning sections remain available together. Numbered section links move focus to the relevant controls, highlight the current stage and show completed details. The map sticks below the header with a bounded height; short desktop windows keep it in normal flow. This replaces the earlier map-on-the-right layout described above.

On phones, the roadmap uses compact 44px touch targets. Pickup and drop remain near the top, followed by schedule, package choices and the quote. The map and distance breakdown expand on demand, and the persistent bottom action opens the next required field or booking summary. The booking summary uses the same roadmap navigation, and the How it works section presents connected booking steps. Direct section links wait for their destination to leave Next's hidden streaming container before attempting focus.

Public pages, navigation, cards, the footer and the staff workspace now use a plain bright white canvas. Borders and dark text distinguish sections, while orange actions and selected states remain visible. The original animated hero, media treatments, 3px corners, pricing rules, catalog sources and lazy map loading are retained.

Visual review at 320px, 390px, 1024px, 1280px and 1440px found no horizontal page overflow or calculator runtime errors. Screenshots and geometry are under `.data/roadmap-review`. All 14 public/admin page and viewport combinations checked under `.data/white-canvas-review` used white page backgrounds; four expanded-footer/admin-login accessibility checks found no violations.

Regression review also found an availability submission with a visible date but no request during initial page startup. Availability controls now wait for their client handlers to be ready before accepting input. The existing cancellation of outdated requests is retained.

Validation: the final production build generated all 289 routes, TypeScript and all 446 unit tests passed, and lint retained only the three existing backend-script warnings. The public regression run passed 161 cases and exposed the startup availability issue. After that fix, all 34 active affected browser cases passed, including two new startup checks, with 12 intentional viewport skips. Across the full and affected runs, all 164 executable public Chrome cases were verified; the complete suite has 36 intentional viewport skips. Final affected output is `.data/roadmap-complete-results`, with logs under `.data/roadmap-review`.

All 10 admin component browser cases passed using mocked actions/options and the real shared styles. Authenticated production admin writes and physical-device Safari behavior were not exercised. This visual update requires no database migration.
