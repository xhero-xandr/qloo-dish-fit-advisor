import assert from "node:assert/strict";
import { test } from "node:test";
import { curlFor, demographicsParams, describeRequest, placeSearchParams, recommendParams, tagSearchParams } from "../lib/provenance.ts";

test("each builder gives exactly the parameters the call sends", () => {
  assert.deepEqual(tagSearchParams("ramen", 7), { "filter.query": "ramen", "feature.semantic_search": true, take: 7 });
  assert.deepEqual(placeSearchParams(["t1", "t2"], "Austin, TX", 8), {
    "filter.type": "urn:entity:place",
    "filter.tags": "t1,t2",
    "filter.location.query": "Austin, TX",
    "filter.location.radius": 0,
    take: 8,
  });
  assert.deepEqual(demographicsParams("e1"), { "filter.type": "urn:demographics", "signal.interests.entities": "e1", take: 1 });
  assert.deepEqual(recommendParams(["v1", "v2"], "urn:entity:brand", "Austin, TX", 5), {
    "filter.type": "urn:entity:brand",
    "signal.interests.entities": "v1,v2",
    "signal.location.query": "Austin, TX",
    take: 5,
  });
});

test("an audience adds the demographic signals and nothing else changes", () => {
  const p = placeSearchParams(["t"], "Austin", 8, { age: ["25_to_29", "30_to_34"], gender: "female" });
  assert.equal(p["signal.demographics.age"], "25_to_29,30_to_34");
  assert.equal(p["signal.demographics.gender"], "female");
  assert.equal("signal.demographics.age" in placeSearchParams(["t"], "Austin", 8, { age: [] }), false);
  assert.equal("signal.demographics.gender" in placeSearchParams(["t"], "Austin", 8, {}), false);
});

test("describeRequest is one line: the method, the path and every parameter", () => {
  assert.equal(
    describeRequest({ path: "/v2/insights", params: demographicsParams("e1") }),
    "GET /v2/insights · filter.type=urn:demographics · signal.interests.entities=e1 · take=1"
  );
  assert.equal(describeRequest({ path: "/", params: {} }), "GET /");
});

test("the curl command repeats the request with a placeholder for the key, never a real one", () => {
  const curl = curlFor("https://hackathon.api.qloo.com/", { path: "/v2/tags", params: tagSearchParams("O'Brien's pie", 5) });
  assert.equal(
    curl,
    [
      "curl -G 'https://hackathon.api.qloo.com/v2/tags' \\",
      "  -H 'X-Api-Key: '\"$QLOO_API_KEY\" \\",
      "  --data-urlencode 'filter.query=O'\\''Brien'\\''s pie' \\",
      "  --data-urlencode 'feature.semantic_search=true' \\",
      "  --data-urlencode 'take=5'",
    ].join("\n")
  );
});

test("a request with no parameters still makes a valid command", () => {
  assert.equal(curlFor("https://x.example", { path: "/", params: {} }), ["curl -G 'https://x.example/' \\", "  -H 'X-Api-Key: '\"$QLOO_API_KEY\" \\"].join("\n"));
});
