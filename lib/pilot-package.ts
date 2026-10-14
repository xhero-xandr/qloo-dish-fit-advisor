import {
  findTags,
  findPlacesByTags,
  audienceDemographics,
  recommendByEntities,
  QlooQuotaError,
  type QlooPlace,
  type QlooTag,
  type DemographicsResult,
  type CrossDomainEntity,
} from "./qloo";
import { isLlmConfigured } from "./llm";
import {
  planTagsWithAgent,
  synthesizeWithAgent,
  type AgentAnalysis,
  type AgentTagDecision,
  type Fact,
  type SearchTags,
} from "./agent";

export interface VenueCandidate {
  name: string;
  address?: string;
  phone?: string;
  rating?: number;
  priceLevel?: number | null;
  description?: string;
  website?: string;
  imageUrl?: string;
  hours?: string;
  vibeTags: string[];
  dietaryOptions: string[];
  reviewKeywords: RegionInsight[];
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

export interface AgentOutput {
  tagDecision?: AgentTagDecision;
  analysis?: AgentAnalysis;
  /** The exact Qloo-derived fact sheet the analysis step was given and had to cite. */
  facts: Fact[];
  /** Why a step fell back to the deterministic path, if it did. */
  notes: string[];
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
  agent?: AgentOutput;
  tastingBrief: string;
  pilotPlan: string[];
  ownerLetter: string;
  limitations: string[];
  /** ISO timestamp — present only when this result was served from the short-lived cache instead of a fresh Qloo round-trip. */
  cachedAt?: string;
}

const AGE_BUCKETS = ["24_and_younger", "25_to_29", "30_to_34", "35_to_44", "45_to_54", "55_and_older"] as const;
const AGE_LABEL: Record<string, string> = {
  "24_and_younger": "24 and younger",
  "25_to_29": "25–29",
  "30_to_34": "30–34",
  "35_to_44": "35–44",
  "45_to_54": "45–54",
  "55_and_older": "55+",
};

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

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const DAY_SHORT: Record<string, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

/** "Mon closed; Tue–Sun 17:00–23:00" from Qloo's per-day hours, or undefined if Qloo has none. */
function formatHours(hours: NonNullable<QlooPlace["properties"]["hours"]> | undefined): string | undefined {
  if (!hours) return undefined;
  const perDay = DAYS.map((day) => {
    const slots = hours[day];
    if (!slots || slots.length === 0) return "unknown";
    if (slots.every((s) => s.closed)) return "closed";
    const open = slots
      .filter((s) => !s.closed && s.opens && s.closes)
      .map((s) => `${s.opens!.replace(/^T/, "").slice(0, 5)}–${s.closes!.replace(/^T/, "").slice(0, 5)}`);
    return open.length > 0 ? open.join(", ") : "unknown";
  });
  if (perDay.every((t) => t === "unknown")) return undefined;

  const groups: { from: string; to: string; text: string }[] = [];
  DAYS.forEach((day, i) => {
    const last = groups[groups.length - 1];
    if (last && last.text === perDay[i]) last.to = day;
    else groups.push({ from: day, to: day, text: perDay[i] });
  });
  return groups
    .map((g) => `${g.from === g.to ? DAY_SHORT[g.from] : `${DAY_SHORT[g.from]}–${DAY_SHORT[g.to]}`} ${g.text}`)
    .join("; ");
}

/**
 * Drop venues that can't host a pilot. Qloo's `is_closed` isn't enough on its own: some
 * listings have is_closed=false while every day of the week is marked closed (seen live,
 * e.g. a soul-food spot in Atlanta) — almost certainly a shut venue with a stale flag.
 */
function isOperating(place: QlooPlace): boolean {
  if (place.properties?.is_closed) return false;
  const hours = place.properties?.hours;
  if (!hours) return true;
  const days = Object.values(hours);
  return !(days.length > 0 && days.every((slots) => slots.length > 0 && slots.every((s) => s.closed)));
}

/** What the audience of the matched venues also favors in brands, TV shows, artists, and podcasts. */
async function fetchCulturalAffinity(venueIds: string[], city: string): Promise<CulturalAffinity | undefined> {
  try {
    const [brands, tvShows, artists, podcasts] = await Promise.all([
      recommendByEntities(venueIds, "urn:entity:brand", city, 5),
      recommendByEntities(venueIds, "urn:entity:tv_show", city, 5),
      recommendByEntities(venueIds, "urn:entity:artist", city, 5),
      recommendByEntities(venueIds, "urn:entity:podcast", city, 5),
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
  return error instanceof QlooQuotaError;
}

/** What Qloo actually geocoded the city query to, so a bare/ambiguous name (e.g. "Paris") doesn't silently resolve to the wrong place. */
function describeResolvedLocation(place?: QlooPlace): string | undefined {
  const geo = place?.properties?.geocode;
  if (!geo?.city) return undefined;
  const region = geo.admin1_region && geo.admin1_region !== geo.city ? geo.admin1_region : undefined;
  return [geo.city, region, geo.country].filter(Boolean).join(", ");
}

/** A pilot needs candidates to choose between; fewer than this and the agent's tag must beat the baseline's. */
const MIN_PILOT_VENUES = 3;

// Identical concept+city requests reuse a result instead of re-spending quota. Long by default:
// venue data doesn't change hour to hour, while the free Gemini tier allows ~500 requests/day
// (~110 analyses) and judges mostly click the same presets.
const CACHE_TTL_MS = Number(process.env.PILOT_CACHE_TTL_MINUTES ?? 12 * 60) * 60 * 1000;
const DEGRADED_CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;
const resultCache = new Map<string, { data: PilotPackage; fetchedAt: number; expiresAt: number }>();
const inFlight = new Map<string, Promise<PilotPackage>>();

function cacheKey(concept: string, city: string): string {
  return `${concept.trim().toLowerCase()}::${city.trim().toLowerCase()}`;
}

export async function buildPilotPackage(concept: string, city: string): Promise<PilotPackage> {
  const key = cacheKey(concept, city);
  const cached = resultCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.data, cachedAt: new Date(cached.fetchedAt).toISOString() };
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
  // A result where the agent was enabled but fell back (every model overloaded or out of quota) is
  // kept only briefly, so a transient outage doesn't pin the degraded version for half a day.
  const degraded = (result.agent?.notes.length ?? 0) > 0;
  const now = Date.now();
  resultCache.set(key, { data: result, fetchedAt: now, expiresAt: now + (degraded ? DEGRADED_CACHE_TTL_MS : CACHE_TTL_MS) });

  return result;
}

type Tag = { id: string; name: string; type: string };

/** Baseline tag choice: stopword keywords + type-weighted ranking. Also the floor the agent must beat. */
async function resolveTagDeterministically(
  concept: string,
  findVenues: (tagId: string) => Promise<QlooPlace[]>,
  searchTags: SearchTags
): Promise<{ primaryTag: Tag; places: QlooPlace[]; triedTagNames: string[] }> {
  const queries = [concept, ...extractKeywords(concept)];
  const tagResults = await Promise.all(
    queries.map(async (q) => {
      try {
        return await searchTags(q);
      } catch (error) {
        if (isRateLimitError(error)) throw error;
        return [];
      }
    })
  );
  const candidateTags = Array.from(new Map(tagResults.flat().map((t) => [t.id, t])).values());
  if (candidateTags.length === 0) {
    throw new ConceptNotFoundError(
      `Qloo couldn't find a taste tag close to "${concept}". Try rephrasing the concept (e.g. a specific cuisine or dish type).`
    );
  }

  const rankedTags = rankTagsForPlaceMatching(candidateTags);
  const triedTagNames: string[] = [];
  for (const tag of rankedTags.slice(0, 4)) {
    triedTagNames.push(tag.name);
    try {
      const found = await findVenues(tag.id);
      if (found.length > 0) return { primaryTag: tag, places: found, triedTagNames };
    } catch (error) {
      if (isRateLimitError(error)) throw error;
    }
  }
  return { primaryTag: rankedTags[0], places: [], triedTagNames };
}

function signed(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;
}

function describeDemographicsFact(d: DemographicsResult): string {
  const ages = AGE_BUCKETS.filter((b) => typeof d.age?.[b] === "number")
    .map((b) => `${AGE_LABEL[b]} ${signed(d.age[b])}`)
    .join(", ");
  return `age affinity ${ages}; gender affinity male ${signed(d.gender?.male ?? 0)}, female ${signed(d.gender?.female ?? 0)} (Qloo affinity vs. general population)`;
}

/** Number every Qloo-derived datum so the analysis step can cite it and code can verify the citations. */
function buildFacts(input: {
  city: string;
  primaryTag: Tag;
  secondary: AgentTagDecision["secondary"];
  venues: VenueCandidate[];
  aggregate?: DemographicsResult;
  regionInsights: RegionInsight[];
  culturalAffinity?: CulturalAffinity;
}): Fact[] {
  const facts: Fact[] = [];
  const add = (text: string, venue?: string) => facts.push({ id: `F${facts.length + 1}`, text, venue });
  const n = input.venues.length;

  add(`Venues were found via the Qloo tag "${input.primaryTag.name}" (${input.primaryTag.type.replace("urn:tag:", "")}); ${n} operating venue(s) matched.`);
  for (const v of input.venues) {
    const price = v.priceLevel ? "$".repeat(v.priceLevel) : "n/a";
    add(`Venue "${v.name}": rating ${v.rating?.toFixed(1) ?? "n/a"}, price level ${price}${v.address ? `, address ${v.address}` : ""}.`, v.name);
    if (v.hours) add(`Venue "${v.name}" opening hours: ${v.hours}.`, v.name);
    if (v.dietaryOptions.length > 0) add(`Venue "${v.name}" dietary options listed by Qloo: ${v.dietaryOptions.join(", ")}.`, v.name);
    if (v.vibeTags.length > 0) add(`Venue "${v.name}" Qloo tags: ${v.vibeTags.join(", ")}.`, v.name);
    if (v.reviewKeywords.length > 0) {
      add(
        `Venue "${v.name}" own most-mentioned review keywords: ${v.reviewKeywords.map((k) => `${k.keyword} (${k.mentions})`).join(", ")}.`,
        v.name
      );
    }
    if (v.demographics) add(`Venue "${v.name}" audience: ${describeDemographicsFact(v.demographics)}.`, v.name);
  }
  if (input.aggregate) add(`Across all ${n} matched venues combined, average audience ${describeDemographicsFact(input.aggregate)}.`);
  if (input.regionInsights.length > 0) {
    add(
      `Across all ${n} matched venues combined, most-mentioned review keywords: ${input.regionInsights
        .slice(0, 10)
        .map((r) => `${r.keyword} (${r.mentions})`)
        .join(", ")}.`
    );
  }
  const ca = input.culturalAffinity;
  if (ca) {
    const groups: [string, CulturalSignalItem[]][] = [
      ["brands", ca.brands],
      ["TV shows", ca.tvShows],
      ["music artists", ca.artists],
      ["podcasts", ca.podcasts],
    ];
    for (const [label, items] of groups) {
      if (items.length > 0) {
        add(`The audience of these matched venues also over-indexes on these ${label}: ${items.map((i) => i.name).join(", ")}.`);
      }
    }
  }
  for (const s of input.secondary) {
    if (s.venueCount !== undefined) {
      add(
        `Secondary concept signal "${s.name}": ${s.venueCount} venue(s) in ${input.city} carry this Qloo tag${
          s.venueNames && s.venueNames.length > 0 ? `, e.g. ${s.venueNames.join(", ")}` : ""
        }.`
      );
    } else {
      add(`Part of the concept also maps to the Qloo tag "${s.name}" (venues for it were not checked).`);
    }
  }
  return facts;
}

function shortError(error: unknown): string {
  return (error instanceof Error ? error.message : "unknown error").slice(0, 160);
}

async function buildPilotPackageUncached(concept: string, city: string): Promise<PilotPackage> {
  const limitations: string[] = [];
  const agentEnabled = isLlmConfigured();
  const agentNotes: string[] = [];

  // One place lookup per tag per analysis, shared by the agent's tool calls and the pipeline.
  const venueLookups = new Map<string, Promise<QlooPlace[]>>();
  const findVenues = (tagId: string): Promise<QlooPlace[]> => {
    let lookup = venueLookups.get(tagId);
    if (!lookup) {
      lookup = findPlacesByTags([tagId], city, 8).then((found) => found.filter(isOperating));
      venueLookups.set(tagId, lookup);
      lookup.catch(() => venueLookups.delete(tagId));
    }
    return lookup;
  };
  const tagSearches = new Map<string, Promise<QlooTag[]>>();
  const searchTags: SearchTags = (query) => {
    const key = query.trim().toLowerCase();
    let search = tagSearches.get(key);
    if (!search) {
      search = findTags(query, 8);
      tagSearches.set(key, search);
      search.catch(() => tagSearches.delete(key));
    }
    return search;
  };

  let tagDecision: AgentTagDecision | undefined;
  if (agentEnabled) {
    try {
      tagDecision = await planTagsWithAgent(concept, city, findVenues, searchTags);
    } catch (error) {
      if (isRateLimitError(error)) throw error;
      agentNotes.push(`Agent tag selection fell back to deterministic ranking: ${shortError(error)}`);
    }
  }

  let primaryTag: Tag;
  let places: QlooPlace[];
  const agentPlaces = tagDecision ? await findVenues(tagDecision.primary.id) : [];
  if (tagDecision && agentPlaces.length >= MIN_PILOT_VENUES) {
    primaryTag = { id: tagDecision.primary.id, name: tagDecision.primary.name, type: tagDecision.primary.type };
    places = agentPlaces;
  } else {
    // The agent may only improve on the baseline, never fall below it: with fewer than
    // MIN_PILOT_VENUES candidates its pick is checked against the deterministic one,
    // and the tag with more venues wins. Seen live: the agent anchored "Neapolitan
    // sourdough pizza" on a tag with one (Detroit-style) venue while the baseline
    // tag had four Neapolitan pizzerias.
    const resolved = await resolveTagDeterministically(concept, findVenues, searchTags);
    if (tagDecision && agentPlaces.length > 0 && agentPlaces.length >= resolved.places.length) {
      primaryTag = { id: tagDecision.primary.id, name: tagDecision.primary.name, type: tagDecision.primary.type };
      places = agentPlaces;
    } else {
      if (tagDecision) {
        tagDecision = {
          ...tagDecision,
          override: {
            agentTag: tagDecision.primary.name,
            agentVenueCount: agentPlaces.length,
            usedTag: resolved.primaryTag.name,
            usedVenueCount: resolved.places.length,
          },
          secondary: [
            { ...tagDecision.primary, venueNames: agentPlaces.slice(0, 3).map((p) => p.name) },
            ...tagDecision.secondary,
          ].slice(0, 3),
        };
      }
      primaryTag = resolved.primaryTag;
      places = resolved.places;
      if (places.length === 0) {
        limitations.push(
          `Qloo found no venues in "${city}" for any of the tags related to "${concept}" (tried: ${resolved.triedTagNames.join(", ")}). The city may be misspelled, or the niche may be too narrow for this region.`
        );
      }
    }
  }

  // The insights API does not return these ordered by relevance to the tag,
  // so use rating as a proxy for venue quality until a sharper signal is wired in.
  places = [...places].sort((a, b) => (b.properties?.business_rating ?? 0) - (a.properties?.business_rating ?? 0));

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
        hours: formatHours(p.properties?.hours),
        vibeTags: (p.tags ?? []).filter((t) => t.type !== DIETARY_TAG_TYPE).slice(0, 6).map((t) => t.name),
        dietaryOptions: extractDietaryOptions(p.tags ?? []),
        reviewKeywords: [...(p.properties?.keywords ?? [])]
          .sort((a, b) => b.count - a.count)
          .slice(0, 6)
          .map((k) => ({ keyword: k.name, mentions: k.count })),
        demographics: demo,
      };
    })
  );

  const aggregate = aggregateDemographics(venues);
  const vibeWords = Array.from(new Set(venues.flatMap((v) => v.vibeTags))).slice(0, 10);
  const regionInsights = aggregateRegionInsights(topPlaces);
  const culturalAffinity =
    topPlaces.length > 0 ? await fetchCulturalAffinity(topPlaces.map((p) => p.entity_id), city) : undefined;

  let agent: AgentOutput | undefined;
  if (agentEnabled) {
    const facts = buildFacts({
      city,
      primaryTag,
      secondary: tagDecision?.secondary ?? [],
      venues,
      aggregate,
      regionInsights,
      culturalAffinity,
    });
    let analysis: AgentAnalysis | undefined;
    if (venues.length > 0) {
      try {
        analysis = await synthesizeWithAgent(concept, city, facts, venues.map((v) => v.name));
      } catch (error) {
        agentNotes.push(`Agent analysis unavailable, showing the template plan: ${shortError(error)}`);
      }
    }
    agent = { tagDecision, analysis, facts, notes: agentNotes };
  }

  const tastingBrief = [
    `Tasting concept: "${concept}"`,
    `Atmosphere cues (from tags of taste-matched venues): ${vibeWords.length > 0 ? vibeWords.join(", ") : "not enough data"}.`,
    regionInsights.length > 0
      ? `What reviews of the ${venues.length} matched venue${venues.length === 1 ? "" : "s"} mention most: ${regionInsights.slice(0, 6).map((r) => r.keyword).join(", ")}. These are aggregated mention counts, not review text${venues.length < 3 ? ", and too few venues to speak for the whole city" : ""}.`
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

  const bestVenue = venues.find((v) => v.name === agent?.analysis?.recommendedVenue?.name) ?? venues[0];
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
    aggregateDemographics: aggregate,
    regionInsights,
    culturalAffinity,
    agent,
    tastingBrief,
    pilotPlan,
    ownerLetter,
    limitations,
  };
}
