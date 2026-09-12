// backend/seed-data.js
//
// The content the site launches with, ported from the Claude Design prototype
// (design/project/Xotic Car Rental.dc.html). Everything here is editable in the
// admin panel afterwards — this file only decides what exists on day one.
//
// Coordinates:
//   * Cities come from the `all-the-cities` GeoNames dataset. Verify or find
//     more with `npm run geocode -- <name>`.
//   * Landmarks — airport terminals, the Alleppey jetty, Guruvayur temple,
//     Ramoji Film City — are written out by hand. They are not populated
//     places, so no city dataset carries them, and a city centroid would be
//     the wrong point: quoting Kochi→COK off the Kochi centroid loses 8 km.
//
// The prototype listed `chennai-central` twice in its location array; there are
// 33 distinct locations, not 34.

const cities = [
  // North India
  { slug: 'delhi',       name: 'Delhi NCR',          state: 'Delhi',      multiplier: 1.10, carCount: 350, lat: 28.6139,  lng: 77.2090 },
  { slug: 'jaipur',      name: 'Jaipur',             state: 'Rajasthan',  multiplier: 1.00, carCount: 120, lat: 26.9124,  lng: 75.7873 },
  { slug: 'udaipur',     name: 'Udaipur',            state: 'Rajasthan',  multiplier: 1.05, carCount: 80,  lat: 24.5854,  lng: 73.7125 },
  { slug: 'chandigarh',  name: 'Chandigarh',         state: 'Punjab',     multiplier: 1.05, carCount: 95,  lat: 30.7333,  lng: 76.7794 },

  // West India
  { slug: 'mumbai',      name: 'Mumbai',             state: 'Maharashtra', multiplier: 1.15, carCount: 420, lat: 19.0760,  lng: 72.8777 },
  { slug: 'pune',        name: 'Pune',               state: 'Maharashtra', multiplier: 1.05, carCount: 160, lat: 18.5204,  lng: 73.8567 },
  { slug: 'goa',         name: 'Goa',                state: 'Goa',         multiplier: 1.20, carCount: 130, lat: 15.2993,  lng: 74.1240 },
  { slug: 'ahmedabad',   name: 'Ahmedabad',          state: 'Gujarat',     multiplier: 1.00, carCount: 110, lat: 23.0225,  lng: 72.5714 },

  // South India
  { slug: 'bangalore',   name: 'Bengaluru',          state: 'Karnataka',  multiplier: 1.05, carCount: 310, lat: 12.97194, lng: 77.59369 },
  { slug: 'hyderabad',   name: 'Hyderabad',          state: 'Telangana',  multiplier: 1.05, carCount: 240, lat: 17.3850,  lng: 78.4867 },
  { slug: 'chennai',     name: 'Chennai',            state: 'Tamil Nadu', multiplier: 1.00, carCount: 180, lat: 13.08784, lng: 80.27847 },
  { slug: 'kochi',       name: 'Kochi',              state: 'Kerala',     multiplier: 1.00, carCount: 150, lat: 9.93988,  lng: 76.26022 },
  { slug: 'trivandrum',  name: 'Thiruvananthapuram', state: 'Kerala',     multiplier: 1.00, carCount: 90,  lat: 8.5241,   lng: 76.9366 },
  { slug: 'kozhikode',   name: 'Kozhikode',          state: 'Kerala',     multiplier: 0.95, carCount: 60,  lat: 11.2588,  lng: 75.7804 },
  { slug: 'mysuru',      name: 'Mysuru',             state: 'Karnataka',  multiplier: 1.00, carCount: 70,  lat: 12.2958,  lng: 76.6394 },
  { slug: 'coimbatore',  name: 'Coimbatore',         state: 'Tamil Nadu', multiplier: 0.95, carCount: 85,  lat: 11.0168,  lng: 76.9558 },
  { slug: 'madurai',     name: 'Madurai',            state: 'Tamil Nadu', multiplier: 0.95, carCount: 65,  lat: 9.9252,   lng: 78.1198 },

  // East & Central India
  { slug: 'kolkata',     name: 'Kolkata',            state: 'West Bengal', multiplier: 1.00, carCount: 170, lat: 22.5726,  lng: 88.3639 },
  { slug: 'bhubaneswar', name: 'Bhubaneswar',        state: 'Odisha',      multiplier: 0.95, carCount: 70,  lat: 20.2961,  lng: 85.8245 },
  { slug: 'indore',      name: 'Indore',             state: 'Madhya Pradesh', multiplier: 0.95, carCount: 75, lat: 22.7196, lng: 75.8577 },
];

