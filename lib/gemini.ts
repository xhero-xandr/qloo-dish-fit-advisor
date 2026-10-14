// Gemini via the Vercel AI SDK (@ai-sdk/google). Retries, tool loops and structured
// output are handled by the SDK; this module only configures the provider.

import { createGoogleGenerativeAI } from "@ai-sdk/google";

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
