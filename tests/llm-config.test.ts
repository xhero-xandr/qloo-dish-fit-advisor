import assert from "node:assert/strict";
import { test } from "node:test";

delete process.env.GEMINI_API_KEY;
delete process.env.LLM_MODELS;
delete process.env.GEMINI_MODELS;
const { buildModelChain, parseModelSpec } = await import("../lib/llm.ts");

// Stand-ins for the provider constructors: record what each model was built with.
const made: string[] = [];
const makers = {
  google: (key: string, id: string) => (made.push(`google|${key}|${id}`), { id } as never),
  compatible: (name: string, base: string, key: string | undefined, id: string) => (made.push(`${name}|${base}|${key ?? "-"}|${id}`), { id } as never),
};
const build = (env: Record<string, string | undefined>) => {
  made.length = 0;
  return { ...buildModelChain(env, makers), made: [...made] };
};

test("a bare model name is a Gemini model, as it always was", () => {
  assert.deepEqual(parseModelSpec("gemini-3.5-flash-lite"), { provider: "google", model: "gemini-3.5-flash-lite" });
  assert.deepEqual(parseModelSpec("google:gemini-3.5-flash"), { provider: "google", model: "gemini-3.5-flash" });
});

test("the first colon splits the provider; the model may contain more", () => {
  assert.deepEqual(parseModelSpec("ollama:llama3:8b"), { provider: "ollama", model: "llama3:8b" });
  assert.deepEqual(parseModelSpec("OpenRouter:meta/llama-3:free"), { provider: "openrouter", model: "meta/llama-3:free" });
});

test("by default, with a Gemini key, the chain is the one Gemini model", () => {
  const r = build({ GEMINI_API_KEY: "k" });
  assert.deepEqual(r.chain.map((m) => m.label), ["gemini-3.5-flash-lite"]);
  assert.deepEqual(r.made, ["google|k|gemini-3.5-flash-lite"]);
});

test("GEMINI_MODELS still works, and LLM_MODELS wins when both are set", () => {
  assert.deepEqual(build({ GEMINI_API_KEY: "k", GEMINI_MODELS: "a, b" }).chain.map((m) => m.label), ["a", "b"]);
  assert.deepEqual(build({ GEMINI_API_KEY: "k", GEMINI_MODELS: "a", LLM_MODELS: "c" }).chain.map((m) => m.label), ["c"]);
});

test("the google key may also be the name Google's own SDK uses", () => {
  assert.equal(build({ GOOGLE_GENERATIVE_AI_API_KEY: "g" }).chain.length, 1);
});

test("a named provider uses its built-in address and its own key, and is labelled provider:model", () => {
  const r = build({ LLM_MODELS: "groq:llama-3.3-70b-versatile,openai:gpt-5-mini", GROQ_API_KEY: "gk", OPENAI_API_KEY: "ok" });
  assert.deepEqual(r.chain.map((m) => m.label), ["groq:llama-3.3-70b-versatile", "openai:gpt-5-mini"]);
  assert.deepEqual(r.made, [
    "groq|https://api.groq.com/openai/v1|gk|llama-3.3-70b-versatile",
    "openai|https://api.openai.com/v1|ok|gpt-5-mini",
  ]);
});

test("a provider and an address of your own can be named, and the address can be overridden", () => {
  const r = build({ LLM_MODELS: "acme:big-1,openai:x", ACME_BASE_URL: "https://llm.acme.test/v1", ACME_API_KEY: "ak", OPENAI_API_KEY: "ok", OPENAI_BASE_URL: "https://proxy.test/v1" });
  assert.deepEqual(r.made, ["acme|https://llm.acme.test/v1|ak|big-1", "openai|https://proxy.test/v1|ok|x"]);
});

test("a local server needs no key", () => {
  const r = build({ LLM_MODELS: "ollama:qwen3:8b" });
  assert.deepEqual(r.made, ["ollama|http://localhost:11434/v1|-|qwen3:8b"]);
});

test("a model that cannot be used is skipped with the reason, and the rest still work", () => {
  const r = build({ LLM_MODELS: "gemini-3.5-flash-lite,groq:x,acme:y,:z,google:", GROQ_API_KEY: undefined });
  assert.equal(r.chain.length, 0);
  assert.deepEqual(r.skipped, [
    "gemini-3.5-flash-lite: set GEMINI_API_KEY",
    "groq:x: set GROQ_API_KEY",
    "acme:y: set ACME_BASE_URL",
    ":z: no provider name",
    "google:: no model name",
  ]);
  const mixed = build({ LLM_MODELS: "groq:x,gemini-3.5-flash-lite", GEMINI_API_KEY: "k" });
  assert.deepEqual(mixed.chain.map((m) => m.label), ["gemini-3.5-flash-lite"]);
  assert.equal(mixed.skipped.length, 1);
});

test("provider names with dashes become valid variable names", () => {
  const r = build({ LLM_MODELS: "my-host:m", MY_HOST_BASE_URL: "https://h.test/v1", MY_HOST_API_KEY: "k" });
  assert.deepEqual(r.made, ["my-host|https://h.test/v1|k|m"]);
});

test("with nothing configured there is no agent", () => {
  assert.equal(build({}).chain.length, 0);
});
