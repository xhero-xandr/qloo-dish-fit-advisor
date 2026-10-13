// Thin server-side client for the Qloo Insights API (hackathon endpoint).
// Docs: https://docs.qloo.com/reference/insights-api-deep-dive

const BASE_URL = process.env.QLOO_BASE_URL ?? "https://hackathon.api.qloo.com";
const API_KEY = process.env.QLOO_API_KEY;

if (!API_KEY && process.env.NODE_ENV !== "test") {
  console.warn("QLOO_API_KEY is not set — Qloo calls will fail.");
}

// The hackathon key is rate-limited at the account level (Qloo's own response
// headers report `x-second-ratelimit-limit: 5`), shared across every request
// this server makes, no matter how many browser tabs or concurrent city
// comparisons triggered them. A single multi-tag concept lookup alone can fire
// 3-4 calls in a burst, so every outbound call is serialized through one
// module-level queue with spacing, instead of trusting caller-side Promise.all
// to behave. One 429 retry (with a short backoff) covers the rare race where
// another request slips into the same window.
const MIN_SPACING_MS = 260; // ~3.8 req/s, safely under the 5 req/s cap
let requestChain: Promise<void> = Promise.resolve();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function scheduleRequestSlot(): Promise<void> {
  const slot = requestChain.then(() => sleep(MIN_SPACING_MS));
  requestChain = slot;
  return slot;
}

async function qlooGet<T>(path: string, params: Record<string, string | number | boolean | undefined>): Promise<T> {
  const url = new URL(path, BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    await scheduleRequestSlot();
    const res = await fetch(url, {
      headers: { "X-Api-Key": API_KEY ?? "" },
      cache: "no-store",
    });
    if (res.ok) return res.json() as Promise<T>;

    if (res.status === 429) {
      if (attempt === 0) {
        await sleep(1100);
        continue;
      }
      throw new Error("Qloo rate limit hit (429) repeatedly — the shared hackathon key allows only ~5 requests/second. Try fewer cities at once, or retry in a few seconds.");
    }
    const body = await res.text().catch(() => "");
    throw new Error(`Qloo API ${res.status} on ${path}: ${body.slice(0, 300)}`);
  }
  throw new Error("Qloo API request failed after retry.");
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
    hours?: Record<string, { opens: string; closes: string; closed: boolean }[]>;
    website?: string;
    phone?: string;
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

export interface TasteSignalResult {
  entity: { entity_id: string; name: string };
  affinity?: number;
}

/** Entities (other places/brands) that overlap in taste with the given signal tags — used for "audience also likes" framing. */
export async function recommendByTags(tagIds: string[], targetType: string, take = 5): Promise<unknown[]> {
  const data = await qlooGet<{ results: { entities: unknown[] } }>("/v2/insights", {
    "filter.type": targetType,
    "signal.interests.tags": tagIds.join(","),
    take,
  });
  return data.results?.entities ?? [];
}
