import assert from "node:assert/strict";
import { test } from "node:test";

process.env.DEMO_PASSWORD = "pw";
process.env.DEMO_USER = "demo";
const auth = await import("../lib/auth.ts");
const { createAnalyzeHandler } = await import("../lib/analyze-handler.ts");
const { CityNotFoundError, ConceptNotFoundError } = await import("../lib/tags.ts");
const { QlooQuotaError } = await import("../lib/qloo.ts");

const signedIn = () => `${auth.SESSION_COOKIE}=${auth.createSessionToken()}`;
let client = 0;
function post(body: unknown, opts: { cookie?: string | null; ip?: string; raw?: string } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json", "cf-connecting-ip": opts.ip ?? `10.0.0.${++client}` };
  const cookie = opts.cookie === undefined ? signedIn() : opts.cookie;
  if (cookie) headers.cookie = cookie;
  return new Request("http://x/api/analyze", { method: "POST", headers, body: opts.raw ?? JSON.stringify(body) });
}
const ok = createAnalyzeHandler(async (concept, city) => ({ concept, city }));

test("without a session the request is refused before anything is spent", async () => {
  let built = 0;
  const handler = createAnalyzeHandler(async () => (built++, {}));
  const res = await handler(post({ concept: "ramen", city: "Tokyo" }, { cookie: null }));
  assert.equal(res.status, 401);
  assert.equal((await res.json()).code, "auth");
  assert.equal(built, 0);
});

test("a valid request returns the analysis, with the concept and city trimmed", async () => {
  const res = await ok(post({ concept: "  birria tacos ", city: " Phoenix, AZ " }));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { concept: "birria tacos", city: "Phoenix, AZ" });
});

test("bad input is a 400 with a message the page can show", async () => {
  assert.equal((await ok(post({}, { raw: "not json" }))).status, 400);
  const empty = await ok(post({ concept: "", city: "Austin" }));
  assert.equal(empty.status, 400);
  assert.match((await empty.json()).error, /required/);
  const oneLetter = await ok(post({ concept: "x", city: "Austin" }));
  assert.equal(oneLetter.status, 400);
  assert.equal((await ok(post({ concept: 42, city: ["Austin"] }))).status, 400, "non-string fields count as missing");
});

test("a concept or city Qloo cannot map is a 422 the user can fix", async () => {
  for (const error of [new ConceptNotFoundError("no tag close to that"), new CityNotFoundError("no data for that city")]) {
    const res = await createAnalyzeHandler(async () => {
      throw error;
    })(post({ concept: "ramen", city: "Tokyo" }));
    assert.equal(res.status, 422);
    assert.equal((await res.json()).error, error.message);
  }
});

test("an upstream failure, including exhausted Qloo quota, is a 502", async () => {
  for (const error of [new QlooQuotaError("quota"), new Error("boom"), "weird"]) {
    const res = await createAnalyzeHandler(async () => {
      throw error;
    })(post({ concept: "ramen", city: "Tokyo" }));
    assert.equal(res.status, 502);
    assert.ok((await res.json()).error);
  }
});

test("a client is limited to 30 analyses an hour, and the limit is per client", async () => {
  const ip = "192.0.2.7";
  for (let i = 0; i < 30; i++) assert.equal((await ok(post({ concept: "ramen", city: "Tokyo" }, { ip }))).status, 200);
  const limited = await ok(post({ concept: "ramen", city: "Tokyo" }, { ip }));
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get("retry-after")) > 0);
  assert.equal((await ok(post({ concept: "ramen", city: "Tokyo" }, { ip: "192.0.2.8" }))).status, 200);
});
