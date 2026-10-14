import { findTags, findPlacesByTags, audienceDemographics, recommendByTags, type QlooPlace, type DemographicsResult, type CrossDomainEntity } from "./qloo";

export interface VenueCandidate {
  name: string;
  address?: string;
  phone?: string;
  rating?: number;
  priceLevel?: number | null;
  description?: string;
  website?: string;
  imageUrl?: string;
  vibeTags: string[];
  dietaryOptions: string[];
  demographics?: DemographicsResult;
}

export interface RegionInsight {
  keyword: string;
  mentions: number;
}

export interface CulturalSignalItem {
  name: string;
  imageUrl?: string;
  subtitle?: string;
}

export interface CulturalAffinity {
  brands: CulturalSignalItem[];
  tvShows: CulturalSignalItem[];
  artists: CulturalSignalItem[];
  podcasts: CulturalSignalItem[];
}

export interface PilotPackage {
  concept: string;
  city: string;
  resolvedLocation?: string;
  matchedTag?: { id: string; name: string; type: string };
  venues: VenueCandidate[];
  aggregateDemographics?: DemographicsResult;
  regionInsights: RegionInsight[];
  culturalAffinity?: CulturalAffinity;
  tastingBrief: string;
  pilotPlan: string[];
  ownerLetter: string;
  limitations: string[];
  /** ISO timestamp — present only when this result was served from the short-lived cache instead of a fresh Qloo round-trip. */
  cachedAt?: string;
}

const AGE_BUCKETS = ["24_and_younger", "25_to_29", "30_to_34", "35_to_44", "45_to_54", "55_and_older"] as const;

/** Average per-venue affinity scores into one aggregate audience profile for the hero chart. */
function aggregateDemographics(venues: VenueCandidate[]): DemographicsResult | undefined {
  const withDemo = venues.filter((v) => v.demographics);
  if (withDemo.length === 0) return undefined;

  const age: Record<string, number> = {};
  for (const bucket of AGE_BUCKETS) {
    const values = withDemo.map((v) => v.demographics?.age?.[bucket] ?? 0);
    age[bucket] = values.reduce((a, b) => a + b, 0) / values.length;
  }
  const maleValues = withDemo.map((v) => v.demographics?.gender?.male ?? 0);
  const femaleValues = withDemo.map((v) => v.demographics?.gender?.female ?? 0);
  return {
    age,
    gender: {
      male: maleValues.reduce((a, b) => a + b, 0) / maleValues.length,
      female: femaleValues.reduce((a, b) => a + b, 0) / femaleValues.length,
    },
  };
}

/**
 * Aggregate the review-derived keyword mentions Qloo attaches to each venue
 * (e.g. "brisket" mentioned 184 times) across all matched venues, as a proxy
 * for what this region's audience actually values in this niche — there is no
 * free-text review/complaint data in the API, only these aggregated counts.
 */
function aggregateRegionInsights(places: QlooPlace[]): RegionInsight[] {
  const totals = new Map<string, number>();
  for (const p of places) {
    for (const kw of p.properties?.keywords ?? []) {
      totals.set(kw.name, (totals.get(kw.name) ?? 0) + kw.count);
    }
  }
  return Array.from(totals.entries())
    .map(([keyword, mentions]) => ({ keyword, mentions }))
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 12);
}

function toCulturalSignalItems(entities: CrossDomainEntity[]): CulturalSignalItem[] {
  return entities.map((e) => ({
    name: e.name,
    imageUrl: e.properties?.image?.url,
    subtitle: (e.properties?.genres ?? e.properties?.primary_genres)?.slice(0, 2).join(", "),
  }));
}

const DIETARY_TAG_TYPE = "urn:tag:dietary_option:qloo";

/** Pull the dietary-option tags Qloo attached to a venue (vegan, gluten-free, halal, ...). */
function extractDietaryOptions(tags: { id: string; name: string; type: string }[]): string[] {
  return tags.filter((t) => t.type === DIETARY_TAG_TYPE).map((t) => t.name);
}

/**
 * Cross-domain taste signal: what the audience for the matched cuisine tag,
 * *in this city*, tends toward in brands, TV shows, artists, and podcasts —
 * "what do izakaya fans in Austin also watch/listen to/buy".
 */
async function fetchCulturalAffinity(tagId: string, city: string): Promise<CulturalAffinity | undefined> {
  try {
    const [brands, tvShows, artists, podcasts] = await Promise.all([
      recommendByTags([tagId], "urn:entity:brand", city, 5),
      recommendByTags([tagId], "urn:entity:tv_show", city, 5),
      recommendByTags([tagId], "urn:entity:artist", city, 5),
      recommendByTags([tagId], "urn:entity:podcast", city, 5),
    ]);
    if (brands.length === 0 && tvShows.length === 0 && artists.length === 0 && podcasts.length === 0) return undefined;
    return {
      brands: toCulturalSignalItems(brands),
      tvShows: toCulturalSignalItems(tvShows),
      artists: toCulturalSignalItems(artists),
      podcasts: toCulturalSignalItems(podcasts),
    };
  } catch {
    // best-effort enrichment; a failure here shouldn't break the whole pilot package
    return undefined;
  }
}

