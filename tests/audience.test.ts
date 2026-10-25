import assert from "node:assert/strict";
import test from "node:test";
import {
  ageRangeLabel,
  coreAgeLabel,
  describeAudience,
  genderLean,
  levelOf,
} from "../lib/audience.ts";

test("scores turn into words at the stated cut-offs", () => {
  assert.equal(levelOf(0.15), "much more");
  assert.equal(levelOf(0.149), "more");
  assert.equal(levelOf(0.05), "more");
  assert.equal(levelOf(0.049), "about average");
  assert.equal(levelOf(0), "about average");
  assert.equal(levelOf(-0.049), "about average");
  assert.equal(levelOf(-0.05), "less");
  assert.equal(levelOf(-0.149), "less");
  assert.equal(levelOf(-0.15), "much less");
});

test("neighbouring age groups join into one range, gaps are listed", () => {
  assert.equal(ageRangeLabel(["30_to_34", "25_to_29"]), "25–34");
  assert.equal(ageRangeLabel(["24_and_younger", "25_to_29"]), "29 and younger");
  assert.equal(ageRangeLabel(["45_to_54", "55_and_older"]), "45+");
  assert.equal(ageRangeLabel(["25_to_29", "45_to_54"]), "25–29 and 45–54");
  assert.equal(ageRangeLabel(["35_to_44"]), "35–44");
  assert.equal(
    ageRangeLabel([
      "24_and_younger",
      "25_to_29",
      "30_to_34",
      "35_to_44",
      "45_to_54",
      "55_and_older",
    ]),
    "all ages",
  );
  assert.equal(ageRangeLabel([]), "");
});

test("the core audience is the groups above the 'more' cut-off", () => {
  const austin = {
    age: {
      "24_and_younger": -0.02,
      "25_to_29": 0.07,
      "30_to_34": 0.05,
      "35_to_44": -0.11,
      "45_to_54": -0.08,
      "55_and_older": -0.05,
    },
  };
  assert.equal(coreAgeLabel(austin), "25–34");
  assert.equal(coreAgeLabel({ age: { "25_to_29": 0.04 } }), undefined);
  assert.equal(coreAgeLabel({}), undefined);
});

test("gender lean needs a clear gap", () => {
  assert.equal(
    genderLean({ gender: { male: -0.17, female: 0.17 } }),
    "more women than men",
  );
  assert.equal(
    genderLean({ gender: { male: 0.25, female: -0.25 } }),
    "more men than women",
  );
  assert.equal(
    genderLean({ gender: { male: -0.01, female: 0.01 } }),
    "men and women alike",
  );
  assert.equal(
    genderLean({ gender: { male: -0.05, female: 0.05 } }),
    "more women than men",
  );
  assert.equal(genderLean({}), "men and women alike");
});

test("the sentence names who likes the places more and less", () => {
  const austin = {
    age: {
      "24_and_younger": -0.02,
      "25_to_29": 0.07,
      "30_to_34": 0.05,
      "35_to_44": -0.11,
      "45_to_54": -0.08,
      "55_and_older": -0.05,
    },
    gender: { male: -0.01, female: 0.01 },
  };
  assert.equal(
    describeAudience(austin),
    "People aged 25–34 like these venues more than the average person does; people aged 35+ like them less. Men and women about equally.",
  );
  assert.equal(
    describeAudience(
      { age: { "45_to_54": -0.2 }, gender: { male: 0.2, female: -0.1 } },
      "this venue",
    ),
    "People aged 45–54 like them less. Somewhat more men than women.",
  );
  assert.equal(
    describeAudience({ age: { "25_to_29": 0.01 } }),
    "No age group likes these venues clearly more or less than the average person. Men and women about equally.",
  );
});

import { guestGroupCounts } from "../lib/audience.ts";

test("guest groups are counted once per venue and kept only when two or more venues share them", () => {
  assert.deepEqual(
    guestGroupCounts([
      { guests: ["Families", "Students", "Families"] },
      { guests: ["Families", "Tourists"] },
      { guests: ["Students", "Families"] },
      {},
    ]),
    [
      ["Families", 3],
      ["Students", 2],
    ],
  );
  assert.deepEqual(guestGroupCounts([{ guests: ["Seniors"] }]), []);
});

test("groups Qloo puts on most venues come after the specific ones, whatever their counts", () => {
  assert.deepEqual(
    guestGroupCounts([
      { guests: ["Locals", "Foodies", "Students"] },
      { guests: ["Locals", "Foodies", "Students"] },
      { guests: ["Locals", "Foodies"] },
    ]).map(([g]) => g),
    ["Students", "Locals", "Foodies"],
  );
});
