// Pure helpers that turn Qloo's raw place data into what the page and the agent use. No network, no
// state: each is tested on its own (tests/venues.test.ts).

import { AGE_BUCKETS } from "./facts.ts";
import { geoMatches } from "./location.ts";
import type { CrossDomainEntity, DemographicsResult, QlooPlace } from "./qloo.ts";
import type { CulturalSignalItem, RegionInsight, VenueCandidate } from "./pilot-package.ts";

/** Average per-venue affinity scores into one aggregate audience profile for the hero chart. */
export function aggregateDemographics(venues: VenueCandidate[]): DemographicsResult | undefined {
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
export function aggregateRegionInsights(places: QlooPlace[]): RegionInsight[] {
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

export function toCulturalSignalItems(entities: CrossDomainEntity[]): CulturalSignalItem[] {
  return entities.map((e) => ({
    name: e.name,
    imageUrl: e.properties?.image?.url,
    subtitle: (e.properties?.genres ?? e.properties?.primary_genres)?.slice(0, 2).join(", "),
  }));
}

export const DIETARY_TAG_TYPE = "urn:tag:dietary_option:qloo";

/** Pull the dietary-option tags Qloo attached to a venue (vegan, gluten-free, halal, ...). */
export function extractDietaryOptions(tags: { id: string; name: string; type: string }[]): string[] {
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
export function formatHours(hours: NonNullable<QlooPlace["properties"]["hours"]> | undefined): string | undefined {
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
export function isOperating(place: QlooPlace): boolean {
  if (place.properties?.is_closed) return false;
  const hours = place.properties?.hours;
  if (!hours) return true;
  const days = Object.values(hours);
  return !(days.length > 0 && days.every((slots) => slots.length > 0 && slots.every((s) => s.closed)));
}


/**
 * Rank candidate tags from broadest/most "place-matchable" to narrowest, so we can
 * try them in order against `findPlacesByTags` and stop at the first one that
 * actually returns venues. Qloo's semantic tag search often surfaces very narrow
 * compound tags (e.g. "izakaya_style_small_plates") ahead of the broad canonical
 * one ("izakaya") that places are actually tagged with.
 */
export function rankTagsForPlaceMatching(
  tags: { id: string; name: string; type: string; properties?: { is_canonical?: boolean } }[]
): { id: string; name: string; type: string }[] {
  const typeWeight: Record<string, number> = {
    "urn:tag:category:place": 3,
    "urn:tag:genre:place": 3,
    "urn:tag:cuisine:qloo": 2,
    "urn:tag:culinary_style:qloo": 2,
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
  // Words about the business, not the food: "ghost kitchen for halal fried chicken wings" is about chicken.
  "ghost", "kitchen", "special", "specials", "seasonal", "pop", "popup", "item", "items", "new", "our",
  "for", "from", "into", "house", "homemade", "made", "fresh", "local", "serving", "offer", "offering",
]);

/**
 * Pull individual meaningful keywords out of a free-text concept (e.g. "izakaya-style small plates" ->
 * ["izakaya"]). When there are at least two, the first two together come first as a phrase
 * ("farm-to-table seasonal menu" -> "farm table"), because Qloo has tags like "Farm-to-Table".
 */
export function extractKeywords(concept: string): string[] {
  const words = Array.from(
    new Set(
      concept
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    )
  );
  // Cap the number of keywords: each one is a separate Qloo API call, and the event
  // key has a shared rate limit — a long concept phrase shouldn't fan out into a
  // dozen requests. The first few words usually carry the cuisine/dish signal anyway.
  const singles = words.slice(0, 4);
  return words.length >= 2 ? [`${words[0]} ${words[1]}`, ...singles] : singles;
}


/** What Qloo actually geocoded the city query to, so a bare/ambiguous name (e.g. "Paris") doesn't silently resolve to the wrong place. */
export function describeResolvedLocation(place?: QlooPlace): string | undefined {
  const geo = place?.properties?.geocode;
  if (!geo?.city) return undefined;
  const region = geo.admin1_region && geo.admin1_region !== geo.city ? geo.admin1_region : undefined;
  return [geo.city, region, geo.country].filter(Boolean).join(", ");
}

const WORD = /[\p{L}\p{N}]+/gu;

function words(text: string): string[] {
  return (text.toLowerCase().match(WORD) ?? []).filter((w) => w.length >= 3);
}

/**
 * Whether the tag Qloo matched has anything to do with the words the user typed. Qloo's semantic
 * tag search always returns something, so gibberish ("asdfgh qwerty") comes back as "Tacos". A
 * shared word, or one that is a stem of the other ("taco" / "tacos"), counts. Concepts with no
 * Latin letters (e.g. Russian) cannot be compared with English tag names, so they are not flagged.
 */
export function conceptMatchesTag(concept: string, tagNames: string[]): boolean {
  if (!/[a-z]/i.test(concept)) return true;
  const tagWords = tagNames.flatMap(words);
  return words(concept).some((c) =>
    tagWords.some((t) => c === t || (Math.min(c.length, t.length) >= 4 && (c.startsWith(t) || t.startsWith(c))))
  );
}

/**
 * A warning when Qloo placed the city query somewhere that does not contain what was typed (e.g.
 * "Portland, ME" resolved to the suburb Cape Elizabeth). Short abbreviations ("NYC", "LA") are not checked.
 */
export function locationMismatch(query: string, place?: QlooPlace): string | undefined {
  const geo = place?.properties?.geocode;
  if (!geo || query.split(",")[0].trim().length <= 3) return undefined;
  if (geoMatches(query, geo)) return undefined;
  const named = describeResolvedLocation(place);
  return `Qloo placed "${query}" at ${named ?? "a different area"}. If that is not the area you meant, try the bare city name or add a country.`;
}