const locations = [
  // Kochi — the anchor is Marine Drive, as in the prototype.
  { slug: 'kochi-marine',   name: 'Marine Drive, Kochi',        city: 'kochi', lat: 9.9816,  lng: 76.2755 },
  { slug: 'kochi-airport',  name: 'Cochin Intl Airport (COK)',  city: 'kochi', lat: 10.1520, lng: 76.4019, airport: true },
  { slug: 'kochi-fort',     name: 'Fort Kochi',                 city: 'kochi', lat: 9.9658,  lng: 76.2422 },
  { slug: 'kochi-kakkanad', name: 'Kakkanad / Infopark',        city: 'kochi', lat: 10.0159, lng: 76.3419 },
  { slug: 'alleppey',       name: 'Alleppey houseboat jetty',   city: 'kochi', lat: 9.4930,  lng: 76.3320 },
  { slug: 'kumarakom',      name: 'Kumarakom',                  city: 'kochi', lat: 9.6177,  lng: 76.4274 },
  { slug: 'munnar',         name: 'Munnar',                     city: 'kochi', lat: 10.0889, lng: 77.0595 },
  { slug: 'thekkady',       name: 'Thekkady',                   city: 'kochi', lat: 9.5939,  lng: 77.1600 },
  { slug: 'guruvayur',      name: 'Guruvayur temple',           city: 'kochi', lat: 10.5946, lng: 76.0400 },

  // Thiruvananthapuram
  { slug: 'tvm-city',       name: 'Thiruvananthapuram city',    city: 'trivandrum', lat: 8.4875,  lng: 76.9525 },
  { slug: 'tvm-airport',    name: 'Trivandrum airport (TRV)',   city: 'trivandrum', lat: 8.4821,  lng: 76.9200, airport: true },
  { slug: 'kovalam',        name: 'Kovalam beach',              city: 'trivandrum', lat: 8.4004,  lng: 76.9787 },
  { slug: 'varkala',        name: 'Varkala',                    city: 'trivandrum', lat: 8.7379,  lng: 76.7163 },
  { slug: 'kanyakumari',    name: 'Kanyakumari',                city: 'trivandrum', lat: 8.0883,  lng: 77.5385 },

  // Kozhikode
  { slug: 'kozhikode-city', name: 'Kozhikode city',             city: 'kozhikode', lat: 11.2588, lng: 75.7804 },
  { slug: 'ccj-airport',    name: 'Calicut airport (CCJ)',      city: 'kozhikode', lat: 11.1362, lng: 75.9553, airport: true },
  { slug: 'wayanad',        name: 'Wayanad, Kalpetta',          city: 'kozhikode', lat: 11.6054, lng: 76.0833 },
  { slug: 'bekal',          name: 'Bekal fort',                 city: 'kozhikode', lat: 12.3908, lng: 75.0330 },

  // Bengaluru
  { slug: 'blr-city',       name: 'Bengaluru city centre',      city: 'bangalore', lat: 12.9716, lng: 77.5946 },
  { slug: 'blr-airport',    name: 'Bengaluru airport (BLR)',    city: 'bangalore', lat: 13.1986, lng: 77.7066, airport: true },
  { slug: 'blr-whitefield', name: 'Whitefield, Bengaluru',      city: 'bangalore', lat: 12.9698, lng: 77.7500 },
  { slug: 'blr-coorg',      name: 'Coorg, Madikeri',            city: 'bangalore', lat: 12.4244, lng: 75.7382 },

  // Mysuru
  { slug: 'mysuru-palace',  name: 'Mysuru Palace',              city: 'mysuru', lat: 12.3052, lng: 76.6552 },
  { slug: 'srirangapatna',  name: 'Srirangapatna',              city: 'mysuru', lat: 12.4181, lng: 76.6947 },
  { slug: 'chikmagalur',    name: 'Chikkamagaluru',             city: 'mysuru', lat: 13.3161, lng: 75.7720 },

  // Chennai
  { slug: 'chennai-central', name: 'Chennai Central',           city: 'chennai', lat: 13.0827, lng: 80.2755 },
  { slug: 'chennai-airport', name: 'Chennai airport (MAA)',     city: 'chennai', lat: 12.9941, lng: 80.1709, airport: true },
  { slug: 'mahabalipuram',   name: 'Mahabalipuram',             city: 'chennai', lat: 12.6269, lng: 80.1927 },
  { slug: 'pondicherry',     name: 'Puducherry',                city: 'chennai', lat: 11.9416, lng: 79.8083 },
  { slug: 'vellore',         name: 'Vellore',                   city: 'chennai', lat: 12.9165, lng: 79.1325 },

  // Coimbatore
  { slug: 'cbe-city',       name: 'Coimbatore city',            city: 'coimbatore', lat: 11.0168, lng: 76.9558 },
  { slug: 'cjb-airport',    name: 'Coimbatore airport (CJB)',   city: 'coimbatore', lat: 11.0300, lng: 77.0434, airport: true },
  { slug: 'ooty',           name: 'Ooty (Udhagamandalam)',      city: 'coimbatore', lat: 11.4102, lng: 76.6950 },
  { slug: 'coonoor',        name: 'Coonoor',                    city: 'coimbatore', lat: 11.3530, lng: 76.7959 },
  { slug: 'palakkad',       name: 'Palakkad',                   city: 'coimbatore', lat: 10.7867, lng: 76.6548 },

  // Madurai
  { slug: 'madurai-city',   name: 'Madurai, Meenakshi temple',  city: 'madurai', lat: 9.9195,  lng: 78.1193 },
  { slug: 'ixm-airport',    name: 'Madurai airport (IXM)',      city: 'madurai', lat: 9.8345,  lng: 78.0934, airport: true },
  { slug: 'rameswaram',     name: 'Rameswaram',                 city: 'madurai', lat: 9.2876,  lng: 79.3129 },
  { slug: 'kodaikanal',     name: 'Kodaikanal',                 city: 'madurai', lat: 10.2381, lng: 77.4892 },
  { slug: 'thanjavur',      name: 'Thanjavur',                  city: 'madurai', lat: 10.7870, lng: 79.1378 },

  // Delhi NCR
  { slug: 'delhi-cp',       name: 'Connaught Place, Delhi',     city: 'delhi', lat: 28.6304, lng: 77.2177 },
  { slug: 'del-airport',    name: 'Indira Gandhi Intl Airport (DEL)', city: 'delhi', lat: 28.5562, lng: 77.1000, airport: true },
  { slug: 'delhi-aerocity', name: 'Aerocity / Gurgaon CyberHub', city: 'delhi', lat: 28.5494, lng: 77.1215 },
  { slug: 'delhi-noida',    name: 'Sector 18, Noida',           city: 'delhi', lat: 28.5708, lng: 77.3261 },
  { slug: 'delhi-agra',     name: 'Taj Mahal, Agra',            city: 'delhi', lat: 27.1751, lng: 78.0421 },

  // Mumbai
  { slug: 'mumbai-bkc',     name: 'BKC (Bandra Kurla Complex)', city: 'mumbai', lat: 19.0657, lng: 72.8687 },
  { slug: 'bom-airport',    name: 'Chhatrapati Shivaji Intl Airport (BOM)', city: 'mumbai', lat: 19.0896, lng: 72.8656, airport: true },
  { slug: 'mumbai-colaba',  name: 'Colaba / Marine Drive',      city: 'mumbai', lat: 18.9220, lng: 72.8347 },
  { slug: 'mumbai-lonavala', name: 'Lonavala / Khandala',       city: 'mumbai', lat: 18.7557, lng: 73.4091 },

  // Pune
  { slug: 'pune-city',      name: 'Koregaon Park, Pune',        city: 'pune', lat: 18.5362, lng: 73.8940 },
  { slug: 'pnq-airport',    name: 'Pune Airport (PNQ)',         city: 'pune', lat: 18.5822, lng: 73.9197, airport: true },
  { slug: 'pune-hinjewadi', name: 'Hinjewadi IT Park',          city: 'pune', lat: 18.5913, lng: 73.7389 },

  // Goa
  { slug: 'goa-panaji',     name: 'Panaji / Miramar',           city: 'goa', lat: 15.4989, lng: 73.8278 },
  { slug: 'goi-airport',    name: 'Dabolim Airport (GOI)',      city: 'goa', lat: 15.3808, lng: 73.8313, airport: true },
  { slug: 'goa-calangute',  name: 'Calangute / Candolim beach', city: 'goa', lat: 15.5430, lng: 73.7667 },

  // Jaipur
  { slug: 'jaipur-city',    name: 'Jaipur City Palace / C-Scheme', city: 'jaipur', lat: 26.9258, lng: 75.8237 },
  { slug: 'jai-airport',    name: 'Jaipur Airport (JAI)',       city: 'jaipur', lat: 26.8242, lng: 75.8122, airport: true },
  { slug: 'jaipur-amber',   name: 'Amber Fort',                 city: 'jaipur', lat: 26.9855, lng: 75.8513 },

  // Hyderabad
  { slug: 'hyd-city',       name: 'Banjara Hills / Jubilee Hills', city: 'hyderabad', lat: 17.4156, lng: 78.4350 },
  { slug: 'hyd-airport',    name: 'Rajiv Gandhi Intl Airport (HYD)', city: 'hyderabad', lat: 17.2403, lng: 78.4294, airport: true },
  { slug: 'hyd-hitec',      name: 'HITEC City / Gachibowli',    city: 'hyderabad', lat: 17.4474, lng: 78.3762 },

  // Kolkata
  { slug: 'kolkata-park',   name: 'Park Street, Kolkata',       city: 'kolkata', lat: 22.5516, lng: 88.3524 },
  { slug: 'ccu-airport',    name: 'Netaji Subhash Chandra Bose Airport (CCU)', city: 'kolkata', lat: 22.6547, lng: 88.4467, airport: true },
  { slug: 'kolkata-newtown', name: 'New Town / Salt Lake',      city: 'kolkata', lat: 22.5850, lng: 88.4700 },
];

