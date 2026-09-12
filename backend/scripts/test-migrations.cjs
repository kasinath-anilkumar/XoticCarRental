// Runs the real migration SQL in disposable PostgreSQL/WASM. No network or
// configured database is touched; auth/storage below model Supabase's base schema.
const { before, after, describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const { randomUUID } = require('node:crypto');
const { runInNewContext } = require('node:vm');
const { prepareValue } = require('pg/lib/utils');
const { PGlite } = require('@electric-sql/pglite');

const migrations = join(__dirname, '..', 'supabase', 'migrations');
const adminId = randomUUID();
const otherId = randomUUID();
const cityId = randomUUID();
const otherCityId = randomUUID();
const carTypeId = randomUUID();
const carId = randomUUID();
const occasionId = randomUUID();
const otherOccasionId = randomUUID();
let db;
let stamp;

async function asRole(role, userId, work) {
  assert.ok(['anon', 'authenticated', 'service_role'].includes(role));
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? '']);
  try { return await work(); } finally { await db.exec('reset role'); }
}

async function saveCar(name, occasions = [occasionId], cities = [cityId]) {
  const { rows } = await db.query('select * from public.cars where id = $1', [carId]);
  return db.query('select public.save_car_details($1, $2::jsonb, $3::uuid[], $4::uuid[])', [
    carId, JSON.stringify({ ...rows[0], name }), `{${occasions.join(',')}}`, `{${cities.join(',')}}`,
  ]);
}

