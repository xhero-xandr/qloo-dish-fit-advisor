import assert from "node:assert/strict";
import { test } from "node:test";
import { QlooQuotaError } from "../lib/qloo.ts";
import { ConceptNotFoundError, MIN_PILOT_VENUES, resolveTagDeterministically } from "../lib/tags.ts";

const tag = (name: string, type = "urn:tag:genre:place") => ({ id: `urn:tag:${name}`, name, type });
const place = (name: string) => ({ entity_id: name, name, properties: {} }) as never;

test("a venue pilot needs at least three candidates", () => {
  assert.equal(MIN_PILOT_VENUES, 3);
});

test("it takes the first ranked tag that returns venues, and reports the ones it tried", async () => {
  const out = await resolveTagDeterministically(
    "izakaya",
    async (id) => (id === "urn:tag:izakaya" ? [place("Fukumoto")] : []),
    async () => [tag("izakaya_style_small_plates", "urn:tag:genre:media"), tag("izakaya")]
  );
  assert.equal(out.primaryTag.name, "izakaya");
  assert.equal(out.places.length, 1);
  assert.deepEqual(out.triedTagNames, ["izakaya"]);
});

test("when no tag has venues it returns the best-ranked tag with an empty list", async () => {
  const out = await resolveTagDeterministically("izakaya", async () => [], async () => [tag("izakaya"), tag("sake_bar")]);
  assert.equal(out.places.length, 0);
  assert.ok(out.primaryTag);
  assert.ok(out.triedTagNames.length >= 1);
});

test("it tries at most four tags", async () => {
  let calls = 0;
  await resolveTagDeterministically("x", async () => (calls++, []), async () => Array.from({ length: 9 }, (_, i) => tag(`t${i}`)));
  assert.equal(calls, 4);
});

test("no tags at all is a concept error the user can fix, not an upstream failure", async () => {
  await assert.rejects(resolveTagDeterministically("zzzz", async () => [], async () => []), ConceptNotFoundError);
});

test("a rate-limit error is passed up, other search failures are tolerated", async () => {
  await assert.rejects(
    resolveTagDeterministically("izakaya", async () => [], async () => {
      throw new QlooQuotaError("429");
    }),
    QlooQuotaError
  );
  const out = await resolveTagDeterministically(
    "izakaya sake",
    async () => [place("A")],
    async (q) => {
      if (q === "izakaya sake") throw new Error("boom");
      return [tag("izakaya")];
    }
  );
  assert.equal(out.primaryTag.name, "izakaya");
});

test("while checking tags for venues, a rate limit stops everything but any other failure moves to the next tag", async () => {
  await assert.rejects(
    resolveTagDeterministically("izakaya", async () => {
      throw new QlooQuotaError("429");
    }, async () => [tag("izakaya")]),
    QlooQuotaError
  );
  let calls = 0;
  const out = await resolveTagDeterministically(
    "izakaya",
    async (id) => {
      calls++;
      if (id === "urn:tag:first") throw new Error("flaky");
      return [place("Fukumoto")];
    },
    async () => [tag("first"), tag("second")]
  );
  assert.equal(out.places.length, 1);
  assert.ok(calls >= 2);
});