/**
 * Where the vehicles actually live.
 *
 * Internal (§9): a garage is a pricing input, never a thing a customer is
 * shown. Every car is based at one, and the priced distance runs garage →
 * pickup → events → drop → garage. A city centroid would have been easier and
 * would have quoted the dead-head legs wrong by ten kilometres a time.
 */
const garages = [
  { slug: 'kochi-yard',      name: 'Kochi — Kaloor yard',            city: 'kochi',      lat: 9.9915,  lng: 76.2999 },
  { slug: 'trivandrum-yard', name: 'Thiruvananthapuram — Kazhakkoottam yard', city: 'trivandrum', lat: 8.5658, lng: 76.8790 },
  { slug: 'kozhikode-yard',  name: 'Kozhikode — Vengeri yard',       city: 'kozhikode',  lat: 11.2600, lng: 75.8100 },
  { slug: 'bangalore-yard',  name: 'Bengaluru — Peenya yard',        city: 'bangalore',  lat: 13.0287, lng: 77.5195 },
  { slug: 'mysuru-yard',     name: 'Mysuru — Hebbal yard',           city: 'mysuru',     lat: 12.3450, lng: 76.6200 },
  { slug: 'chennai-yard',    name: 'Chennai — Guindy yard',          city: 'chennai',    lat: 13.0067, lng: 80.2206 },
  { slug: 'coimbatore-yard', name: 'Coimbatore — Peelamedu yard',    city: 'coimbatore', lat: 11.0290, lng: 77.0000 },
  { slug: 'madurai-yard',    name: 'Madurai — Thirunagar yard',      city: 'madurai',    lat: 9.8900,  lng: 78.0800 },
  { slug: 'delhi-yard',      name: 'Delhi — Aerocity yard',          city: 'delhi',      lat: 28.5500, lng: 77.1200 },
  { slug: 'mumbai-yard',     name: 'Mumbai — BKC yard',              city: 'mumbai',     lat: 19.0600, lng: 72.8600 },
  { slug: 'pune-yard',       name: 'Pune — Shivajinagar yard',       city: 'pune',       lat: 18.5300, lng: 73.8500 },
  { slug: 'goa-yard',        name: 'Goa — Porvorim yard',            city: 'goa',        lat: 15.5300, lng: 73.8200 },
  { slug: 'jaipur-yard',     name: 'Jaipur — Mansarovar yard',       city: 'jaipur',     lat: 26.8600, lng: 75.7600 },
  { slug: 'hyd-yard',        name: 'Hyderabad — Madhapur yard',      city: 'hyderabad',  lat: 17.4500, lng: 78.3900 },
  { slug: 'kolkata-yard',    name: 'Kolkata — Salt Lake yard',       city: 'kolkata',    lat: 22.5800, lng: 88.4200 },
];
const carTypes = [
  { slug: 'luxury-sedan', name: 'Luxury sedan' },
  { slug: 'muv',          name: 'MUV' },
  { slug: 'luxury-suv',   name: 'Luxury SUV' },
  { slug: 'suv',          name: 'SUV' },
  { slug: 'premium-muv',  name: 'Premium MUV' },
  { slug: 'premium-van',  name: 'Premium van' },
  { slug: 'van-tempo',    name: 'Van / tempo' },
  { slug: 'ultra-luxury', name: 'Ultra luxury' },
  // The segments §4 names that the fleet had no word for. Each one has
  // inventory below it: a filter chip that leads to an empty grid is worse
  // than not offering the chip at all.
  { slug: 'convertible',  name: 'Convertible' },
  { slug: 'sports',       name: 'Sports car' },
  { slug: 'vintage',      name: 'Vintage' },
  { slug: 'limousine',    name: 'Limousine' },
];

