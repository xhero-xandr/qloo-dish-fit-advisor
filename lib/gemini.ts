// Minimal server-side Gemini client (REST generateContent).
// Docs: https://ai.google.dev/api/generate-content

const API_KEY = process.env.GEMINI_API_KEY;
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// gemini-3.5-flash-lite only, by default. Measured Oct 2026: it answers tool turns in <1s,
// while gemini-3.8-flash / 3.6-flash mostly returned 503, hung, or took ~55s per turn, and
// on the free tier 3.8-flash allows only 20 requests/day. Override with GEMINI_MODELS.
const MODEL_CHAIN = (process.env.GEMINI_MODELS ?? "gemini-3.5-flash-lite")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

// Free tier: 15 requests/minute per model (from Google's own 429 QuotaFailure details).
// Calls are queued under that instead of failing — the same "let it wait" policy as the
// Qloo client — so a burst of analyses slows down rather than silently losing the agent.
const REQUESTS_PER_MINUTE = Number(process.env.GEMINI_RPM ?? 14);
const MAX_QUEUE_WAIT_MS = 90_000;
const REQUEST_TIMEOUT_MS = 20_000;
const ATTEMPTS_PER_MODEL = 2;
const RETRY_DELAY_MS = 1_500;
// A 429 asking us to wait up to this long (a per-minute quota) is waited out. Longer (a
// per-day quota) means the model is skipped until the quota resets, capped at MAX_COOLDOWN_MS.
const MAX_WAITED_RETRY_DELAY_MS = 65_000;
const FAILURE_COOLDOWN_MS = 20_000;
const MAX_COOLDOWN_MS = 6 * 60 * 60_000;

const unavailableUntil = new Map<string, number>();
const recentCalls = new Map<string, number[]>();
let queue: Promise<unknown> = Promise.resolve();

/** Every model in the chain was overloaded, rate-limited, or cooling down — not a bad request. */
export class GeminiUnavailableError extends Error {}

export function geminiModels(): string[] {
  return [...MODEL_CHAIN];
}

export interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown>; id?: string };
  functionResponse?: { name: string; id?: string; response: Record<string, unknown> };
  thoughtSignature?: string;
  thought?: boolean;
}

export interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

export interface GeminiRequest {
  contents: GeminiContent[];
  systemInstruction?: { parts: { text: string }[] };
  tools?: { functionDeclarations: unknown[] }[];
  toolConfig?: { functionCallingConfig: { mode: "AUTO" | "ANY" | "NONE"; allowedFunctionNames?: string[] } };
  generationConfig?: Record<string, unknown>;
}

export interface GeminiResult {
  model: string;
  parts: GeminiPart[];
}

