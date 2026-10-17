import assert from "node:assert/strict";
import { test } from "node:test";

delete process.env.GEMINI_API_KEY;
const { chefNotesText, fallbackCore, interpretBrief, needsInterpretation, normalizeBrief } = await import("../lib/brief.ts");

test("a short single phrase is used exactly as typed", async () => {
  for (const text of ["ramen", "izakaya-style small plates", "Korean fried chicken with natural wine pairing", "vegan soul food"]) {
    assert.equal(needsInterpretation(text), false, text);
    const brief = await interpretBrief(text);
    assert.deepEqual(brief, { original: text, core: text, dishes: [], interpreted: false });
  }
});

test("a list, several lines or a long paragraph is read", () => {
  assert.equal(needsInterpretation("braised short rib, miso-glazed carrots, sesame crumble"), true, "two or more commas");
  assert.equal(needsInterpretation("tacos; ceviche"), true, "a semicolon");
  assert.equal(needsInterpretation("pizza\nwith mushrooms"), true, "two lines");
  assert.equal(needsInterpretation("a ".repeat(41).trim() + " menu"), true, "long");
  assert.equal(needsInterpretation("one two three four five six seven eight nine ten"), true, "more than nine words");
  assert.equal(needsInterpretation("fried chicken, waffles"), false, "a single comma is just a pair");
});

test("without a model the search phrase is the first clause, capped at eight words", () => {
  assert.equal(fallbackCore("braised short rib, miso-glazed carrots, sesame crumble"), "braised short rib");
  assert.equal(fallbackCore("Modern European tasting menu: five courses; seasonal"), "Modern European tasting menu");
  assert.equal(fallbackCore("one two three four five six seven eight nine ten eleven"), "one two three four five six seven eight");
  assert.equal(fallbackCore(", , rib"), "rib", "an empty first clause falls back to the text");
});

test("reading a long description without a model still gives a search phrase and flags it as read", async () => {
  const brief = await interpretBrief("slow-cooked lamb shoulder, pomegranate molasses, herbed couscous");
  assert.equal(brief.interpreted, true);
  assert.equal(brief.core, "slow-cooked lamb shoulder");
  assert.deepEqual(brief.dishes, []);
  assert.equal(brief.original, "slow-cooked lamb shoulder, pomegranate molasses, herbed couscous");
});

test("normalizeBrief cleans what a model returns and never leaves the search phrase empty", () => {
  const out = normalizeBrief("original text, with, commas", {
    core: "  modern   European  ",
    dishes: ["Short rib", " short rib ", "", 5, "x".repeat(200), ...Array.from({ length: 12 }, (_, i) => `dish ${i}`)],
  });
  assert.equal(out.core, "modern European");
  assert.equal(out.dishes.length, 8, "at most eight dishes");
  assert.equal(out.dishes[0], "Short rib");
  assert.ok(out.dishes.every((d) => d.length <= 80));
  assert.equal(out.dishes.filter((d) => d.toLowerCase() === "short rib").length, 1, "the same dish in another case is kept once");
  const empty = normalizeBrief("braised short rib, miso carrots, sesame", { core: "", dishes: "nope" });
  assert.equal(empty.core, "braised short rib");
  assert.deepEqual(empty.dishes, []);
  assert.equal(normalizeBrief("a b c d e f g h i j", { core: "one two three four five six seven eight nine ten" }).core.split(" ").length, 8);
});

test("chef notes appear in the prompt only when there are some", () => {
  assert.equal(chefNotesText(undefined), "");
  assert.equal(chefNotesText({ dishes: [], season: undefined }), "");
  assert.equal(chefNotesText({ dishes: ["Short rib", "Carrots"] }), '\nDishes the chef names: "Short rib"; "Carrots"');
  assert.equal(chefNotesText({ season: "summer" }), '\nSeason or timing the chef mentions (plan around it): "summer"');
});
