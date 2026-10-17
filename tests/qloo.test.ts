import assert from "node:assert/strict";
import { mock, test } from "node:test";

process.env.QLOO_API_KEY = "test-key";
const qloo = await import("../lib/qloo.ts");

type Call = { url: URL; headers: Record<string, string>; at: number };
const realFetch = globalThis.fetch;

function stubFetch(responses: (Response | Error)[]) {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: URL | string, init?: RequestInit) => {
    calls.push({ url: new URL(String(input)), headers: init?.headers as Record<string, string>, at: Date.now() });
    const next = responses[Math.min(calls.length - 1, responses.length - 1)];
    if (next instanceof Error) throw next;
    return next.clone();
  }) as typeof fetch;
  return calls;
}
const json = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });
const restore = () => {
  globalThis.fetch = realFetch;
  mock.timers.reset();
};

/** Runs the promise while advancing the mocked timers, so waits of seconds take no real time. */
async function settle<T>(p: Promise<T>): Promise<T> {
  let done = false;
  const guarded = p.finally(() => (done = true));
  guarded.catch(() => {});
  while (!done) {
    await new Promise((r) => setImmediate(r));
    mock.timers.runAll();
  }
  return guarded;
}

test("tag search sends the key, the query and semantic search, and returns the tags", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const calls = stubFetch([json({ results: { tags: [{ id: "urn:tag:cuisine:qloo:ramen", name: "Ramen", type: "urn:tag:cuisine:qloo" }] } })]);
  try {
    const tags = await settle(qloo.findTags("ramen", 7));
    assert.equal(tags[0].name, "Ramen");
    const { url, headers } = calls[0];
    assert.equal(url.pathname, "/v2/tags");
    assert.equal(url.searchParams.get("filter.query"), "ramen");
    assert.equal(url.searchParams.get("feature.semantic_search"), "true");
    assert.equal(url.searchParams.get("take"), "7");
    assert.equal(headers["X-Api-Key"], "test-key");
  } finally {
    restore();
  }
});

test("a response without results is an empty list, not a crash", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  stubFetch([json({ success: true })]);
  try {
    assert.deepEqual(await settle(qloo.findTags("zzz")), []);
  } finally {
    restore();
  }
});

test("place search asks for places carrying the tag, inside the city only", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const calls = stubFetch([json({ results: { entities: [{ entity_id: "1", name: "Fukumoto", properties: {} }] } })]);
  try {
    const places = await settle(qloo.findPlacesByTags(["t1", "t2"], "Austin, TX", 5));
    assert.equal(places[0].name, "Fukumoto");
    const q = calls[0].url.searchParams;
    assert.equal(calls[0].url.pathname, "/v2/insights");
    assert.equal(q.get("filter.type"), "urn:entity:place");
    assert.equal(q.get("filter.tags"), "t1,t2");
    assert.equal(q.get("filter.location.query"), "Austin, TX");
    assert.equal(q.get("filter.location.radius"), "0", "strictly inside the city");
    assert.equal(q.get("take"), "5");
  } finally {
    restore();
  }
});

test("demographics come from the first block's query, and are undefined when there is none", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const calls = stubFetch([json({ results: { demographics: [{ entity_id: "e", query: { age: { "25_to_29": 0.4 }, gender: { male: 0.1, female: -0.1 } } }] } }), json({ results: { demographics: [] } })]);
  try {
    const demo = await settle(qloo.audienceDemographics("e"));
    assert.equal(demo?.age["25_to_29"], 0.4);
    assert.equal(calls[0].url.searchParams.get("filter.type"), "urn:demographics");
    assert.equal(calls[0].url.searchParams.get("signal.interests.entities"), "e");
    assert.equal(await settle(qloo.audienceDemographics("e2")), undefined);
  } finally {
    restore();
  }
});

