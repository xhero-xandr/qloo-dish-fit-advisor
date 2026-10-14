// Minimal server-side Gemini client (REST generateContent).
// Docs: https://ai.google.dev/api/generate-content

const API_KEY = process.env.GEMINI_API_KEY;
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// Fast, reliable model first. In testing (Oct 2026) gemini-3.5-flash-lite answered in <1s,
// while gemini-3.8-flash / 3.6-flash mostly returned 503, hung, or took ~55s per turn —
// unusable for a multi-turn tool loop. The larger model stays as an overload fallback.
const MODEL_CHAIN = (process.env.GEMINI_MODELS ?? "gemini-3.5-flash-lite,gemini-3.8-flash")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

// An overloaded model answers 503 in ~3s; skip it for a while instead of paying that on every call.
const COOLDOWN_MS = 60_000;
const REQUEST_TIMEOUT_MS = 20_000;
const unavailableUntil = new Map<string, number>();

/** Every model in the chain was overloaded, timed out, or cooling down — worth retrying elsewhere, not a bad request. */
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
  toolConfig?: { functionCallingConfig: { mode: "AUTO" | "ANY" | "NONE" } };
  generationConfig?: Record<string, unknown>;
}

export interface GeminiResult {
  model: string;
  parts: GeminiPart[];
}

export function isGeminiConfigured(): boolean {
  return Boolean(API_KEY);
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
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
      failures.push(`${model}: cooling down after overload`);
      continue;
    }

    let res: Response;
    try {
      res = await fetch(`${BASE_URL}/${model}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(request),
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      unavailableUntil.set(model, Date.now() + COOLDOWN_MS);
      failures.push(`${model}: ${error instanceof Error ? error.message : "network error"}`);
      continue;
    }

    if (res.ok) {
      const data = (await res.json()) as { candidates?: { content?: { parts?: GeminiPart[] } }[] };
      const parts = data.candidates?.[0]?.content?.parts;
      if (!parts || parts.length === 0) {
        failures.push(`${model}: empty response`);
        continue;
      }
      return { model, parts };
    }

    const body = await res.text().catch(() => "");
    failures.push(`${model}: HTTP ${res.status}`);
    if (isRetryableStatus(res.status)) {
      unavailableUntil.set(model, Date.now() + COOLDOWN_MS);
      continue;
    }
    // A 4xx means the request itself is wrong; another model won't fix it.
    throw new Error(`Gemini ${model} rejected the request (HTTP ${res.status}): ${body.slice(0, 300)}`);
  }

  throw new GeminiUnavailableError(`No Gemini model available — ${failures.join("; ")}`);
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
