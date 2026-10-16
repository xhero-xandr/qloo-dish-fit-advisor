import assert from "node:assert/strict";
import { test } from "node:test";

delete process.env.DEMO_PASSWORD;
const session = await import("../app/api/session/route.ts");
const login = await import("../app/api/login/route.ts");
const { createAnalyzeHandler } = await import("../lib/analyze-handler.ts");

test("with no DEMO_PASSWORD the app is open: no login, everyone counts as signed in", async () => {
  const info = await (await session.GET(new Request("http://x/api/session"))).json();
  assert.deepEqual({ authRequired: info.authRequired, authenticated: info.authenticated }, { authRequired: false, authenticated: true });
  assert.equal((await login.POST(new Request("http://x/", { method: "POST", body: "{}" }))).status, 200);
});

test("and an analysis needs no cookie", async () => {
  const handler = createAnalyzeHandler(async () => ({ ok: true }));
  const res = await handler(new Request("http://x/api/analyze", { method: "POST", headers: { "cf-connecting-ip": "50.0.0.1" }, body: JSON.stringify({ concept: "ramen", city: "Tokyo" }) }));
  assert.equal(res.status, 200);
});
