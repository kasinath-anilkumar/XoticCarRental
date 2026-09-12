# Project review and validation

Reviewed on 12 September 2026. Changes were made locally; no hosted database was migrated and no WhatsApp messages were sent.

## Improvements

- Fleet browsing shows 12 cars per page, preserves URL filters, and resets the page when filters change. Admin enquiries and availability fetch 25 rows per page from PostgreSQL, including filtered database totals.
- Anonymous public catalog reads use a shared five-minute Next.js cache. Staff cookies never enter it; successful admin edits invalidate its tag. Cursor batches prevent database row limits from silently truncating catalogs or availability results. Mobile filters receive only their required metadata.
- Calendars and gallery dialogs load on demand; maps wait until near the viewport. Gallery photos render in batches of 12, with lazy images. Missing seed photography uses placeholders.
- Enquiries validate dates, times, phones, numeric values, enums, origins and body sizes before expensive work. In-memory request limits now have bounded memory. The server recomputes prices, checks availability for the entire trip, and rejects a changed quote.
- The calculator and APIs share a 12-stop itinerary limit. Incomplete URL itineraries preserve their empty stops. Configured database outages, including partial credentials, stop live pricing and submissions instead of using demo rates or placeholder WhatsApp details.
- Lead references are allocated atomically in PostgreSQL, including sequences beyond 999. Car details and related records save in one transaction. Local demo storage serializes writes and refuses to overwrite corrupt data.
- Database policies now restrict feature and storage writes to staff admins, and prevent anonymous access to private availability notes and enquiry references.
- Forms distinguish a saved enquiry from an unsaved WhatsApp handoff, prevent duplicate submissions, and handle request timeouts. Dialogs contain keyboard focus and restore it when closed. Added loading, error, and 404 pages, a skip link, and reduced-motion support; repaired reported contrast failures and missing icons.
- Patched Next.js and Vitest dependencies; the install audit reports zero vulnerabilities.

## Reproduce the checks

Final results: **191 unit/API tests**, **7 PostgreSQL tests**, and **33 Playwright checks** passed. Three Playwright cases are intentionally skipped (desktop has no mobile menu; generated-route/admin HTTP checks run once). The browser suite checked all **275 generated public routes**, 11 local admin screens, and nine core pages for automated WCAG violations and horizontal overflow at desktop/mobile sizes. Production build, lint and TypeScript checks passed. Desktop/mobile screenshots are in the gitignored `test-results/` directory and the interactive report is in `playwright-report/index.html`.

The restricted Windows test environment required stopping the completed test server explicitly during Playwright teardown; test assertions and the runner's final exit status passed. Live router requests were unavailable in this environment, so this run exercised their estimate fallback. Production routing still needs a staging check with the chosen provider.

```sh
npm ci
npm --prefix backend ci
npm test
npm run lint
npm run build
npm run typecheck
npm run test:db
npx playwright install chromium
npm run test:e2e
```

Run build and typecheck sequentially: building replaces `.next/types`. The build downloads the configured Inter font from Google when it is not cached. Browser tests use the production build on 127.0.0.1:3100. To use installed Chrome in PowerShell instead of downloading Chromium:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm run test:e2e
```

Browser coverage includes desktop and mobile page rendering, automated WCAG checks, overflow, pagination, calendar shortcuts, gallery navigation and focus, service enquiry fallback, 404/API errors, generated public routes, and local admin worklists. Service submissions are intercepted in the browser: they do not create real leads or send messages. Database tests execute all migration SQL in disposable PGlite PostgreSQL with a minimal Supabase auth/storage schema and verify permissions, counter allocation and transaction rollback.

## Deployment and remaining work

1. Configure hosted Supabase and run `npm run migrate` before deploying this code. Migrations **0013–0015** add required functions, indexes and policy fixes. Verify actual Supabase Auth, Storage, PostgREST, admin saves and enquiry capture in staging; the local PostgreSQL harness does not test those hosted services.
2. Keep `ADMIN_LOCAL_ACCESS` and `ALLOW_LOCAL_STORE` unset in public production. Local JSON storage is a development preview, with no multi-process or durable hosted-storage guarantee.
3. Fleet pagination currently bounds rendered results, while pricing and distance sorting still use a complete cached catalog. A much larger fleet needs indexed SQL filtering and geospatial queries, small quote-specific reads, and measured capacity tests against representative data. Do not interpret this review as a production load certification.
4. Rate limits and geocoder/router caches are per server instance. Configure trusted proxy IP handling and a shared limiter or edge protection for multi-instance deployment. Use a supported routing/geocoding provider instead of public demo endpoints before sustained traffic.
5. The inherited pricing rule rounds excess package hours into another complete package; the advertised extra-hour rate is therefore not applied. The review preserves existing tested prices. Resolve this business rule and reconcile public rate-card wording before accepting bookings.
6. Set real contact details and WhatsApp number, replace illustrative fleet/gallery media, and confirm cancellation/response-time/pricing claims with the business. Configure monitoring, database backups and restore testing for launch.

Public garage coordinates are pricing inputs under the current architecture and are visible to visitors; availability notes and lead details remain private.
