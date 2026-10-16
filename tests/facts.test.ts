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