const packages = [
  { slug: 'p8',   label: '8 hrs / 80 km',            hours: 8,  km: 80,  rateKey: 'rate_8h',   sub: 'Half day in the city',  icon: 'ph-clock' },
  { slug: 'p12',  label: '12 hrs / 120 km',          hours: 12, km: 120, rateKey: 'rate_12h',  sub: 'Long day, functions',   icon: 'ph-clock-clockwise' },
  { slug: 'full', label: 'Full day 24 hrs / 300 km', hours: 24, km: 300, rateKey: 'rate_full', sub: 'Outstation, multi-city', icon: 'ph-road-horizon' },
];

const cars = [
  {
    slug: 'eclass', name: 'Mercedes-Benz E-Class', year: 2023, type: 'luxury-sedan',
    seats: 4, transmission: 'Automatic', fuel: 'Petrol', city: 'kochi', garage: 'kochi-yard',
    rating: 4.9, badge: 'Most booked', occasions: ['wedding', 'celebrity', 'casual'],
    rate8h: 6500, rate12h: 8900, rateFull: 12500,
    extraKmRate: 34, extraHrRate: 350, bata: 600, nightCharge: 500,
  },
  {
    slug: 'innova', name: 'Toyota Innova Crysta', year: 2022, type: 'muv',
    seats: 7, transmission: 'Manual', fuel: 'Diesel', city: 'bangalore', garage: 'bangalore-yard',
    rating: 4.8, badge: 'Best value', occasions: ['casual', 'wedding'],
    rate8h: 4000, rate12h: 5600, rateFull: 7800,
    extraKmRate: 18, extraHrRate: 200, bata: 500, nightCharge: 400,
  },
  {
    slug: 'x5', name: 'BMW X5', year: 2023, type: 'luxury-suv',
    seats: 5, transmission: 'Automatic', fuel: 'Diesel', city: 'trivandrum', garage: 'trivandrum-yard',
    rating: 4.9, badge: 'Celebrity pick', occasions: ['celebrity', 'wedding'],
    rate8h: 8500, rate12h: 11500, rateFull: 15900,
    extraKmRate: 45, extraHrRate: 450, bata: 700, nightCharge: 600,
  },
  {
    slug: 'fortuner', name: 'Toyota Fortuner', year: 2022, type: 'suv',
    seats: 7, transmission: 'Automatic', fuel: 'Diesel', city: 'coimbatore', garage: 'coimbatore-yard',
    rating: 4.7, badge: 'Convoy ready', occasions: ['wedding', 'casual'],
    rate8h: 5500, rate12h: 7400, rateFull: 10200,
    extraKmRate: 26, extraHrRate: 280, bata: 600, nightCharge: 500,
  },
  {
    slug: 'a6', name: 'Audi A6', year: 2023, type: 'luxury-sedan',
    seats: 4, transmission: 'Automatic', fuel: 'Petrol', city: 'mysuru', garage: 'mysuru-yard',
    rating: 4.8, badge: 'Bridal car', occasions: ['wedding', 'celebrity'],
    rate8h: 7200, rate12h: 9800, rateFull: 13500,
    extraKmRate: 38, extraHrRate: 380, bata: 650, nightCharge: 550,
  },
  {
    slug: 'carnival', name: 'Kia Carnival', year: 2023, type: 'premium-muv',
    seats: 7, transmission: 'Automatic', fuel: 'Diesel', city: 'chennai', garage: 'chennai-yard',
    rating: 4.8, badge: 'Crew favourite', occasions: ['celebrity', 'casual'],
    rate8h: 6800, rate12h: 9200, rateFull: 12800,
    extraKmRate: 32, extraHrRate: 340, bata: 600, nightCharge: 500,
  },
  {
    slug: 'vclass', name: 'Mercedes-Benz V-Class', year: 2022, type: 'premium-van',
    seats: 7, transmission: 'Automatic', fuel: 'Diesel', city: 'kochi', garage: 'kochi-yard',
    rating: 4.9, badge: 'Privacy build', occasions: ['celebrity', 'wedding'],
    rate8h: 9500, rate12h: 12800, rateFull: 17500,
    extraKmRate: 48, extraHrRate: 480, bata: 750, nightCharge: 650,
  },
  {
    slug: 'urbania', name: 'Force Urbania', year: 2023, type: 'van-tempo',
    seats: 13, transmission: 'Manual', fuel: 'Diesel', city: 'bangalore', garage: 'bangalore-yard',
    rating: 4.6, badge: 'Guest transfer', occasions: ['wedding', 'casual'],
    rate8h: 7500, rate12h: 9800, rateFull: 13200,
    extraKmRate: 34, extraHrRate: 300, bata: 600, nightCharge: 500,
  },
  {
    slug: 'vellfire', name: 'Toyota Vellfire', year: 2023, type: 'premium-van',
    seats: 6, transmission: 'Automatic', fuel: 'Hybrid', city: 'kozhikode', garage: 'kozhikode-yard',
    rating: 4.9, badge: 'Executive cabin', occasions: ['celebrity', 'wedding', 'casual'],
    rate8h: 12000, rate12h: 16000, rateFull: 21500,
    extraKmRate: 60, extraHrRate: 600, bata: 800, nightCharge: 700,
  },
  {
    slug: 'camry', name: 'Toyota Camry Hybrid', year: 2022, type: 'luxury-sedan',
    seats: 4, transmission: 'Automatic', fuel: 'Hybrid', city: 'madurai', garage: 'madurai-yard',
    rating: 4.7, badge: 'Quiet ride', occasions: ['casual', 'wedding', 'celebrity'],
    rate8h: 5800, rate12h: 7900, rateFull: 11000,
    extraKmRate: 30, extraHrRate: 320, bata: 550, nightCharge: 450,
  },
  {
    slug: 'boxster', name: 'Porsche 718 Boxster', year: 2022, type: 'convertible',
    seats: 2, transmission: 'Automatic', fuel: 'Petrol', city: 'kochi', garage: 'kochi-yard',
    rating: 4.8, badge: 'Roof down', occasions: ['celebrity', 'wedding'],
    rate8h: 18000, rate12h: 24000, rateFull: 32000,
    extraKmRate: 90, extraHrRate: 900, bata: 900, nightCharge: 900,
  },
  {
    slug: 'mustang', name: 'Ford Mustang GT', year: 2021, type: 'sports',
    seats: 4, transmission: 'Automatic', fuel: 'Petrol', city: 'bangalore', garage: 'bangalore-yard',
    rating: 4.7, badge: 'Shoot favourite', occasions: ['celebrity', 'wedding'],
    rate8h: 16500, rate12h: 22000, rateFull: 29500,
    extraKmRate: 85, extraHrRate: 850, bata: 800, nightCharge: 800,
  },
  {
    slug: 'belair', name: 'Chevrolet Bel Air 1957', year: 1957, type: 'vintage',
    seats: 4, transmission: 'Manual', fuel: 'Petrol', city: 'kochi', garage: 'kochi-yard',
    // A sixty-year-old car is not sent down a highway to another state (§6).
    serviceCities: ['kochi'],
    rating: 4.9, badge: 'Vintage', occasions: ['wedding', 'celebrity'],
    rate8h: 22000, rate12h: 28000, rateFull: 36000,
    extraKmRate: 110, extraHrRate: 1100, bata: 1000, nightCharge: 1000,
  },
  {
    slug: 'stretch', name: 'Lincoln Town Car Stretch', year: 2019, type: 'limousine',
    seats: 8, transmission: 'Automatic', fuel: 'Petrol', city: 'chennai', garage: 'chennai-yard',
    rating: 4.6, badge: 'Eight seats', occasions: ['wedding', 'celebrity'],
    rate8h: 26000, rate12h: 34000, rateFull: 45000,
    extraKmRate: 120, extraHrRate: 1200, bata: 1200, nightCharge: 1200,
  },
  {
    slug: 'ghost', name: 'Rolls-Royce Ghost', year: 2021, type: 'ultra-luxury',
    seats: 4, transmission: 'Automatic', fuel: 'Petrol', city: 'bangalore', garage: 'bangalore-yard',
    serviceCities: ['bangalore', 'mysuru'],
    rating: 5.0, badge: 'Signature', occasions: ['wedding', 'celebrity'],
    rate8h: 35000, rate12h: 45000, rateFull: 60000,
    extraKmRate: 150, extraHrRate: 1500, bata: 1500, nightCharge: 1500,
  },
];

