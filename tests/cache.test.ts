import assert from "node:assert/strict";
import { test } from "node:test";
import { cacheKey, createResultCache } from "../lib/result-cache.ts";

function make(opts: { max?: number } = {}) {
  let t = 1_000_000;
  const cache = createResultCache<{ n: number }>({ ttlMs: 60_000, degradedTtlMs: 5_000, maxEntries: opts.max ?? 10, now: () => t });
  return { cache, advance: (ms: number) => (t += ms) };
}

test("the key ignores case and surrounding spaces but not the concept itself", () => {
  assert.equal(cacheKey(" Izakaya ", "Austin, TX "), cacheKey("izakaya", "austin, tx"));
  assert.notEqual(cacheKey("izakaya", "Austin"), cacheKey("izakaya", "Dallas"));
  assert.notEqual(cacheKey("izakaya", "Austin"), cacheKey("ramen", "Austin"));
});

test("a second identical request is served from the cache with its fetch time", async () => {
  const { cache } = make();
  let runs = 0;
  const compute = async () => ({ n: ++runs });
  const first = await cache.getOrCompute("k", compute);
  const second = await cache.getOrCompute("k", compute);
  assert.equal(runs, 1);
  assert.equal(first.cachedAt, undefined, "a fresh result is not marked as cached");
  assert.ok(second.cachedAt);
  assert.equal(second.data.n, 1);
});

test("a different key computes again", async () => {
  const { cache } = make();
  let runs = 0;
  await cache.getOrCompute("a", async () => ({ n: ++runs }));
  await cache.getOrCompute("b", async () => ({ n: ++runs }));
  assert.equal(runs, 2);
});

test("an entry expires after the ttl", async () => {
  const { cache, advance } = make();
  let runs = 0;
  const compute = async () => ({ n: ++runs });
  await cache.getOrCompute("k", compute);
  advance(59_000);
  await cache.getOrCompute("k", compute);
  assert.equal(runs, 1);
  advance(2_000);
  await cache.getOrCompute("k", compute);
  assert.equal(runs, 2);
});

test("a degraded result is kept only briefly", async () => {
  const { cache, advance } = make();
  let runs = 0;
  const compute = async () => ({ n: ++runs });
  await cache.getOrCompute("k", compute, () => true);
  advance(6_000);
  await cache.getOrCompute("k", compute);
  assert.equal(runs, 2);
});

test("concurrent identical requests share one run", async () => {
  const { cache } = make();
  let runs = 0;
  const compute = () => new Promise<{ n: number }>((resolve) => setTimeout(() => resolve({ n: ++runs }), 10));
  const [a, b] = await Promise.all([cache.getOrCompute("k", compute), cache.getOrCompute("k", compute)]);
  assert.equal(runs, 1);
  assert.equal(a.data.n, b.data.n);
});

test("a failed run is not cached and the next request retries", async () => {
  const { cache } = make();
  await assert.rejects(cache.getOrCompute("k", async () => { throw new Error("down"); }));
  const out = await cache.getOrCompute("k", async () => ({ n: 7 }));
  assert.equal(out.data.n, 7);
});

test("the cache never holds more than its limit", async () => {
  const { cache } = make({ max: 3 });
  for (let i = 0; i < 6; i++) await cache.getOrCompute(`k${i}`, async () => ({ n: i }));
  assert.equal(cache.size(), 3);
});

test("an entry is gone at the very instant it expires", async () => {
  const { cache, advance } = make();
  let runs = 0;
  const compute = async () => ({ n: ++runs });
  await cache.getOrCompute("k", compute);
  advance(60_000);
  await cache.getOrCompute("k", compute);
  assert.equal(runs, 2);
});

test("when full, expired entries go first and a live one is kept", async () => {
  const { cache, advance } = make({ max: 2 });
  let runs = 0;
  const compute = async () => ({ n: ++runs });
  await cache.getOrCompute("old", compute);
  advance(30_000);
  await cache.getOrCompute("mid", compute);
  advance(31_000);
  await cache.getOrCompute("new", compute);
  assert.equal(cache.size(), 2, "the expired one made room");
  const again = await cache.getOrCompute("mid", compute);
  assert.ok(again.cachedAt, "the live entry survived");
  assert.equal(runs, 3);
});

test("when full and nothing has expired, the oldest entry is the one dropped", async () => {
  const { cache } = make({ max: 2 });
  let runs = 0;
  const compute = async () => ({ n: ++runs });
  await cache.getOrCompute("a", compute);
  await cache.getOrCompute("b", compute);
  await cache.getOrCompute("c", compute);
  assert.equal((await cache.getOrCompute("b", compute)).cachedAt !== undefined, true);
  assert.equal((await cache.getOrCompute("c", compute)).cachedAt !== undefined, true);
  const a = await cache.getOrCompute("a", compute);
  assert.equal(a.cachedAt, undefined, "a was evicted and had to be computed again");
});

test("the key is lower-cased on both sides", () => {
  assert.equal(cacheKey("RAMEN", "TOKYO"), "ramen::tokyo");
});
