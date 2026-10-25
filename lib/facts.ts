// Numbers every Qloo-derived datum so the analysis step can cite it and code can verify the
// citations. Pure: the same inputs always give the same fact list.

import type { AgentTagDecision, Fact } from "./agent";
import { guestGroupCounts } from "./audience.ts";
import type { DemographicsResult } from "./qloo";
import type { Details } from "./input.ts";
import type { FactSource, QlooRequest } from "./provenance.ts";
import type {
  CulturalAffinity,
  CulturalSignalItem,
  RegionInsight,
  VenueCandidate,
} from "./pilot-package";

export type Tag = { id: string; name: string; type: string };

/** How to rebuild the Qloo request behind each kind of fact; built by the code that made the calls. */
export interface FactSources {
  base: string;
  places(tagId: string): QlooRequest;
  demographics(entityId: string): QlooRequest;
  cultural: Partial<
    Record<"brands" | "tvShows" | "artists" | "podcasts", QlooRequest>
  >;
}

export const AGE_BUCKETS = [
  "24_and_younger",
  "25_to_29",
  "30_to_34",
  "35_to_44",
  "45_to_54",
  "55_and_older",
] as const;
export const AGE_LABEL: Record<string, string> = {
  "24_and_younger": "24 and younger",
  "25_to_29": "25–29",
  "30_to_34": "30–34",
  "35_to_44": "35–44",
  "45_to_54": "45–54",
  "55_and_older": "55+",
};

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
export function buildFacts(input: {
  city: string;
  primaryTag: Tag;
  secondary: AgentTagDecision["secondary"];
  venues: VenueCandidate[];
  aggregate?: DemographicsResult;
  regionInsights: RegionInsight[];
  culturalAffinity?: CulturalAffinity;
  /** What the chef asked for beyond the description; each request is answered from Qloo's data for every venue. */
  requested?: Details;
  /** When given, every fact carries the Qloo request it came from. */
  sources?: FactSources;
}): Fact[] {
  const facts: Fact[] = [];
  const sources = input.sources;
  const from = (
    requests: (QlooRequest | undefined)[],
    note?: string,
  ): FactSource | undefined => {
    const list = requests.filter((r): r is QlooRequest => r !== undefined);
    return sources && list.length > 0
      ? { base: sources.base, requests: list, ...(note ? { note } : {}) }
      : undefined;
  };
  const venueSearch = sources?.places(input.primaryTag.id);
  const add = (text: string, venue?: string, source?: FactSource) =>
    facts.push({
      id: `F${facts.length + 1}`,
      text,
      venue,
      ...(source ? { source } : {}),
    });
  const n = input.venues.length;

  add(
    `Venues were found via the Qloo tag "${input.primaryTag.name}" (${input.primaryTag.type.replace("urn:tag:", "")}); ${n} operating venue(s) matched.`,
    undefined,
    from(
      [venueSearch],
      "The tag was chosen from tag searches (see the agent's steps); this is the venue search it anchors.",
    ),
  );
  for (const v of input.venues) {
    const price = v.priceLevel ? "$".repeat(v.priceLevel) : "n/a";
    const fromSearch = from([venueSearch]);
    add(
      `Venue "${v.name}": rating ${v.rating?.toFixed(1) ?? "n/a"}, price level ${price}${v.address ? `, address ${v.address}` : ""}.`,
      v.name,
      fromSearch,
    );
    if (v.hours)
      add(`Venue "${v.name}" opening hours: ${v.hours}.`, v.name, fromSearch);
    if (v.dietaryOptions.length > 0)
      add(
        `Venue "${v.name}" dietary options listed by Qloo: ${v.dietaryOptions.join(", ")}.`,
        v.name,
        fromSearch,
      );
    if (v.vibeTags.length > 0)
      add(
        `Venue "${v.name}" Qloo tags: ${v.vibeTags.join(", ")}.`,
        v.name,
        fromSearch,
      );
    if (v.guests && v.guests.length > 0)
      add(
        `Venue "${v.name}" guests, as Qloo tags them (who the venue is known to be popular with): ${v.guests.join(", ")}.`,
        v.name,
        fromSearch,
      );
    if (v.reviewKeywords.length > 0) {
      add(
        `Venue "${v.name}" own most-mentioned review keywords: ${v.reviewKeywords.map((k) => `${k.keyword} (${k.mentions})`).join(", ")}.`,
        v.name,
        fromSearch,
      );
    }
    if (v.demographics) {
      add(
        `Venue "${v.name}" audience: ${describeDemographicsFact(v.demographics)}.`,
        v.name,
        from([sources?.demographics(v.entityId)]),
      );
    }
  }
  addRequestedFacts(
    input.requested,
    input.venues,
    add,
    from,
    venueSearch,
    sources,
  );
  if (input.aggregate) {
    add(
      `Across all ${n} matched venues combined, average audience ${describeDemographicsFact(input.aggregate)}.`,
      undefined,
      from(
        input.venues
          .filter((v) => v.demographics)
          .map((v) => sources?.demographics(v.entityId)),
        "Averaged here across these requests, one per venue.",
      ),
    );
  }
  const guestGroups = guestGroupCounts(input.venues);
  if (guestGroups.length > 0) {
    add(
      `Across all ${n} matched venues, the guest groups Qloo tags on more than one venue: ${guestGroups
        .map(([group, count]) => `${group} (${count} of ${n})`)
        .join(", ")}.`,
      undefined,
      from(
        [venueSearch],
        "Guest tags from the venue search, counted here across the matched venues.",
      ),
    );
  }
  if (input.regionInsights.length > 0) {
    add(
      `Across all ${n} matched venues combined, most-mentioned review keywords: ${input.regionInsights
        .slice(0, 10)
        .map((r) => `${r.keyword} (${r.mentions})`)
        .join(", ")}.`,
      undefined,
      from(
        [venueSearch],
        "Review-keyword counts from the venue search, summed here across the matched venues.",
      ),
    );
  }
  const ca = input.culturalAffinity;
  if (ca) {
    const groups: [
      string,
      CulturalSignalItem[],
      keyof FactSources["cultural"],
    ][] = [
      ["brands", ca.brands, "brands"],
      ["TV shows", ca.tvShows, "tvShows"],
      ["music artists", ca.artists, "artists"],
      ["podcasts", ca.podcasts, "podcasts"],
    ];
    for (const [label, items, key] of groups) {
      if (items.length > 0) {
        add(
          `The audience of these matched venues also over-indexes on these ${label}: ${items.map((i) => i.name).join(", ")}.`,
          undefined,
          from([sources?.cultural[key]]),
        );
      }
    }
  }
  for (const s of input.secondary) {
    if (s.venueCount !== undefined) {
      add(
        `Secondary concept signal "${s.name}": ${s.venueCount} venue(s) in ${input.city} carry this Qloo tag${
          s.venueNames && s.venueNames.length > 0
            ? `, e.g. ${s.venueNames.join(", ")}`
            : ""
        }.`,
        undefined,
        from([sources?.places(s.id)]),
      );
    } else {
      add(
        `Part of the concept also maps to the Qloo tag "${s.name}" (venues for it were not checked).`,
      );
    }
  }
  return facts;
}

