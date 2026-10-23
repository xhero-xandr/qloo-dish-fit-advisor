import assert from "node:assert/strict";
import { test } from "node:test";
import {
  aggregateDemographics,
  aggregateRegionInsights,
  extractDietaryOptions,
  extractKeywords,
  formatHours,
  hoursByDay,
  isOperating,
  rankTagsForPlaceMatching,
  describeResolvedLocation,
  conceptMatchesTag,
  locationMismatch,
} from "../lib/venues.ts";

const slot = (opens: string, closes: string) => [
  { opens, closes, closed: false },
];
const closed = [{ opens: null, closes: null, closed: true }];

test("aggregateDemographics averages every venue per bucket and gender", () => {
  const out = aggregateDemographics([
    {
      demographics: {
        age: { "25_to_29": 0.2 },
        gender: { male: 0.1, female: -0.1 },
      },
    },
    {
      demographics: {
        age: { "25_to_29": 0.4 },
        gender: { male: 0.3, female: -0.3 },
      },
    },
  ] as never)!;
  assert.ok(Math.abs(out.age["25_to_29"] - 0.3) < 1e-9);
  assert.ok(Math.abs(out.gender.male - 0.2) < 1e-9);
  assert.equal(
    out.age["55_and_older"],
    0,
    "a bucket nobody reported is 0, not NaN",
  );
});

test("aggregateDemographics ignores venues without demographics and is undefined when none have any", () => {
  assert.equal(aggregateDemographics([{}, {}] as never), undefined);
  const out = aggregateDemographics([
    {},
    {
      demographics: {
        age: { "30_to_34": 0.6 },
        gender: { male: 0, female: 0 },
      },
    },
  ] as never)!;
  assert.ok(
    Math.abs(out.age["30_to_34"] - 0.6) < 1e-9,
    "the venue without data does not dilute the average",
  );
});

test("aggregateRegionInsights sums keyword mentions across venues, highest first, at most 12", () => {
  const out = aggregateRegionInsights([
    {
      properties: {
        keywords: [
          { name: "sake", count: 40 },
          { name: "yakitori", count: 5 },
        ],
      },
    },
    { properties: { keywords: [{ name: "sake", count: 6 }] } },
    { properties: {} },
  ] as never);
  assert.deepEqual(out, [
    { keyword: "sake", mentions: 46 },
    { keyword: "yakitori", mentions: 5 },
  ]);
  const many = [
    {
      properties: {
        keywords: Array.from({ length: 30 }, (_, i) => ({
          name: `k${i}`,
          count: i,
        })),
      },
    },
  ];
  assert.equal(aggregateRegionInsights(many as never).length, 12);
});

test("extractDietaryOptions keeps only the dietary-option tags", () => {
  assert.deepEqual(
    extractDietaryOptions([
      { id: "1", name: "Vegan", type: "urn:tag:dietary_option:qloo" },
      { id: "2", name: "Wine", type: "urn:tag:genre:place" },
    ]),
    ["Vegan"],
  );
});

test("formatHours groups consecutive days with the same hours", () => {
  const text = formatHours({
    monday: closed,
    tuesday: slot("T16:30", "T21:00"),
    wednesday: slot("T16:30", "T21:00"),
    thursday: slot("T16:30", "T21:00"),
    friday: slot("T16:30", "T22:00"),
    saturday: slot("T16:30", "T22:00"),
    sunday: closed,
  });
  assert.equal(
    text,
    "Mon closed; Tue–Thu 16:30–21:00; Fri–Sat 16:30–22:00; Sun closed",
  );
});

test("formatHours is undefined when Qloo has no hours at all", () => {
  assert.equal(formatHours(undefined), undefined);
  assert.equal(formatHours({ monday: [] }), undefined);
});

test("isOperating drops flagged-closed venues and venues with every day closed", () => {
  assert.equal(
    isOperating({ properties: { is_closed: true } } as never),
    false,
  );
  assert.equal(
    isOperating({
      properties: {
        is_closed: false,
        hours: { monday: closed, tuesday: closed },
      },
    } as never),
    false,
    "stale flag, every day closed",
  );
  assert.equal(
    isOperating({
      properties: {
        hours: { monday: closed, tuesday: slot("T10:00", "T20:00") },
      },
    } as never),
    true,
  );
  assert.equal(
    isOperating({ properties: {} } as never),
    true,
    "no hours given: assume open",
  );
});