const occasions = [
  {
    slug: 'wedding', name: 'Wedding', icon: 'ph-heart',
    tagline: 'Bridal car, convoy, guest fleet',
    surcharge: 2500,
    handlingNote: 'Decor clearance, morning detailing, convoy contact',
    kicker: 'Wedding fleet',
    title: 'The car should be the calmest part of the day',
    blurb: 'A bridal car with decor clearance, a convoy for family, and a guest shuttle that runs on the timeline you give us.',
    h2: 'What a wedding booking includes',
    fleetTitle: 'Cars couples book most',
    ctaTitle: 'Hold a wedding date',
    note: 'Decor is fitted by your decorator; we allow ribbon, floral and magnetic fixings only — no adhesive or drilling.',
    includes: [
      { title: 'Decor-ready bridal car', detail: 'Cleared for floral and ribbon work, detailed the morning of' },
      { title: 'Convoy coordination', detail: 'One point of contact for every driver in the fleet' },
      { title: 'Uniformed chauffeurs', detail: 'White shirt, dark trousers, door service for the couple' },
      { title: 'Timeline held, not metered', detail: 'Waiting hours are quoted upfront, not billed as surprises' },
      { title: 'Standby vehicle on call', detail: 'For fleets of four cars or more, within the same city' },
    ],
    packages: [
      { name: 'Bride & groom car', detail: '12 hrs / 120 km · decor ready · E-Class or A6', price: '₹11,400', unit: 'from, per day' },
      { name: 'Family convoy — 3 cars', detail: 'Fortuner ×2 + Innova · 12 hrs each', price: '₹24,600', unit: 'from, per day' },
      { name: 'Guest shuttle', detail: 'Urbania 13-seater · station and hotel runs', price: '₹9,800', unit: 'from, per day' },
    ],
  },
  {
    slug: 'celebrity', name: 'Celebrity pickup', icon: 'ph-star-four',
    tagline: 'Discreet, on time, escorted',
    surcharge: 3500,
    handlingNote: 'Privacy fit-out, route plan, standby at venue',
    kicker: 'Celebrity & VIP movement',
    title: 'Airport to venue without a single loose end',
    blurb: 'Blacked-out cabins, drivers who have done this before, and a route plan shared with your team before the day.',
    h2: 'How VIP movement is handled',
    fleetTitle: 'Cars managers ask for',
    ctaTitle: 'Plan a VIP movement',
    note: 'Escort vehicles, bouncer seating and airport tarmac access are arranged on request with 48 hours notice.',
    includes: [
      { title: 'Privacy-built cabins', detail: 'V-Class and X5 with tinted rear glass and partition' },
      { title: 'Route plan in advance', detail: 'Shared on WhatsApp with alternates for crowd risk' },
      { title: 'NDA-signed drivers', detail: 'Same drivers repeat for the whole schedule' },
      { title: 'Escort and crew cars', detail: 'Carnival or Innova following the principal car' },
      { title: 'Standby at the venue', detail: 'Engine on, doors ready, for the exit window' },
    ],
    packages: [
      { name: 'Airport pickup & drop', detail: '8 hrs / 80 km · V-Class · standby included', price: '₹9,500', unit: 'from, per day' },
      { name: 'Principal + crew car', detail: 'X5 + Carnival · 12 hrs each · same-day schedule', price: '₹20,700', unit: 'from, per day' },
      { name: 'Full-day escorted', detail: '24 hrs / 300 km · 3-car movement', price: '₹46,200', unit: 'from, per day' },
    ],
  },
  {
    slug: 'casual', name: 'Casual & city', icon: 'ph-city',
    tagline: 'Airport runs, meetings, days out',
    surcharge: 0,
    handlingNote: '',
    kicker: 'Casual & city use',
    title: 'A driver for the day, priced like a package',
    blurb: 'Airport transfers, client meetings, a day of shopping. Pick 8 or 12 hours and keep the same car and driver.',
    h2: 'What a city booking includes',
    fleetTitle: 'Everyday favourites',
    ctaTitle: 'Book a car for tomorrow',
    note: 'Extra hours and km are billed at the car’s published rate — the calculator shows both before you confirm.',
    includes: [
      { title: 'Fuel and driver in the package', detail: 'Nothing extra to settle at the end of the day' },
      { title: 'Same car, same driver', detail: 'No swaps mid-day, no shared rides' },
      { title: 'Airport pickups tracked', detail: 'Driver waits free for 60 minutes on arrivals' },
      { title: 'Child seat on request', detail: 'Free, if asked at booking' },
      { title: 'Cancel free till 24 hrs', detail: 'Advance refunded to the same UPI ID' },
    ],
    packages: [
      { name: 'Airport transfer', detail: 'One-way drop · Innova Crysta', price: '₹1,900', unit: 'from, per transfer' },
      { name: 'City day', detail: '8 hrs / 80 km · Innova or E-Class', price: '₹4,000', unit: 'from, per day' },
      { name: 'Corporate week', detail: '5 days × 12 hrs · one driver', price: '₹26,400', unit: 'from, per week' },
    ],
  },
  {
    slug: 'tour', name: 'Outstation & tours', icon: 'ph-mountains',
    tagline: 'Munnar, Alleppey, temple circuits',
    surcharge: 0,
    handlingNote: '',
    kicker: 'Outstation & tours',
    title: 'Kerala in four days, without changing cars',
    blurb: 'Hill stations, backwaters and temple circuits on a per-day package with the km you actually drive.',
    h2: 'How outstation trips are quoted',
    fleetTitle: 'Built for long roads',
    ctaTitle: 'Price a tour',
    note: 'Interstate permits and tolls are at actuals. One-way drops carry a driver-return allowance, shown as its own line.',
    includes: [
      { title: 'Per-day package, 300 km', detail: 'Extra km billed only past the package' },
      { title: 'Driver stay handled', detail: 'Bata covers his food and lodging' },
      { title: 'Night driving limits', detail: 'No driving past 11pm without a second driver' },
      { title: 'Route suggestions', detail: 'Halts and photo stops your driver knows' },
      { title: 'One-way drops allowed', detail: 'Return allowance shown before you pay' },
    ],
    packages: [
      { name: 'Kochi → Munnar → back', detail: '2 days · 24 hrs / 300 km each', price: '₹18,900', unit: 'from, per trip' },
      { name: 'Backwater run', detail: 'Kochi → Alleppey → Kochi · 1 day', price: '₹8,400', unit: 'from, per trip' },
      { name: 'Temple circuit', detail: 'Guruvayur + Thrissur · 12 hrs', price: '₹9,200', unit: 'from, per trip' },
    ],
  },
];

