import assert from "node:assert/strict";
import { test } from "node:test";

process.env.DEMO_PASSWORD = "correct horse";
process.env.DEMO_USER = "demo";
delete process.env.SHOW_DEMO_CREDENTIALS;
const auth = await import("../lib/auth.ts");
const login = await import("../app/api/login/route.ts");
const logout = await import("../app/api/logout/route.ts");
const session = await import("../app/api/session/route.ts");

let n = 0;
const attempt = (username: string, password: string, extra: Record<string, string> = {}) =>
  login.POST(
    new Request("http://x/api/login", {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": `20.0.0.${++n}`, ...extra },
      body: JSON.stringify({ username, password }),
    })
  );

test("right credentials set an HttpOnly session cookie that the session route accepts", async () => {
  const res = await attempt("demo", "correct horse");
  assert.equal(res.status, 200);
  const cookie = res.headers.get("set-cookie") ?? "";
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.doesNotMatch(cookie, /Secure/, "plain http in this test");
  const pair = cookie.split(";")[0];
  const info = await (await session.GET(new Request("http://x/api/session", { headers: { cookie: pair } }))).json();
  assert.deepEqual({ authRequired: info.authRequired, authenticated: info.authenticated, demo: info.demo }, { authRequired: true, authenticated: true, demo: undefined });
});

test("the cookie is Secure behind an https proxy", async () => {
  const res = await attempt("demo", "correct horse", { "x-forwarded-proto": "https" });
  assert.match(res.headers.get("set-cookie") ?? "", /Secure/);
});

test("wrong credentials are a 401 with no cookie", async () => {
  const res = await attempt("demo", "wrong");
  assert.equal(res.status, 401);
  assert.equal(res.headers.get("set-cookie"), null);
});

test("a malformed body is a 400", async () => {
  const res = await login.POST(new Request("http://x/api/login", { method: "POST", headers: { "cf-connecting-ip": "30.0.0.1" }, body: "nope" }));
  assert.equal(res.status, 400);
});

test("after ten attempts from one client sign-in is refused, even with the right password", async () => {
  const ip = { "cf-connecting-ip": "40.0.0.1" };
  for (let i = 0; i < 10; i++) assert.equal((await login.POST(new Request("http://x/", { method: "POST", headers: ip, body: JSON.stringify({ username: "demo", password: "x" }) }))).status, 401);
  const res = await login.POST(new Request("http://x/", { method: "POST", headers: ip, body: JSON.stringify({ username: "demo", password: "correct horse" }) }));
  assert.equal(res.status, 429);
  assert.ok(Number(res.headers.get("retry-after")) > 0);
});

test("signed out, the session route shows the demo account and says sign-in is needed", async () => {
  const info = await (await session.GET(new Request("http://x/api/session"))).json();
  assert.equal(info.authenticated, false);
  assert.deepEqual(info.demo, { username: "demo", password: "correct horse" });
});

test("logout clears the cookie", async () => {
  const res = await logout.POST();
  assert.match(res.headers.get("set-cookie") ?? "", new RegExp(`${auth.SESSION_COOKIE}=;.*Max-Age=0`));
});
