// Numbers every Qloo-derived datum so the analysis step can cite it and code can verify the
// citations. Pure: the same inputs always give the same fact list.

import type { AgentTagDecision, Fact } from "./agent";
import type { DemographicsResult } from "./qloo";
import type { Details } from "./input.ts";
import type { CulturalAffinity, CulturalSignalItem, RegionInsight, VenueCandidate } from "./pilot-package";

export type Tag = { id: string; name: string; type: string };

export const AGE_BUCKETS = ["24_and_younger", "25_to_29", "30_to_34", "35_to_44", "45_to_54", "55_and_older"] as const;
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
  addRequestedFacts(input.requested, input.venues, add);
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

const AGE_LABELS: Record<string, string> = { ...AGE_LABEL };

/** The chef's dietary, price and audience requests, each checked against what Qloo says about every venue. */
function addRequestedFacts(
  requested: Details | undefined,
  venues: VenueCandidate[],
  add: (text: string, venue?: string) => void
) {
  if (!requested) return;
  for (const diet of requested.dietary ?? []) {
    for (const v of venues) {
      const listed = v.dietaryOptions.some((d) => d.toLowerCase() === diet.toLowerCase());
      add(
        listed
          ? `The chef asked for "${diet}". Venue "${v.name}" lists it among its Qloo dietary options.`
          : `The chef asked for "${diet}". Venue "${v.name}" does not list it among its Qloo dietary options.`,
        v.name
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
        v.name
      );
    }
  }
  const a = requested.audience;
  if (a) {
    const wanted = [...(a.age ?? []).map((g) => AGE_LABELS[g] ?? g), ...(a.gender ? [a.gender] : [])].join(", ");
    for (const v of venues) {
      if (!v.demographics) continue;
      const parts = [
        ...(a.age ?? []).map((g) => `${AGE_LABELS[g] ?? g} ${signed(v.demographics?.age?.[g] ?? 0)}`),
        ...(a.gender ? [`${a.gender} ${signed(v.demographics?.gender?.[a.gender] ?? 0)}`] : []),
      ];
      add(`The chef asked for this audience: ${wanted}. Venue "${v.name}" audience affinity for it (Qloo, vs. average): ${parts.join("; ")}.`, v.name);
    }
  }
}
