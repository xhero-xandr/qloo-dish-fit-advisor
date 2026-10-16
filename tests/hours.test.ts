import assert from "node:assert/strict";
import { test } from "node:test";
import { eveningSlot, formatSlot, parseSlot, slotProblem, suggestTastingSlot, weekWindows } from "../lib/hours.ts";

const slot = (opens: string, closes: string) => [{ opens, closes, closed: false }];
const closed = [{ opens: null, closes: null, closed: true }];

// Closed Mon and Sun; Tue-Thu 16:30-21:00; Fri-Sat 16:30-22:00 (the shape Qloo returns).
const week = weekWindows({
  monday: closed,
  tuesday: slot("T16:30", "T21:00"),
  wednesday: slot("T16:30", "T21:00"),
  thursday: slot("T16:30", "T21:00"),
  friday: slot("T16:30", "T22:00"),
  saturday: slot("T16:30", "T22:00"),
  sunday: closed,
})!;

test("weekWindows is undefined when Qloo has no usable hours", () => {
  assert.equal(weekWindows(undefined), undefined);
  assert.equal(weekWindows({ monday: closed }), undefined);
});

test("a venue closing after midnight gets a close past 24:00", () => {
  const late = weekWindows({ friday: slot("T18:00", "T02:00") })!;
  assert.deepEqual(late.Fri, [{ open: 18 * 60, close: 26 * 60 }]);
});

test("eveningSlot prefers a quiet weekday and starts no earlier than 17:00", () => {
  const s = eveningSlot(week)!;
  assert.equal(s.day, "Tue");
  assert.equal(formatSlot(s), "Tue 17:00–20:00");
});

test("eveningSlot is undefined for a venue that never opens in the evening", () => {
  const lunch = weekWindows({ tuesday: slot("T11:00", "T14:30") })!;
  assert.equal(eveningSlot(lunch), undefined);
  assert.equal(formatSlot(suggestTastingSlot(lunch)!), "Tue 11:00–14:00");
});

test("parseSlot reads a day and range out of free text", () => {
  assert.deepEqual(parseSlot("Week 3, Tue 18:00–21:00"), { day: "Tue", start: 18 * 60, end: 21 * 60 });
  assert.equal(parseSlot("sometime next week"), undefined);
});

test("slotProblem flags closed days, hours outside opening and pre-evening starts", () => {
  assert.equal(slotProblem(parseSlot("Mon 18:00–21:00")!, week), "closed on Mon");
  assert.equal(slotProblem(parseSlot("Tue 18:00–22:00")!, week), "outside opening hours");
  assert.equal(slotProblem(parseSlot("Tue 16:30–19:30")!, week), "starts before the evening");
  assert.equal(slotProblem(parseSlot("Tue 18:00–21:00")!, week), undefined);
});