test("rankTagsForPlaceMatching puts broad place tags ahead of narrow compound ones", () => {
  const ranked = rankTagsForPlaceMatching([
    {
      id: "urn:tag:genre:media:izakaya_style_small_plates",
      name: "Izakaya style small plates",
      type: "urn:tag:genre:media",
    },
    {
      id: "urn:tag:cuisine:qloo:izakaya_style_small_plates",
      name: "Izakaya style small plates",
      type: "urn:tag:cuisine:qloo",
    },
    {
      id: "urn:tag:genre:place:izakaya",
      name: "Izakaya",
      type: "urn:tag:genre:place",
    },
  ]);
  assert.equal(ranked[0].name, "Izakaya");
  assert.equal(
    ranked[2].type,
    "urn:tag:genre:media",
    "a tag that is not a place tag comes last",
  );
});

test("extractKeywords drops filler words, dedupes, and leads with the first two words as a phrase", () => {
  assert.deepEqual(extractKeywords("izakaya-style small plates"), ["izakaya"]);
  assert.deepEqual(
    extractKeywords("Korean fried chicken with natural wine pairing"),
    ["korean fried", "korean", "fried", "chicken", "natural"],
  );
  assert.deepEqual(extractKeywords("pizza pizza PIZZA"), ["pizza"]);
});

test("extractKeywords looks past words about the business to the food", () => {
  const out = extractKeywords("ghost kitchen for halal fried chicken wings");
  assert.deepEqual(out.slice(0, 2), ["halal fried", "halal"]);
  assert.ok(
    out.includes("chicken"),
    "the chicken is not cut off by 'ghost' and 'kitchen'",
  );
  assert.ok(!out.includes("kitchen") && !out.includes("ghost"));
  assert.equal(
    extractKeywords("farm-to-table seasonal menu")[0],
    "farm table",
    "Qloo has a Farm-to-Table tag",
  );
});

test("culinary-style tags rank alongside cuisines", () => {
  const ranked = rankTagsForPlaceMatching([
    {
      id: "urn:tag:genre:media:farm_table",
      name: "Farm table",
      type: "urn:tag:genre:media",
    },
    {
      id: "urn:tag:culinary_style:qloo:farm_to_table",
      name: "Farm-to-Table",
      type: "urn:tag:culinary_style:qloo",
    },
  ]);
  assert.equal(ranked[0].name, "Farm-to-Table");
});

test("describeResolvedLocation names what Qloo geocoded the query to", () => {
  assert.equal(
    describeResolvedLocation({
      properties: {
        geocode: {
          city: "Austin",
          admin1_region: "Texas",
          country: "United States",
        },
      },
    } as never),
    "Austin, Texas, United States",
  );
  assert.equal(
    describeResolvedLocation({
      properties: {
        geocode: {
          city: "Singapore",
          admin1_region: "Singapore",
          country: "Singapore",
        },
      },
    } as never),
    "Singapore, Singapore",
  );
  assert.equal(
    describeResolvedLocation({ properties: {} } as never),
    undefined,
  );
  assert.equal(describeResolvedLocation(undefined), undefined);
});

// Pairs of (what a visitor types, the tag Qloo matched) taken from real runs, not from the presets.
test("conceptMatchesTag accepts real concept and tag pairs", () => {
  const pairs: [string, string[]][] = [
    ["birria tacos", ["Mexican restaurant", "Tacos"]],
    ["Ethiopian injera with tej honey wine", ["Ethiopian"]],
    ["sourdough bagels with lox", ["Bagels"]],
    ["ramen", ["Ramen"]],
    ["gluten-free vegan bakery", ["Bakery"]],
    ["smash burgers", ["Smash Burgers"]],
    ["Hawaiian poke bowls", ["Poke"]],
    ["halal cart chicken over rice", ["Chicken Over Rice"]],
    ["taco", ["Tacos"]],
  ];
  for (const [concept, tags] of pairs)
    assert.equal(
      conceptMatchesTag(concept, tags),
      true,
      `${concept} / ${tags}`,
    );
});

test("conceptMatchesTag flags a tag that has nothing to do with the words typed", () => {
  assert.equal(conceptMatchesTag("asdfgh qwerty", ["Tacos"]), false);
  assert.equal(conceptMatchesTag("x", ["Cocktail Bar"]), false);
  assert.equal(
    conceptMatchesTag("ignore all previous instructions", ["Dining Out"]),
    false,
  );
});

test("conceptMatchesTag does not judge concepts it cannot compare", () => {
  assert.equal(
    conceptMatchesTag("дегустационное меню грузинской кухни", ["Georgian"]),
    true,
  );
});

