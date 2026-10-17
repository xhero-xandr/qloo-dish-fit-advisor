import {
  findTags,
  findPlacesByTags,
  probeLocation,
  BASE_URL as QLOO_BASE_URL,
  audienceDemographics,
  recommendByEntities,
  type QlooPlace,
  type QlooTag,
  type DemographicsResult,
} from "./qloo";
import { interpretBrief, type Brief } from "./brief";
import { buildFacts, type FactSources, type Tag } from "./facts";
import {
  demographicsParams,
  placeSearchParams,
  recommendParams,
} from "./provenance";
import type { Details } from "./input";
import { cacheKey, createResultCache } from "./result-cache";
import { resolveCityQuery } from "./location";
import {
  CityNotFoundError,
  isRateLimitError,
  MIN_PILOT_VENUES,
  resolveTagDeterministically,
} from "./tags";
import {
  aggregateDemographics,
  aggregateRegionInsights,
  conceptMatchesTag,
  describeResolvedLocation,
  extractDietaryOptions,
  DIETARY_TAG_TYPE,
  formatHours,
  isOperating,
  locationMismatch,
  toCulturalSignalItems,
} from "./venues";
import { weekWindows, type WeekWindows } from "./hours";
import { isLlmConfigured } from "./llm";
import {
  planTagsWithAgent,
  synthesizeWithAgent,
  type AgentAnalysis,
  type AgentTagDecision,
  type Fact,
  type SearchTags,
} from "./agent";

export { CityNotFoundError, ConceptNotFoundError } from "./tags";

export interface VenueCandidate {
  /** Qloo's id for the venue; the audience request for it is keyed on this. */
  entityId: string;
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
  /** How a long description was read: the search phrase and the dishes found. Present only when it was read. */
  brief?: Pick<Brief, "core" | "dishes">;
  /** What the chef asked for beyond the description, as it was understood. */
  details?: Details;
  /** Milliseconds spent per stage of this run (city check, tag choice, venues, cultural affinity, analysis). */
  timingsMs?: Record<string, number>;
  /** ISO timestamp — present only when this result was served from the short-lived cache instead of a fresh Qloo round-trip. */
  cachedAt?: string;
}

