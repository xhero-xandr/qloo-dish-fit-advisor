import assert from "node:assert/strict";
import { test } from "node:test";
import { APICallError, RetryError } from "ai";

process.env.GEMINI_API_KEY = "test";
process.env.GEMINI_MODELS = "model-a, model-b";
const llm = await import("../lib/llm.ts");

const rateLimit = (body: string, status = 429) =>
  new APICallError({ message: "limit", url: "https://x", requestBodyValues: {}, statusCode: status, responseBody: body });
const daily = '{"error":{"details":[{"violations":[{"quotaId":"GenerateRequestsPerDayPerProjectPerModel"}]},{"retryDelay":"30s"}]}}';
const perMinute = '{"error":{"details":[{"retryDelay":"12s"}]}}';

test("the configured models come back in order, and the agent counts as configured", () => {
  assert.deepEqual(llm.llmModels().map((m) => m.label), ["model-a", "model-b"]);
  assert.equal(llm.isLlmConfigured(), true);
});

test("a per-minute 429 does not park the model: the SDK's retries cover it", () => {
  llm.parkIfQuotaSpent("model-a", rateLimit(perMinute));
  assert.equal(llm.isModelParked("model-a"), false);
});

test("a daily quota 429 parks that model only, for at least ten minutes", () => {
  const before = Date.now();
  llm.parkIfQuotaSpent("model-b", rateLimit(daily));
  assert.equal(llm.isModelParked("model-b"), true);
  assert.equal(llm.isModelParked("model-a"), false);
  const realNow = Date.now;
  try {
    Date.now = () => before + 9 * 60_000;
    assert.equal(llm.isModelParked("model-b"), true);
    Date.now = () => before + 11 * 60_000;
    assert.equal(llm.isModelParked("model-b"), false, "back in service after the cooldown");
  } finally {
    Date.now = realNow;
  }
});

test("a wait longer than a minute parks the model even without a daily-quota name", () => {
  llm.parkIfQuotaSpent("slow", rateLimit('{"error":{"details":[{"retryDelay":"300s"}]}}'));
  assert.equal(llm.isModelParked("slow"), true);
});

test("the cooldown never exceeds six hours", () => {
  llm.parkIfQuotaSpent("huge", rateLimit('{"error":{"details":[{"retryDelay":"99999999s"}]} PerDay'));
  const realNow = Date.now;
  const start = realNow();
  try {
    Date.now = () => start + 6 * 3_600_000 + 1000;
    assert.equal(llm.isModelParked("huge"), false);
  } finally {
    Date.now = realNow;
  }
});

test("a daily quota inside the SDK's retry wrapper is still recognised", () => {
  const wrapped = new RetryError({ message: "failed after retries", reason: "maxRetriesExceeded", errors: [rateLimit(daily)] });
  llm.parkIfQuotaSpent("wrapped", wrapped);
  assert.equal(llm.isModelParked("wrapped"), true);
});

test("other failures never park a model", () => {
  llm.parkIfQuotaSpent("m503", rateLimit(daily, 503));
  llm.parkIfQuotaSpent("mplain", new Error("network"));
  llm.parkIfQuotaSpent("mstring", "oops");
  for (const m of ["m503", "mplain", "mstring"]) assert.equal(llm.isModelParked(m), false, m);
});

test("the cooldown follows the wait Qloo's neighbour Gemini asks for, between ten minutes and six hours", () => {
  const realNow = Date.now;
  const start = realNow();
  try {
    llm.parkIfQuotaSpent("two-hours", rateLimit('{"error":{"details":[{"retryDelay":"7200s"}]} PerDay'));
    Date.now = () => start + 119 * 60_000;
    assert.equal(llm.isModelParked("two-hours"), true);
    Date.now = () => start + 121 * 60_000;
    assert.equal(llm.isModelParked("two-hours"), false);
  } finally {
    Date.now = realNow;
  }
});

test("retry delays with decimals or odd spacing are read", () => {
  const realNow = Date.now;
  const start = realNow();
  try {
    llm.parkIfQuotaSpent("decimal", rateLimit('{"retryDelay" : "1800.5s"}'));
    Date.now = () => start + 29 * 60_000;
    assert.equal(llm.isModelParked("decimal"), true, "a 1800.5 s wait is parked past 29 minutes");
    Date.now = () => start + 31 * 60_000;
    assert.equal(llm.isModelParked("decimal"), false);
  } finally {
    Date.now = realNow;
  }
});

test("a wait of exactly 65 seconds is a per-minute limit; 66 is not", () => {
  llm.parkIfQuotaSpent("edge-65", rateLimit('{"retryDelay":"65s"}'));
  llm.parkIfQuotaSpent("edge-66", rateLimit('{"retryDelay":"66s"}'));
  assert.equal(llm.isModelParked("edge-65"), false);
  assert.equal(llm.isModelParked("edge-66"), true);
});

test("a model whose cooldown ends right now is back in service", () => {
  const realNow = Date.now;
  const start = realNow();
  try {
    llm.parkIfQuotaSpent("edge-now", rateLimit(daily));
    Date.now = () => start + 10 * 60_000;
    assert.equal(llm.isModelParked("edge-now"), false, "exactly ten minutes later it is free again");
  } finally {
    Date.now = realNow;
  }
});

const withHeaders = (body: string, headers: Record<string, string>, status = 429) =>
  new APICallError({ message: "limit", url: "https://x", requestBodyValues: {}, statusCode: status, responseBody: body, responseHeaders: headers });

test("other providers' limits are read too: Retry-After, 'try again in', insufficient_quota", () => {
  llm.parkIfQuotaSpent("ra-long", withHeaders("{}", { "retry-after": "600" }));
  assert.equal(llm.isModelParked("ra-long"), true, "a ten-minute Retry-After parks it");
  llm.parkIfQuotaSpent("ra-short", withHeaders("{}", { "retry-after": "20" }));
  assert.equal(llm.isModelParked("ra-short"), false, "twenty seconds is a per-minute limit");
  llm.parkIfQuotaSpent("ra-date", withHeaders("{}", { "retry-after": new Date(Date.now() + 3_600_000).toUTCString() }));
  assert.equal(llm.isModelParked("ra-date"), true, "a date an hour away counts");
  llm.parkIfQuotaSpent("oa-quota", withHeaders('{"error":{"code":"insufficient_quota","message":"You exceeded your current quota"}}', {}));
  assert.equal(llm.isModelParked("oa-quota"), true);
  llm.parkIfQuotaSpent("groq-min", withHeaders('{"error":{"message":"Rate limit reached ... Please try again in 7.5s."}}', {}));
  assert.equal(llm.isModelParked("groq-min"), false);
  llm.parkIfQuotaSpent("groq-day", withHeaders('{"error":{"message":"Rate limit reached for model per day ... Please try again in 2m30s."}}', {}));
  assert.equal(llm.isModelParked("groq-day"), true, "named as a daily limit");
  llm.parkIfQuotaSpent("oa-long", withHeaders('{"error":{"message":"Please try again in 2m30s."}}', {}));
  assert.equal(llm.isModelParked("oa-long"), true, "150 seconds is longer than a per-minute window");
  llm.parkIfQuotaSpent("oa-ms", withHeaders('{"error":{"message":"Please try again in 250ms."}}', {}));
  assert.equal(llm.isModelParked("oa-ms"), false);
});
