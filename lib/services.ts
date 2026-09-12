/**
 * The services the brief names (§2), and what each one has to ask (§12).
 *
 * §2 lists ten. Airport transfers is the eleventh, because §19 asks for airport
 * packages and §26 asks for an airport page, and a job with its own flight
 * number, its own free-waiting rule and its own fixed fare is not a footnote
 * to VIP movement.
 *
 * A service is not an occasion. An *occasion* is a pricing dimension — it adds
 * a handling line to a quote and tags which cars suit it. A *service* is how
 * the business is sold: a page a customer lands on from a search for "wedding
 * car rental Kochi", with copy about that job and a form that asks the
 * questions that job actually needs answered.
 *
 * Keeping them separate is what lets the search stay simple. The fleet list
 * has no occasion picker on purpose — nobody browsing for a price is thinking
 * in those terms — while these pages carry the intent instead.
 *
 * The `fields` on each service are the reason this file exists. §12 is explicit
 * that an enquiry must capture what the service needs: a wedding lead without a
 * venue and a car count cannot be quoted, and a monthly chauffeur lead without
 * hours-per-day cannot be priced at all. A generic contact form loses all of
 * that and leaves staff to chase it over three messages.
 */

export type ServiceFieldType = "text" | "number" | "date" | "select" | "textarea";

export interface ServiceField {
  name: string;
  label: string;
  type: ServiceFieldType;
  /** For selects. The first option is the default. */
  options?: string[];
  required?: boolean;
  placeholder?: string;
  hint?: string;
  /** Half-width on wide screens; long answers take the full row. */
  wide?: boolean;
}

export interface ServicePackage {
  name: string;
  detail: string;
  price: string;
  unit: string;
}

/**
 * How a visitor sorts these in their head.
 *
 * Eleven services in one flat grid asks somebody to read eleven things to
 * find the one they came for. Three bands means they read a heading, then
 * three or four things. The split is by what the trip IS, not by what we
 * charge for it: a wedding and a photoshoot are both occasions even though
 * they price differently, and an airport run and a monthly driver are both
 * business even though one is 40 minutes and the other is a year.
 */
export type ServiceGroup = "occasions" | "business" | "travel";

export const SERVICE_GROUPS: Array<{ key: ServiceGroup; name: string; blurb: string }> = [
  {
    key: "occasions",
    name: "Occasions",
    blurb:
      "A day with a timeline somebody else set. The car is prepared for it, and the hours are held rather than metered.",
  },
  {
    key: "business",
    name: "Business travel",
    blurb:
      "Billed to a company, invoiced with GST, and driven by someone your people will see again.",
  },
  {
    key: "travel",
    name: "Touring and outstation",
    blurb:
      "Long distances, priced with the fuel, the tolls and the driver\u2019s stay already counted.",
  },
];

export interface Service {
  slug: string;
  name: string;
  /** Short label for nav and cards. */
  short: string;
  icon: string;
  kicker: string;
  title: string;
  blurb: string;
  /** The one-line promise, for cards and meta descriptions. */
  tagline: string;
  /** Which occasion prices it — the handling line and the fleet tag. */
  occasionSlug: string;
  /** Which band it sits under on the services index. */
  group: ServiceGroup;
  /** Pre-set filters for "see the cars for this", so the link lands usefully. */
  carFilter: { type?: string; seats?: string };
  h2: string;
  includes: Array<{ title: string; detail: string }>;
  packages: ServicePackage[];
  /** The honest caveat. Every service has one; hiding it costs a lead later. */
  note: string;
  fields: ServiceField[];
}

/** Asked by nearly every service, so written once. */
const WHERE: ServiceField = {
  name: "city",
  label: "City or area",
  type: "text",
  required: true,
  placeholder: "Kochi, Kottayam, Bengaluru…",
};

const WHEN: ServiceField = { name: "date", label: "Date", type: "date", required: true };

/**
 * §12 asks nearly every service for a segment and a budget. They are one pair
 * of questions, not ten — and the segment options are the ones §4 names, so a
 * customer's answer here matches the chip they would have tapped on the fleet.
 */
const SEGMENT: ServiceField = {
  name: "segment",
  label: "Car segment",
  type: "select",
  options: [
    "No preference",
    "Luxury sedan",
    "Luxury SUV",
    "SUV",
    "Premium MUV",
    "Premium van",
    "Convertible",
    "Sports car",
    "Vintage",
    "Limousine",
    "Ultra luxury",
  ],
};

