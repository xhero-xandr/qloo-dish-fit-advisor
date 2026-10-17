// Checks on what the user typed, before any quota is spent on it.

export const MAX_CONCEPT_LENGTH = 800;
export const MAX_CITY_LENGTH = 100;
export const MAX_SEASON_LENGTH = 80;

const HAS_WORD = /\p{L}{2,}/u;

// The names Qloo uses for the dietary-option tags it puts on venues.
export const DIETARY_OPTIONS = [
  "Vegan",
  "Vegetarian",
  "Gluten free",
  "Dairy free",
  "Halal",
  "Kosher",
] as const;
export const AGE_GROUPS = [
  "24_and_younger",
  "25_to_29",
  "30_to_34",
  "35_to_44",
  "45_to_54",
  "55_and_older",
] as const;

/** What the chef can say about the dish beyond the description. Every field is optional. */
export interface Details {
  /** Dietary options the dish has to meet, e.g. "Vegan". Checked against what Qloo lists for each venue. */
  dietary?: (typeof DIETARY_OPTIONS)[number][];
  /** The audience the dish is for. Sent to Qloo as a signal, so it changes which venues come back. */
  audience?: {
    age?: (typeof AGE_GROUPS)[number][];
    gender?: "male" | "female";
  };
  /** Price levels the dish would sit at, 1 ($) to 4 ($$$$). Compared with each venue's own level. */
  prices?: (1 | 2 | 3 | 4)[];
  /** Season or daypart, in the chef's words ("summer", "weekend brunch"). Read by the analysis, not by Qloo. */
  season?: string;
}

function onlyFrom<T>(value: unknown, allowed: readonly T[]): T[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const picked = allowed.filter((a) => value.includes(a));
  return picked.length > 0 ? picked : undefined;
}

/** Keeps only the details that are valid; anything else is dropped rather than trusted. Undefined if nothing is left. */
export function parseDetails(raw: unknown): Details | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  const details: Details = {};
  const dietary = onlyFrom(r.dietary, DIETARY_OPTIONS);
  if (dietary) details.dietary = dietary;
  const a =
    typeof r.audience === "object" && r.audience !== null
      ? (r.audience as Record<string, unknown>)
      : {};
  const age = onlyFrom(a.age, AGE_GROUPS);
  const gender =
    a.gender === "male" || a.gender === "female" ? a.gender : undefined;
  if (age || gender)
    details.audience = {
      ...(age ? { age } : {}),
      ...(gender ? { gender } : {}),
    };
  const prices = onlyFrom(r.prices, [1, 2, 3, 4] as const);
  if (prices) details.prices = [...prices];
  const season =
    typeof r.season === "string"
      ? r.season.replace(/\s+/g, " ").trim().slice(0, MAX_SEASON_LENGTH)
      : "";
  if (season && HAS_WORD.test(season)) details.season = season;
  return Object.keys(details).length > 0 ? details : undefined;
}

/** A message for the user if the concept or city cannot be analysed, otherwise undefined. */
export function validateInput(
  concept: string,
  city: string,
): string | undefined {
  if (!concept || !city) return "Both 'concept' and 'city' are required.";
  if (concept.length > MAX_CONCEPT_LENGTH || city.length > MAX_CITY_LENGTH) {
    return `Keep the description under ${MAX_CONCEPT_LENGTH} characters and the city under ${MAX_CITY_LENGTH}.`;
  }
  if (!HAS_WORD.test(concept))
    return 'Describe the dish or menu in a few words, e.g. "izakaya-style small plates".';
  if (!HAS_WORD.test(city)) return 'Enter a city name, e.g. "Austin, TX".';
  return undefined;
}