// "Fares people ask for most" on each city page. The prototype derived these
// from its fake geometry; these are real road distances, published as
// km_override so the estimate never contradicts what a local already knows.
const cityRoutes = [
  { city: 'kochi', from: 'kochi-marine', to: 'kochi-airport',  km: 30 },
  { city: 'kochi', from: 'kochi-marine', to: 'kochi-fort',     km: 13 },
  { city: 'kochi', from: 'kochi-marine', to: 'kochi-kakkanad', km: 12 },
  { city: 'kochi', from: 'kochi-marine', to: 'alleppey',       km: 54 },
  { city: 'kochi', from: 'kochi-marine', to: 'kumarakom',      km: 55 },
  { city: 'kochi', from: 'kochi-marine', to: 'munnar',         km: 130 },
  { city: 'kochi', from: 'kochi-marine', to: 'thekkady',       km: 160 },

  { city: 'trivandrum', from: 'tvm-city', to: 'tvm-airport',  km: 7 },
  { city: 'trivandrum', from: 'tvm-city', to: 'kovalam',      km: 16 },
  { city: 'trivandrum', from: 'tvm-city', to: 'varkala',      km: 51 },
  { city: 'trivandrum', from: 'tvm-city', to: 'kanyakumari',  km: 88 },

  { city: 'kozhikode', from: 'kozhikode-city', to: 'ccj-airport', km: 27 },
  { city: 'kozhikode', from: 'kozhikode-city', to: 'wayanad',     km: 74 },
  { city: 'kozhikode', from: 'kozhikode-city', to: 'bekal',       km: 154 },

  { city: 'bangalore', from: 'blr-city', to: 'blr-airport',    km: 35 },
  { city: 'bangalore', from: 'blr-city', to: 'blr-whitefield', km: 18 },
  { city: 'bangalore', from: 'blr-city', to: 'blr-coorg',      km: 265 },

  { city: 'mysuru', from: 'mysuru-palace', to: 'srirangapatna', km: 18 },
  { city: 'mysuru', from: 'mysuru-palace', to: 'chikmagalur',   km: 175 },

  { city: 'chennai', from: 'chennai-central', to: 'chennai-airport', km: 21 },
  { city: 'chennai', from: 'chennai-central', to: 'mahabalipuram',   km: 56 },
  { city: 'chennai', from: 'chennai-central', to: 'pondicherry',     km: 152 },
  { city: 'chennai', from: 'chennai-central', to: 'vellore',         km: 138 },

  { city: 'coimbatore', from: 'cbe-city', to: 'cjb-airport', km: 12 },
  { city: 'coimbatore', from: 'cbe-city', to: 'ooty',        km: 86 },
  { city: 'coimbatore', from: 'cbe-city', to: 'coonoor',     km: 70 },
  { city: 'coimbatore', from: 'cbe-city', to: 'palakkad',    km: 55 },

  { city: 'madurai', from: 'madurai-city', to: 'ixm-airport', km: 12 },
  { city: 'madurai', from: 'madurai-city', to: 'kodaikanal',  km: 115 },
  { city: 'madurai', from: 'madurai-city', to: 'rameswaram',  km: 172 },
  { city: 'madurai', from: 'madurai-city', to: 'thanjavur',   km: 190 },

  // Delhi NCR
  { city: 'delhi', from: 'delhi-cp', to: 'del-airport',    km: 16 },
  { city: 'delhi', from: 'delhi-cp', to: 'delhi-aerocity', km: 15 },
  { city: 'delhi', from: 'delhi-cp', to: 'delhi-noida',    km: 20 },
  { city: 'delhi', from: 'delhi-cp', to: 'delhi-agra',     km: 210 },

  // Mumbai
  { city: 'mumbai', from: 'mumbai-bkc', to: 'bom-airport',    km: 8 },
  { city: 'mumbai', from: 'mumbai-bkc', to: 'mumbai-colaba',  km: 22 },
  { city: 'mumbai', from: 'mumbai-bkc', to: 'mumbai-lonavala', km: 85 },

  // Pune
  { city: 'pune', from: 'pune-city', to: 'pnq-airport',    km: 10 },
  { city: 'pune', from: 'pune-city', to: 'pune-hinjewadi', km: 18 },

  // Goa
  { city: 'goa', from: 'goa-panaji', to: 'goi-airport',   km: 28 },
  { city: 'goa', from: 'goa-panaji', to: 'goa-calangute', km: 16 },

  // Jaipur
  { city: 'jaipur', from: 'jaipur-city', to: 'jai-airport',  km: 12 },
  { city: 'jaipur', from: 'jaipur-city', to: 'jaipur-amber', km: 11 },

  // Hyderabad
  { city: 'hyderabad', from: 'hyd-city', to: 'hyd-airport', km: 29 },
  { city: 'hyderabad', from: 'hyd-city', to: 'hyd-hitec',   km: 11 },

  // Kolkata
  { city: 'kolkata', from: 'kolkata-park', to: 'ccu-airport',    km: 17 },
  { city: 'kolkata', from: 'kolkata-park', to: 'kolkata-newtown', km: 15 },
];

