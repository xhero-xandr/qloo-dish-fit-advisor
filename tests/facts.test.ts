import assert from "node:assert/strict";
import { test } from "node:test";
import { buildFacts } from "../lib/facts.ts";

const venue = {
  name: "Fukumoto",
  rating: 4.6,
  priceLevel: 3,
  address: "514 Medina St Austin, TX",
  hours: "Tue–Thu 16:30–21:00",
  dietaryOptions: ["Vegetarian"],
  vibeTags: ["Wine"],
  reviewKeywords: [{ keyword: "yakitori", mentions: 110 }],
  demographics: { age: { "25_to_29": 0.18 }, gender: { male: 0.05, female: -0.05 } },
} as never;

const facts = buildFacts({
  city: "Austin",
  primaryTag: { id: "t1", name: "Izakaya", type: "urn:tag:cuisine:qloo" },
  secondary: [{ name: "Small Plates", venueCount: 5, venueNames: ["Soto"] }] as never,
  venues: [venue],
  regionInsights: [{ keyword: "sake", mentions: 46 }],
});

test("facts are numbered F1..Fn in order", () => {
  assert.deepEqual(facts.map((f) => f.id), facts.map((_, i) => `F${i + 1}`));
});

test("every per-venue fact is tagged with that venue, group facts are not", () => {
  const perVenue = facts.filter((f) => f.text.startsWith('Venue "Fukumoto"'));
  assert.ok(perVenue.length >= 5);
  assert.ok(perVenue.every((f) => f.venue === "Fukumoto"));
  const group = facts.filter((f) => f.text.startsWith("Across all"));
  assert.ok(group.length >= 1 && group.every((f) => f.venue === undefined));
});

test("the facts carry the numbers the agent is allowed to quote", () => {
  const text = facts.map((f) => f.text).join("\n");
  assert.match(text, /rating 4\.6, price level \$\$\$/);
  assert.match(text, /yakitori \(110\)/);
  assert.match(text, /25–29 \+0\.18/);
  assert.match(text, /"Small Plates": 5 venue\(s\)/);
});

// Added after a mutation run: which sentences the agent is shown, and when each one is left out.
const full = {
  name: "Fukumoto",
  rating: 4.6,
  priceLevel: 3,
  address: "514 Medina St",
  hours: "Tue–Thu 16:30–21:00",
  dietaryOptions: ["Vegetarian", "Vegan"],
  vibeTags: ["Wine", "Date night"],
  reviewKeywords: [{ keyword: "yakitori", mentions: 110 }, { keyword: "sake", mentions: 46 }],
  demographics: { age: { "25_to_29": 0.18, "55_and_older": -0.2 }, gender: { male: 0.05, female: -0.05 } },
} as never;
const bare = { name: "Plain", rating: undefined, priceLevel: null, address: undefined, hours: undefined, dietaryOptions: [], vibeTags: [], reviewKeywords: [], demographics: undefined } as never;
const tag = { id: "t", name: "Izakaya", type: "urn:tag:cuisine:qloo" };
const texts = (input: Parameters<typeof buildFacts>[0]) => buildFacts(input).map((f) => f.text);

test("a venue with every field gets one sentence per field, naming the values", () => {
  const t = texts({ city: "Austin", primaryTag: tag, secondary: [], venues: [full], regionInsights: [] });
  assert.deepEqual(t.slice(1), [
    'Venue "Fukumoto": rating 4.6, price level $$$, address 514 Medina St.',
    'Venue "Fukumoto" opening hours: Tue–Thu 16:30–21:00.',
    'Venue "Fukumoto" dietary options listed by Qloo: Vegetarian, Vegan.',
    'Venue "Fukumoto" Qloo tags: Wine, Date night.',
    'Venue "Fukumoto" own most-mentioned review keywords: yakitori (110), sake (46).',
    'Venue "Fukumoto" audience: age affinity 25–29 +0.18, 55 and younger -0.20; gender affinity male +0.05, female -0.05 (Qloo affinity vs. general population).'.replace("55 and younger", "55+"),
  ]);
  assert.match(t[0], /"Izakaya" \(cuisine:qloo\); 1 operating venue\(s\) matched\./);
});

test("a venue with nothing but a name gets only the basic sentence", () => {
  const t = texts({ city: "Austin", primaryTag: tag, secondary: [], venues: [bare], regionInsights: [] });
  assert.equal(t.length, 2);
  assert.equal(t[1], 'Venue "Plain": rating n/a, price level n/a.');
});

test("an affinity of zero or a missing gender block is shown as +0.00, not left out", () => {
  const venue = { ...(bare as object), name: "Z", demographics: { age: { "25_to_29": 0 }, gender: undefined } } as never;
  const t = texts({ city: "x", primaryTag: tag, secondary: [], venues: [venue], regionInsights: [] });
  assert.match(t[2], /25–29 \+0\.00; gender affinity male \+0\.00, female \+0\.00/);
});

