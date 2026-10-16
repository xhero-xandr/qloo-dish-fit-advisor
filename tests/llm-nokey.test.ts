import assert from "node:assert/strict";
import { test } from "node:test";

delete process.env.GEMINI_API_KEY;
const llm = await import("../lib/llm.ts");

test("without a key there is no agent and no models", () => {
  assert.equal(llm.isLlmConfigured(), false);
  assert.deepEqual(llm.llmModels(), []);
});