/**
 * Peak windows (§10). Recurring MM-DD, so nobody re-enters them each year.
 *
 * The numbers are the ones a South Indian fleet actually runs on: the
 * November-to-February wedding months, the Onam fortnight, and the last
 * week of December when every car in the state is already out.
 */
const seasons = [
  {
    slug: 'wedding-season', name: 'Wedding season',
    startsOn: '11-01', endsOn: '02-28', multiplier: 1.2,
    note: 'November to February — the fleet is booked out most weekends',
  },
  {
    slug: 'onam', name: 'Onam',
    startsOn: '08-20', endsOn: '09-10', multiplier: 1.15,
    note: 'Onam fortnight',
  },
  {
    slug: 'new-year', name: 'Christmas & New Year',
    startsOn: '12-22', endsOn: '01-02', multiplier: 1.35,
    note: 'Christmas through New Year, when every car is already out',
  },
];

/**
 * Charges Xotic may bill rather than pass through (§10).
 *
 * All three ship INACTIVE, because the policy on the site today is that
 * tolls, parking and permits are paid at actuals — see `exclusions` below,
 * which says exactly that. Turning one on in /admin/settings puts it on
 * every matching quote as its own line; the two statements have to agree,
 * so the admin says so where the switch is.
 */
const charges = [
  {
    key: 'permit', label: 'Interstate permit',
    note: 'Border permit for a vehicle leaving its home state',
    amount: 1500, appliesTo: 'interstate', isActive: false,
  },
  {
    key: 'tolls', label: 'Toll allowance',
    note: 'Highway tolls on an outstation run',
    amount: 800, appliesTo: 'outstation', isActive: false,
  },
  {
    key: 'parking', label: 'Parking allowance',
    note: 'Venue and airport parking',
    amount: 300, appliesTo: 'always', isActive: false,
  },
];