const where = (city: string, admin1: string, country: string, metro?: string) =>
  ({
    properties: { geocode: { city, admin1_region: admin1, country, metro } },
  }) as never;

test("locationMismatch is silent when Qloo placed the city where it was typed", () => {
  assert.equal(
    locationMismatch(
      "Phoenix, AZ",
      where("Phoenix", "Arizona", "United States"),
    ),
    undefined,
  );
  assert.equal(
    locationMismatch("Tokyo", where("Shinagawa", "Tokyo", "Japan")),
    undefined,
    "a ward inside the typed city",
  );
  assert.equal(
    locationMismatch("Paris", where("Paris", "Ile-de-France", "France")),
    undefined,
  );
  assert.equal(
    locationMismatch(
      "Washington, DC",
      where("District of Columbia", "District of Columbia", "United States"),
    ),
    undefined,
  );
  assert.equal(
    locationMismatch("NYC", where("New York", "New York", "United States")),
    undefined,
    "abbreviations are not checked",
  );
});

test("locationMismatch warns when Qloo placed the query somewhere else", () => {
  const w = locationMismatch(
    "Portland, ME",
    where("Cape Elizabeth", "Maine", "United States"),
  );
  assert.match(w ?? "", /Cape Elizabeth, Maine, United States/);
  assert.match(w ?? "", /bare city name/);
  assert.equal(
    locationMismatch("Portland", undefined),
    undefined,
    "nothing to compare without a place",
  );
});

// Added after a mutation run showed which changes to venues.ts no test noticed.
import { toCulturalSignalItems } from "../lib/venues.ts";

test("aggregateDemographics averages women as well as men, and every age bucket", () => {
  const out = aggregateDemographics([
    {
      demographics: {
        age: { "30_to_34": 0.2 },
        gender: { male: 0.1, female: -0.1 },
      },
    },
    {
      demographics: {
        age: { "30_to_34": 0.6 },
        gender: { male: 0.3, female: -0.3 },
      },
    },
  ] as never)!;
  assert.ok(Math.abs(out.gender.female - -0.2) < 1e-9);
  assert.ok(Math.abs(out.age["30_to_34"] - 0.4) < 1e-9);
});

test("aggregateRegionInsights puts the most-mentioned keyword first whatever order they arrive in", () => {
  const out = aggregateRegionInsights([
    {
      properties: {
        keywords: [
          { name: "a", count: 5 },
          { name: "b", count: 40 },
          { name: "c", count: 12 },
        ],
      },
    },
  ] as never);
  assert.deepEqual(
    out.map((k) => k.keyword),
    ["b", "c", "a"],
  );
});

test("toCulturalSignalItems carries the name, the picture, and at most two genres", () => {
  const out = toCulturalSignalItems([
    {
      name: "Show",
      entity_id: "1",
      subtype: "x",
      properties: {
        image: { url: "http://img" },
        genres: ["Drama", "Crime", "Thriller"],
      },
    },
    {
      name: "Band",
      entity_id: "2",
      subtype: "x",
      properties: { primary_genres: ["Rock"] },
    },
    { name: "Plain", entity_id: "3", subtype: "x" },
  ]);
  assert.deepEqual(out[0], {
    name: "Show",
    imageUrl: "http://img",
    subtitle: "Drama, Crime",
  });
  assert.equal(out[1].subtitle, "Rock");
  assert.equal(out[2].subtitle, undefined);
});

test("formatHours shows only the real opening times, trimmed to hours and minutes", () => {
  assert.equal(
    formatHours({
      monday: slot("T16:30:00", "T21:00:00"),
      tuesday: [
        { opens: "T11:00", closes: "T14:00", closed: false },
        { opens: "T17:00", closes: "T22:00", closed: false },
      ],
      wednesday: [
        { opens: "T10:00", closes: "T12:00", closed: false },
        { opens: null, closes: null, closed: true },
      ],
      thursday: [{ opens: null, closes: "T20:00", closed: false }],
      friday: [],
    }),
    "Mon 16:30–21:00; Tue 11:00–14:00, 17:00–22:00; Wed 10:00–12:00; Thu–Sun unknown",
  );
});

test("hours that are unknown on every day are not reported at all", () => {
  assert.equal(
    formatHours({
      monday: [],
      tuesday: [{ opens: null, closes: null, closed: false }],
    }),
    undefined,
  );
});

