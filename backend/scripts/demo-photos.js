// backend/scripts/demo-photos.js
//
// TEMPORARY real photography for judging the site's look. Not for production.
//
//   npm run demo-photos              put real photos on every seeded car
//   npm run demo-photos -- --remove  take them off again, restore the plates
//
// The generated plates from scripts/media.mjs show where a photo sits, but not
// how the site feels with photographs in it. This swaps each seeded car's
// car_images rows for real, freely licensed photos from Wikimedia Commons.
//
// They go through the same path as an admin upload — into the public
// `car-photos` bucket, under demo/ — so next/image serves them from the
// Supabase host it already allows and no config has to change (or be
// un-changed later).
//
// Why they cannot ship: they are photos of other people's cars, most are
// CC BY-SA and so need visible credit, and none of them is Xotic's fleet. The
// script prints the credits; `--remove` (or flushing the database and the
// demo/ folder of the bucket) is the way out.
//
// Picked by eye from Commons, matched to the listed generation where Commons
// had one. Force Urbania has no freely licensed photos at all, so it borrows
// two Force Traveller shots — same maker, same class — and has no interior or
// rear.

const { join } = require('node:path');
const { BACKEND_DIR, loadEnvFile, connect } = require('./db');

const BUCKET = 'car-photos';
const PREFIX = 'demo/';
const WIDTH = 1920; // one of Wikimedia's standard thumbnail widths
const USER_AGENT = 'XoticCarRental-demo-photos/1.0 (preview script)';
const SHOTS = ['hero', 'interior', 'rear', 'detail'];
const SHOT_ALT = { hero: 'exterior', interior: 'interior', rear: 'rear view', detail: 'detail' };

