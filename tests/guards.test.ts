import assert from "node:assert/strict";
import { test } from "node:test";
import { enforceGrounding, type RawAnalysis } from "../lib/guards.ts";
import { weekWindows } from "../lib/hours.ts";

const facts = [
  { id: "F1", text: 'Venues were found via the Qloo tag "Izakaya"; 2 operating venue(s) matched.' },
  { id: "F2", text: 'Venue "Fukumoto": rating 4.6, price level $$$.', venue: "Fukumoto" },
  { id: "F3", text: 'Venue "Fukumoto" opening hours: Tue–Thu 16:30–21:00.', venue: "Fukumoto" },
  { id: "F4", text: 'Venue "Soto": rating 4.7, price level $$$$.', venue: "Soto" },
  { id: "F5", text: "Across all 2 matched venues combined, most-mentioned review keywords: sake (46).", venue: undefined },
];
const names = ["Fukumoto", "Soto"];
const slot = (opens: string, closes: string) => [{ opens, closes, closed: false }];
const closed = [{ opens: null, closes: null, closed: true }];
const windows = new Map([
  [
    "Fukumoto",
    weekWindows({ monday: closed, tuesday: slot("T16:30", "T21:00"), wednesday: slot("T16:30", "T21:00"), sunday: closed })!,
  ],
]);

const base: RawAnalysis = {
  verdict: { fit: "strong", text: "Two venues matched.", facts: ["F1"] },
  recommendedVenue: { name: "Fukumoto", why: "Rated 4.6 and open on weekday evenings.", facts: ["F2", "F3"] },
  pilotPlan: [{ when: "Week 1", text: "Approach the venue.", facts: [] }],
  menuNotes: [{ text: "Lean on sake.", facts: ["F5"] }],
  risks: [{ text: "Closed on Mondays.", facts: ["F3"] }],
};
const run = (patch: Partial<RawAnalysis>) => enforceGrounding({ ...base, ...patch }, facts, names, windows);

test("a fully grounded answer passes unchanged", () => {
  const out = run({});
  assert.equal(out.droppedItems, 0);
  assert.equal(out.correctedItems, 0);
  assert.equal(out.recommendedVenue?.name, "Fukumoto");
  assert.equal(out.risks.length, 1);
});

test("invented fact ids are stripped, and an item left with no real citation is dropped", () => {
  const out = run({
    risks: [
      { text: "Mixed ids.", facts: ["F3", "F99"] },
      { text: "Only invented.", facts: ["F98"] },
    ],
  });
  assert.deepEqual(out.risks, [{ text: "Mixed ids.", facts: ["F3"] }]);
  assert.equal(out.droppedItems, 1);
});

test("repeated ids are collapsed", () => {
  assert.deepEqual(run({ risks: [{ text: "x", facts: ["F3", "F3"] }] }).risks[0].facts, ["F3"]);
});

test("a plan step that cites nothing is kept, because it makes no claim about the data", () => {
  assert.equal(run({}).pilotPlan.length, 1);
});

test("the recommended venue must be a matched venue; the name is normalised", () => {
  const ok = run({ recommendedVenue: { name: " fukumoto ", why: "Open evenings.", facts: ["F3"] } });
  assert.equal(ok.recommendedVenue?.name, "Fukumoto");
  const unknown = run({ recommendedVenue: { name: "Invented Bistro", why: "Great.", facts: ["F3"] } });
  assert.equal(unknown.recommendedVenue, undefined);
  assert.equal(unknown.droppedItems, 1);
});

test("a recommendation must rest on a fact about its own venue and must not cite another venue's", () => {
  const onlyOther = run({ recommendedVenue: { name: "Fukumoto", why: "Open evenings.", facts: ["F4"] } });
  assert.equal(onlyOther.recommendedVenue, undefined);
  const mixed = run({ recommendedVenue: { name: "Fukumoto", why: "Open evenings.", facts: ["F3", "F4", "F5"] } });
  assert.deepEqual(mixed.recommendedVenue?.facts, ["F3", "F5"], "own and group facts stay, the other venue's is stripped");
});

test("a number the cited facts do not contain drops the verdict, the reason and the risk", () => {
  const out = run({
    verdict: { fit: "strong", text: "Rated 4.9 by 300 reviewers.", facts: ["F2"] },
    recommendedVenue: { name: "Fukumoto", why: "Rated 4.9.", facts: ["F2"] },
    risks: [{ text: "Only 12 reviews.", facts: ["F2"] }],
  });
  assert.equal(out.verdict, undefined);
  assert.equal(out.recommendedVenue, undefined);
  assert.equal(out.risks.length, 0);
  assert.equal(out.droppedItems, 3);
});

