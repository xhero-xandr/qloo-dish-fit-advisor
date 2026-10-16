// What the code insists on after the model has answered. The model is asked to cite numbered Qloo
// facts; nothing it writes is trusted until it passes these checks, which need no network and no model,
// so they are tested directly (tests/guards.test.ts).

import type { Fact, Fit } from "./agent";
import { unsupportedNumbers } from "./claims.ts";
import { formatSlot, parseSlot, slotProblem, suggestTastingSlot, type WeekWindows } from "./hours.ts";

interface Cited {
  text: string;
  facts: string[];
}

/** The model's structured answer, before any check. */
export interface RawAnalysis {
  verdict?: Cited & { fit: Fit };
  recommendedVenue?: { name: string; why: string; facts: string[] };
  pilotPlan?: (Cited & { when: string })[];
  menuNotes?: Cited[];
  risks?: Cited[];
}

export interface CheckedAnalysis {
  verdict?: Cited & { fit: Fit };
  recommendedVenue?: { name: string; why: string; facts: string[] };
  pilotPlan: (Cited & { when: string })[];
  menuNotes: Cited[];
  risks: Cited[];
  /** Items removed because they cited nothing real, quoted a number the facts lack, or named another venue's facts. */
  droppedItems: number;
  /** Tasting windows replaced because they fell outside the venue's real hours. */
  correctedItems: number;
  /** Why each dropped item was dropped, e.g. "verdict: 4.9 is not in the facts it cites". */
  droppedNotes: string[];
}

export function enforceGrounding(
  value: RawAnalysis,
  facts: Fact[],
  venueNames: string[],
  windows: Map<string, WeekWindows> = new Map()
): CheckedAnalysis {
  const factIds = new Set(facts.map((f) => f.id));
  const factText = new Map(facts.map((f) => [f.id, f.text]));
  const factVenue = new Map(facts.map((f) => [f.id, f.venue]));

  let dropped = 0;
  const droppedNotes: string[] = [];
  const cite = (ids: unknown): string[] =>
    Array.isArray(ids) ? Array.from(new Set(ids.map(String).filter((id) => factIds.has(id)))) : [];

  // `claim` is the sentence that states something about the data. Its numbers must appear in the facts
  // it cites. Menu notes and plan steps are suggestions ("3-5 dishes", "15-25 guests"), not claims
  // about the data, so they are only held to the citation rule.
  function keep<T extends { facts: string[]; text?: string }>(
    item: T | undefined,
    label: string,
    claim?: (i: T) => string
  ): T | undefined {
    if (!item) return undefined;
    const facts = cite(item.facts);
    const missing = claim ? unsupportedNumbers(claim(item), facts.map((id) => factText.get(id) ?? "")) : [];
    if (facts.length === 0 || missing.length > 0) {
      dropped++;
      droppedNotes.push(
        facts.length === 0
          ? `${label}: cited no fact that exists`
          : `${label}: ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} not in the facts it cites`
      );
      return undefined;
    }
    return { ...item, facts };
  }
  const keepAll = <T extends { facts: string[]; text?: string }>(
    items: T[] | undefined,
    label: string,
    claim?: (i: T) => string
  ): T[] => (items ?? []).map((i) => keep(i, label, claim)).filter((i): i is T => Boolean(i));

  let recommendedVenue = keep(value.recommendedVenue, "recommendation", (r) => r.why);
  if (recommendedVenue) {
    const match = venueNames.find((n) => n.toLowerCase() === recommendedVenue!.name.trim().toLowerCase());
    // The recommendation may cite general facts, but not another venue's facts, and it
    // must rest on at least one fact about the venue itself.
    const ownFacts = recommendedVenue.facts.filter((id) => !factVenue.get(id) || factVenue.get(id) === match);
    if (match && ownFacts.some((id) => factVenue.get(id) === match)) {
      recommendedVenue = { ...recommendedVenue, name: match, facts: ownFacts };
    } else {
      dropped++;
      droppedNotes.push("recommendation: not a matched venue, or cited no fact about its own venue");
      recommendedVenue = undefined;
    }
  }

  const verdict = keep(value.verdict, "verdict", (v) => v.text);

  // The tasting night must fit the venue's real hours. The agent's wording is checked, and a
  // window that is on a closed day, outside the hours, or before the evening (when the venue
  // opens in the evening) is replaced by the one computed from those hours.
  let corrected = 0;
  const week = recommendedVenue && windows.get(recommendedVenue.name);
  const pilotPlan = (value.pilotPlan ?? [])
    .map((step) => ({ ...step, facts: cite(step.facts) }))
    .map((step) => {
      const slot = parseSlot(step.when);
      if (!slot || !week || !slotProblem(slot, week)) return step;
      const suggested = suggestTastingSlot(week);
      if (!suggested) return step;
      corrected++;
      const prefix = step.when.match(/^(.*?)\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i)?.[1] ?? "";
      return { ...step, when: `${prefix}${formatSlot(suggested)}` };
    });

  return {
    verdict,
    recommendedVenue,
    pilotPlan,
    menuNotes: keepAll(value.menuNotes, "menu note"),
    risks: keepAll(value.risks, "risk", (r) => r.text),
    droppedItems: dropped,
    correctedItems: corrected,
    droppedNotes,
  };
}