test("group facts appear only when there is something to say, and say it", () => {
  const none = texts({ city: "x", primaryTag: tag, secondary: [], venues: [bare], regionInsights: [] });
  assert.ok(!none.some((x) => x.startsWith("Across all")));
  const some = texts({
    city: "x",
    primaryTag: tag,
    secondary: [],
    venues: [full, bare],
    aggregate: { age: { "25_to_29": 0.1 }, gender: { male: 0.2, female: -0.2 } },
    regionInsights: Array.from({ length: 12 }, (_, i) => ({ keyword: `k${i}`, mentions: 100 - i })),
  });
  assert.ok(some.some((x) => /^Across all 2 matched venues combined, average audience age affinity 25–29 \+0\.10/.test(x)));
  const kw = some.find((x) => x.includes("most-mentioned review keywords") && x.startsWith("Across all"))!;
  assert.match(kw, /k0 \(100\), k1 \(99\)/);
  assert.ok(kw.includes("k9 (91)") && !kw.includes("k10"), "at most ten keywords");
});

test("cultural affinity lists each filled group under its own label and skips empty ones", () => {
  const t = texts({
    city: "x",
    primaryTag: tag,
    secondary: [],
    venues: [bare],
    regionInsights: [],
    culturalAffinity: { brands: [{ name: "Nike" }, { name: "Adidas" }], tvShows: [], artists: [{ name: "Beyoncé" }], podcasts: [{ name: "Serial" }] } as never,
  });
  assert.ok(t.includes("The audience of these matched venues also over-indexes on these brands: Nike, Adidas."));
  assert.ok(t.includes("The audience of these matched venues also over-indexes on these music artists: Beyoncé."));
  assert.ok(t.includes("The audience of these matched venues also over-indexes on these podcasts: Serial."));
  assert.ok(!t.some((x) => x.includes("TV shows")));
});

test("a secondary tag says how many venues carry it, with examples when it has them", () => {
  const t = texts({
    city: "Austin",
    primaryTag: tag,
    venues: [bare],
    regionInsights: [],
    secondary: [
      { name: "Sake Bar", venueCount: 3, venueNames: ["A", "B"] },
      { name: "Small Plates", venueCount: 0, venueNames: [] },
      { name: "Ramen", venueCount: 2 },
      { name: "Yakitori" },
    ] as never,
  });
  assert.ok(t.includes('Secondary concept signal "Sake Bar": 3 venue(s) in Austin carry this Qloo tag, e.g. A, B.'));
  assert.ok(t.includes('Secondary concept signal "Small Plates": 0 venue(s) in Austin carry this Qloo tag.'));
  assert.ok(t.includes('Secondary concept signal "Ramen": 2 venue(s) in Austin carry this Qloo tag.'));
  assert.ok(t.includes('Part of the concept also maps to the Qloo tag "Yakitori" (venues for it were not checked).'));
});

test("with nothing requested the facts are exactly as before", () => {
  const plain = texts({ city: "Austin", primaryTag: tag, secondary: [], venues: [full], regionInsights: [] });
  const withNone = texts({ city: "Austin", primaryTag: tag, secondary: [], venues: [full], regionInsights: [], requested: {} });
  assert.deepEqual(withNone, plain);
});

test("each dietary request is answered for every venue from the options Qloo lists", () => {
  const t = texts({ city: "x", primaryTag: tag, secondary: [], venues: [full, bare], regionInsights: [], requested: { dietary: ["Vegan", "Halal"] } });
  assert.ok(t.includes('The chef asked for "Vegan". Venue "Fukumoto" lists it among its Qloo dietary options.'));
  assert.ok(t.includes('The chef asked for "Halal". Venue "Fukumoto" does not list it among its Qloo dietary options.'));
  assert.ok(t.includes('The chef asked for "Vegan". Venue "Plain" does not list it among its Qloo dietary options.'));
});

test("a price request says whether each venue with a known price is inside the range", () => {
  const t = texts({ city: "x", primaryTag: tag, secondary: [], venues: [full, bare], regionInsights: [], requested: { prices: [1, 2] } });
  assert.ok(t.includes('The chef asked for price level $, $$. Venue "Fukumoto" is $$$, outside that range.'));
  assert.ok(!t.some((x) => x.includes('Venue "Plain" is')), "a venue with no price level gets no sentence");
  const inside = texts({ city: "x", primaryTag: tag, secondary: [], venues: [full], regionInsights: [], requested: { prices: [3] } });
  assert.ok(inside.some((x) => x.includes("$$$, inside that range")));
});

test("an audience request gives the venue's affinity for exactly those groups", () => {
  const t = texts({ city: "x", primaryTag: tag, secondary: [], venues: [full, bare], regionInsights: [], requested: { audience: { age: ["25_to_29"], gender: "female" } } });
  assert.ok(t.includes('The chef asked for this audience: 25–29, female. Venue "Fukumoto" audience affinity for it (Qloo, vs. average): 25–29 +0.18; female -0.05.'));
  assert.ok(!t.some((x) => x.includes("this audience") && x.includes('"Plain"')), "no demographics, no sentence");
});

test("requested facts come after the venue facts, so the earlier numbering does not move", () => {
  const plain = buildFacts({ city: "x", primaryTag: tag, secondary: [], venues: [full], regionInsights: [] });
  const asked = buildFacts({ city: "x", primaryTag: tag, secondary: [], venues: [full], regionInsights: [], requested: { dietary: ["Vegan"] } });
  assert.deepEqual(asked.slice(0, plain.length - 0).map((f) => f.id).slice(0, 7), plain.map((f) => f.id).slice(0, 7));
  assert.equal(asked.length, plain.length + 1);
});