describe('database migrations and access control', { concurrency: false }, () => {
  before(async () => {
    db = new PGlite();
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin bypassrls;
      grant usage on schema public to service_role;
      alter default privileges in schema public grant all on tables to service_role;
      alter default privileges in schema public grant all on sequences to service_role;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      grant usage on schema auth to anon, authenticated, service_role;
      grant execute on function auth.uid() to anon, authenticated, service_role;
      create schema storage;
      create table storage.buckets (id text primary key, name text not null, public boolean not null default false);
      create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id));
      alter table storage.objects enable row level security;
      grant usage on schema storage to anon, authenticated, service_role;
      grant select on storage.objects to anon;
      grant select, insert, update, delete on storage.objects to authenticated;
    `);
    stamp = (await db.query("select to_char(current_timestamp at time zone 'Asia/Kolkata', 'YYMMDD') as stamp")).rows[0].stamp;

    for (const file of readdirSync(migrations).filter((name) => name.endsWith('.sql')).sort()) {
      if (file.startsWith('0013_')) {
        for (const reference of [`WED-${stamp}-999`, `WED-${stamp}-1000`, `VIP-${stamp}-005`]) {
          await db.query(`insert into public.enquiries (lead_id, km, hours, days, subtotal, gst, total, advance)
            values ($1, 0, 0, 0, 0, 0, 0, 0)`, [reference]);
        }
      }
      try {
        await db.exec(`begin;\n${readFileSync(join(migrations, file), 'utf8')}\ncommit;`);
      } catch (error) {
        throw new Error(`Migration ${file} failed: ${error.message}`, { cause: error });
      }
    }

    await db.query('insert into auth.users (id) values ($1), ($2)', [adminId, otherId]);
    await db.query('insert into public.staff (user_id, is_admin) values ($1, true), ($2, false)', [adminId, otherId]);
    await db.query(`insert into public.cities (id, slug, name, state, lat, lng) values
      ($1, 'test-city', 'Test city', 'Kerala', 10, 76), ($2, 'other-city', 'Other city', 'Kerala', 11, 76)`, [cityId, otherCityId]);
    await db.query("insert into public.car_types (id, slug, name) values ($1, 'sedan', 'Sedan')", [carTypeId]);
    await db.query(`insert into public.cars
      (id, slug, name, year, car_type_id, seats, home_city_id, rate_8h, rate_12h, rate_full, extra_km_rate, extra_hr_rate, bata, night_charge)
      values ($1, 'test-car', 'Original car', 2026, $2, 4, $3, 1000, 1500, 2000, 20, 100, 300, 100)`, [carId, carTypeId, cityId]);
    await db.query("insert into public.occasions (id, slug, name) values ($1, 'wedding', 'Wedding'), ($2, 'tour', 'Tour')", [occasionId, otherOccasionId]);
    await db.query('insert into public.car_occasions (car_id, occasion_id) values ($1, $2)', [carId, occasionId]);
    await db.query('insert into public.car_service_cities (car_id, city_id) values ($1, $2)', [carId, cityId]);
    await db.query(`insert into public.garages (slug, name, city_id, lat, lng, is_active) values
      ('active-yard', 'Active yard', $1, 10, 76, true), ('hidden-yard', 'Hidden yard', $1, 10, 76, false)`, [cityId]);
    await db.query("insert into public.car_availability (car_id, status, starts_on, ends_on, note) values ($1, 'hold', current_date, current_date, 'Private note')", [carId]);
    await db.exec("insert into public.seasons (slug, name, starts_on, ends_on) values ('test', 'Test season', '01-01', '02-01')");
  });
  after(async () => { await db?.close(); });

  test('accepts the 1957 vintage car while enforcing the 1900 and 2100 year bounds', async () => {
    const insertYear = (year) => db.query(`
      insert into public.cars
        (slug, name, year, car_type_id, seats, home_city_id, rate_8h, rate_12h, rate_full, extra_km_rate, extra_hr_rate, bata, night_charge)
      select $1, 'Vintage year regression', $2, car_type_id, seats, home_city_id,
        rate_8h, rate_12h, rate_full, extra_km_rate, extra_hr_rate, bata, night_charge
      from public.cars where id = $3
      returning year`, [`year-test-${year}`, year, carId]);

    for (const year of [1957, 1900, 2100]) {
      assert.equal((await insertYear(year)).rows[0].year, year);
    }
    for (const year of [1899, 2101]) {
      await assert.rejects(() => insertYear(year), (error) => error.code === '23514' && error.constraint === 'cars_year_check');
    }
  });

  test('allocates unique references after 999 and preserves legacy daily counters', async () => {
    const references = await asRole('service_role', null, () => Promise.all(Array.from({ length: 20 }, async () => (
      await db.query("select public.allocate_lead_reference('WED') as reference")
    ).rows[0].reference)));
    assert.equal(new Set(references).size, 20);
    assert.ok(references.includes(`WED-${stamp}-1001`));
    assert.ok(references.includes(`WED-${stamp}-1020`));
    const vip = await asRole('service_role', null, () => db.query("select public.allocate_lead_reference('VIP') as reference"));
    assert.equal(vip.rows[0].reference, `VIP-${stamp}-006`);
  });

  test('limits reference allocation to the service role', async () => {
    for (const role of ['anon', 'authenticated']) {
      await asRole(role, otherId, async () => {
        await assert.rejects(() => db.query("select public.allocate_lead_reference('WED')"), /permission denied/);
      });
    }
  });

  test('publishes active garage pricing inputs and keeps private availability inaccessible', async () => {
    await asRole('anon', null, async () => {
      const garages = await db.query('select slug from public.garages');
      assert.deepEqual(garages.rows.map((row) => row.slug), ['active-yard']);
      await assert.rejects(() => db.query('select note from public.car_availability'), /permission denied/);
    });
    await asRole('authenticated', otherId, async () => {
      assert.equal((await db.query('select * from public.car_availability')).rows.length, 0);
      await assert.rejects(() => db.query("insert into public.car_availability (car_id,status,starts_on,ends_on) values ($1,'hold',current_date,current_date)", [carId]), /row-level security/);
    });
  });

  test('rejects non-admin writes to later feature tables and uploaded photos', async () => {
    await asRole('authenticated', otherId, async () => {
      await assert.rejects(() => db.query("insert into public.garages (slug,name,city_id,lat,lng) values ('forbidden','Forbidden',$1,10,76)", [cityId]), /row-level security/);
      await assert.rejects(() => db.exec("insert into public.seasons (slug,name,starts_on,ends_on) values ('forbidden','Forbidden','01-01','02-01')"), /row-level security/);
      await assert.rejects(() => db.query('insert into public.car_service_cities (car_id,city_id) values ($1,$2)', [carId, otherCityId]), /row-level security/);
      await assert.rejects(() => db.exec("insert into storage.objects (bucket_id) values ('car-photos')"), /row-level security/);
    });
  });

  test('allows admin updates and replaces car relations atomically', async () => {
    await asRole('authenticated', adminId, async () => {
      await saveCar('Updated car', [otherOccasionId], [otherCityId]);
      await db.exec("insert into storage.objects (bucket_id) values ('car-photos')");
    });
    assert.equal((await db.query('select name from public.cars where id=$1', [carId])).rows[0].name, 'Updated car');
    assert.deepEqual((await db.query('select occasion_id from public.car_occasions where car_id=$1', [carId])).rows, [{ occasion_id: otherOccasionId }]);
    assert.deepEqual((await db.query('select city_id from public.car_service_cities where car_id=$1', [carId])).rows, [{ city_id: otherCityId }]);
  });

  test('rolls the full car edit back when a selected relation is invalid', async () => {
    await asRole('authenticated', adminId, async () => {
      await assert.rejects(() => saveCar('Must roll back', [occasionId], [randomUUID()]), /foreign key/);
    });
    assert.equal((await db.query('select name from public.cars where id=$1', [carId])).rows[0].name, 'Updated car');
    assert.deepEqual((await db.query('select occasion_id from public.car_occasions where car_id=$1', [carId])).rows, [{ occasion_id: otherOccasionId }]);
    assert.deepEqual((await db.query('select city_id from public.car_service_cities where car_id=$1', [carId])).rows, [{ city_id: otherCityId }]);
  });

  test('denies the car update RPC to an authenticated non-admin', async () => {
    await asRole('authenticated', otherId, async () => {
      await assert.rejects(() => saveCar('Unauthorized'), /Admin access required/);
    });
  });

  test('runs the actual sample seed twice without schema errors or duplicate vehicles', async () => {
    const seedData = require('../seed-data');
    const seedSource = readFileSync(join(__dirname, 'seed.js'), 'utf8');
    const seedSlugs = new Set(seedData.cars.map((car) => car.slug));
    let previousCars;
    let closed = 0;

    for (let run = 0; run < 2; run += 1) {
      const errors = [];
      const isolatedProcess = { argv: [], exitCode: 0, exit(code) { this.exitCode = code; } };
      const client = {
        // Match node-postgres parameter encoding, including text[] settings.
        query: (sql, values) => db.query(sql, values?.map((value) => prepareValue(value))),
        end: async () => { closed += 1; },
      };
      const completion = runInNewContext(seedSource, {
        require: (name) => {
          if (name === './db') return { connect: async () => client };
          if (name === '../seed-data') return seedData;
          throw new Error(`Unexpected seed dependency: ${name}`);
        },
        console: { log() {}, error: (...args) => errors.push(args.join(' ')) },
        process: isolatedProcess,
      }, { filename: 'seed.js' });
      await completion;

      assert.equal(isolatedProcess.exitCode, 0, errors.join('\n'));
      assert.deepEqual(errors, []);
      const cars = (await db.query('select id, slug, year from public.cars order by slug')).rows
        .filter((car) => seedSlugs.has(car.slug));
      assert.equal(cars.length, seedData.cars.length);
      assert.equal(new Set(cars.map((car) => car.slug)).size, seedData.cars.length);
      assert.equal(cars.find((car) => car.slug === 'belair').year, 1957);
      assert.equal((await db.query('select count(*)::int as count from public.site_settings')).rows[0].count, 1);
      if (previousCars) assert.deepEqual(cars, previousCars);
      previousCars = cars;
    }
    assert.equal(closed, 2);
  });
});