const MANIFEST = {
  eclass: {
    hero: 'File:MERCEDES-BENZ E-CLASS (W213) China (3).jpg',
    interior: 'File:Osaka Motor Show 2019 (271) - Mercedes-Benz E 350 de AVANTGARDE Sports (W213).jpg',
    rear: 'File:MERCEDES-BENZ E-CLASS (W213) China (4).jpg',
    detail: 'File:The tire wheel of Mercedes-Benz E 200 AVANTGARDE (4AA-214050C).jpg',
  },
  innova: {
    hero: 'File:Toyota Innova Crysta 2.4 Z front right.jpg',
    interior: 'File:2021 Toyota Innova 2.4G diesel 6AT grey interior view in Brunei.jpg',
    rear: 'File:Toyota Innova Crysta 2.4 Z rear left.jpg',
    detail: 'File:Toyota Innova Crysta.jpg',
  },
  x5: {
    hero: 'File:BMW X5 (G05) China (11).jpg',
    interior: 'File:2019 BMW X5 30d M Sport 3.0 Interior.jpg',
    rear: 'File:BMW X5 MK4 rear.jpg',
    detail: 'File:Scheinwerfer des X5 mit BMW Laserlicht.jpg',
  },
  fortuner: {
    hero: 'File:Toyota Fortuner 4x4 LTD 2-Tone White Pearl-Black (cropped).jpg',
    interior: 'File:2019 Toyota Fortuner 2.4 VRZ TRD Sportivo 4x2 GUN165R interior (20190722).jpg',
    rear: 'File:2018 Toyota Fortuner TRD Sportivo looking from back.jpg',
    detail: 'File:Toyota Fortuner GUN166 Legender 2.8 Q 4x2 Gray Metallic 01.jpg',
  },
  a6: {
    hero: 'File:AUDI A6L C8 China (63).jpg',
    interior: 'File:Audi A6, GIMS 2018, Le Grand-Saconnex (1X7A1762).jpg',
    rear: 'File:Audi A6 Back I Genf 2018.jpg',
    detail: 'File:Audi A6 50 TDI Quattro Premium C8 Daytona Gray Pearl (14).jpg',
  },
  carnival: {
    hero: 'File:Kia Carnival V6 Limited 2021 (52638531412).jpg',
    interior: 'File:Kia Carnival KA4 PE Taupe (12).jpg',
    rear: 'File:0 Kia Carnival (KA4) 3.jpg',
    detail: 'File:0 Kia Carnival (KA4) 7.jpg',
  },
  vclass: {
    hero: 'File:MERCEDES BENZ V-CLASS (W447) China (18).jpg',
    interior: 'File:Osaka Motor Show 2015 (24) - Mercedes-Benz V220d AVANTGARDE long (W447).JPG',
    rear: 'File:MERCEDES BENZ V-CLASS (W447) China (19).jpg',
    detail: 'File:The tire wheel of Mercedes-Benz V220d Sports long (W447).jpg',
  },
  urbania: {
    hero: 'File:Force Motors - Traveller 26 - Agra 2014-05-14 4222.JPG',
    detail: 'File:MakeInIndia-Force-Motors-Minivan.jpg',
  },
  vellfire: {
    hero: 'File:TOYOTA ALPHARD (AH30) HONG KONG (6).jpg',
    interior: 'File:Toyota VELLFIRE X 2WD (DBA-AGH30W-NRXGK) interior.jpg',
    rear: 'File:TOYOTA ALPHARD HYBRID (AH40) China (15).jpg',
    detail: 'File:The front emblem of Toyota VELLFIRE Z G Edition 2WD 7-Seater (3BA-AGH30W-NFXSK).jpg',
  },
  camry: {
    hero: 'File:TOYOTA CAMRY (XV70) China (27).jpg',
    interior: 'File:2021 Toyota Camry 2.5AT white interior view in Brunei.jpg',
    rear: 'File:Toyota Camry SE Back P4110368.jpg',
    detail: 'File:The tire wheel of Toyota CAMRY G (DAA-AXVH70).jpg',
  },
  boxster: {
    hero: 'File:2018 Porsche 718 Boxster GTS.jpg',
    interior: 'File:2018 Porsche 718 Boxster S Interior.jpg',
    rear: 'File:2018 Porsche 718 Boxster GTS 2.jpg',
    detail: 'File:Porsche 718 Boxster S Back IMG 0694.jpg',
  },
  mustang: {
    hero: 'File:Ford Mustang GT (S550) Washington DC Metro Area, USA.jpg',
    interior: 'File:Mstg S550 hk160616 7083besg.jpg',
    rear: 'File:Ford Mustang S550 5.0 GT 50 Years appearance package black 02.jpg',
    detail: 'File:Dülmen, Automeile auf dem Kartoffelmarkt, Ford Mustang -- 2019 -- 9899.jpg',
  },
  belair: {
    hero: 'File:1957 Chevrolet Bel Air 2-Door Sedan in Matador Red, Front Left, 05-27-2023.jpg',
    interior: 'File:57chevyinterior.jpg',
    rear: 'File:Chevrolet Bel Air 1957 en Dalhem 02.jpg',
    detail: 'File:Chevrolet Bel Air - Oldtimertreffen Wengerter (14427953737).jpg',
  },
  stretch: {
    hero: 'File:Lincoln Town Car Stretch limo (47828403802).jpg',
    interior: 'File:Limo Interior.jpg',
    rear: 'File:Stretch-Limousine Muenchen Hotel Vier Jahreszeiten-1.jpg',
    detail: 'File:Lincoln Town Car Stretch limo (47828403472).jpg',
  },
  ghost: {
    hero: 'File:2022 Rolls-Royce Ghost V12 Black Badge 4x4 Auto.jpg',
    interior: 'File:Rolls-Royce Ghost II Mandarin Navy Blue (1).jpg',
    rear: 'File:Rolls-Royce Ghost II (2021) (53322836003).jpg',
    detail: 'File:Rolls-Royce Ghost I Series II Black Badge Black (3).jpg',
  },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function apiCredentials() {
  const fileEnv = loadEnvFile(join(BACKEND_DIR, '..', '.env.local'));
  const get = (k) => process.env[k] || fileEnv[k] || '';
  const url = get('NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '');
  const serviceKey = get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local (project root).');
  }
  return { url, serviceKey };
}

/** Wikimedia answers bursts with 429; back off rather than fail the run. */
async function fetchWithRetry(url, init = {}, attempts = 5) {
  for (let attempt = 1; ; attempt += 1) {
    const res = await fetch(url, { ...init, headers: { 'user-agent': USER_AGENT, ...(init.headers || {}) } });
    if ((res.status !== 429 && res.status < 500) || attempt >= attempts) return res;
    await sleep(1000 * 2 ** attempt);
  }
}

/** One API call per 40 titles: the sized URL plus what the credit line needs. */
async function resolveFiles(titles) {
  const byTitle = new Map();
  for (let i = 0; i < titles.length; i += 40) {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      prop: 'imageinfo',
      titles: titles.slice(i, i + 40).join('|'),
      iiprop: 'url|extmetadata',
      iiurlwidth: String(WIDTH),
      iiextmetadatafilter: 'LicenseShortName|Artist',
    });
    const res = await fetchWithRetry(`https://commons.wikimedia.org/w/api.php?${params}`);
    if (!res.ok) throw new Error(`Wikimedia Commons API returned HTTP ${res.status}`);
    const { query } = await res.json();

    // The API normalises some titles; map its answers back to the manifest's.
    const asked = new Map((query.normalized || []).map((n) => [n.to, n.from]));
    for (const page of query.pages) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      const meta = info.extmetadata || {};
      byTitle.set(asked.get(page.title) || page.title, {
        src: info.thumburl || info.url,
        page: info.descriptionurl,
        license: meta.LicenseShortName?.value || 'see file page',
        artist: (meta.Artist?.value || 'unknown').replace(/<[^>]+>/g, '').trim(),
      });
    }
  }
  const missing = titles.filter((t) => !byTitle.has(t));
  if (missing.length) throw new Error(`Not found on Wikimedia Commons:\n   ${missing.join('\n   ')}`);
  return byTitle;
}

