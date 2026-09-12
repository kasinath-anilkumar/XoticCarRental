// backend/scripts/geocode.js
//
// Coordinate lookup for Indian places, from the `all-the-cities` npm dataset
// (GeoNames, every settlement over 1,000 people, MIT).
//
// Two jobs:
//
//   1. `node scripts/geocode.js --build`
//      Writes ../data/india-cities.json — a trimmed index (name, lat, lng,
//      state, population) of Indian places over 10,000 people, about 120 KB.
//      The admin panel's "add a location" form searches THAT file, not the
//      30 MB package, so the dataset never reaches the Next.js server bundle.
//
//   2. `node scripts/geocode.js kochi`
//      Prints matches, for filling in coordinates by hand.
//
// Landmarks are not in here — an airport terminal, a houseboat jetty or a
// temple is not a populated place, and a city centroid is the wrong point for
// them anyway. Those coordinates are written out explicitly in seed-data.js.

const { writeFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');

const OUT_DIR = join(__dirname, '..', '..', 'data');
const OUT_FILE = join(OUT_DIR, 'india-cities.json');

/** Minimum population to include in the trimmed index. */
const MIN_POPULATION = 10000;

// GeoNames admin1 codes for India. The dataset carries the code, not the name.
const STATES = {
  '01': 'Andaman and Nicobar Islands',
  '02': 'Andhra Pradesh',
  '03': 'Assam',
  '05': 'Chandigarh',
  '06': 'Dadra and Nagar Haveli',
  '07': 'Delhi',
  '09': 'Gujarat',
  10: 'Haryana',
  11: 'Himachal Pradesh',
  12: 'Jammu and Kashmir',
  13: 'Kerala',
  14: 'Lakshadweep',
  16: 'Maharashtra',
  17: 'Manipur',
  18: 'Meghalaya',
  19: 'Karnataka',
  20: 'Nagaland',
  21: 'Odisha',
  22: 'Puducherry',
  23: 'Punjab',
  24: 'Rajasthan',
  25: 'Tamil Nadu',
  26: 'Tripura',
  28: 'West Bengal',
  29: 'Sikkim',
  30: 'Arunachal Pradesh',
  31: 'Mizoram',
  32: 'Daman and Diu',
  33: 'Goa',
  34: 'Bihar',
  35: 'Madhya Pradesh',
  36: 'Uttar Pradesh',
  37: 'Chhattisgarh',
  38: 'Jharkhand',
  39: 'Uttarakhand',
  40: 'Telangana',
  41: 'Ladakh',
};

// The GeoNames extract carries no alternate names for India (checked: 0 of
// 3,502 rows have one), and it still uses several pre-rename spellings. Without
// this map a search for "Kochi" — the name on the city's own signage — finds
// nothing, because the dataset calls it "Cochin". Keyed by the dataset's
// spelling; every listed alias resolves to the same place.
const ALIASES = {
  Cochin: ['Kochi', 'Ernakulam'],
  Bengaluru: ['Bangalore'],
  Chennai: ['Madras'],
  Mumbai: ['Bombay'],
  Kolkata: ['Calcutta'],
  Puducherry: ['Pondicherry', 'Pondy'],
  Alappuzha: ['Alleppey'],
  Thiruvananthapuram: ['Trivandrum'],
  Kozhikode: ['Calicut'],
  Thrissur: ['Trichur'],
  Kannur: ['Cannanore'],
  Kollam: ['Quilon'],
  Mysore: ['Mysuru'],
  Vadodara: ['Baroda'],
  Varanasi: ['Benares', 'Banaras'],
  Prayagraj: ['Allahabad'],
  Allahabad: ['Prayagraj'],
  Shimla: ['Simla'],
  Belgaum: ['Belagavi'],
  Hubli: ['Hubballi'],
  Gurgaon: ['Gurugram'],
  Madikeri: ['Coorg'],
  Panaji: ['Panjim'],
};

/** Diacritic- and case-insensitive, so "Rishikesh" finds "Rishīkesh". */
function fold(value) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function indianCities() {
  // Required lazily: loading the dataset costs a second and ~200 MB of heap.
  const all = require('all-the-cities');
  return all.filter((c) => c.country === 'IN');
}

function toRecord(city) {
  const [lng, lat] = city.loc.coordinates;
  const record = {
    name: city.name,
    lat: Number(lat.toFixed(5)),
    lng: Number(lng.toFixed(5)),
    state: STATES[city.adminCode] || '',
    population: city.population,
  };
  const aka = ALIASES[city.name];
  if (aka) record.aka = aka;
  return record;
}

/** True when the query matches the place's name or any of its aliases. */
function matches(city, needle) {
  if (fold(city.name).includes(needle)) return true;
  if (fold(city.altName || '').includes(needle)) return true;
  const aka = ALIASES[city.name];
  return Boolean(aka && aka.some((alias) => fold(alias).includes(needle)));
}

function build() {
  const rows = indianCities()
    .filter((c) => c.population >= MIN_POPULATION)
    .map(toRecord)
    .sort((a, b) => b.population - a.population);

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(rows), 'utf8');
  console.log(
    `Wrote ${rows.length} places (population >= ${MIN_POPULATION.toLocaleString()}) to data/india-cities.json`,
  );
}

function search(query) {
  const needle = fold(query);
  const found = indianCities()
    .filter((c) => matches(c, needle))
    .sort((a, b) => b.population - a.population)
    .slice(0, 15)
    .map(toRecord);

  if (found.length === 0) {
    console.log(`No match for "${query}".`);
    console.log('Landmarks (airports, jetties, temples) are not in this dataset —');
    console.log('write their coordinates directly into backend/seed-data.js.');
    return;
  }

  for (const m of found) {
    const aka = m.aka ? ` [${m.aka.join(', ')}]` : '';
    console.log(
      `${m.name.padEnd(24)} ${String(m.lat).padStart(9)}, ${String(m.lng).padStart(9)}  ${m.state} (${m.population.toLocaleString()})${aka}`,
    );
  }
}

const args = process.argv.slice(2);
if (args.includes('--build') || args.length === 0) {
  build();
} else {
  search(args.join(' '));
}