export function isGeminiConfigured(): boolean {
  return Boolean(API_KEY);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** FIFO slot under the per-minute cap. Returns false if the wait would exceed MAX_QUEUE_WAIT_MS. */
function acquireSlot(model: string): Promise<boolean> {
  const enqueuedAt = Date.now();
  const slot = queue.then(async () => {
    for (;;) {
      const now = Date.now();
      const calls = (recentCalls.get(model) ?? []).filter((t) => now - t < 60_000);
      if (calls.length < REQUESTS_PER_MINUTE) {
        calls.push(now);
        recentCalls.set(model, calls);
        return true;
      }
      const waitMs = calls[0] + 60_000 - now + 50;
      if (now + waitMs - enqueuedAt > MAX_QUEUE_WAIT_MS) return false;
      await sleep(waitMs);
    }
  });
  queue = slot.catch(() => undefined);
  return slot;
}

/**
 * `models` pins a multi-turn conversation to the model that started it: thought
 * signatures returned by one model aren't guaranteed to be accepted by another.
 */
export async function geminiGenerate(request: GeminiRequest, models: string[] = MODEL_CHAIN): Promise<GeminiResult> {
  if (!API_KEY) throw new Error("GEMINI_API_KEY is not set.");

  const failures: string[] = [];
  for (const model of models) {
    if ((unavailableUntil.get(model) ?? 0) > Date.now()) {
      failures.push(`${model}: skipped until its quota/overload clears`);
      continue;
    }

    for (let attempt = 0; attempt < ATTEMPTS_PER_MODEL; attempt++) {
      if (!(await acquireSlot(model))) {
        failures.push(`${model}: request queue full (over ${MAX_QUEUE_WAIT_MS / 1000}s wait)`);
        break;
      }
      const outcome = await callOnce(model, request);
      if (process.env.GEMINI_DEBUG) console.info(`[gemini] call ${model} -> ${outcome.kind}`);
      if (outcome.kind === "ok") return { model, parts: outcome.parts };

      failures.push(`${model}: ${outcome.reason}`);
      console.warn(`[gemini] ${model} attempt ${attempt + 1} failed: ${outcome.reason}`);
      if (outcome.kind === "fatal") {
        // A 4xx means the request itself is wrong; another model won't fix it.
        throw new Error(`Gemini ${model} rejected the request: ${outcome.reason}`);
      }
      if (outcome.retryAfterMs !== undefined && outcome.retryAfterMs > MAX_WAITED_RETRY_DELAY_MS) {
        // Per-day quota: skip this model until it resets rather than retrying every call.
        unavailableUntil.set(model, Date.now() + Math.min(outcome.retryAfterMs, MAX_COOLDOWN_MS));
        break;
      }
      if (attempt + 1 < ATTEMPTS_PER_MODEL) {
        await sleep(outcome.retryAfterMs ?? RETRY_DELAY_MS);
      } else {
        unavailableUntil.set(model, Date.now() + FAILURE_COOLDOWN_MS);
      }
    }
  }

  throw new GeminiUnavailableError(`No Gemini model available — ${failures.join("; ")}`);
}

type CallOutcome =
  | { kind: "ok"; parts: GeminiPart[] }
  | { kind: "retryable"; reason: string; retryAfterMs?: number }
  | { kind: "fatal"; reason: string };

/** Google's RetryInfo, e.g. "retryDelay": "54s". */
function parseRetryDelay(body: string): number | undefined {
  const match = body.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  return match ? Number(match[1]) * 1000 : undefined;
}

async function callOnce(model: string, request: GeminiRequest): Promise<CallOutcome> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": API_KEY ?? "", "Content-Type": "application/json" },
      body: JSON.stringify(request),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    return { kind: "retryable", reason: error instanceof Error ? error.message : "network error" };
  }

  if (res.ok) {
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: GeminiPart[] } }[];
      usageMetadata?: { totalTokenCount?: number };
    };
    if (process.env.GEMINI_DEBUG) console.info(`[gemini] tokens ${model} ${data.usageMetadata?.totalTokenCount ?? "?"}`);
    const parts = data.candidates?.[0]?.content?.parts;
    if (!parts || parts.length === 0) return { kind: "retryable", reason: "empty response" };
    return { kind: "ok", parts };
  }

  const body = await res.text().catch(() => "");
  const reason = `HTTP ${res.status} ${body.replace(/\s+/g, " ").slice(0, 200)}`;
  if (res.status === 429 || res.status >= 500) return { kind: "retryable", reason, retryAfterMs: parseRetryDelay(body) };
  return { kind: "fatal", reason };
}

/** Final turn of a conversation: no tools, JSON constrained to `schema`. */
export async function geminiJson<T>(
  request: Omit<GeminiRequest, "generationConfig" | "toolConfig">,
  schema: Record<string, unknown>,
  models?: string[]
): Promise<{ model: string; value: T }> {
  const result = await geminiGenerate(
    {
      ...request,
      ...(request.tools ? { toolConfig: { functionCallingConfig: { mode: "NONE" } } } : {}),
      generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.2 },
    },
    models
  );
  const text = result.parts
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
  return { model: result.model, value: JSON.parse(text) as T };
}
