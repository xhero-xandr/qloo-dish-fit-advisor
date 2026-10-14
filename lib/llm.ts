// LLM providers for the agent, via the Vercel AI SDK. Retries, tool loops and structured
// output are handled by the SDK; this module builds the model chain and tracks quotas.

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { APICallError, RetryError, type LanguageModel } from "ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const list = (value: string) =>
  value
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

// gemini-3.5-flash-lite only, by default. Measured Oct 2026: it answers tool turns in <1s,
// while gemini-3.8-flash / 3.6-flash mostly returned 503, hung, or took ~55s per turn, and
// on the free tier 3.8-flash allows only 20 requests/day. Override with GEMINI_MODELS.
const GEMINI_MODELS = list(process.env.GEMINI_MODELS ?? "gemini-3.5-flash-lite");
// Backup for the analysis step once Gemini's quota is spent. Override with GROQ_MODELS.
const GROQ_MODELS = list(process.env.GROQ_MODELS ?? "openai/gpt-oss-120b");

/** Retries per model call. The SDK backs off exponentially (2s, 4s, 8s, 16s), which covers a per-minute 429. */
export const LLM_MAX_RETRIES = 4;

export interface ChainModel {
  /** Shown in the UI and stored on results, e.g. "gemini-3.5-flash-lite" or "groq/openai/gpt-oss-120b". */
  label: string;
  model: LanguageModel;
  /**
   * Trusted with the tag agent's tool loop. Measured Oct 2026: gpt-oss-120b on Groq failed
   * it in every run — calling tools it was told not to, skipping a required call, inventing
   * tag ids — while it handled the analysis step fine. So Groq backs up the analysis only.
   */
  toolAgent: boolean;
}

const google = createGoogleGenerativeAI({ apiKey: GEMINI_API_KEY });
const groq = createGroq({ apiKey: GROQ_API_KEY });

/** Gemini first, then Groq; a provider without a key is left out. */
const MODEL_CHAIN: ChainModel[] = [
  ...(GEMINI_API_KEY ? GEMINI_MODELS.map((id) => ({ label: id, model: google(id), toolAgent: true })) : []),
  ...(GROQ_API_KEY ? GROQ_MODELS.map((id) => ({ label: `groq/${id}`, model: groq(id), toolAgent: false })) : []),
];

export function llmModels(): ChainModel[] {
  return [...MODEL_CHAIN];
}

export function isLlmConfigured(): boolean {
  return MODEL_CHAIN.length > 0;
}

// Once a model's daily quota is spent, every call would sit through the SDK's retries (~30s)
// before failing. The first such failure parks the model instead, so later analyses move
// straight to the next model in the chain until the quota resets.
const MAX_WAITED_MS = 65_000;
const MIN_DAILY_COOLDOWN_MS = 10 * 60_000;
const MAX_COOLDOWN_MS = 6 * 60 * 60_000;
const unavailableUntil = new Map<string, number>();

export function isModelParked(label: string): boolean {
  return (unavailableUntil.get(label) ?? 0) > Date.now();
}

/**
 * Parks the model if `error` is a 429 for a daily quota, or one asking to wait longer than
 * a per-minute window. Gemini names the quota ("…PerDay…") and gives a RetryInfo
 * "retryDelay"; Groq says "tokens per day" / "requests per day" and sends retry-after.
 */
export function parkIfQuotaSpent(label: string, error: unknown): void {
  const last = RetryError.isInstance(error) ? error.lastError : error;
  if (!APICallError.isInstance(last) || last.statusCode !== 429) return;
  const body = last.responseBody ?? "";
  const retryDelay = body.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  const retryAfter = Number(last.responseHeaders?.["retry-after"]);
  const waitMs = Math.max(retryDelay ? Number(retryDelay[1]) * 1000 : 0, Number.isFinite(retryAfter) ? retryAfter * 1000 : 0);
  if (!/PerDay|per day/i.test(body) && waitMs <= MAX_WAITED_MS) return;
  unavailableUntil.set(label, Date.now() + Math.min(Math.max(waitMs, MIN_DAILY_COOLDOWN_MS), MAX_COOLDOWN_MS));
}