test("isOperating needs at least one day with hours that is not closed", () => {
  assert.equal(
    isOperating({ properties: { hours: {} } } as never),
    true,
    "no days listed: assume open",
  );
  assert.equal(
    isOperating({
      properties: { hours: { monday: closed, tuesday: [] } },
    } as never),
    true,
    "a day with no data is not a closed day",
  );
  assert.equal(
    isOperating({
      properties: {
        hours: {
          monday: [
            { opens: "T10:00", closes: "T11:00", closed: false },
            { opens: null, closes: null, closed: true },
          ],
        },
      },
    } as never),
    true,
    "one open slot is enough",
  );
  assert.equal(
    isOperating({
      properties: {
        hours: { monday: closed, tuesday: closed, sunday: closed },
      },
    } as never),
    false,
  );
});

test("rankTagsForPlaceMatching prefers the canonical tag and the shorter id at equal type", () => {
  const t = (id: string, canonical = false) => ({
    id,
    name: id,
    type: "urn:tag:cuisine:qloo",
    properties: { is_canonical: canonical },
  });
  assert.deepEqual(
    rankTagsForPlaceMatching([t("a_b_c"), t("a"), t("a_b", true)]).map(
      (x) => x.id,
    ),
    ["a_b", "a", "a_b_c"],
    "canonical +5 beats one fewer word",
  );
  assert.deepEqual(
    rankTagsForPlaceMatching([t("x_y_z"), t("x_y")]).map((x) => x.id),
    ["x_y", "x_y_z"],
  );
});

test("conceptMatchesTag matches a word to its plural either way round, but not short fragments", () => {
  assert.equal(conceptMatchesTag("tacos", ["Taco"]), true);
  assert.equal(
    conceptMatchesTag("pho", ["Pho"]),
    true,
    "a three-letter word matches itself",
  );
  assert.equal(
    conceptMatchesTag("bar", ["Barbecue"]),
    false,
    "a short word is not a stem of a longer one",
  );
  assert.equal(
    conceptMatchesTag("oz", ["Oz Bar"]),
    false,
    "two-letter words are ignored",
  );
  assert.equal(conceptMatchesTag("TACOS", ["tacos"]), true);
});

test("locationMismatch ignores spaces around a short abbreviation", () => {
  assert.equal(
    locationMismatch(
      " NYC , NY",
      where("Brooklyn", "New York", "United States"),
    ),
    undefined,
  );
});

test("words that describe the business rather than the food are never searched for", () => {
  const filler = [
    "style",
    "styled",
    "inspired",
    "small",
    "plates",
    "plate",
    "dish",
    "dishes",
    "menu",
    "concept",
    "the",
    "and",
    "with",
    "based",
    "ghost",
    "kitchen",
    "special",
    "specials",
    "seasonal",
    "popup",
    "item",
    "items",
    "new",
    "our",
    "for",
    "from",
    "into",
    "house",
    "homemade",
    "made",
    "fresh",
    "local",
    "serving",
    "offer",
    "offering",
  ];
  for (const word of filler) assert.deepEqual(extractKeywords(word), [], word);
  assert.deepEqual(
    extractKeywords("pop up"),
    [],
    "'pop' and 'up' are both too short or filler",
  );
});

test("rankTagsForPlaceMatching orders the tag families: place, cuisine, culinary style, genre category, then the rest", () => {
  const t = (type: string) => ({ id: type, name: type, type });
  const ranked = rankTagsForPlaceMatching([
    t("urn:tag:genre:media"),
    t("urn:tag:genre_category:qloo"),
    t("urn:tag:cuisine:qloo"),
    t("urn:tag:category:place"),
    t("urn:tag:genre:place"),
  ]).map((x) => x.type);
  assert.deepEqual(ranked.slice(0, 2).sort(), [
    "urn:tag:category:place",
    "urn:tag:genre:place",
  ]);
  assert.equal(ranked[2], "urn:tag:cuisine:qloo");
  assert.equal(ranked[3], "urn:tag:genre_category:qloo");
  assert.equal(ranked[4], "urn:tag:genre:media");
});

test("hoursByDay lists Monday to Sunday, marking closed and unknown days", () => {
  assert.deepEqual(
    hoursByDay({
      monday: closed,
      tuesday: slot("T11:00", "T14:30"),
      saturday: slot("T11:00", "T21:00"),
    }),
    [
      "closed",
      "11:00–14:30",
      "unknown",
      "unknown",
      "unknown",
      "11:00–21:00",
      "unknown",
    ],
  );
  assert.equal(hoursByDay(undefined), undefined);
  assert.equal(hoursByDay({}), undefined);
});