/**
 * Rank candidate tags from broadest/most "place-matchable" to narrowest, so we can
 * try them in order against `findPlacesByTags` and stop at the first one that
 * actually returns venues. Qloo's semantic tag search often surfaces very narrow
 * compound tags (e.g. "izakaya_style_small_plates") ahead of the broad canonical
 * one ("izakaya") that places are actually tagged with.
 */
function rankTagsForPlaceMatching(
  tags: { id: string; name: string; type: string; properties?: { is_canonical?: boolean } }[]
): { id: string; name: string; type: string }[] {
  const typeWeight: Record<string, number> = {
    "urn:tag:category:place": 3,
    "urn:tag:genre:place": 3,
    "urn:tag:cuisine:qloo": 2,
    "urn:tag:genre_category:qloo": 1,
  };
  return [...tags].sort((a, b) => {
    const score = (t: (typeof tags)[number]) =>
      (typeWeight[t.type] ?? 0) * 10 + (t.properties?.is_canonical ? 5 : 0) - t.id.split("_").length;
    return score(b) - score(a);
  });
}

const STOPWORDS = new Set([
  "style", "styled", "inspired", "small", "plates", "plate", "dish", "dishes", "menu", "concept",
  "the", "a", "an", "and", "or", "with", "of", "based",
]);

/** Pull individual meaningful keywords out of a free-text concept (e.g. "izakaya-style small plates" -> ["izakaya"]). */
function extractKeywords(concept: string): string[] {
  const words = concept
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  // Cap the number of keywords: each one is a separate Qloo API call, and the event
  // key has a shared rate limit — a long concept phrase shouldn't fan out into a
  // dozen requests. The first few words usually carry the cuisine/dish signal anyway.
  return Array.from(new Set(words)).slice(0, 3);
}

/** The input couldn't be mapped to Qloo's vocabulary — a client-side problem, not an upstream failure. */
export class ConceptNotFoundError extends Error {}

function isRateLimitError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("429");
}

/** What Qloo actually geocoded the city query to, so a bare/ambiguous name (e.g. "Paris") doesn't silently resolve to the wrong place. */
function describeResolvedLocation(place?: QlooPlace): string | undefined {
  const geo = place?.properties?.geocode;
  if (!geo?.city) return undefined;
  const region = geo.admin1_region && geo.admin1_region !== geo.city ? geo.admin1_region : undefined;
  return [geo.city, region, geo.country].filter(Boolean).join(", ");
}

const CACHE_TTL_MS = 10 * 60 * 1000; // identical concept+city requests reuse this instead of burning the shared monthly Qloo quota
const CACHE_MAX_ENTRIES = 200;
const resultCache = new Map<string, { data: PilotPackage; expiresAt: number }>();
const inFlight = new Map<string, Promise<PilotPackage>>();

function cacheKey(concept: string, city: string): string {
  return `${concept.trim().toLowerCase()}::${city.trim().toLowerCase()}`;
}

export async function buildPilotPackage(concept: string, city: string): Promise<PilotPackage> {
  const key = cacheKey(concept, city);
  const cached = resultCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.data, cachedAt: new Date(cached.expiresAt - CACHE_TTL_MS).toISOString() };
  }

  // A double-submit or a second tab joins the run already in progress instead of starting another full pipeline.
  const pending = inFlight.get(key);
  if (pending) return pending;

  const run = computeAndCache(key, concept, city);
  inFlight.set(key, run);
  try {
    return await run;
  } finally {
    inFlight.delete(key);
  }
}

async function computeAndCache(key: string, concept: string, city: string): Promise<PilotPackage> {
  const result = await buildPilotPackageUncached(concept, city);

  if (resultCache.size >= CACHE_MAX_ENTRIES) {
    for (const [k, v] of resultCache) {
      if (v.expiresAt <= Date.now()) resultCache.delete(k);
    }
    if (resultCache.size >= CACHE_MAX_ENTRIES) {
      const oldestKey = resultCache.keys().next().value;
      if (oldestKey) resultCache.delete(oldestKey);
    }
  }
  resultCache.set(key, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });

  return result;
}

