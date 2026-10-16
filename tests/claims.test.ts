import assert from "node:assert/strict";
import { test } from "node:test";
import { unsupportedNumbers } from "../lib/claims.ts";

const facts = ['Venue "Fukumoto": rating 4.6, price level $$$.', "Reviews mention: yakitori (110), pork belly (25)."];

test("numbers that appear in the cited facts are backed", () => {
  assert.deepEqual(unsupportedNumbers("Fukumoto is rated 4.6 and yakitori is mentioned 110 times.", facts), []);
});

test("a number the cited facts do not contain is reported", () => {
  assert.deepEqual(unsupportedNumbers("Fukumoto is rated 4.9 across 300 reviews.", facts), ["4.9", "300"]);
});

test("formatting differences do not matter", () => {
  assert.deepEqual(unsupportedNumbers("Rated 4.60 with 1,000 mentions.", ["rating 4.6", "1000 mentions"]), []);
});

test("a sentence with no numbers is never flagged", () => {
  assert.deepEqual(unsupportedNumbers("The venue serves yakitori.", []), []);
});
