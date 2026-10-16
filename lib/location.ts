// Qloo matches a city query fuzzily, and "City, ST" can land on the wrong place: "Boise, ID",
// "Boise, Idaho" and even "Boise, Idaho, United States" all resolve to Boise County (Crouch, Horseshoe
// Bend), while plain "Boise" resolves to the city. This picks the query that lands on the right place.

export interface Geo {
  city?: string;
  metro?: string;
  admin1_region?: string;
  country?: string;
}

const US_STATES: Record<string, string> = {
  al: "alabama",
  ak: "alaska",
  az: "arizona",
  ar: "arkansas",
  ca: "california",
  co: "colorado",
  ct: "connecticut",
  de: "delaware",
  dc: "district of columbia",
  fl: "florida",
  ga: "georgia",
  hi: "hawaii",
  id: "idaho",
  il: "illinois",
  in: "indiana",
  ia: "iowa",
  ks: "kansas",
  ky: "kentucky",
  la: "louisiana",
  me: "maine",
  md: "maryland",
  ma: "massachusetts",
  mi: "michigan",
  mn: "minnesota",
  ms: "mississippi",
  mo: "missouri",
  mt: "montana",
  ne: "nebraska",
  nv: "nevada",
  nh: "new hampshire",
  nj: "new jersey",
  nm: "new mexico",
  ny: "new york",
  nc: "north carolina",
  nd: "north dakota",
  oh: "ohio",
  ok: "oklahoma",
  or: "oregon",
  pa: "pennsylvania",
  ri: "rhode island",
  sc: "south carolina",
  sd: "south dakota",
  tn: "tennessee",
  tx: "texas",
  ut: "utah",
  vt: "vermont",
  va: "virginia",
  wa: "washington",
  wv: "west virginia",
  wi: "wisconsin",
  wy: "wyoming",
};

const plain = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** "Boise, ID" -> { city: "boise", region: "idaho" }; "Tokyo" -> { city: "tokyo" }. */
export function parseCityQuery(query: string): {
  city: string;
  region?: string;
} {
  const [city, region] = query.split(",").map((p) => plain(p.trim()));
  return { city, region: region ? (US_STATES[region] ?? region) : undefined };
}

/** Whether Qloo's geocode for a result is the city that was typed (and the region, if one was typed). */
export function geoMatches(query: string, geo: Geo | undefined): boolean {
  if (!geo) return false;
  const { city, region } = parseCityQuery(query);
  const where = plain(
    [geo.city, geo.metro, geo.admin1_region, geo.country]
      .filter(Boolean)
      .join(" "),
  );
  const cityOk =
    where.includes(city) ||
    (city === "washington" && where.includes("district of columbia"));
  if (!cityOk) return false;
  if (!region) return true;
  return where.includes(region);
}

/**
 * The query to send to Qloo for this city. The typed query is kept when it lands correctly; when it
 * does not, the bare city name is tried, and used only if it lands on the same city and region. Never
 * trades a wrong place for a different wrong place ("Portland, ME" must not silently become Portland, OR).
 */
export async function resolveCityQuery(
  query: string,
  probe: (q: string) => Promise<Geo | null | undefined>,
): Promise<string> {
  const { city } = parseCityQuery(query);
  if (!query.includes(",") || city.length <= 3) return query;
  const typed = await probe(query);
  if (!typed || geoMatches(query, typed)) return query; // nothing to go on, or it landed correctly
  const bare = query.split(",")[0].trim();
  const alt = await probe(bare);
  return alt && geoMatches(query, alt) ? bare : query;
}

/** Qloo answers 400 when it cannot place the city at all; that is "no such city", not an outage. */
export function isUnknownLocalityError(error: unknown): boolean {
  return error instanceof Error && /unable to resolve to a valid locality/i.test(error.message);
}