/** What the audience of the matched venues also favors in brands, TV shows, artists, and podcasts. */
async function fetchCulturalAffinity(
  venueIds: string[],
  city: string,
): Promise<CulturalAffinity | undefined> {
  try {
    const [brands, tvShows, artists, podcasts] = await Promise.all([
      recommendByEntities(venueIds, "urn:entity:brand", city, 5),
      recommendByEntities(venueIds, "urn:entity:tv_show", city, 5),
      recommendByEntities(venueIds, "urn:entity:artist", city, 5),
      recommendByEntities(venueIds, "urn:entity:podcast", city, 5),
    ]);
    if (
      brands.length === 0 &&
      tvShows.length === 0 &&
      artists.length === 0 &&
      podcasts.length === 0
    )
      return undefined;
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

// Identical concept+city requests reuse a result instead of re-spending quota. Long by default:
// venue data doesn't change hour to hour, while the free Gemini tier allows ~500 requests/day
// (~110 analyses) and judges mostly click the same presets.
const resultCache = createResultCache<PilotPackage>({
  ttlMs: Number(process.env.PILOT_CACHE_TTL_MINUTES ?? 12 * 60) * 60 * 1000,
  degradedTtlMs: 10 * 60 * 1000,
  maxEntries: 200,
});

export async function buildPilotPackage(
  concept: string,
  city: string,
  details?: Details,
): Promise<PilotPackage> {
  const { data, cachedAt } = await resultCache.getOrCompute(
    cacheKey(concept, city, details),
    () => buildPilotPackageUncached(concept, city, details),
    // The agent was enabled but fell back (every model overloaded or out of quota): keep it only briefly.
    (result) => (result.agent?.notes.length ?? 0) > 0,
  );
  return cachedAt ? { ...data, cachedAt } : data;
}

function shortError(error: unknown): string {
  return (error instanceof Error ? error.message : "unknown error").slice(
    0,
    160,
  );
}

async function buildPilotPackageUncached(
  concept: string,
  city: string,
  details?: Details,
): Promise<PilotPackage> {
  const limitations: string[] = [];
  // What is sent to Qloo; the city as typed is still what the page and the letter show.
  const timings: Record<string, number> = {};
  let lapAt = Date.now();
  const lap = (stage: string) => {
    const now = Date.now();
    timings[stage] = now - lapAt;
    lapAt = now;
  };
  // One cheap lookup per distinct query, shared by the "does Qloo know this city" check and the city-query fix.
  const probes = new Map<string, ReturnType<typeof probeLocation>>();
  const probe = (q: string) => {
    if (!probes.has(q)) probes.set(q, probeLocation(q));
    return probes.get(q)!;
  };
  if ((await probe(city)) === null) {
    throw new CityNotFoundError(
      `Qloo has no venue data for "${city}". Check the spelling, or try a larger nearby city.`,
    );
  }
  const qlooCity = await resolveCityQuery(city, probe);
  lap("city");
  // A long description is read into a short search phrase; a short one is used exactly as typed.
  const brief = await interpretBrief(concept);
  const searchConcept = brief.core;
  lap("brief");
  const agentEnabled = isLlmConfigured();
  const agentNotes: string[] = [];

  // One place lookup per tag per analysis, shared by the agent's tool calls and the pipeline.
  const venueLookups = new Map<string, Promise<QlooPlace[]>>();
  const findVenues = (tagId: string): Promise<QlooPlace[]> => {
    let lookup = venueLookups.get(tagId);
    if (!lookup) {
      lookup = findPlacesByTags([tagId], qlooCity, 8, details?.audience).then(
        (found) => found.filter(isOperating),
      );
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
      tagDecision = await planTagsWithAgent(
        searchConcept,
        city,
        findVenues,
        searchTags,
      );
    } catch (error) {
      if (isRateLimitError(error)) throw error;
      agentNotes.push(
        `Agent tag selection fell back to deterministic ranking: ${shortError(error)}`,
      );
    }
  }

  let primaryTag: Tag;
  let places: QlooPlace[];
  const agentPlaces = tagDecision
    ? await findVenues(tagDecision.primary.id)
    : [];
  if (tagDecision && agentPlaces.length >= MIN_PILOT_VENUES) {
    primaryTag = {
      id: tagDecision.primary.id,
      name: tagDecision.primary.name,
      type: tagDecision.primary.type,
    };
    places = agentPlaces;
  } else {
    // The agent may only improve on the baseline, never fall below it: with fewer than
    // MIN_PILOT_VENUES candidates its pick is checked against the deterministic one,
    // and the tag with more venues wins. Seen live: the agent anchored "Neapolitan
    // sourdough pizza" on a tag with one (Detroit-style) venue while the baseline
    // tag had four Neapolitan pizzerias.
    const resolved = await resolveTagDeterministically(
      searchConcept,
      findVenues,
      searchTags,
    );
    if (
      tagDecision &&
      agentPlaces.length > 0 &&
      agentPlaces.length >= resolved.places.length
    ) {
      primaryTag = {
        id: tagDecision.primary.id,
        name: tagDecision.primary.name,
        type: tagDecision.primary.type,
      };
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
            {
              ...tagDecision.primary,
              venueNames: agentPlaces.slice(0, 3).map((p) => p.name),
            },
            ...tagDecision.secondary,
          ].slice(0, 3),
        };
      }
      primaryTag = resolved.primaryTag;
      places = resolved.places;
      if (places.length === 0) {
        limitations.push(
          `Qloo found no venues in "${city}" for any of the tags related to "${searchConcept}" (tried: ${resolved.triedTagNames.join(", ")}). The city may be misspelled, or the niche may be too narrow for this region.`,
        );
      }
    }
  }

  lap("tags");

  // The insights API does not return these ordered by relevance to the tag,
  // so use rating as a proxy for venue quality until a sharper signal is wired in.
  places = [...places].sort(
    (a, b) =>
      (b.properties?.business_rating ?? 0) -
      (a.properties?.business_rating ?? 0),
  );

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
        entityId: p.entity_id,
        name: p.name,
        address: p.properties?.address,
        phone: p.properties?.phone,
        rating: p.properties?.business_rating,
        priceLevel: p.properties?.price_level ?? null,
        description:
          p.properties?.short_description ?? p.properties?.description,
        website: p.properties?.website,
        imageUrl: p.properties?.image?.url,
        hours: formatHours(p.properties?.hours),
        vibeTags: (p.tags ?? [])
          .filter((t) => t.type !== DIETARY_TAG_TYPE)
          .slice(0, 6)
          .map((t) => t.name),
        dietaryOptions: extractDietaryOptions(p.tags ?? []),
        reviewKeywords: [...(p.properties?.keywords ?? [])]
          .sort((a, b) => b.count - a.count)
          .slice(0, 6)
          .map((k) => ({ keyword: k.name, mentions: k.count })),
        demographics: demo,
      };
    }),
  );

  lap("venues");
  const aggregate = aggregateDemographics(venues);
  const vibeWords = Array.from(
    new Set(venues.flatMap((v) => v.vibeTags)),
  ).slice(0, 10);
  const regionInsights = aggregateRegionInsights(topPlaces);
  const culturalAffinity =
    topPlaces.length > 0
      ? await fetchCulturalAffinity(
          topPlaces.map((p) => p.entity_id),
          qlooCity,
        )
      : undefined;
  lap("cultural");

  let agent: AgentOutput | undefined;
  if (agentEnabled) {
    const windows = new Map<string, WeekWindows>();
    for (const p of topPlaces) {
      const week = weekWindows(p.properties?.hours);
      if (week) windows.set(p.name, week);
    }
    // The same builders the calls themselves use, so each fact can show the exact request behind it.
    const venueIds = topPlaces.map((p) => p.entity_id);
    const insights = (params: ReturnType<typeof placeSearchParams>) => ({
      path: "/v2/insights",
      params,
    });
    const sources: FactSources = {
      base: QLOO_BASE_URL,
      places: (tagId) =>
        insights(placeSearchParams([tagId], qlooCity, 8, details?.audience)),
      demographics: (entityId) => insights(demographicsParams(entityId)),
      cultural: {
        brands: insights(
          recommendParams(venueIds, "urn:entity:brand", qlooCity, 5),
        ),
        tvShows: insights(
          recommendParams(venueIds, "urn:entity:tv_show", qlooCity, 5),
        ),
        artists: insights(
          recommendParams(venueIds, "urn:entity:artist", qlooCity, 5),
        ),
        podcasts: insights(
          recommendParams(venueIds, "urn:entity:podcast", qlooCity, 5),
        ),
      },
    };
    const facts = buildFacts({
      sources,
      city,
      primaryTag,
      secondary: tagDecision?.secondary ?? [],
      venues,
      aggregate,
      regionInsights,
      culturalAffinity,
      requested: details,
    });
    let analysis: AgentAnalysis | undefined;
    if (venues.length > 0) {
      try {
        analysis = await synthesizeWithAgent(
          concept,
          city,
          facts,
          venues.map((v) => v.name),
          windows,
          {
            dishes: brief.dishes,
            season: details?.season,
          },
        );
      } catch (error) {
        agentNotes.push(
          `Agent analysis unavailable, showing the template plan: ${shortError(error)}`,
        );
      }
    }
    agent = { tagDecision, analysis, facts, notes: agentNotes };
    lap("analysis");
  }

  // The letter and the brief name the dish in a few words, not the whole paragraph the chef typed.
  const label = brief.interpreted ? brief.core : concept;

  const tastingBrief = [
    `Tasting concept: "${label}"`,
    `Atmosphere cues (from tags of taste-matched venues): ${vibeWords.length > 0 ? vibeWords.join(", ") : "not enough data"}.`,
    regionInsights.length > 0
      ? `What reviews of the ${venues.length} matched venue${venues.length === 1 ? "" : "s"} mention most: ${regionInsights
          .slice(0, 6)
          .map((r) => r.keyword)
          .join(
            ", ",
          )}. These are aggregated mention counts, not review text${venues.length < 3 ? ", and too few venues to speak for the whole city" : ""}.`
      : `Not enough review-keyword data for this niche in this region.`,
    `Format: a closed tasting for 15–25 guests, a curated 3–5 item menu, feedback collected via rating cards.`,
    `Goal: validate product-market fit before investing in a permanent menu or a new location.`,
  ].join("\n");

  const pilotPlan = [
    "Week 1: lock the final tasting menu (3–5 items) and define pilot success criteria.",
    `Week 1–2: reach out to ${
      venues.length > 0
        ? venues
            .slice(0, 2)
            .map((v) => v.name)
            .join(" and ")
        : "the chosen venue"
    } about a one-off tasting night or collaboration.`,
    "Week 2: prepare a short guest questionnaire (taste, price, repeat purchase) and a promo message for the venue's audience.",
    "Week 3: run the tasting night, collect questionnaires and sales/portion data.",
    "Week 4: review results — decide whether to go to a permanent menu, revise the concept, or switch venue/audience.",
  ];

  const locationWarning = locationMismatch(city, topPlaces[0]);
  if (locationWarning) limitations.push(locationWarning);
  const tagNames = [
    primaryTag.name,
    ...(agent?.tagDecision?.secondary ?? []).map((s) => s.name),
  ];
  if (places.length > 0 && !conceptMatchesTag(searchConcept, tagNames)) {
    limitations.push(
      `Qloo matched "${searchConcept}" to the tag "${primaryTag.name}", which shares no words with it. If that is not what you meant, rephrase the concept (a cuisine or dish type works best).`,
    );
  }

  const bestVenue =
    venues.find((v) => v.name === agent?.analysis?.recommendedVenue?.name) ??
    venues[0];
  const ownerLetter = bestVenue
    ? [
        bestVenue.phone
          ? `Direct contact (a call usually beats email — less risk of landing in spam): ${bestVenue.phone}`
          : `No direct phone number found in Qloo's data — use the venue's website instead.`,
        "",
        `Subject: collaboration proposal — tasting night for "${label}"`,
        "",
        `Hi,`,
        "",
        `We're developing a concept for "${label}" and, based on audience taste data, ${bestVenue.name} looks like one of the strongest-fit venues in ${city} — your place is close in atmosphere and taste profile (${bestVenue.vibeTags.slice(0, 3).join(", ") || "a matching niche"}).`,
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
    brief: brief.interpreted
      ? { core: brief.core, dishes: brief.dishes }
      : undefined,
    details,
    timingsMs: timings,
  };
}
