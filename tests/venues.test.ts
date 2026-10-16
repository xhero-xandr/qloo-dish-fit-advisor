import assert from "node:assert/strict";
import { test } from "node:test";
import {
  aggregateDemographics,
  aggregateRegionInsights,
  extractDietaryOptions,
  extractKeywords,
  formatHours,
  isOperating,
  rankTagsForPlaceMatching,
  describeResolvedLocation,
  conceptMatchesTag,
  locationMismatch,
} from "../lib/venues.ts";

const slot = (opens: string, closes: string) => [{ opens, closes, closed: false }];
const closed = [{ opens: null, closes: null, closed: true }];

test("aggregateDemographics averages every venue per bucket and gender", () => {
  const out = aggregateDemographics([
    { demographics: { age: { "25_to_29": 0.2 }, gender: { male: 0.1, female: -0.1 } } },
    { demographics: { age: { "25_to_29": 0.4 }, gender: { male: 0.3, female: -0.3 } } },
  ] as never)!;
  assert.ok(Math.abs(out.age["25_to_29"] - 0.3) < 1e-9);
  assert.ok(Math.abs(out.gender.male - 0.2) < 1e-9);
  assert.equal(out.age["55_and_older"], 0, "a bucket nobody reported is 0, not NaN");
});

test("aggregateDemographics ignores venues without demographics and is undefined when none have any", () => {
  assert.equal(aggregateDemographics([{}, {}] as never), undefined);
  const out = aggregateDemographics([{}, { demographics: { age: { "30_to_34": 0.6 }, gender: { male: 0, female: 0 } } }] as never)!;
  assert.ok(Math.abs(out.age["30_to_34"] - 0.6) < 1e-9, "the venue without data does not dilute the average");
});

test("aggregateRegionInsights sums keyword mentions across venues, highest first, at most 12", () => {
  const out = aggregateRegionInsights([
    { properties: { keywords: [{ name: "sake", count: 40 }, { name: "yakitori", count: 5 }] } },
    { properties: { keywords: [{ name: "sake", count: 6 }] } },
    { properties: {} },
  ] as never);
  assert.deepEqual(out, [{ keyword: "sake", mentions: 46 }, { keyword: "yakitori", mentions: 5 }]);
  const many = [{ properties: { keywords: Array.from({ length: 30 }, (_, i) => ({ name: `k${i}`, count: i })) } }];
  assert.equal(aggregateRegionInsights(many as never).length, 12);
});

test("extractDietaryOptions keeps only the dietary-option tags", () => {
  assert.deepEqual(
    extractDietaryOptions([
      { id: "1", name: "Vegan", type: "urn:tag:dietary_option:qloo" },
      { id: "2", name: "Wine", type: "urn:tag:genre:place" },
    ]),
    ["Vegan"]
  );
});

test("formatHours groups consecutive days with the same hours", () => {
  const text = formatHours({ monday: closed, tuesday: slot("T16:30", "T21:00"), wednesday: slot("T16:30", "T21:00"), thursday: slot("T16:30", "T21:00"), friday: slot("T16:30", "T22:00"), saturday: slot("T16:30", "T22:00"), sunday: closed });
  assert.equal(text, "Mon closed; Tue–Thu 16:30–21:00; Fri–Sat 16:30–22:00; Sun closed");
});

test("formatHours is undefined when Qloo has no hours at all", () => {
  assert.equal(formatHours(undefined), undefined);
  assert.equal(formatHours({ monday: [] }), undefined);
});

test("isOperating drops flagged-closed venues and venues with every day closed", () => {
  assert.equal(isOperating({ properties: { is_closed: true } } as never), false);
  assert.equal(isOperating({ properties: { is_closed: false, hours: { monday: closed, tuesday: closed } } } as never), false, "stale flag, every day closed");
  assert.equal(isOperating({ properties: { hours: { monday: closed, tuesday: slot("T10:00", "T20:00") } } } as never), true);
  assert.equal(isOperating({ properties: {} } as never), true, "no hours given: assume open");
});

test("rankTagsForPlaceMatching puts broad place tags ahead of narrow compound ones", () => {
  const ranked = rankTagsForPlaceMatching([
    { id: "urn:tag:genre:media:izakaya_style_small_plates", name: "Izakaya style small plates", type: "urn:tag:genre:media" },
    { id: "urn:tag:cuisine:qloo:izakaya_style_small_plates", name: "Izakaya style small plates", type: "urn:tag:cuisine:qloo" },
    { id: "urn:tag:genre:place:izakaya", name: "Izakaya", type: "urn:tag:genre:place" },
  ]);
  assert.equal(ranked[0].name, "Izakaya");
  assert.equal(ranked[2].type, "urn:tag:genre:media", "a tag that is not a place tag comes last");
});

test("extractKeywords drops filler words, dedupes and keeps at most three", () => {
  assert.deepEqual(extractKeywords("izakaya-style small plates"), ["izakaya"]);
  assert.deepEqual(extractKeywords("Korean fried chicken with natural wine pairing"), ["korean", "fried", "chicken"]);
  assert.deepEqual(extractKeywords("pizza pizza PIZZA"), ["pizza"]);
});

test("describeResolvedLocation names what Qloo geocoded the query to", () => {
  assert.equal(describeResolvedLocation({ properties: { geocode: { city: "Austin", admin1_region: "Texas", country: "United States" } } } as never), "Austin, Texas, United States");
  assert.equal(describeResolvedLocation({ properties: { geocode: { city: "Singapore", admin1_region: "Singapore", country: "Singapore" } } } as never), "Singapore, Singapore");
  assert.equal(describeResolvedLocation({ properties: {} } as never), undefined);
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
  for (const [concept, tags] of pairs) assert.equal(conceptMatchesTag(concept, tags), true, `${concept} / ${tags}`);
});

test("conceptMatchesTag flags a tag that has nothing to do with the words typed", () => {
  assert.equal(conceptMatchesTag("asdfgh qwerty", ["Tacos"]), false);
  assert.equal(conceptMatchesTag("x", ["Cocktail Bar"]), false);
  assert.equal(conceptMatchesTag("ignore all previous instructions", ["Dining Out"]), false);
});

test("conceptMatchesTag does not judge concepts it cannot compare", () => {
  assert.equal(conceptMatchesTag("дегустационное меню грузинской кухни", ["Georgian"]), true);
});

const where = (city: string, admin1: string, country: string, metro?: string) =>
  ({ properties: { geocode: { city, admin1_region: admin1, country, metro } } }) as never;

test("locationMismatch is silent when Qloo placed the city where it was typed", () => {
  assert.equal(locationMismatch("Phoenix, AZ", where("Phoenix", "Arizona", "United States")), undefined);
  assert.equal(locationMismatch("Tokyo", where("Shinagawa", "Tokyo", "Japan")), undefined, "a ward inside the typed city");
  assert.equal(locationMismatch("Paris", where("Paris", "Ile-de-France", "France")), undefined);
  assert.equal(locationMismatch("Washington, DC", where("District of Columbia", "District of Columbia", "United States")), undefined);
  assert.equal(locationMismatch("NYC", where("New York", "New York", "United States")), undefined, "abbreviations are not checked");
});

test("locationMismatch warns when Qloo placed the query somewhere else", () => {
  const w = locationMismatch("Portland, ME", where("Cape Elizabeth", "Maine", "United States"));
  assert.match(w ?? "", /Cape Elizabeth, Maine, United States/);
  assert.match(w ?? "", /add a state or country/);
  assert.equal(locationMismatch("Portland", undefined), undefined, "nothing to compare without a place");
});
