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

// Added after a mutation run showed which changes to hours.ts no test noticed.
test("a time Qloo gives in any shape is read, and one it cannot read is skipped", () => {
  const w = weekWindows({
    monday: [{ opens: "T16:30:00", closes: "T21:00:00", closed: false }],
    tuesday: [{ opens: "9:05", closes: "17:00", closed: false }],
    wednesday: [{ opens: "x16:30", closes: "T21:00", closed: false }],
    thursday: [{ opens: "T11:00", closes: null, closed: false }],
    friday: [{ opens: "T10:00", closes: "T10:00", closed: false }],
  })!;
  assert.deepEqual(w.Mon, [{ open: 990, close: 1260 }], "seconds are ignored");
  assert.deepEqual(w.Tue, [{ open: 545, close: 1020 }], "a single-digit hour, no T");
  assert.deepEqual(w.Wed, [], "garbage before the time is not accepted");
  assert.deepEqual(w.Thu, [], "a missing close time drops the slot");
  assert.deepEqual(w.Fri, [{ open: 600, close: 600 + 24 * 60 }], "same open and close means open all day");
  assert.deepEqual(w.Sat, []);
});

test("a window with two sittings keeps both", () => {
  const w = weekWindows({ friday: [{ opens: "T11:00", closes: "T14:00", closed: false }, { opens: "T17:00", closes: "T22:00", closed: false }] })!;
  assert.equal(w.Fri.length, 2);
});

test("an evening slot needs a full two hours, and no more is needed", () => {
  const exactly = weekWindows({ tuesday: slot("T17:00", "T19:00") })!;
  assert.equal(formatSlot(eveningSlot(exactly)!), "Tue 17:00–19:00");
  const short = weekWindows({ tuesday: slot("T17:00", "T18:59") })!;
  assert.equal(eveningSlot(short), undefined);
});

test("with no evening, a daytime window needs two hours too and starts when the venue opens", () => {
  const exactly = weekWindows({ tuesday: slot("T11:00", "T13:00") })!;
  assert.equal(formatSlot(suggestTastingSlot(exactly)!), "Tue 11:00–13:00");
  const short = weekWindows({ tuesday: slot("T11:00", "T12:59") })!;
  assert.equal(suggestTastingSlot(short), undefined);
  const brief = weekWindows({ tuesday: slot("T11:00", "T11:30") })!;
  assert.equal(suggestTastingSlot(brief), undefined);
});

test("parseSlot reads the minutes, spaced dashes, full day names and slots past midnight", () => {
  assert.deepEqual(parseSlot("Tue 18:00–21:30"), { day: "Tue", start: 1080, end: 1290 });
  assert.deepEqual(parseSlot("Week 3, Tue 18:00 – 21:00"), { day: "Tue", start: 1080, end: 1260 });
  assert.deepEqual(parseSlot("Tuesday 18:00-21:00"), { day: "Tue", start: 1080, end: 1260 });
  assert.deepEqual(parseSlot("Fri 22:00–01:00"), { day: "Fri", start: 1320, end: 25 * 60 });
  assert.deepEqual(parseSlot("Tue 18:00–18:00"), { day: "Tue", start: 1080, end: 1080 + 24 * 60 }, "equal start and end is a full day");
});

test("parseSlot needs both a day and a time", () => {
  assert.equal(parseSlot("Tue evening"), undefined);
  assert.equal(parseSlot("Week 3, 18:00–21:00"), undefined);
});

test("slotProblem finds the right sitting, and a slot may start exactly at 17:00", () => {
  const w = weekWindows({ tuesday: [{ opens: "T11:00", closes: "T14:00", closed: false }, { opens: "T17:00", closes: "T22:00", closed: false }] })!;
  assert.equal(slotProblem(parseSlot("Tue 18:00–21:00")!, w), undefined, "fits the second sitting");
  assert.equal(slotProblem(parseSlot("Tue 17:00–20:00")!, w), undefined, "starting at 17:00 sharp is fine");
  assert.equal(slotProblem(parseSlot("Tue 13:00–18:00")!, w), "outside opening hours", "spans the gap between sittings");
  const late = weekWindows({ tuesday: slot("T16:30", "T21:00") })!;
  assert.equal(slotProblem(parseSlot("Tue 16:00–19:00")!, late), "outside opening hours", "starts before it opens");
});

test("a venue that is never open in the evening may host a daytime slot", () => {
  const lunch = weekWindows({ tuesday: slot("T11:00", "T15:00") })!;
  assert.equal(slotProblem(parseSlot("Tue 11:00–14:00")!, lunch), undefined);
});