test("cross-domain recommendations are seeded with the venues and located by the city", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const calls = stubFetch([json({ results: { entities: [{ name: "Brand", entity_id: "b", subtype: "urn:entity:brand" }] } })]);
  try {
    const out = await settle(qloo.recommendByEntities(["v1", "v2"], "urn:entity:brand", "Austin, TX", 3));
    assert.equal(out[0].name, "Brand");
    const q = calls[0].url.searchParams;
    assert.equal(q.get("filter.type"), "urn:entity:brand");
    assert.equal(q.get("signal.interests.entities"), "v1,v2");
    assert.equal(q.get("signal.location.query"), "Austin, TX");
  } finally {
    restore();
  }
});

test("a 429 is retried after the wait Qloo reports, then succeeds", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const calls = stubFetch([
    new Response("slow down", { status: 429, headers: { "x-second-ratelimit-reset": "1" } }),
    json({ results: { tags: [{ id: "a", name: "A", type: "t" }] } }),
  ]);
  try {
    const tags = await settle(qloo.findTags("x"));
    assert.equal(tags.length, 1);
    assert.equal(calls.length, 2);
  } finally {
    restore();
  }
});

test("a spent monthly quota is not retried and is reported as a quota error", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const calls = stubFetch([new Response("", { status: 429, headers: { "x-month-ratelimit-remaining": "0" } })]);
  try {
    await assert.rejects(settle(qloo.findTags("x")), qloo.QlooQuotaError);
    assert.equal(calls.length, 1);
  } finally {
    restore();
  }
});

test("a rate limit that never clears gives up after 13 tries as a quota error", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const calls = stubFetch([new Response("", { status: 429 })]);
  try {
    await assert.rejects(settle(qloo.findTags("x")), qloo.QlooQuotaError);
    assert.equal(calls.length, 13);
  } finally {
    restore();
  }
});

test("any other failure is a plain error carrying the status and path, and is not retried", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const calls = stubFetch([new Response('{"errors":[{"message":"bad"}]}', { status: 400 })]);
  try {
    await assert.rejects(settle(qloo.findTags("x")), (e: Error) => !(e instanceof qloo.QlooQuotaError) && /400 on \/v2\/tags/.test(e.message) && /bad/.test(e.message));
    assert.equal(calls.length, 1);
  } finally {
    restore();
  }
});

test("calls are spaced at least 250 ms apart however many are started at once", async () => {
  const calls = stubFetch([json({ results: { tags: [] } })]);
  try {
    await Promise.all([qloo.findTags("a"), qloo.findTags("b"), qloo.findTags("c")]);
    const gaps = calls.slice(1).map((c, i) => c.at - calls[i].at);
    assert.ok(gaps.every((g) => g >= 240), `gaps were ${gaps}`);
  } finally {
    restore();
  }
});

test("probeLocation tells 'no restaurants' and 'unknown city' apart from an outage", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    stubFetch([json({ results: { entities: [{ entity_id: "1", name: "A", properties: { geocode: { city: "Boise" } } }] } })]);
    assert.deepEqual(await settle(qloo.probeLocation("Boise")), { city: "Boise" });
    stubFetch([json({ results: { entities: [] } })]);
    assert.equal(await settle(qloo.probeLocation("Nowhere")), null, "answered, nothing there");
    stubFetch([new Response('{"errors":[{"message":"filter.location.query is unable to resolve to a valid locality."}]}', { status: 400 })]);
    assert.equal(await settle(qloo.probeLocation("Philidelphia")), null, "Qloo cannot place the city");
    stubFetch([new Response("down", { status: 500 })]);
    assert.equal(await settle(qloo.probeLocation("Boise")), undefined, "an outage is not an answer");
  } finally {
    restore();
  }
});

/** Records the waits the client asks for instead of making them, so retry timing can be checked exactly. */
async function waitsFor(responses: (Response | Error)[], run: () => Promise<unknown>) {
  const realSet = globalThis.setTimeout;
  const waits: number[] = [];
  stubFetch(responses);
  globalThis.setTimeout = ((fn: () => void, ms?: number) => {
    waits.push(Number(ms));
    fn();
    return 0 as never;
  }) as unknown as typeof setTimeout;
  try {
    await run().catch(() => {});
  } finally {
    globalThis.setTimeout = realSet;
    restore();
  }
  return waits.filter((w) => w !== 260);
}
const ok = () => json({ results: { tags: [] } });