test("menu notes and plan steps may suggest numbers the facts do not contain", () => {
  const out = run({
    menuNotes: [{ text: "Offer 3-5 small plates.", facts: ["F5"] }],
    pilotPlan: [{ when: "Week 2", text: "Host 15-25 guests.", facts: ["F3"] }],
  });
  assert.equal(out.menuNotes.length, 1);
  assert.equal(out.pilotPlan.length, 1);
  assert.equal(out.droppedItems, 0);
});

test("a tasting window on a closed day is replaced by one inside the venue's hours", () => {
  const out = run({ pilotPlan: [{ when: "Week 3, Mon 18:00–21:00", text: "Run the night.", facts: ["F3"] }] });
  assert.equal(out.correctedItems, 1);
  assert.equal(out.pilotPlan[0].when, "Week 3, Tue 17:00–20:00");
});

test("a window that already fits the hours is left alone", () => {
  const out = run({ pilotPlan: [{ when: "Week 3, Wed 18:00–21:00", text: "Run the night.", facts: ["F3"] }] });
  assert.equal(out.correctedItems, 0);
  assert.equal(out.pilotPlan[0].when, "Week 3, Wed 18:00–21:00");
});

test("with no recommended venue there are no hours to correct against", () => {
  const out = run({
    recommendedVenue: { name: "Invented Bistro", why: "Great.", facts: ["F3"] },
    pilotPlan: [{ when: "Week 3, Mon 18:00–21:00", text: "Run the night.", facts: [] }],
  });
  assert.equal(out.correctedItems, 0);
  assert.equal(out.pilotPlan[0].when, "Week 3, Mon 18:00–21:00");
});

test("every dropped item says why, in words the page can show", () => {
  const out = run({
    verdict: { fit: "strong", text: "Rated 4.9.", facts: ["F2"] },
    risks: [
      { text: "Rated 4.9 and 300 reviews.", facts: ["F2"] },
      { text: "Invented citation.", facts: ["F99"] },
    ],
    recommendedVenue: { name: "Invented Bistro", why: "Great.", facts: ["F3"] },
  });
  assert.deepEqual(out.droppedNotes, [
    "recommendation: not a matched venue, or cited no fact about its own venue",
    "verdict: 4.9 is not in the facts it cites",
    "risk: 4.9, 300 are not in the facts it cites",
    "risk: cited no fact that exists",
  ]);
  assert.equal(out.droppedItems, out.droppedNotes.length);
  assert.deepEqual(run({}).droppedNotes, [], "nothing dropped, nothing said");
});

test("a missing verdict or recommendation is simply absent, not counted as dropped", () => {
  const out = enforceGrounding({ pilotPlan: [], menuNotes: [], risks: [] } as RawAnalysis, facts, names, windows);
  assert.equal(out.verdict, undefined);
  assert.equal(out.recommendedVenue, undefined);
  assert.equal(out.droppedItems, 0);
});

test("without any lists the answer has empty lists, not placeholders", () => {
  const out = enforceGrounding({}, facts, names, windows);
  assert.deepEqual([out.pilotPlan, out.menuNotes, out.risks, out.droppedNotes], [[], [], [], []]);
});

test("ids that are not a list are treated as no citation", () => {
  const out = run({ risks: [{ text: "x", facts: "F3" as never }] });
  assert.equal(out.risks.length, 0);
  assert.equal(out.droppedItems, 1);
});

test("a window that cannot be fixed is left as written when the venue has no usable hours", () => {
  const never = new Map([["Fukumoto", weekWindows({ monday: [{ opens: null, closes: null, closed: true }], tuesday: [{ opens: "T10:00", closes: "T13:00", closed: false }] })!]]);
  const out = enforceGrounding({ ...base, pilotPlan: [{ when: "Week 3, Mon 18:00–21:00", text: "Run it.", facts: [] }] }, facts, names, never);
  assert.equal(out.pilotPlan[0].when, "Week 3, Tue 10:00–13:00", "falls back to the best daytime window there is");
  const none = new Map([["Fukumoto", weekWindows({ sunday: [{ opens: "T00:00", closes: "T00:30", closed: false }] })!]]);
  const out2 = enforceGrounding({ ...base, pilotPlan: [{ when: "Week 3, Mon 18:00–21:00", text: "Run it.", facts: [] }] }, facts, names, none);
  assert.equal(out2.pilotPlan[0].when, "Week 3, Mon 18:00–21:00", "no window long enough: the original stays");
  assert.equal(out2.correctedItems, 0);
});

test("only the text before the day name is kept as the prefix of a corrected window", () => {
  const out = run({ pilotPlan: [{ when: "Week 3 (tasting): Mon 18:00–21:00", text: "Run it.", facts: [] }] });
  assert.equal(out.pilotPlan[0].when, "Week 3 (tasting): Tue 17:00–20:00");
});

test("a recommendation citing only another venue's facts is dropped even when it also cites a group fact", () => {
  const out = run({ recommendedVenue: { name: "Fukumoto", why: "Open.", facts: ["F4", "F5"] } });
  assert.equal(out.recommendedVenue, undefined);
});
