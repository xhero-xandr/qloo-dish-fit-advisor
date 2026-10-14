// Gemini via the Vercel AI SDK (@ai-sdk/google). Retries, tool loops and structured
// output are handled by the SDK; this module only configures the provider.

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { APICallError, RetryError } from "ai";

const API_KEY = process.env.GEMINI_API_KEY;

// gemini-3.5-flash-lite only, by default. Measured Oct 2026: it answers tool turns in <1s,
// while gemini-3.8-flash / 3.6-flash mostly returned 503, hung, or took ~55s per turn, and
// on the free tier 3.8-flash allows only 20 requests/day. Override with GEMINI_MODELS.
const MODEL_CHAIN = (process.env.GEMINI_MODELS ?? "gemini-3.5-flash-lite")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

/** Retries per model call. The SDK backs off exponentially (2s, 4s, 8s, 16s), which covers a per-minute 429. */
export const GEMINI_MAX_RETRIES = 4;

export const google = createGoogleGenerativeAI({ apiKey: API_KEY });

export function geminiModels(): string[] {
  return [...MODEL_CHAIN];
}

export function isGeminiConfigured(): boolean {
  return Boolean(API_KEY);
}

// Once a model's daily quota is spent, every call would sit through the SDK's retries (~30s)
// before failing. The first such failure parks the model instead, so later analyses go
// straight to the deterministic fallback until the quota resets.
const MIN_DAILY_COOLDOWN_MS = 10 * 60_000;
const MAX_COOLDOWN_MS = 6 * 60 * 60_000;
const unavailableUntil = new Map<string, number>();

export function isModelParked(model: string): boolean {
  return (unavailableUntil.get(model) ?? 0) > Date.now();
}

/** Parks `model` if `error` is a 429 for its per-day quota (Google's QuotaFailure names a PerDay quota id). */
export function parkIfDailyQuota(model: string, error: unknown): void {
  const last = RetryError.isInstance(error) ? error.lastError : error;
  if (!APICallError.isInstance(last) || last.statusCode !== 429) return;
  const body = last.responseBody ?? "";
  if (!/PerDay/i.test(body)) return;
  const delay = body.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  const resetMs = delay ? Number(delay[1]) * 1000 : 0;
  unavailableUntil.set(model, Date.now() + Math.min(Math.max(resetMs, MIN_DAILY_COOLDOWN_MS), MAX_COOLDOWN_MS));
}
