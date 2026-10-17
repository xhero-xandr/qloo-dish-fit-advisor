import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { generateText, hasToolCall, Output, tool } from "ai";
import { z } from "zod";

// A stand-in for any OpenAI-compatible provider (Groq, OpenRouter, Ollama, ...): it answers
// /chat/completions in that format. This checks that a model configured as "<name>:<model>" works
// through the same SDK calls the agent makes (plain text, structured output, a tool loop).

const requests: { path: string; body: { model: string; messages: { role: string; content?: unknown }[]; tools?: unknown[]; temperature?: number; seed?: number }; auth?: string }[] = [];
let reply: (body: (typeof requests)[number]["body"]) => unknown = () => ({});
const server = createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = JSON.parse(raw);
    requests.push({ path: req.url ?? "", body, auth: req.headers.authorization });
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(reply(body)));
  });
});
const completion = (message: object, finish = "stop") => ({
  id: "x", object: "chat.completion", created: 0, model: "m",
  choices: [{ index: 0, message: { role: "assistant", ...message }, finish_reason: finish }],
  usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
});

let llm: typeof import("../lib/llm.ts");
before(async () => {
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  delete process.env.GEMINI_API_KEY;
  process.env.LLM_MODELS = "mock:test-model";
  process.env.MOCK_BASE_URL = `http://127.0.0.1:${port}/v1`;
  process.env.MOCK_API_KEY = "sk-mock";
  llm = await import("../lib/llm.ts");
});
after(() => server.close());

test("the configured provider is in the chain with its own label", () => {
  assert.equal(llm.isLlmConfigured(), true);
  assert.deepEqual(llm.llmModels().map((m) => m.label), ["mock:test-model"]);
});

test("plain text works, and the key and the sampling settings the agent uses reach the provider", async () => {
  reply = () => completion({ content: "hello" });
  const { text } = await generateText({ model: llm.llmModels()[0].model, prompt: "say hi", temperature: 0, seed: 42, maxRetries: 0 });
  assert.equal(text, "hello");
  const sent = requests.at(-1)!;
  assert.equal(sent.path, "/v1/chat/completions");
  assert.equal(sent.auth, "Bearer sk-mock");
  assert.equal(sent.body.model, "test-model");
  assert.equal(sent.body.temperature, 0);
  assert.equal(sent.body.seed, 42);
});

test("structured output, as the analysis and the description reader use it, is parsed", async () => {
  reply = () => completion({ content: JSON.stringify({ core: "modern bistro", dishes: ["short rib"] }) });
  const { output } = await generateText({
    model: llm.llmModels()[0].model,
    prompt: "read this",
    output: Output.object({ schema: z.object({ core: z.string(), dishes: z.array(z.string()) }) }),
    maxRetries: 0,
  });
  assert.deepEqual(output, { core: "modern bistro", dishes: ["short rib"] });
});

test("a tool loop works: the model calls a tool, gets its result, then calls the stop tool", async () => {
  let turn = 0;
  reply = () => {
    turn++;
    const call = (id: string, name: string, args: object) => completion({ content: null, tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }] }, "tool_calls");
    return turn === 1 ? call("c1", "search_tags", { query: "ramen" }) : call("c2", "submit_choice", { tag: "ramen" });
  };
  let searched = "";
  const result = await generateText({
    model: llm.llmModels()[0].model,
    prompt: "pick a tag",
    tools: {
      search_tags: tool({ description: "search", inputSchema: z.object({ query: z.string() }), execute: async ({ query }) => ((searched = query), { tags: ["Ramen"] }) }),
      submit_choice: tool({ description: "submit", inputSchema: z.object({ tag: z.string() }) }),
    },
    toolChoice: "required",
    stopWhen: [hasToolCall("submit_choice")],
    maxRetries: 0,
  });
  assert.equal(searched, "ramen");
  const submitted = result.steps.flatMap((s) => s.toolCalls).find((c) => c.toolName === "submit_choice");
  assert.deepEqual(submitted?.input, { tag: "ramen" });
  assert.equal(turn, 2);
});

test("a 429 from the provider is an API error the quota check understands", async () => {
  const { APICallError } = await import("ai");
  reply = () => ({});
  const original = server.listeners("request");
  server.removeAllListeners("request");
  server.on("request", (_req, res) => {
    res.statusCode = 429;
    res.setHeader("retry-after", "3600");
    res.end(JSON.stringify({ error: { message: "slow down" } }));
  });
  try {
    await assert.rejects(generateText({ model: llm.llmModels()[0].model, prompt: "x", maxRetries: 0 }), (e: unknown) => {
      llm.parkIfQuotaSpent("mock:test-model", e);
      return APICallError.isInstance(e) && e.statusCode === 429;
    });
    assert.equal(llm.isModelParked("mock:test-model"), true, "an hour-long Retry-After parks the model");
  } finally {
    server.removeAllListeners("request");
    for (const l of original) server.on("request", l as never);
  }
});
