import assert from "node:assert/strict";
import { test } from "node:test";

// The module reads its configuration when it is first loaded, so set it before importing.
process.env.DEMO_USER = "demo";
process.env.DEMO_PASSWORD = "correct horse";
delete process.env.SESSION_SECRET;
const auth = await import("../lib/auth.ts");

test("credentials must match both user and password", () => {
  assert.equal(auth.credentialsValid("demo", "correct horse"), true);
  assert.equal(auth.credentialsValid("demo", "wrong"), false);
  assert.equal(auth.credentialsValid("someone", "correct horse"), false);
  assert.equal(auth.credentialsValid(undefined, "correct horse"), false);
  assert.equal(auth.credentialsValid("demo", 12345), false);
});

test("a fresh session token is valid and a tampered one is not", () => {
  const token = auth.createSessionToken();
  assert.equal(auth.sessionValid(token), true);
  const [expires, signature] = token.split(".");
  assert.equal(auth.sessionValid(`${Number(expires) + 3600}.${signature}`), false);
  assert.equal(auth.sessionValid(`${expires}.${"0".repeat(signature.length)}`), false);
  assert.equal(auth.sessionValid(undefined), false);
  assert.equal(auth.sessionValid("garbage"), false);
});

test("an expired token is rejected even with a correct signature", () => {
  const realNow = Date.now;
  const token = auth.createSessionToken();
  Date.now = () => realNow() + (auth.SESSION_TTL_SECONDS + 5) * 1000;
  try {
    assert.equal(auth.sessionValid(token), false);
  } finally {
    Date.now = realNow;
  }
});

test("requestHasSession reads the cookie from the request", () => {
  const token = auth.createSessionToken();
  const withCookie = new Request("http://x/", { headers: { cookie: `a=1; ${auth.SESSION_COOKIE}=${token}` } });
  assert.equal(auth.requestHasSession(withCookie), true);
  assert.equal(auth.requestHasSession(new Request("http://x/")), false);
});

test("rateLimit allows up to the limit then reports seconds to wait", () => {
  for (let i = 0; i < 3; i++) assert.equal(auth.rateLimit("t", "a", 3, 60_000), undefined);
  const wait = auth.rateLimit("t", "a", 3, 60_000);
  assert.ok(wait !== undefined && wait > 0 && wait <= 60);
  assert.equal(auth.rateLimit("t", "b", 3, 60_000), undefined, "another client has its own budget");
});

test("clientKey prefers the Cloudflare header, then x-forwarded-for", () => {
  const cf = new Request("http://x/", { headers: { "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" } });
  assert.equal(auth.clientKey(cf), "1.1.1.1");
  const xff = new Request("http://x/", { headers: { "x-forwarded-for": "2.2.2.2, 3.3.3.3" } });
  assert.equal(auth.clientKey(xff), "2.2.2.2");
  assert.equal(auth.clientKey(new Request("http://x/")), "unknown");
});

test("a session lasts twelve hours", () => {
  assert.equal(auth.SESSION_TTL_SECONDS, 12 * 60 * 60);
});

test("a token is still good at the second it expires and not after", () => {
  const realNow = Date.now;
  const token = auth.createSessionToken();
  const expires = Number(token.split(".")[0]);
  try {
    Date.now = () => expires * 1000;
    assert.equal(auth.sessionValid(token), true);
    Date.now = () => expires * 1000 + 1500;
    assert.equal(auth.sessionValid(token), false);
  } finally {
    Date.now = realNow;
  }
});

test("clientKey trims the forwarded address and falls back to x-real-ip", () => {
  assert.equal(auth.clientKey(new Request("http://x/", { headers: { "x-forwarded-for": "  2.2.2.2 , 3.3.3.3" } })), "2.2.2.2");
  assert.equal(auth.clientKey(new Request("http://x/", { headers: { "x-real-ip": "4.4.4.4" } })), "4.4.4.4");
});

test("rate-limit hits expire with the window, to the millisecond", () => {
  const realNow = Date.now;
  let now = 1_000_000;
  Date.now = () => now;
  try {
    assert.equal(auth.rateLimit("win", "k", 2, 1000), undefined);
    now += 400;
    assert.equal(auth.rateLimit("win", "k", 2, 1000), undefined);
    now += 100;
    assert.equal(auth.rateLimit("win", "k", 2, 1000), 1, "full; the oldest hit frees up in 500 ms, reported as 1 s");
    now += 499;
    assert.ok(auth.rateLimit("win", "k", 2, 1000) !== undefined, "999 ms after the first hit it still counts");
    now += 1;
    assert.equal(auth.rateLimit("win", "k", 2, 1000), undefined, "1000 ms after it, the window has moved on");
  } finally {
    Date.now = realNow;
  }
});

test("isHttps recognises a secure request either by header or by the url", () => {
  assert.equal(auth.isHttps(new Request("http://x/", { headers: { "x-forwarded-proto": "https" } })), true);
  assert.equal(auth.isHttps(new Request("https://x/")), true);
  assert.equal(auth.isHttps(new Request("http://x/")), false);
});

test("a per-hour limit from the environment must be a positive whole number", () => {
  assert.equal(auth.limitFromEnv("120", 30), 120);
  for (const bad of [undefined, "", "0", "-5", "2.5", "lots"]) assert.equal(auth.limitFromEnv(bad, 30), 30, String(bad));
});
