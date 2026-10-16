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
  assert.match(validateInput("a".repeat(201), "Austin") ?? "", /under 200/);
  assert.match(validateInput("ramen", "c".repeat(101)) ?? "", /under 100/);
});
