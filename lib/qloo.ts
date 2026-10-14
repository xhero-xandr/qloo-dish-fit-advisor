// Thin server-side client for the Qloo Insights API (hackathon endpoint).
// Docs: https://docs.qloo.com/reference/insights-api-deep-dive

const BASE_URL = process.env.QLOO_BASE_URL ?? "https://hackathon.api.qloo.com";
const API_KEY = process.env.QLOO_API_KEY;

if (!API_KEY && process.env.NODE_ENV !== "test") {
  console.warn("QLOO_API_KEY is not set — Qloo calls will fail.");
}

// The hackathon key's documented limits (confirmed from Qloo's own response
// headers): 5 requests/second and 10,000/month, shared at the account level
// across every request this server makes, no matter how many browser tabs or
// concurrent city comparisons triggered them. A single multi-tag concept
// lookup alone can fire 3-4 calls in a burst, so every outbound call is
// serialized through one module-level queue with spacing, instead of
// trusting caller-side Promise.all to behave.
//
// On a 429, we wait and retry rather than fail fast — an analysis is allowed
// to take longer than usual; the reverse proxy in front of this app is
// configured with an 86400s read timeout specifically so a slow-but-patient
// retry loop here never gets cut off upstream.
const MIN_SPACING_MS = 260; // ~3.8 req/s, safely under the 5 req/s cap
const MAX_RATE_LIMIT_RETRIES = 12; // worst case ~30-40s of waiting before giving up
let requestChain: Promise<void> = Promise.resolve();

/** Qloo refused for quota reasons — callers must propagate it rather than treat it as "no results". */
export class QlooQuotaError extends Error {}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function scheduleRequestSlot(): Promise<void> {
  const slot = requestChain.then(() => sleep(MIN_SPACING_MS));
  requestChain = slot;
  return slot;
}

function retryDelayMs(res: Response, attempt: number): number {
  const resetHeader = res.headers.get("x-second-ratelimit-reset");
  const resetSeconds = resetHeader ? Number(resetHeader) : NaN;
  if (Number.isFinite(resetSeconds) && resetSeconds > 0) {
    return Math.min(resetSeconds * 1000 + 150, 5000);
  }
  // Exponential-ish backoff fallback if the API doesn't report a reset window.
  return Math.min(500 * (attempt + 1), 3000);
}

async function qlooGet<T>(path: string, params: Record<string, string | number | boolean | undefined>): Promise<T> {
  const url = new URL(path, BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
    await scheduleRequestSlot();
    const res = await fetch(url, {
      headers: { "X-Api-Key": API_KEY ?? "" },
      cache: "no-store",
    });
    if (res.ok) return res.json() as Promise<T>;

    if (res.status === 429) {
      if (res.headers.get("x-month-ratelimit-remaining") === "0") {
        throw new QlooQuotaError("Qloo monthly request quota for this API key is exhausted — retrying won't help until it resets.");
      }
      if (attempt < MAX_RATE_LIMIT_RETRIES) {
        await sleep(retryDelayMs(res, attempt));
        continue;
      }
      throw new QlooQuotaError("Qloo rate limit hit (429) repeatedly — the shared hackathon key allows only ~5 requests/second. Please wait a bit and try again.");
    }
    const body = await res.text().catch(() => "");
    throw new Error(`Qloo API ${res.status} on ${path}: ${body.slice(0, 300)}`);
  }
  throw new Error("Qloo API request failed after retrying.");
}

export interface QlooTag {
  id: string;
  name: string;
  type: string;
  popularity?: number;
  properties?: { is_canonical?: boolean };
}

export async function findTags(query: string, limit = 10): Promise<QlooTag[]> {
  const data = await qlooGet<{ results: { tags: QlooTag[] } }>("/v2/tags", {
    "filter.query": query,
    "feature.semantic_search": true,
    take: limit,
  });
  return data.results?.tags ?? [];
}

export interface QlooPlace {
  entity_id: string;
  name: string;
  properties: {
    description?: string;
    short_description?: string;
    address?: string;
    business_rating?: number;
    price_level?: number | null;
    geocode?: { city?: string; metro?: string; admin1_region?: string; country?: string };
    hours?: Record<string, { opens: string | null; closes: string | null; closed: boolean }[]>;
    website?: string;
    phone?: string;
    is_closed?: boolean;
    image?: { url?: string };
    keywords?: { name: string; count: number }[];
  };
  tags?: { id: string; name: string; type: string }[];
  popularity?: number;
}

export async function findPlacesByTags(tagIds: string[], city: string, take = 8): Promise<QlooPlace[]> {
  const data = await qlooGet<{ results: { entities: QlooPlace[] } }>("/v2/insights", {
    "filter.type": "urn:entity:place",
    "filter.tags": tagIds.join(","),
    "filter.location.query": city,
    "filter.location.radius": 0,
    take,
  });
  return data.results?.entities ?? [];
}

export interface DemographicsResult {
  age: Record<string, number>;
  gender: Record<string, number>;
}

export async function audienceDemographics(entityId: string): Promise<DemographicsResult | undefined> {
  const data = await qlooGet<{ results: { demographics: { entity_id: string; query: DemographicsResult }[] } }>(
    "/v2/insights",
    {
      "filter.type": "urn:demographics",
      "signal.interests.entities": entityId,
      take: 1,
    }
  );
  return data.results?.demographics?.[0]?.query;
}

export interface CrossDomainEntity {
  name: string;
  entity_id: string;
  subtype: string;
  properties?: {
    image?: { url?: string };
    genres?: string[];
    primary_genres?: string[];
    short_description?: string;
    description?: string;
  };
}

/**
 * Entities in a *different* domain (brands, TV shows, ...) that the audience
 * of the given entities tends toward — "what do regulars of these venues also
 * watch/buy".
 */
export async function recommendByEntities(
  entityIds: string[],
  targetType: string,
  location: string,
  take = 5
): Promise<CrossDomainEntity[]> {
  // Seeding with the matched venues themselves describes *their* audience. Seeding with a
  // tag instead degrades badly: a broad tag without location returns the tag's global
  // audience (izakaya -> Japanese brands), and a narrow tag with location returns generic
  // city culture (korean_fried_chicken + NYC -> The New Yorker, MoMA).
  const data = await qlooGet<{ results: { entities: CrossDomainEntity[] } }>("/v2/insights", {
    "filter.type": targetType,
    "signal.interests.entities": entityIds.join(","),
    "signal.location.query": location,
    take,
  });
  return data.results?.entities ?? [];
}