test("the wait after a 429 is what Qloo reports plus a margin, never more than five seconds", async () => {
  assert.deepEqual(await waitsFor([new Response("", { status: 429, headers: { "x-second-ratelimit-reset": "2" } }), ok()], () => qloo.findTags("x")), [2150]);
  assert.deepEqual(await waitsFor([new Response("", { status: 429, headers: { "x-second-ratelimit-reset": "30" } }), ok()], () => qloo.findTags("x")), [5000]);
});

test("without a usable reset header the wait grows by half a second a try, up to three seconds", async () => {
  const rate = new Response("", { status: 429 });
  const waits = await waitsFor([rate, rate, rate, ok()], () => qloo.findTags("x"));
  assert.deepEqual(waits, [500, 1000, 1500]);
  const many = await waitsFor([rate], () => qloo.findTags("x"));
  assert.equal(Math.max(...many), 3000);
  const zero = await waitsFor([new Response("", { status: 429, headers: { "x-second-ratelimit-reset": "0" } }), ok()], () => qloo.findTags("x"));
  assert.deepEqual(zero, [500], "a reset of 0 is not trusted");
  const junk = await waitsFor([new Response("", { status: 429, headers: { "x-second-ratelimit-reset": "soon" } }), ok()], () => qloo.findTags("x"));
  assert.deepEqual(junk, [500]);
});

test("an error body is cut to 300 characters, and an unreadable one leaves the message intact", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    stubFetch([new Response("x".repeat(1000), { status: 400 })]);
    await assert.rejects(settle(qloo.findTags("x")), (e: Error) => e.message.length < 400);
    const broken = new Response("ignored", { status: 400 });
    broken.text = () => Promise.reject(new Error("stream failed"));
    globalThis.fetch = (async () => broken) as typeof fetch;
    await assert.rejects(settle(qloo.findTags("x")), (e: Error) => /400 on \/v2\/tags: $/.test(e.message));
  } finally {
    restore();
  }
});

test("the lookup of an unknown city asks for restaurants", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const calls = stubFetch([json({ results: { entities: [] } })]);
  try {
    await settle(qloo.probeLocation("Nowhere"));
    assert.equal(calls[0].url.searchParams.get("filter.tags"), "urn:tag:genre:place:restaurant");
    assert.equal(calls[0].url.searchParams.get("take"), "1");
  } finally {
    restore();
  }
});

test("a missing results block is an empty list for places and recommendations too", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    stubFetch([json({})]);
    assert.deepEqual(await settle(qloo.findPlacesByTags(["t"], "Austin")), []);
    stubFetch([json({})]);
    assert.deepEqual(await settle(qloo.recommendByEntities(["e"], "urn:entity:brand", "Austin")), []);
  } finally {
    restore();
  }
});

test("an audience, when given, is sent as Qloo's demographic signals and otherwise left out", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  const calls = stubFetch([json({ results: { entities: [] } })]);
  try {
    await settle(qloo.findPlacesByTags(["t"], "Austin", 8, { age: ["25_to_29", "30_to_34"], gender: "female" }));
    const q = calls[0].url.searchParams;
    assert.equal(q.get("signal.demographics.age"), "25_to_29,30_to_34");
    assert.equal(q.get("signal.demographics.gender"), "female");
    await settle(qloo.findPlacesByTags(["t"], "Austin", 8));
    assert.equal(calls[1].url.searchParams.has("signal.demographics.age"), false);
    assert.equal(calls[1].url.searchParams.has("signal.demographics.gender"), false);
    await settle(qloo.findPlacesByTags(["t"], "Austin", 8, { age: [] }));
    assert.equal(calls[2].url.searchParams.has("signal.demographics.age"), false, "an empty list is not sent");
  } finally {
    restore();
  }
});