function storage({ url, serviceKey }, path, init = {}) {
  return fetch(`${url}/storage/v1/${path}`, {
    ...init,
    headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, ...(init.headers || {}) },
  });
}

async function apply() {
  const creds = apiCredentials();
  const titles = [...new Set(Object.values(MANIFEST).flatMap((shots) => Object.values(shots)))];
  const files = await resolveFiles(titles);

  // Every upload lands before the database changes, so a failed download
  // leaves the site exactly as it was.
  const uploaded = [];
  for (const [slug, shots] of Object.entries(MANIFEST)) {
    for (const kind of SHOTS) {
      if (!shots[kind]) continue;
      const file = files.get(shots[kind]);

      const image = await fetchWithRetry(file.src);
      if (!image.ok) throw new Error(`Download failed (HTTP ${image.status}) for ${shots[kind]}`);
      const body = Buffer.from(await image.arrayBuffer());

      const objectPath = `${PREFIX}${slug}-${kind}.jpg`;
      const put = await storage(creds, `object/${BUCKET}/${objectPath}`, {
        method: 'POST',
        headers: { 'content-type': 'image/jpeg', 'cache-control': '3600', 'x-upsert': 'true' },
        body,
      });
      if (!put.ok) throw new Error(`Upload failed for ${objectPath}: HTTP ${put.status} ${await put.text()}`);

      uploaded.push({ slug, kind, file, url: `${creds.url}/storage/v1/object/public/${BUCKET}/${objectPath}` });
      console.log(`+  ${objectPath}  ${Math.round(body.length / 1024)} KB`);
      await sleep(300);
    }
  }

  const client = await connect();
  try {
    await client.query('begin');
    const { rows: cars } = await client.query('select id, slug, name from public.cars where slug = any($1)', [
      Object.keys(MANIFEST),
    ]);
    const carBySlug = new Map(cars.map((c) => [c.slug, c]));

    for (const slug of Object.keys(MANIFEST)) {
      const car = carBySlug.get(slug);
      if (!car) {
        console.log(`~  no car with slug "${slug}" in the database; skipped`);
        continue;
      }
      await client.query('delete from public.car_images where car_id = $1', [car.id]);
      for (const shot of uploaded.filter((u) => u.slug === slug)) {
        await client.query(
          'insert into public.car_images (car_id, url, kind, alt, sort) values ($1, $2, $3, $4, $5)',
          [car.id, shot.url, shot.kind, `${car.name} — ${SHOT_ALT[shot.kind]}`, SHOTS.indexOf(shot.kind)],
        );
      }
    }
    await client.query('commit');
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    await client.end().catch(() => {});
  }

  console.log(`\nDone: ${uploaded.length} photos on ${Object.keys(MANIFEST).length} cars.`);
  console.log('Undo with: npm run demo-photos -- --remove');
  console.log('\nCredits (Wikimedia Commons):');
  for (const u of uploaded) console.log(`   ${u.slug}/${u.kind}: ${u.file.artist}, ${u.file.license} — ${u.file.page}`);
}

async function remove() {
  const creds = apiCredentials();

  // Rows before files: a row without its file is a broken image on the site,
  // a car without rows is just the placeholder plate.
  const client = await connect();
  try {
    await client.query('begin');
    const marker = `/storage/v1/object/public/${BUCKET}/${PREFIX}`;
    const { rowCount } = await client.query('delete from public.car_images where position($1 in url) > 0', [marker]);

    // Any car left with no photos gets back the generated plates it had.
    const { rows: bare } = await client.query(
      'select c.id, c.slug, c.name from public.cars c where not exists (select 1 from public.car_images i where i.car_id = c.id)',
    );
    for (const car of bare) {
      for (const [sort, kind] of SHOTS.entries()) {
        await client.query(
          'insert into public.car_images (car_id, url, kind, alt, sort) values ($1, $2, $3, $4, $5)',
          [car.id, `/media/cars/${car.slug}-${kind}.png`, kind, `${car.name} - sample ${kind} illustration`, sort],
        );
      }
    }
    await client.query('commit');
    console.log(`-  removed ${rowCount} demo photo rows; restored placeholder plates on ${bare.length} cars`);
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    await client.end().catch(() => {});
  }

  const list = await storage(creds, `object/list/${BUCKET}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prefix: PREFIX, limit: 1000 }),
  });
  if (!list.ok) throw new Error(`Could not list ${BUCKET}/${PREFIX}: HTTP ${list.status}`);
  const names = (await list.json()).map((o) => `${PREFIX}${o.name}`);
  if (names.length) {
    const del = await storage(creds, `object/${BUCKET}`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prefixes: names }),
    });
    if (!del.ok) throw new Error(`Could not delete demo files: HTTP ${del.status} ${await del.text()}`);
  }
  console.log(`-  deleted ${names.length} files from ${BUCKET}/${PREFIX}`);
}

(process.argv.includes('--remove') ? remove() : apply()).catch((err) => {
  console.error(`\nx  ${err.message}\n`);
  process.exitCode = 1;
});
