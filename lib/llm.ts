// LLM providers for the agent, via the Vercel AI SDK. Retries, tool loops and structured
// output are handled by the SDK; this module builds the model chain and tracks quotas.

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { APICallError, RetryError, type LanguageModel } from "ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const list = (value: string) =>
  value
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

// gemini-3.5-flash-lite only, by default. Measured Oct 2026: it answers tool turns in <1s,
// while gemini-3.8-flash / 3.6-flash mostly returned 503, hung, or took ~55s per turn, and
// on the free tier 3.8-flash allows only 20 requests/day. Override with GEMINI_MODELS.
const GEMINI_MODELS = list(process.env.GEMINI_MODELS ?? "gemini-3.5-flash-lite");

/** Retries per model call. The SDK backs off exponentially (2s, 4s, 8s, 16s), which covers a per-minute 429. */
export const LLM_MAX_RETRIES = 4;

export interface ChainModel {
  /** Shown in the UI and stored on results, e.g. "gemini-3.5-flash-lite". */
  label: string;
  model: LanguageModel;
}

const google = createGoogleGenerativeAI({ apiKey: GEMINI_API_KEY });

/** The configured Gemini models, in order of preference; empty without a key. */
const MODEL_CHAIN: ChainModel[] = GEMINI_API_KEY ? GEMINI_MODELS.map((id) => ({ label: id, model: google(id) })) : [];

export function llmModels(): ChainModel[] {
  return [...MODEL_CHAIN];
}

export function isLlmConfigured(): boolean {
  return MODEL_CHAIN.length > 0;
}

// Once a model's daily quota is spent, every call would sit through the SDK's retries (~30s)
// before failing. The first such failure parks the model instead, so later analyses skip it
// (and fall back to the deterministic pipeline) until the quota resets.
const MAX_WAITED_MS = 65_000;
const MIN_DAILY_COOLDOWN_MS = 10 * 60_000;
const MAX_COOLDOWN_MS = 6 * 60 * 60_000;
const unavailableUntil = new Map<string, number>();

export function isModelParked(label: string): boolean {
  return (unavailableUntil.get(label) ?? 0) > Date.now();
}

/**
 * Parks the model if `error` is a 429 for a daily quota, or one asking to wait longer than
 * a per-minute window. Gemini names the quota ("…PerDay…") and gives a RetryInfo "retryDelay".
 */
export function parkIfQuotaSpent(label: string, error: unknown): void {
  const last = RetryError.isInstance(error) ? error.lastError : error;
  if (!APICallError.isInstance(last) || last.statusCode !== 429) return;
  const body = last.responseBody ?? "";
  const retryDelay = body.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  const waitMs = retryDelay ? Number(retryDelay[1]) * 1000 : 0;
  if (!/PerDay/i.test(body) && waitMs <= MAX_WAITED_MS) return;
  unavailableUntil.set(label, Date.now() + Math.min(Math.max(waitMs, MIN_DAILY_COOLDOWN_MS), MAX_COOLDOWN_MS));
}
