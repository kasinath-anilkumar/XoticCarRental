// backend/scripts/seed.js
//
// Loads backend/seed-data.js into the database.
//
//   npm run seed              upsert the seed content (safe to re-run)
//   npm run seed -- --reset   delete existing content first, then seed
//
// Idempotent by design: every row is keyed by its slug and upserted, so
// re-running after editing seed-data.js updates in place. It never touches
// enquiries or staff — only content.
//
// --reset is destructive and prompts nothing, so it is deliberately not the
// default. Use it when seed-data.js has removed rows and you want the database
// to match exactly.

const { connect } = require('./db');
const data = require('../seed-data');

const RESET = process.argv.includes('--reset');

async function main() {
  const client = await connect();
  const ids = {
    cities: {}, locations: {}, carTypes: {}, packages: {},
    occasions: {}, cars: {}, garages: {},
  };

  try {
    await client.query('begin');

    if (RESET) {
      // Order matters: children before parents.
      await client.query(`
        delete from public.car_occasions;
        delete from public.car_service_cities;
        delete from public.car_images;
        delete from public.cars;
        delete from public.garages;
        delete from public.seasons;
        delete from public.city_routes;
        delete from public.occasion_packages;
        delete from public.occasion_includes;
        delete from public.occasions;
        delete from public.packages;
        delete from public.locations;
        delete from public.car_types;
        delete from public.cities;
      `);
      console.log('[reset]  cleared existing content');
    }

    // ── cities ────────────────────────────────────────────────────────────
    for (const [index, city] of data.cities.entries()) {
      const { rows } = await client.query(
        `insert into public.cities (slug, name, state, multiplier, car_count, lat, lng, sort)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         on conflict (slug) do update set
           name = excluded.name, state = excluded.state,
           multiplier = excluded.multiplier, car_count = excluded.car_count,
           lat = excluded.lat, lng = excluded.lng, sort = excluded.sort
         returning id`,
        [city.slug, city.name, city.state, city.multiplier, city.carCount, city.lat, city.lng, index],
      );
      ids.cities[city.slug] = rows[0].id;
    }
    console.log(`[seed]   cities            ${data.cities.length}`);

    // ── locations ─────────────────────────────────────────────────────────
    for (const [index, loc] of data.locations.entries()) {
      const cityId = ids.cities[loc.city];
      if (!cityId) throw new Error(`location "${loc.slug}" references unknown city "${loc.city}"`);
      const { rows } = await client.query(
        `insert into public.locations (slug, name, city_id, lat, lng, is_airport, sort)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (slug) do update set
           name = excluded.name, city_id = excluded.city_id,
           lat = excluded.lat, lng = excluded.lng,
           is_airport = excluded.is_airport, sort = excluded.sort
         returning id`,
        [loc.slug, loc.name, cityId, loc.lat, loc.lng, Boolean(loc.airport), index],
      );
      ids.locations[loc.slug] = rows[0].id;
    }
    console.log(`[seed]   locations         ${data.locations.length}`);

    // ── car types ─────────────────────────────────────────────────────────
    for (const [index, type] of data.carTypes.entries()) {
      const { rows } = await client.query(
        `insert into public.car_types (slug, name, sort)
         values ($1, $2, $3)
         on conflict (slug) do update set name = excluded.name, sort = excluded.sort
         returning id`,
        [type.slug, type.name, index],
      );
      ids.carTypes[type.slug] = rows[0].id;
    }
    console.log(`[seed]   car types         ${data.carTypes.length}`);

    // ── packages ──────────────────────────────────────────────────────────
    for (const [index, pkg] of data.packages.entries()) {
      const { rows } = await client.query(
        `insert into public.packages (slug, label, hours, km, rate_key, sub, icon, sort)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         on conflict (slug) do update set
           label = excluded.label, hours = excluded.hours, km = excluded.km,
           rate_key = excluded.rate_key, sub = excluded.sub,
           icon = excluded.icon, sort = excluded.sort
         returning id`,
        [pkg.slug, pkg.label, pkg.hours, pkg.km, pkg.rateKey, pkg.sub, pkg.icon, index],
      );
      ids.packages[pkg.slug] = rows[0].id;
    }
    console.log(`[seed]   packages          ${data.packages.length}`);

    // ── garages ───────────────────────────────────────────────────────────
    //
    // Internal (§9), and the row every quote measures from. A car with no
    // garage falls back to its city centre, which is a worse quote rather
    // than a broken one — so a missing yard here is a warning, not a throw.
    for (const garage of data.garages) {
      const cityId = ids.cities[garage.city];
      if (!cityId) throw new Error(`garage "${garage.slug}" references unknown city "${garage.city}"`);
      const { rows } = await client.query(
        `insert into public.garages (slug, name, city_id, lat, lng)
         values ($1, $2, $3, $4, $5)
         on conflict (slug) do update set
           name = excluded.name, city_id = excluded.city_id,
           lat = excluded.lat, lng = excluded.lng
         returning id`,
        [garage.slug, garage.name, cityId, garage.lat, garage.lng],
      );
      ids.garages[garage.slug] = rows[0].id;
    }
    console.log(`[seed]   garages           ${data.garages.length}`);

    // ── seasons ───────────────────────────────────────────────────────────
    for (const season of data.seasons) {
      await client.query(
        `insert into public.seasons (slug, name, starts_on, ends_on, multiplier, note)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (slug) do update set
           name = excluded.name, starts_on = excluded.starts_on,
           ends_on = excluded.ends_on, multiplier = excluded.multiplier,
           note = excluded.note`,
        [season.slug, season.name, season.startsOn, season.endsOn, season.multiplier, season.note],
      );
    }
    console.log(`[seed]   seasons           ${data.seasons.length}`);

    // ── occasions ─────────────────────────────────────────────────────────
    let includeCount = 0;
    let occPackageCount = 0;
    for (const [index, occ] of data.occasions.entries()) {
      const { rows } = await client.query(
        `insert into public.occasions
           (slug, name, icon, tagline, surcharge, handling_note,
            kicker, title, blurb, h2, fleet_title, cta_title, note, sort)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         on conflict (slug) do update set
           name = excluded.name, icon = excluded.icon, tagline = excluded.tagline,
           surcharge = excluded.surcharge, handling_note = excluded.handling_note,
           kicker = excluded.kicker, title = excluded.title, blurb = excluded.blurb,
           h2 = excluded.h2, fleet_title = excluded.fleet_title,
           cta_title = excluded.cta_title, note = excluded.note, sort = excluded.sort
         returning id`,
        [
          occ.slug, occ.name, occ.icon, occ.tagline, occ.surcharge, occ.handlingNote,
          occ.kicker, occ.title, occ.blurb, occ.h2, occ.fleetTitle, occ.ctaTitle, occ.note, index,
        ],
      );
      const occasionId = rows[0].id;
      ids.occasions[occ.slug] = occasionId;

      // Children have no natural key, so replace them wholesale.
      await client.query('delete from public.occasion_includes where occasion_id = $1', [occasionId]);
      for (const [i, inc] of occ.includes.entries()) {
        await client.query(
          `insert into public.occasion_includes (occasion_id, title, detail, sort)
           values ($1, $2, $3, $4)`,
          [occasionId, inc.title, inc.detail, i],
        );
        includeCount += 1;
      }

      await client.query('delete from public.occasion_packages where occasion_id = $1', [occasionId]);
      for (const [i, p] of occ.packages.entries()) {
        await client.query(
          `insert into public.occasion_packages (occasion_id, name, detail, price, unit, sort)
           values ($1, $2, $3, $4, $5, $6)`,
          [occasionId, p.name, p.detail, p.price, p.unit, i],
        );
        occPackageCount += 1;
      }
    }
    console.log(
      `[seed]   occasions         ${data.occasions.length} (${includeCount} includes, ${occPackageCount} packages)`,
    );

    // ── cars ──────────────────────────────────────────────────────────────
    for (const [index, car] of data.cars.entries()) {
      const typeId = ids.carTypes[car.type];
      const cityId = ids.cities[car.city];
      if (!typeId) throw new Error(`car "${car.slug}" references unknown type "${car.type}"`);
      if (!cityId) throw new Error(`car "${car.slug}" references unknown city "${car.city}"`);

      // A named garage that does not exist is a typo worth stopping for: the
      // car would quote from the city centre and nothing would look wrong.
      const garageId = car.garage ? ids.garages[car.garage] : null;
      if (car.garage && !garageId) {
        throw new Error(`car "${car.slug}" references unknown garage "${car.garage}"`);
      }

      const { rows } = await client.query(
        `insert into public.cars
           (slug, name, year, car_type_id, seats, transmission, fuel, home_city_id,
            garage_id, rating, badge, rate_8h, rate_12h, rate_full,
            extra_km_rate, extra_hr_rate, bata, night_charge, sort)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         on conflict (slug) do update set
           name = excluded.name, year = excluded.year, car_type_id = excluded.car_type_id,
           seats = excluded.seats, transmission = excluded.transmission, fuel = excluded.fuel,
           home_city_id = excluded.home_city_id, garage_id = excluded.garage_id,
           rating = excluded.rating, badge = excluded.badge,
           rate_8h = excluded.rate_8h, rate_12h = excluded.rate_12h, rate_full = excluded.rate_full,
           extra_km_rate = excluded.extra_km_rate, extra_hr_rate = excluded.extra_hr_rate,
           bata = excluded.bata, night_charge = excluded.night_charge, sort = excluded.sort
         returning id`,
        [
          car.slug, car.name, car.year, typeId, car.seats, car.transmission, car.fuel, cityId,
          garageId, car.rating, car.badge, car.rate8h, car.rate12h, car.rateFull,
          car.extraKmRate, car.extraHrRate, car.bata, car.nightCharge, index,
        ],
      );
      const carId = rows[0].id;
      ids.cars[car.slug] = carId;

      await client.query('delete from public.car_service_cities where car_id = $1', [carId]);
      for (const citySlug of car.serviceCities ?? []) {
        const serviceCityId = ids.cities[citySlug];
        if (!serviceCityId) {
          throw new Error(`car "${car.slug}" may serve unknown city "${citySlug}"`);
        }
        await client.query(
          'insert into public.car_service_cities (car_id, city_id) values ($1, $2)',
          [carId, serviceCityId],
        );
      }

      await client.query('delete from public.car_occasions where car_id = $1', [carId]);
      for (const occSlug of car.occasions) {
        const occasionId = ids.occasions[occSlug];
        if (!occasionId) throw new Error(`car "${car.slug}" references unknown occasion "${occSlug}"`);
        await client.query(
          'insert into public.car_occasions (car_id, occasion_id) values ($1, $2)',
          [carId, occasionId],
        );
      }
    }
    console.log(`[seed]   cars              ${data.cars.length}`);

    // ── city routes ───────────────────────────────────────────────────────
    for (const [index, route] of data.cityRoutes.entries()) {
      const cityId = ids.cities[route.city];
      const fromId = ids.locations[route.from];
      const toId = ids.locations[route.to];
      if (!cityId || !fromId || !toId) {
        throw new Error(`city route ${route.city}: ${route.from} -> ${route.to} references unknown rows`);
      }
      await client.query(
        `insert into public.city_routes (city_id, from_location_id, to_location_id, km_override, sort)
         values ($1, $2, $3, $4, $5)
         on conflict (city_id, from_location_id, to_location_id) do update set
           km_override = excluded.km_override, sort = excluded.sort`,
        [cityId, fromId, toId, route.km ?? null, index],
      );
    }
    console.log(`[seed]   city routes       ${data.cityRoutes.length}`);

    // ── settings ──────────────────────────────────────────────────────────
    const s = data.settings;
    await client.query(
      `insert into public.site_settings
         (id, whatsapp_number, phone_display, email, gst_percent, advance_percent,
          circuity_factor, inclusions, exclusions, why_items, charges, pricing_rules)
       values (true, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       on conflict (id) do update set
         whatsapp_number = excluded.whatsapp_number,
         phone_display = excluded.phone_display,
         email = excluded.email,
         gst_percent = excluded.gst_percent,
         advance_percent = excluded.advance_percent,
         circuity_factor = excluded.circuity_factor,
         inclusions = excluded.inclusions,
         exclusions = excluded.exclusions,
         why_items = excluded.why_items,
         charges = excluded.charges,
         pricing_rules = excluded.pricing_rules`,
      [
        s.whatsappNumber, s.phoneDisplay, s.email, s.gstPercent, s.advancePercent,
        s.circuityFactor, s.inclusions, s.exclusions, JSON.stringify(s.whyItems),
        JSON.stringify(s.charges ?? []),
        JSON.stringify(s.pricingRules),
      ],
    );
    console.log('[seed]   site settings     1');

    // Optional sample service definitions; preserve existing operator edits.
    const services = require('../service-seed-data.json');
    for (const [sort, definition] of services.entries()) {
      await client.query(`insert into public.services (slug, definition, is_active, sort)
        values ($1, $2::jsonb, true, $3) on conflict (slug) do nothing`,
      [definition.slug, JSON.stringify(definition), sort]);
    }
    console.log(`[seed]   services          ${services.length}`);

    await client.query('commit');

    console.log('\nDone.');
    if (s.whatsappNumber === '919876543210') {
      console.log(
        '\n!  The WhatsApp number is still the prototype placeholder (919876543210).\n' +
          '   Change it in /admin/settings before launch — every enquiry goes there.\n',
      );
    }
  } catch (err) {
    await client.query('rollback').catch(() => {});
    console.error(`\nx  Seed failed and was rolled back:\n   ${err.message}\n`);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('\nx  Unexpected error:', err.message);
  process.exit(1);
});