const settings = {
  pricingRules: { minimumLegKm: 6, localSpeedKph: 32, outstationSpeedKph: 52, oneWayReturnPercent: 35, nightStartHour: 22, nightEndHour: 6 },
  // PLACEHOLDER — the prototype's number. Replace in /admin/settings before
  // the site goes live, or every enquiry goes to a stranger.
  whatsappNumber: '919876543210',
  phoneDisplay: '+91 98765 43210',
  email: 'hello@xotic.example',
  gstPercent: 5,
  advancePercent: 25,
  circuityFactor: 1.25,
  charges,
  inclusions: [
    'Chauffeur, uniformed and verified',
    'Fuel within the package km',
    'Vehicle insurance and maintenance',
    'GST invoice on request',
    'Free waiting: 60 min at airports',
  ],
  exclusions: [
    'Tolls, parking and entry fees',
    'Interstate permits on outstation',
    'Extra km and hours beyond package',
    'Driver bata for extra days',
  ],
  whyItems: [
    { icon: 'ph-shield-check', title: 'Inspected before every trip', body: 'Tyres, brakes, AC and interior checked and logged the day before pickup.' },
    { icon: 'ph-user-circle-check', title: 'Drivers you would trust', body: 'Police-verified, 8 years minimum, briefed on your occasion.' },
    { icon: 'ph-receipt', title: 'One price, itemised', body: 'Package, extra km, hours, bata, night charge. Nothing added later.' },
    { icon: 'ph-whatsapp-logo', title: 'Booking on WhatsApp', body: 'Quote, confirmation, driver details and invoice in one chat.' },
    { icon: 'ph-headset', title: 'Someone answers at 2am', body: 'A human on the line for the whole duration of your booking.' },
  ],
};

module.exports = { cities, locations, garages, carTypes, packages, cars, occasions, cityRoutes, seasons, settings };