const AGE_LABELS: Record<string, string> = { ...AGE_LABEL };

/** The chef's dietary, price and audience requests, each checked against what Qloo says about every venue. */
function addRequestedFacts(
  requested: Details | undefined,
  venues: VenueCandidate[],
  add: (text: string, venue?: string, source?: FactSource) => void,
  from: (
    requests: (QlooRequest | undefined)[],
    note?: string,
  ) => FactSource | undefined,
  venueSearch: QlooRequest | undefined,
  sources: FactSources | undefined,
) {
  if (!requested) return;
  for (const diet of requested.dietary ?? []) {
    for (const v of venues) {
      const listed = v.dietaryOptions.some(
        (d) => d.toLowerCase() === diet.toLowerCase(),
      );
      add(
        listed
          ? `The chef asked for "${diet}". Venue "${v.name}" lists it among its Qloo dietary options.`
          : `The chef asked for "${diet}". Venue "${v.name}" does not list it among its Qloo dietary options.`,
        v.name,
        from(
          [venueSearch],
          "The chef's request is checked here against the dietary options in this result.",
        ),
      );
    }
  }
  if (requested.prices) {
    const wanted = requested.prices.map((p) => "$".repeat(p)).join(", ");
    for (const v of venues) {
      if (!v.priceLevel) continue;
      const inside = (requested.prices as number[]).includes(v.priceLevel);
      add(
        `The chef asked for price level ${wanted}. Venue "${v.name}" is ${"$".repeat(v.priceLevel)}, ${inside ? "inside" : "outside"} that range.`,
        v.name,
        from(
          [venueSearch],
          "The chef's request is compared here with the price level in this result.",
        ),
      );
    }
  }
  const a = requested.audience;
  if (a) {
    const wanted = [
      ...(a.age ?? []).map((g) => AGE_LABELS[g] ?? g),
      ...(a.gender ? [a.gender] : []),
    ].join(", ");
    for (const v of venues) {
      if (!v.demographics) continue;
      const parts = [
        ...(a.age ?? []).map(
          (g) =>
            `${AGE_LABELS[g] ?? g} ${signed(v.demographics?.age?.[g] ?? 0)}`,
        ),
        ...(a.gender
          ? [`${a.gender} ${signed(v.demographics?.gender?.[a.gender] ?? 0)}`]
          : []),
      ];
      add(
        `The chef asked for this audience: ${wanted}. Venue "${v.name}" audience affinity for it (Qloo, vs. average): ${parts.join("; ")}.`,
        v.name,
        from(
          [sources?.demographics(v.entityId)],
          "The groups the chef asked for are picked here out of this venue's audience result.",
        ),
      );
    }
  }
}
