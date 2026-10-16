import assert from "node:assert/strict";
import { test } from "node:test";

process.env.DEMO_PASSWORD = "pw";
delete process.env.DEMO_USER;
process.env.DEMO_USERNAME = "chef";
const auth = await import("../lib/auth.ts");

test("DEMO_USERNAME is accepted when DEMO_USER is not set", () => {
  assert.equal(auth.credentialsValid("chef", "pw"), true);
  assert.equal(auth.credentialsValid("demo", "pw"), false);
  assert.deepEqual(auth.demoHint(), { username: "chef", password: "pw" });
});
