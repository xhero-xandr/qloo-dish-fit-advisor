// Turns Qloo's audience affinity scores into plain words. A score says how much more (above 0) or
// less (below 0) a group likes the venues than the average person; it is not a share of guests, and
// Qloo does not publish its baseline, so it is described in words, never as a percentage.
// The cut-offs are ours and are stated wherever the words are shown.

export type Level =
  "much more" | "more" | "about average" | "less" | "much less";

export const AGE_BUCKETS = [
  "24_and_younger",
  "25_to_29",
  "30_to_34",
  "35_to_44",
  "45_to_54",
  "55_and_older",
] as const;

/** Lower and upper age of each bucket, for joining neighbours into one range ("25–34"). */
const BOUNDS: Record<string, [number | null, number | null]> = {
  "24_and_younger": [null, 24],
  "25_to_29": [25, 29],
  "30_to_34": [30, 34],
  "35_to_44": [35, 44],
  "45_to_54": [45, 54],
  "55_and_older": [55, null],
};

export const MORE = 0.05;
export const MUCH = 0.15;
const GENDER_LEAN = 0.1;

export function levelOf(score: number): Level {
  if (score >= MUCH) return "much more";
  if (score >= MORE) return "more";
  if (score > -MORE) return "about average";
  if (score > -MUCH) return "less";
  return "much less";
}

/** Adjacent buckets as one range: ["25_to_29", "30_to_34"] -> "25–34"; gaps are listed: "25–29 and 45–54". */
export function ageRangeLabel(buckets: readonly string[]): string {
  const ordered = AGE_BUCKETS.filter((b) => buckets.includes(b));
  const runs: string[][] = [];
  for (const b of ordered) {
    const last = runs[runs.length - 1];
    const prev = last?.[last.length - 1];
    if (
      prev &&
      AGE_BUCKETS.indexOf(prev as (typeof AGE_BUCKETS)[number]) + 1 ===
        AGE_BUCKETS.indexOf(b)
    )
      last.push(b);
    else runs.push([b]);
  }
  return runs
    .map((run) => {
      const lower = BOUNDS[run[0]][0];
      const upper = BOUNDS[run[run.length - 1]][1];
      if (lower === null && upper === null) return "all ages";
      if (lower === null) return `${upper} and younger`;
      if (upper === null) return `${lower}+`;
      return `${lower}–${upper}`;
    })
    .join(" and ");
}

interface Scores {
  age?: Record<string, number>;
  gender?: Record<string, number>;
}

/** The age groups that like the venues more than average, as one label, or undefined when none stands out. */
export function coreAgeLabel(scores: Scores): string | undefined {
  const more = AGE_BUCKETS.filter((b) => (scores.age?.[b] ?? 0) >= MORE);
  return more.length > 0 ? ageRangeLabel(more) : undefined;
}

export function genderLean(scores: Scores): string {
  const lean = (scores.gender?.female ?? 0) - (scores.gender?.male ?? 0);
  if (lean >= GENDER_LEAN) return "more women than men";
  if (lean <= -GENDER_LEAN) return "more men than women";
  return "men and women alike";
}

/** One plain sentence: who likes these places more, who less, and the gender lean. */
export function describeAudience(
  scores: Scores,
  places = "these venues",
): string {
  const more = AGE_BUCKETS.filter((b) => (scores.age?.[b] ?? 0) >= MORE);
  const less = AGE_BUCKETS.filter((b) => (scores.age?.[b] ?? 0) <= -MORE);
  const parts: string[] = [];
  if (more.length > 0)
    parts.push(
      `People aged ${ageRangeLabel(more)} like ${places} more than the average person does`,
    );
  if (less.length > 0)
    parts.push(
      `${more.length > 0 ? "people" : "People"} aged ${ageRangeLabel(less)} like them less`,
    );
  const ages =
    parts.length > 0
      ? `${parts.join("; ")}.`
      : `No age group likes ${places} clearly more or less than the average person.`;
  const lean = genderLean(scores);
  return `${ages} ${lean === "men and women alike" ? "Men and women about equally." : `Somewhat ${lean}.`}`;
}

// Qloo tags most popular venues with these guest groups, so on their own they say little about a venue.
const COMMON_GUEST_GROUPS = new Set(["locals", "foodies", "regulars", "groups of friends", "couples"]);

export function isCommonGuestGroup(group: string): boolean {
  return COMMON_GUEST_GROUPS.has(group.trim().toLowerCase());
}

/** Guest groups Qloo tags on at least two of the venues, with how many venues each: most venues first, the common groups last. */
export function guestGroupCounts(
  venues: { guests?: string[] }[],
): [string, number][] {
  const counts = new Map<string, number>();
  for (const v of venues)
    for (const g of new Set(v.guests ?? []))
      counts.set(g, (counts.get(g) ?? 0) + 1);
  return [...counts]
    .filter(([, c]) => c >= 2)
    .sort(
      (a, b) =>
        Number(isCommonGuestGroup(a[0])) - Number(isCommonGuestGroup(b[0])) ||
        b[1] - a[1],
    );
}
