import assert from "node:assert/strict";
import { test } from "node:test";
import { validateInput } from "../lib/input.ts";

test("ordinary concepts and cities pass, in any language", () => {
  assert.equal(validateInput("birria tacos", "Phoenix, AZ"), undefined);
  assert.equal(validateInput("дегустационное меню грузинской кухни", "Tbilisi"), undefined);
  assert.equal(validateInput("ramen", "Tokyo"), undefined);
  assert.equal(validateInput("pho", "Springfield"), undefined);
});

test("empty and one-letter input is turned away before any quota is spent", () => {
  assert.match(validateInput("", "Austin") ?? "", /required/);
  assert.match(validateInput("x", "Austin") ?? "", /few words/);
  assert.match(validateInput("12345", "Austin") ?? "", /few words/);
  assert.match(validateInput("ramen", "?") ?? "", /city name/);
});

test("over-long input is rejected", () => {
  assert.match(validateInput("a".repeat(801), "Austin") ?? "", /under 800/);
  assert.match(validateInput("ramen", "c".repeat(101)) ?? "", /under 100/);
});

test("the length limits are inclusive: 800 and 100 characters are fine, one more is not", () => {
  assert.equal(validateInput("a".repeat(800), "Austin"), undefined);
  assert.equal(validateInput("ramen", "c".repeat(100)), undefined);
  assert.match(validateInput("a".repeat(801), "Austin") ?? "", /under/);
  assert.match(validateInput("ramen", "c".repeat(101)) ?? "", /under/);
});

test("a description may now be up to 800 characters", () => {
  assert.equal(validateInput("a".repeat(800), "Austin"), undefined);
  assert.match(validateInput("a".repeat(801), "Austin") ?? "", /under 800/);
});

import { parseDetails } from "../lib/input.ts";

test("details keep only valid values and drop the rest", () => {
  assert.deepEqual(
    parseDetails({
      dietary: ["Vegan", "Gluten free", "Paleo", 7],
      audience: { age: ["25_to_29", "30_to_34", "teen"], gender: "female" },
      prices: [2, 3, 9, "2"],
      season: "  summer   weekend brunch ",
      extra: "ignored",
    }),
    { dietary: ["Vegan", "Gluten free"], audience: { age: ["25_to_29", "30_to_34"], gender: "female" }, prices: [2, 3], season: "summer weekend brunch" }
  );
});

test("details that are empty, wrong-typed or hostile come out as nothing", () => {
  for (const raw of [undefined, null, "vegan", 5, [], {}, { dietary: "Vegan" }, { dietary: [] }, { audience: { gender: "other" } }, { prices: [0, 5] }, { season: "   " }, { season: "123" }]) {
    assert.equal(parseDetails(raw), undefined, JSON.stringify(raw));
  }
});

test("the season is capped at 80 characters", () => {
  const out = parseDetails({ season: "a".repeat(200) });
  assert.equal(out?.season?.length, 80);
});

test("only an audience gender or only ages is kept as given", () => {
  assert.deepEqual(parseDetails({ audience: { gender: "male" } }), { audience: { gender: "male" } });
  assert.deepEqual(parseDetails({ audience: { age: ["55_and_older"] } }), { audience: { age: ["55_and_older"] } });
});

test("a chosen category is kept only when it looks like a Qloo tag with a name", () => {
  assert.deepEqual(parseDetails({ tag: { id: "urn:tag:cuisine:qloo:banh_mi", name: "  Banh   Mi " } }), {
    tag: { id: "urn:tag:cuisine:qloo:banh_mi", name: "Banh Mi" },
  });
  for (const tag of [
    { id: "urn:tag:cuisine:qloo:banh_mi" },
    { id: "urn:tag:cuisine:qloo:banh_mi", name: "" },
    { id: "banh_mi", name: "Banh Mi" },
    { id: "urn:tag:cuisine", name: "Banh Mi" },
    { id: "urn:tag:cuisine:qloo:Banh Mi", name: "Banh Mi" },
    { id: "urn:tag:cuisine:qloo:x", name: "x".repeat(81) },
    "urn:tag:cuisine:qloo:banh_mi",
  ])
    assert.equal(parseDetails({ tag }), undefined, JSON.stringify(tag));
});