const BUDGET: ServiceField = {
  name: "budget",
  label: "Budget",
  type: "select",
  options: [
    "Not sure yet",
    "Under ₹10,000",
    "Under ₹15,000",
    "Under ₹20,000",
    "Under ₹30,000",
    "₹30,000+",
  ],
};

const NOTES: ServiceField = {
  name: "notes",
  label: "Anything else we should know",
  type: "textarea",
  placeholder: "Timings, flight numbers, special requests",
  wide: true,
};

export const SERVICES: Service[] = [
  {
    slug: "wedding",
    name: "Wedding car rental",
    short: "Wedding",
    icon: "ph-heart",
    kicker: "Wedding fleet",
    title: "The car should be the calmest part of the day",
    blurb:
      "A bridal car cleared for decor, a convoy that keeps the family together, and a guest shuttle that runs to the timeline you give us.",
    tagline: "Bridal car, convoy and guest shuttle",
    occasionSlug: "wedding",
    group: "occasions",
    carFilter: {},
    h2: "What a wedding booking includes",
    includes: [
      {
        title: "Decor-ready bridal car",
        detail: "Cleared for floral and ribbon work, detailed the morning of",
      },
      {
        title: "Convoy coordination",
        detail: "One point of contact for every driver in the fleet",
      },
      {
        title: "Uniformed chauffeurs",
        detail: "White shirt, dark trousers, door service for the couple",
      },
      {
        title: "Timeline held, not metered",
        detail: "Waiting hours are quoted upfront, not billed as a surprise",
      },
      {
        title: "Standby vehicle on call",
        detail: "For fleets of four cars or more, within the same city",
      },
    ],
    packages: [
      {
        name: "Bride & groom car",
        detail: "12 hrs / 120 km · decor ready · E-Class or A6",
        price: "₹11,400",
        unit: "from, per day",
      },
      {
        name: "Family convoy — 3 cars",
        detail: "Fortuner ×2 + Innova · 12 hrs each",
        price: "₹24,600",
        unit: "from, per day",
      },
      {
        name: "Guest shuttle",
        detail: "Urbania 13-seater · station and hotel runs",
        price: "₹9,800",
        unit: "from, per day",
      },
    ],
    note: "Decor is fitted by your decorator. We allow ribbon, floral and magnetic fixings only — no adhesive and no drilling.",
    fields: [
      WHEN,
      { ...WHERE, label: "Venue or city" },
      {
        name: "bridalCar",
        label: "Bridal car",
        type: "select",
        options: ["Yes, decor-ready", "No, plain car is fine", "Not decided"],
      },
      { name: "convoyCars", label: "Cars in the convoy", type: "number", placeholder: "3" },
      { name: "guestSeats", label: "Guest shuttle seats", type: "number", placeholder: "26" },
      {
        name: "muhurtham",
        label: "Muhurtham or ceremony time",
        type: "text",
        placeholder: "10:30 am at the church, reception 7 pm",
      },
      SEGMENT,
      BUDGET,
      NOTES,
    ],
  },
  {
    slug: "photoshoot",
    name: "Photoshoot & film shoot cars",
    short: "Photoshoot",
    icon: "ph-camera",
    kicker: "Camera work",
    title: "Cars that hold up on camera, with drivers who have done a shoot",
    blurb:
      "Picture cars for stills, ads and film — parked, driven or towed — with drivers who understand a call sheet and a locked-off take.",
    tagline: "Picture cars for stills, ads and film",
    occasionSlug: "celebrity",
    group: "occasions",
    carFilter: {},
    h2: "How a shoot booking works",
    includes: [
      { title: "Picture-car condition", detail: "Detailed before call time, no dealer plates or stickers" },
      { title: "Drivers who hold a mark", detail: "Repeat passes, roll-throughs and precise stops" },
      { title: "On-set standby billed by the hour", detail: "Halt hours quoted upfront, not guessed at wrap" },
      { title: "Multiple units", detail: "Two or more identical cars where continuity needs them" },
      { title: "Insurance letter on request", detail: "For productions whose policy needs the vehicle named" },
    ],
    packages: [
      {
        name: "Stills day",
        detail: "8 hrs / 80 km · one car, one location",
        price: "₹7,400",
        unit: "from, per day",
      },
      {
        name: "Ad film unit",
        detail: "12 hrs · picture car + crew MUV",
        price: "₹18,900",
        unit: "from, per day",
      },
      {
        name: "Multi-day feature",
        detail: "Full day rate, weekly billing, driver stay included",
        price: "On request",
        unit: "per schedule",
      },
    ],
    note: "Stunt driving, roof rigs and camera mounts need the vehicle cleared in advance — tell us at enquiry, not on the day.",
    fields: [
      WHEN,
      { ...WHERE, label: "Location" },
      {
        name: "shootType",
        label: "Kind of shoot",
        type: "select",
        options: ["Stills / portfolio", "Ad film", "Feature or series", "Music video", "Wedding shoot"],
      },
      { name: "days", label: "Shoot days", type: "number", placeholder: "1" },
      { name: "hours", label: "Hours on set", type: "number", placeholder: "10" },
      {
        name: "onCamera",
        label: "Is the car on camera?",
        type: "select",
        options: ["Yes, driven on camera", "Yes, parked only", "No, crew transport"],
      },
      { name: "crewSize", label: "Crew size", type: "number", placeholder: "12" },
      SEGMENT,
      BUDGET,
      NOTES,
    ],
  },
  {
    slug: "engagement",
    name: "Engagement & reception cars",
    short: "Engagement",
    icon: "ph-sparkle",
    kicker: "Engagement & reception",
    title: "The short, sharp day that still has to look right",
    blurb:
      "Half-day bookings for engagements, receptions and betrothals — one good car, on time, with the same preparation a wedding gets.",
    tagline: "Half-day bookings, wedding-grade preparation",
    occasionSlug: "wedding",
    group: "occasions",
    carFilter: {},
    h2: "What an engagement booking includes",
    includes: [
      { title: "Half-day rates", detail: "8 hrs / 80 km, which is what these days actually run to" },
      { title: "Light decor allowed", detail: "Ribbon and floral work, fitted by your decorator" },
      { title: "Two-venue runs", detail: "Home, hall and back, with waiting time quoted upfront" },
      { title: "Photographs at the car", detail: "The driver steps away; nobody is in your frame" },
    ],
    packages: [
      {
        name: "Couple's car",
        detail: "8 hrs / 80 km · decor allowed",
        price: "₹7,400",
        unit: "from, per day",
      },
      {
        name: "Car + family MUV",
        detail: "8 hrs each · two vehicles",
        price: "₹12,200",
        unit: "from, per day",
      },
    ],
    note: "Engagement bookings are priced on the wedding rate card, including the handling line — the preparation is the same work.",
    fields: [
      WHEN,
      { ...WHERE, label: "Venue or city" },
      {
        name: "eventType",
        label: "Occasion",
        type: "select",
        options: ["Engagement", "Reception", "Betrothal", "Anniversary"],
      },
      { name: "cars", label: "Cars needed", type: "number", placeholder: "1" },
      { name: "decor", label: "Decor on the car?", type: "select", options: ["Yes", "No"] },
      SEGMENT,
      BUDGET,
      NOTES,
    ],
  },
  {
    slug: "corporate",
    name: "Corporate & business travel",
    short: "Corporate",
    icon: "ph-briefcase",
    kicker: "Corporate travel",
    title: "Billing your accounts team will accept, first time",
    blurb:
      "Airport runs, client movement and multi-day conference fleets — booked against a company account, invoiced with GST, reconciled monthly.",
    tagline: "Account billing, GST invoices, one point of contact",
    occasionSlug: "casual",
    group: "business",
    carFilter: {},
    h2: "How corporate accounts work",
    includes: [
      { title: "GST invoice with your details", detail: "Company name, address and GSTIN on every bill" },
      { title: "Monthly consolidated billing", detail: "One invoice for the month, not one per ride" },
      { title: "Named account manager", detail: "One number for bookings, changes and escalations" },
      { title: "Repeat drivers", detail: "The same chauffeurs for the same executives, where we can" },
      { title: "Duty slips", detail: "Signed start and end readings for every duty, on request" },
    ],
    packages: [
      {
        name: "Airport transfer",
        detail: "Point to point · sedan · meet and greet",
        price: "₹2,400",
        unit: "from, per transfer",
      },
      {
        name: "Executive day",
        detail: "8 hrs / 80 km · E-Class or A6",
        price: "₹7,400",
        unit: "from, per day",
      },
      {
        name: "Conference fleet",
        detail: "4+ vehicles · coordinated arrivals",
        price: "On request",
        unit: "per event",
      },
    ],
    note: "Credit terms are agreed before the first duty. Until then corporate bookings run on the standard advance.",
    fields: [
      { name: "company", label: "Company", type: "text", required: true, placeholder: "Registered name" },
      { ...WHERE, label: "City" },
      {
        name: "requirement",
        label: "What you need",
        type: "select",
        options: [
          "Airport transfers",
          "Executive day hire",
          "Client / guest movement",
          "Conference or event fleet",
          "Monthly retainer",
        ],
      },
      { name: "vehicles", label: "Vehicles at a time", type: "number", placeholder: "2" },
      { name: "startDate", label: "Starting", type: "date" },
      { name: "gstin", label: "GSTIN", type: "text", placeholder: "For the invoice" },
      SEGMENT,
      {
        name: "vip",
        label: "VIP or protocol requirements",
        type: "text",
        placeholder: "Chairman visit, protocol seating, escort",
      },
      NOTES,
    ],
  },
  {
    slug: "packages",
    name: "Tour packages",
    short: "Packages",
    icon: "ph-package",
    kicker: "Ready-made trips",
    title: "Routes we have run enough times to price honestly",
    blurb:
      "Fixed itineraries with the driving, the fuel, the tolls and the driver's stay already counted — so the number you are told is the number you pay.",
    tagline: "Fixed itineraries, all-in pricing",
    occasionSlug: "tour",
    group: "travel",
    carFilter: {},
    h2: "What a package covers",
    includes: [
      { title: "The whole running cost", detail: "Fuel, tolls, permits, parking and the driver's stay" },
      { title: "A written itinerary", detail: "Day by day, with the driving hours stated" },
      { title: "Your own pace", detail: "Stops added or dropped before the trip, re-quoted in writing" },
      { title: "Hotel help, not hotel markup", detail: "We suggest and book; you pay the hotel directly" },
    ],
    packages: [
      {
        name: "Munnar & Thekkady",
        detail: "3 days / 2 nights · Innova · from Kochi",
        price: "₹21,500",
        unit: "from, all in",
      },
      {
        name: "Kerala backwaters",
        detail: "4 days · Alleppey, Kumarakom, Kochi",
        price: "₹28,900",
        unit: "from, all in",
      },
      {
        name: "Ooty & Coonoor",
        detail: "3 days · from Coimbatore or Kochi",
        price: "₹23,400",
        unit: "from, all in",
      },
    ],
    note: "Hill-station permits and forest entry fees are paid at the gate and are not part of the package price.",
    fields: [
      {
        name: "package",
        label: "Which package",
        type: "select",
        options: [
          "Munnar & Thekkady",
          "Kerala backwaters",
          "Ooty & Coonoor",
          "Wayanad",
          "Something else — described below",
        ],
      },
      WHEN,
      { name: "nights", label: "Nights", type: "number", placeholder: "2" },
      { name: "travellers", label: "Travellers", type: "number", placeholder: "4" },
      {
        name: "hotels",
        label: "Do you want hotel suggestions?",
        type: "select",
        options: ["Yes please", "No, already booked"],
      },
      NOTES,
    ],
  },
  {
    slug: "vip-transfers",
    name: "VIP & celebrity transfers",
    short: "VIP transfers",
    icon: "ph-star-four",
    kicker: "VIP movement",
    title: "Airport to venue without a single loose end",
    blurb:
      "Privacy-built cabins, drivers who have done this before, and a route plan shared with your team the day before — not improvised at arrivals.",
    tagline: "Discreet, on time, escorted",
    occasionSlug: "celebrity",
    group: "business",
    carFilter: {},
    h2: "How VIP movement is handled",
    includes: [
      { title: "Privacy-built cabins", detail: "V-Class and X5 with tinted rear glass and a partition" },
      { title: "Route plan in advance", detail: "Shared with your team, with alternates for crowd risk" },
      { title: "Flight tracked", detail: "The car moves with the aircraft, not with the schedule" },
      { title: "Standby at venue", detail: "The car stays; you are never waiting for it to come back" },
      { title: "Escort vehicles", detail: "Arranged on 48 hours notice where the movement needs them" },
    ],
    packages: [
      {
        name: "Airport → venue",
        detail: "Single transfer · V-Class · meet inside",
        price: "₹6,900",
        unit: "from, per transfer",
      },
      {
        name: "Full-day standby",
        detail: "12 hrs · car held at the venue",
        price: "₹16,300",
        unit: "from, per day",
      },
      {
        name: "Movement with escort",
        detail: "Principal car + escort SUV",
        price: "On request",
        unit: "per movement",
      },
    ],
    note: "Tarmac access, escort vehicles and security seating need 48 hours notice and, in some airports, your own clearance.",
    fields: [
      WHEN,
      { ...WHERE, label: "Pickup city" },
      {
        name: "movement",
        label: "Movement",
        type: "select",
        options: ["Airport arrival", "Airport departure", "Venue to venue", "Full-day standby"],
      },
      { name: "flight", label: "Flight number", type: "text", placeholder: "6E 234" },
      { name: "party", label: "People in the party", type: "number", placeholder: "3" },
      SEGMENT,
      {
        name: "escort",
        label: "Escort vehicle?",
        type: "select",
        options: ["Not needed", "Yes, one escort", "Yes, discuss the detail"],
      },
      NOTES,
    ],
  },
  {
    slug: "airport-transfers",
    name: "Airport transfers",
    short: "Airport",
    icon: "ph-airplane-takeoff",
    kicker: "Airport pickup and drop",
    title: "The car is there when the aircraft is, not when the clock says",
    blurb:
      "Flight-tracked pickups at Kochi, Trivandrum, Bengaluru and Chennai, with the driver waiting inside and the fare fixed before you land.",
    tagline: "Flight-tracked, fixed fare, met inside",
    occasionSlug: "casual",
    group: "business",
    carFilter: {},
    h2: "What an airport booking includes",
    includes: [
      { title: "Flight tracked", detail: "A delayed arrival moves the pickup, not the price" },
      { title: "Met inside the terminal", detail: "Name board at arrivals, on request" },
      { title: "Free waiting", detail: "60 minutes after an international arrival, 30 after a domestic one" },
      { title: "Fixed fare", detail: "Quoted point to point, with tolls and parking in it" },
      { title: "Night arrivals covered", detail: "The night charge is on the quote, never added later" },
    ],
    packages: [
      {
        name: "City airport transfer",
        detail: "Point to point · sedan · met inside",
        price: "₹2,400",
        unit: "from, per transfer",
      },
      {
        name: "Group arrival",
        detail: "Innova or Carnival · up to 7 with bags",
        price: "₹3,600",
        unit: "from, per transfer",
      },
      {
        name: "Long-haul drop",
        detail: "Airport to another city, one way",
        price: "On request",
        unit: "per transfer",
      },
    ],
    note: "Airport parking and entry fees are included in the quote. A wait beyond the free period is billed at the car's hourly rate, in 30-minute steps.",
    fields: [
      {
        name: "direction",
        label: "Pickup or drop",
        type: "select",
        options: ["Airport pickup", "Airport drop", "Both, return trip"],
      },
      { name: "airport", label: "Airport", type: "text", required: true, placeholder: "Kochi (COK)" },
      {
        name: "address",
        label: "The other end",
        type: "text",
        required: true,
        placeholder: "Hotel, home or office",
      },
      WHEN,
      { name: "time", label: "Flight time", type: "text", placeholder: "23:40 arrival" },
      { name: "flight", label: "Flight number", type: "text", placeholder: "6E 234" },
      { name: "passengers", label: "Passengers", type: "number", placeholder: "3" },
      { name: "bags", label: "Large bags", type: "number", placeholder: "4" },
      SEGMENT,
      NOTES,
    ],
  },
  {
    slug: "south-india-tour",
    name: "South India tours",
    short: "South India",
    icon: "ph-map-trifold",
    kicker: "Multi-state touring",
    title: "Kerala, Karnataka and Tamil Nadu on one booking",
    blurb:
      "One car, one driver and one price across the three states — no handovers at the border, no renegotiation halfway through the trip.",
    tagline: "Three states, one car, one driver",
    occasionSlug: "tour",
    group: "travel",
    carFilter: {},
    h2: "What a multi-state tour includes",
    includes: [
      { title: "Interstate permits paid", detail: "Included in the quote, not collected on the road" },
      { title: "The same driver throughout", detail: "No handovers at state borders" },
      { title: "Driver's stay and allowance", detail: "Counted in the price, not added at the end" },
      { title: "A realistic daily distance", detail: "We will tell you when an itinerary cannot be driven" },
      { title: "Written day-by-day plan", detail: "Agreed before you leave, changeable in writing" },
    ],
    packages: [
      {
        name: "Kerala grand tour",
        detail: "7 days · Kochi, Munnar, Thekkady, Alleppey, Kovalam",
        price: "₹52,000",
        unit: "from, all in",
      },
      {
        name: "Kerala & Karnataka",
        detail: "9 days · Kochi, Wayanad, Coorg, Mysuru, Bengaluru",
        price: "₹68,000",
        unit: "from, all in",
      },
      {
        name: "Temple circuit",
        detail: "6 days · Madurai, Rameswaram, Kanyakumari, Trivandrum",
        price: "₹46,500",
        unit: "from, all in",
      },
    ],
    note: "Long tours are quoted on a daily distance cap. Days that run well past it are billed at the extra-km rate, shown on the quote.",
    fields: [
      WHEN,
      {
        name: "states",
        label: "States you want to cover",
        type: "text",
        required: true,
        placeholder: "Kerala and Tamil Nadu",
      },
      {
        name: "route",
        label: "Places on the list",
        type: "textarea",
        placeholder: "Kochi → Munnar → Thekkady → Madurai",
        wide: true,
      },
      { name: "nights", label: "Nights", type: "number", placeholder: "7" },
      { name: "travellers", label: "Travellers", type: "number", placeholder: "4" },
      {
        name: "startCity",
        label: "Starting from",
        type: "text",
        placeholder: "Kochi airport",
      },
      NOTES,
    ],
  },
  {
    slug: "leisure",
    name: "Leisure & family trips",
    short: "Leisure",
    icon: "ph-sun-horizon",
    kicker: "Family travel",
    title: "A car for the weekend, without the arithmetic",
    blurb:
      "Day trips, hill runs and family visits with a driver who knows the road — priced before you go, with the fuel and tolls already in it.",
    tagline: "Day trips and weekends away, priced upfront",
    occasionSlug: "casual",
    group: "travel",
    carFilter: {},
    h2: "What a leisure booking includes",
    includes: [
      { title: "Fuel and tolls counted", detail: "In the quote, so the day has no second bill" },
      { title: "Child seats on request", detail: "Free, with a day's notice" },
      { title: "Luggage that actually fits", detail: "We ask the headcount and the bags before suggesting a car" },
      { title: "Stops as you like", detail: "Within the package hours; extra hours are quoted, not sprung" },
    ],
    packages: [
      {
        name: "City day",
        detail: "8 hrs / 80 km · sedan or MUV",
        price: "₹4,200",
        unit: "from, per day",
      },
      {
        name: "Hill day trip",
        detail: "Full day · Innova · Munnar or Wayanad",
        price: "₹8,900",
        unit: "from, per day",
      },
      {
        name: "Weekend away",
        detail: "2 days · driver stay included",
        price: "₹15,600",
        unit: "from, per trip",
      },
    ],
    note: "Hill routes take longer than the map says. We quote the hours honestly rather than promising a schedule the road will not allow.",
    fields: [
      WHEN,
      { ...WHERE, label: "Starting from" },
      {
        name: "destination",
        label: "Where to",
        type: "text",
        required: true,
        placeholder: "Munnar",
      },
      { name: "travellers", label: "Adults", type: "number", placeholder: "4" },
      { name: "children", label: "Children", type: "number", placeholder: "2" },
      {
        name: "childSeat",
        label: "Child seat needed?",
        type: "select",
        options: ["No", "Yes, one", "Yes, two"],
      },
      { name: "luggage", label: "Large bags", type: "number", placeholder: "3" },
      NOTES,
    ],
  },
  {
    slug: "outstation",
    name: "Outstation trips",
    short: "Outstation",
    icon: "ph-path",
    kicker: "Out of town",
    title: "Out of the city, back the same week, one price",
    blurb:
      "One-way drops and return runs across the south, with the driver's stay, the tolls and the return leg all in the number you are quoted.",
    tagline: "One-way and return, all-in pricing",
    occasionSlug: "tour",
    group: "travel",
    carFilter: {},
    h2: "How outstation is priced",
    includes: [
      { title: "Per-km beyond the package", detail: "The rate is on the quote before you agree to it" },
      { title: "Driver bata per night", detail: "Stated as its own line, never folded into a round number" },
      { title: "Return leg counted honestly", detail: "A one-way still has to bring the car home — we show it" },
      { title: "Tolls and permits included", detail: "Nothing collected from you on the road" },
    ],
    packages: [
      {
        name: "One-way drop",
        detail: "Kochi → Bengaluru · sedan",
        price: "₹16,800",
        unit: "from, per trip",
      },
      {
        name: "Return, two days",
        detail: "Innova · driver stay included",
        price: "₹18,400",
        unit: "from, per trip",
      },
      {
        name: "Airport long-haul",
        detail: "Any city airport, point to point",
        price: "On request",
        unit: "per transfer",
      },
    ],
    note: "A one-way trip is priced with the empty return leg included. It is on the quote as its own line — that is why the number is what it is.",
    fields: [
      WHEN,
      { ...WHERE, label: "Pickup" },
      { name: "destination", label: "Drop", type: "text", required: true, placeholder: "Bengaluru" },
      {
        name: "tripType",
        label: "Trip",
        type: "select",
        options: ["One way", "Return, same day", "Return, multiple days"],
      },
      { name: "nights", label: "Nights away", type: "number", placeholder: "1" },
      { name: "travellers", label: "Travellers", type: "number", placeholder: "4" },
      NOTES,
    ],
  },
  {
    slug: "monthly-chauffeur",
    name: "Monthly chauffeur service",
    short: "Monthly chauffeur",
    icon: "ph-steering-wheel",
    kicker: "Long term",
    title: "The same driver, every morning, on a monthly bill",
    blurb:
      "A chauffeur assigned to you by the month — with our car or yours — at a rate that stops counting kilometres and starts counting days.",
    tagline: "A driver assigned by the month, your car or ours",
    occasionSlug: "casual",
    group: "business",
    carFilter: {},
    h2: "How monthly hire works",
    includes: [
      { title: "One assigned chauffeur", detail: "The same person, with a named backup for leave days" },
      { title: "Your car or ours", detail: "Driver-only rates where the vehicle is yours" },
      { title: "Fixed monthly invoice", detail: "With the overtime rate agreed in advance" },
      { title: "Background-checked drivers", detail: "Licence, address and references verified" },
      { title: "Replacement within the day", detail: "If a driver is unwell, another one starts the same shift" },
    ],
    packages: [
      {
        name: "Driver only",
        detail: "26 days · 10 hrs a day · your vehicle",
        price: "₹28,000",
        unit: "from, per month",
      },
      {
        name: "Car with driver",
        detail: "26 days · 10 hrs · sedan, 2,500 km",
        price: "₹68,000",
        unit: "from, per month",
      },
      {
        name: "Executive monthly",
        detail: "E-Class or A6 · 26 days · 12 hrs",
        price: "On request",
        unit: "per month",
      },
    ],
    note: "Monthly rates assume a six-day week and a fixed daily shift. Sundays, public holidays and overtime are billed separately at the agreed rate.",
    fields: [
      {
        name: "arrangement",
        label: "What you need",
        type: "select",
        options: ["Driver only — my car", "Car with driver", "Not sure, advise me"],
      },
      { ...WHERE, label: "City" },
      { name: "startDate", label: "Starting", type: "date" },
      { name: "months", label: "Months", type: "number", placeholder: "3" },
      { name: "hoursPerDay", label: "Hours a day", type: "number", placeholder: "10" },
      {
        name: "language",
        label: "Languages the driver should speak",
        type: "text",
        placeholder: "Malayalam, English",
      },
      NOTES,
    ],
  },
];

/**
 * What this service starts at, in rupees.
 *
 * The cheapest of its packages, read out of the price string those carry —
 * they are written for a human ("₹11,400", "On request"), and a service whose
 * every package is on request has no number to show rather than a zero. An
 * index page that gives a customer nothing to compare is an index page they
 * leave, and every other one on this site anchors with a figure.
 */
export function serviceFromPrice(service: Service): number | null {
  const prices = service.packages
      .map((item) => Number(item.price.replace(/[^0-9]/g, "")))
      .filter((value) => Number.isFinite(value) && value > 0);
  return prices.length > 0 ? Math.min(...prices) : null;
}

export function serviceBySlug(slug: string): Service | undefined {
  return SERVICES.find((service) => service.slug === slug);
}

/**
 * Where an old `/occasions/…` link should land.
 *
 * The four occasions predate the ten services and are still the pricing
 * dimension; these are the pages that replaced them for a reader.
 */
export const OCCASION_TO_SERVICE: Record<string, string> = {
  wedding: "wedding",
  celebrity: "vip-transfers",
  casual: "leisure",
  tour: "outstation",
};
