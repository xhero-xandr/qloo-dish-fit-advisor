import assert from "node:assert/strict";
import { test } from "node:test";

process.env.DEMO_PASSWORD = "secret";
process.env.SHOW_DEMO_CREDENTIALS = "0";
const session = await import("../app/api/session/route.ts");

test("with SHOW_DEMO_CREDENTIALS=0 the session route does not reveal the account", async () => {
  const info = await (await session.GET(new Request("http://x/api/session"))).json();
  assert.equal(info.authRequired, true);
  assert.equal(info.demo, undefined);
});