async function buildPilotPackageUncached(concept: string, city: string): Promise<PilotPackage> {
  const limitations: string[] = [];

  const queries = [concept, ...extractKeywords(concept)];
  const tagResults = await Promise.all(
    queries.map(async (q) => {
      try {
        return await findTags(q, 8);
      } catch (error) {
        if (isRateLimitError(error)) throw error;
        return [];
      }
    })
  );
  const candidateTags = Array.from(
    new Map(tagResults.flat().map((t) => [t.id, t])).values()
  );

  if (candidateTags.length === 0) {
    throw new ConceptNotFoundError(`Qloo couldn't find a taste tag close to "${concept}". Try rephrasing the concept (e.g. a specific cuisine or dish type).`);
  }

  const rankedTags = rankTagsForPlaceMatching(candidateTags);
  let places: QlooPlace[] = [];
  let primaryTag = rankedTags[0];
  const triedTagNames: string[] = [];

  for (const tag of rankedTags.slice(0, 4)) {
    triedTagNames.push(tag.name);
    try {
      const found = await findPlacesByTags([tag.id], city, 8);
      if (found.length > 0) {
        // The insights API does not return these ordered by relevance to the tag,
        // so use rating as a proxy for venue quality until a sharper signal is wired in.
        places = [...found].sort((a, b) => (b.properties?.business_rating ?? 0) - (a.properties?.business_rating ?? 0));
        primaryTag = tag;
        break;
      }
    } catch (error) {
      if (isRateLimitError(error)) throw error;
      // try the next candidate tag
    }
  }

  if (places.length === 0) {
    limitations.push(
      `Qloo found no venues in "${city}" for any of the tags related to "${concept}" (tried: ${triedTagNames.join(", ")}). The city may be misspelled, or the niche may be too narrow for this region.`
    );
  }

  const topPlaces = places.slice(0, 4);
  const venues: VenueCandidate[] = await Promise.all(
    topPlaces.map(async (p) => {
      let demo: DemographicsResult | undefined;
      try {
        demo = await audienceDemographics(p.entity_id);
      } catch (error) {
        if (isRateLimitError(error)) throw error;
        // demographics are best-effort; omit on failure
      }
      return {
        name: p.name,
        address: p.properties?.address,
        phone: p.properties?.phone,
        rating: p.properties?.business_rating,
        priceLevel: p.properties?.price_level ?? null,
        description: p.properties?.short_description ?? p.properties?.description,
        website: p.properties?.website,
        imageUrl: p.properties?.image?.url,
        vibeTags: (p.tags ?? []).filter((t) => t.type !== DIETARY_TAG_TYPE).slice(0, 6).map((t) => t.name),
        dietaryOptions: extractDietaryOptions(p.tags ?? []),
        demographics: demo,
      };
    })
  );

  const vibeWords = Array.from(new Set(venues.flatMap((v) => v.vibeTags))).slice(0, 10);
  const regionInsights = aggregateRegionInsights(topPlaces);
  const culturalAffinity = primaryTag && places.length > 0 ? await fetchCulturalAffinity(primaryTag.id, city) : undefined;

  const tastingBrief = [
    `Tasting concept: "${concept}"`,
    `Atmosphere cues (from tags of taste-matched venues): ${vibeWords.length > 0 ? vibeWords.join(", ") : "not enough data"}.`,
    regionInsights.length > 0
      ? `What this niche's venues actually get praised for in this region (by review-keyword mention frequency): ${regionInsights.slice(0, 6).map((r) => r.keyword).join(", ")}. This isn't complaint data — Qloo doesn't expose review text, only aggregated mention counts — but it's a signal for what the local audience already values.`
      : `Not enough review-keyword data for this niche in this region.`,
    `Format: a closed tasting for 15–25 guests, a curated 3–5 item menu, feedback collected via rating cards.`,
    `Goal: validate product-market fit before investing in a permanent menu or a new location.`,
  ].join("\n");

  const pilotPlan = [
    "Week 1: lock the final tasting menu (3–5 items) and define pilot success criteria.",
    `Week 1–2: reach out to ${venues.length > 0 ? venues.slice(0, 2).map((v) => v.name).join(" and ") : "the chosen venue"} about a one-off tasting night or collaboration.`,
    "Week 2: prepare a short guest questionnaire (taste, price, repeat purchase) and a promo message for the venue's audience.",
    "Week 3: run the tasting night, collect questionnaires and sales/portion data.",
    "Week 4: review results — decide whether to go to a permanent menu, revise the concept, or switch venue/audience.",
  ];

  const bestVenue = venues[0];
  const ownerLetter = bestVenue
    ? [
        bestVenue.phone
          ? `Direct contact (a call usually beats email — less risk of landing in spam): ${bestVenue.phone}`
          : `No direct phone number found in Qloo's data — use the venue's website instead.`,
        "",
        `Subject: collaboration proposal — tasting night for "${concept}"`,
        "",
        `Hi,`,
        "",
        `We're developing a concept for "${concept}" and, based on audience taste data, ${bestVenue.name} looks like one of the strongest-fit venues in ${city} — your place is close in atmosphere and taste profile (${bestVenue.vibeTags.slice(0, 3).join(", ") || "a matching niche"}).`,
        "",
        `We'd like to propose a one-off tasting night at your venue: we handle the menu and service, you provide the space and your audience. For you, it's an extra draw on a slower night, with no risk or investment in a new menu.`,
        "",
        `Happy to discuss a date and format at your convenience.`,
        "",
        `Best,`,
        `[Your name]`,
      ].join("\n")
    : `Not enough venue data in ${city} to draft a letter — try a different city or concept.`;

  return {
    concept,
    city,
    resolvedLocation: describeResolvedLocation(topPlaces[0]),
    matchedTag: places.length > 0 ? primaryTag : undefined,
    venues,
    aggregateDemographics: aggregateDemographics(venues),
    regionInsights,
    culturalAffinity,
    tastingBrief,
    pilotPlan,
    ownerLetter,
    limitations,
  };
}
