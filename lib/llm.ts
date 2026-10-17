// Language models for the agent, through the Vercel AI SDK. Retries, tool loops and structured
// output are handled by the SDK, so the agent code does not care which provider answers; this module
// turns configuration into a chain of models (the first that works is used, the next is the fallback)
// and tracks which of them have run out of quota.
//
// Configuration, one list in LLM_MODELS (or GEMINI_MODELS, the older name):
//
//   LLM_MODELS=gemini-3.5-flash-lite                      a bare name is a Google Gemini model
//   LLM_MODELS=google:gemini-3.5-flash-lite,groq:llama-3.3-70b-versatile
//
// "google:<model>" uses Google's own provider and GEMINI_API_KEY. Any other "<name>:<model>" is an
// OpenAI-compatible endpoint, which covers OpenAI, Groq, OpenRouter, DeepSeek, Mistral, Together, Anthropic's
// compatibility endpoint, and local servers such as Ollama. Its key is <NAME>_API_KEY and its address is
// <NAME>_BASE_URL (built in for the common ones, below). A model whose key is missing is skipped.

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { APICallError, RetryError, type LanguageModel } from "ai";

/** Retries per model call. The SDK backs off exponentially (2s, 4s, 8s, 16s), which covers a per-minute 429. */
export const LLM_MAX_RETRIES = 4;

export interface ChainModel {
  /** Shown in the UI and stored on results: the bare model id for Google, "<provider>:<model>" otherwise. */
  label: string;
  model: LanguageModel;
}

/** Well-known OpenAI-compatible endpoints, so only a key is needed for them. */
const COMPATIBLE_PRESETS: Record<
  string,
  { baseUrl: string; keyless?: boolean }
> = {
  openai: { baseUrl: "https://api.openai.com/v1" },
  groq: { baseUrl: "https://api.groq.com/openai/v1" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1" },
  deepseek: { baseUrl: "https://api.deepseek.com/v1" },
  mistral: { baseUrl: "https://api.mistral.ai/v1" },
  together: { baseUrl: "https://api.together.xyz/v1" },
  anthropic: { baseUrl: "https://api.anthropic.com/v1/" },
  ollama: { baseUrl: "http://localhost:11434/v1", keyless: true },
};

type Env = Record<string, string | undefined>;

export interface ModelMakers {
  google(apiKey: string, modelId: string): LanguageModel;
  compatible(
    name: string,
    baseUrl: string,
    apiKey: string | undefined,
    modelId: string,
  ): LanguageModel;
}

const defaultMakers: ModelMakers = {
  google: (apiKey, modelId) => createGoogleGenerativeAI({ apiKey })(modelId),
  compatible: (name, baseUrl, apiKey, modelId) =>
    createOpenAICompatible({ name, baseURL: baseUrl, apiKey })(modelId),
};

const envName = (provider: string) =>
  provider.toUpperCase().replace(/[^A-Z0-9]/g, "_");

/** "groq:llama-3.3-70b" -> provider groq; a bare "gemini-3.5-flash-lite" -> google. The model may itself contain colons. */
export function parseModelSpec(spec: string): {
  provider: string;
  model: string;
} {
  const i = spec.indexOf(":");
  if (i < 0) return { provider: "google", model: spec };
  return { provider: spec.slice(0, i).toLowerCase(), model: spec.slice(i + 1) };
}

/** The models named in the environment that can actually be used, in order, and the ones skipped with the reason. */
export function buildModelChain(
  env: Env,
  makers: ModelMakers = defaultMakers,
): { chain: ChainModel[]; skipped: string[] } {
  const raw = env.LLM_MODELS ?? env.GEMINI_MODELS ?? "gemini-3.5-flash-lite";
  const specs = raw
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  const chain: ChainModel[] = [];
  const skipped: string[] = [];
  for (const spec of specs) {
    const { provider, model } = parseModelSpec(spec);
    if (!provider) {
      skipped.push(`${spec}: no provider name`);
    } else if (!model) {
      skipped.push(`${spec}: no model name`);
    } else if (provider === "google") {
      const key = env.GEMINI_API_KEY ?? env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (key) chain.push({ label: model, model: makers.google(key, model) });
      else skipped.push(`${spec}: set GEMINI_API_KEY`);
    } else {
      const preset = COMPATIBLE_PRESETS[provider];
      const baseUrl = env[`${envName(provider)}_BASE_URL`] ?? preset?.baseUrl;
      const key = env[`${envName(provider)}_API_KEY`];
      if (!baseUrl) skipped.push(`${spec}: set ${envName(provider)}_BASE_URL`);
      else if (!key && !preset?.keyless)
        skipped.push(`${spec}: set ${envName(provider)}_API_KEY`);
      else
        chain.push({
          label: `${provider}:${model}`,
          model: makers.compatible(provider, baseUrl, key, model),
        });
    }
  }
  return { chain, skipped };
}

const built = buildModelChain(process.env);
const MODEL_CHAIN: ChainModel[] = built.chain;
for (const note of built.skipped) console.warn(`[llm] skipped ${note}`);

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

/** How long the provider says to wait, from the Retry-After header or the error text; 0 when it does not say. */
function waitHintMs(error: APICallError): number {
  const header = error.responseHeaders?.["retry-after"];
  if (header !== undefined) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return seconds * 1000;
    const date = Date.parse(header);
    if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  }
  const body = error.responseBody ?? "";
  // Gemini: "retryDelay": "30s". OpenAI and Groq: "Please try again in 7.5s" (or 250ms, 2m30s).
  const gemini = body.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  if (gemini) return Number(gemini[1]) * 1000;
  const again = body.match(/try again in (?:(\d+)m)?\s*(\d+(?:\.\d+)?)(ms|s)/i);
  if (again)
    return (
      (Number(again[1] ?? 0) * 60 +
        Number(again[2]) / (again[3].toLowerCase() === "ms" ? 1000 : 1)) *
      1000
    );
  return 0;
}

/** Wording that means a quota per day or per account, not a per-minute limit. */
const SPENT_QUOTA =
  /PerDay|per day|daily|insufficient_quota|exceeded your current quota|billing/i;

/**
 * Parks the model if `error` is a 429 for a daily or account quota, or one asking to wait longer than a
 * per-minute window. Providers word this differently (Gemini names "…PerDay…", OpenAI "insufficient_quota",
 * several send a Retry-After header), so all of those are read.
 */
export function parkIfQuotaSpent(label: string, error: unknown): void {
  const last = RetryError.isInstance(error) ? error.lastError : error;
  if (!APICallError.isInstance(last) || last.statusCode !== 429) return;
  const waitMs = waitHintMs(last);
  if (!SPENT_QUOTA.test(last.responseBody ?? "") && waitMs <= MAX_WAITED_MS)
    return;
  unavailableUntil.set(
    label,
    Date.now() +
      Math.min(Math.max(waitMs, MIN_DAILY_COOLDOWN_MS), MAX_COOLDOWN_MS),
  );
}
