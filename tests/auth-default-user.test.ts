import assert from "node:assert/strict";
import { test } from "node:test";

process.env.DEMO_PASSWORD = "pw";
delete process.env.DEMO_USER;
delete process.env.DEMO_USERNAME;
const auth = await import("../lib/auth.ts");

test("the account is called demo when no name is configured", () => {
  assert.equal(auth.credentialsValid("demo", "pw"), true);
  assert.equal(auth.demoHint()?.username, "demo");
});
