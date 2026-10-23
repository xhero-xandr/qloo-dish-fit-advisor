import assert from "node:assert/strict";
import test from "node:test";
import { ownerLetterFor } from "../lib/letter.ts";

test("the letter names the chosen venue, the dish and the city, and leads with the phone", () => {
  const letter = ownerLetterFor(
    {
      name: "Kanji Ramen",
      phone: "+15125550100",
      vibeTags: ["Casual", "Mural", "Loud", "Extra"],
    },
    "tonkotsu ramen",
    "Austin, TX",
  );
  assert.match(letter, /^Direct contact .*\+15125550100/);
  assert.match(letter, /tasting night for "tonkotsu ramen"/);
  assert.match(
    letter,
    /Kanji Ramen looks like one of the strongest-fit venues in Austin, TX/,
  );
  assert.match(letter, /\(Casual, Mural, Loud\)/);
});

test("without a phone it points to the website, without tags it stays generic, without a venue it says so", () => {
  const letter = ownerLetterFor(
    { name: "X", vibeTags: [] },
    "pho",
    "Seattle, WA",
  );
  assert.match(letter, /^No direct phone number/);
  assert.match(letter, /\(a matching niche\)/);
  assert.match(
    ownerLetterFor(undefined, "pho", "Seattle, WA"),
    /^Not enough venue data in Seattle, WA/,
  );
});
