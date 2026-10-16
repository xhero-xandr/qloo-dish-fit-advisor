import assert from "node:assert/strict";
import { test } from "node:test";
import { geoMatches, isUnknownLocalityError, parseCityQuery, resolveCityQuery, type Geo } from "../lib/location.ts";

const geo = (city: string, admin1: string, country = "United States"): Geo => ({ city, admin1_region: admin1, country });

test("parseCityQuery reads city and region, expanding US state abbreviations", () => {
  assert.deepEqual(parseCityQuery("Boise, ID"), { city: "boise", region: "idaho" });
  assert.deepEqual(parseCityQuery("Lisbon, Portugal"), { city: "lisbon", region: "portugal" });
  assert.deepEqual(parseCityQuery("Tokyo"), { city: "tokyo", region: undefined });
});

test("geoMatches requires the typed city, and the typed region when there is one", () => {
  assert.equal(geoMatches("Boise, ID", geo("Boise", "Idaho")), true);
  assert.equal(geoMatches("Boise, ID", geo("Crouch", "Idaho")), false);
  assert.equal(geoMatches("Portland, ME", geo("Portland", "Oregon")), false, "right city name, wrong state");
  assert.equal(geoMatches("Portland, ME", geo("Portland", "Maine")), true);
  assert.equal(geoMatches("Montréal, Canada", geo("Montreal", "Quebec", "Canada")), true, "accents do not matter");
  assert.equal(geoMatches("Washington, DC", geo("District of Columbia", "District of Columbia")), true);
  assert.equal(geoMatches("Tokyo", geo("Shinagawa", "Tokyo", "Japan")), true);
  assert.equal(geoMatches("Boise", undefined), false);
});

// A stand-in for Qloo that resolves each query the way the real one did for Boise.
const boise = async (q: string): Promise<Geo | undefined> =>
  q === "Boise" ? geo("Boise", "Idaho") : geo("Crouch", "Idaho");

test("a typed query that lands correctly is kept, with one probe", async () => {
  let probes = 0;
  const out = await resolveCityQuery("Austin, TX", async () => (probes++, geo("Austin", "Texas")));
  assert.equal(out, "Austin, TX");
  assert.equal(probes, 1);
});

test("a query that lands on the wrong place falls back to the bare city when that lands correctly", async () => {
  assert.equal(await resolveCityQuery("Boise, ID", boise), "Boise");
});

test("the bare city is not used if it lands in a different region", async () => {
  const portland = async (q: string) => (q === "Portland" ? geo("Portland", "Oregon") : geo("Cape Elizabeth", "Maine"));
  assert.equal(await resolveCityQuery("Portland, ME", portland), "Portland, ME");
});

test("no comma or a short abbreviation is passed through without any probe", async () => {
  let probes = 0;
  const probe = async () => (probes++, undefined);
  assert.equal(await resolveCityQuery("Tokyo", probe), "Tokyo");
  assert.equal(await resolveCityQuery("LA, CA", probe), "LA, CA");
  assert.equal(probes, 0);
});

test("when Qloo gives nothing back the typed query is used as it is", async () => {
  assert.equal(await resolveCityQuery("Boise, ID", async () => undefined), "Boise, ID");
});

test("only Qloo's 'cannot place this city' answer counts as an unknown city, not an outage", () => {
  const real = new Error('Qloo API 400 on /v2/insights: {"errors":[{"message":"filter.location.query is unable to resolve to a valid locality."}]}');
  assert.equal(isUnknownLocalityError(real), true);
  assert.equal(isUnknownLocalityError(new Error("Qloo API 500 on /v2/insights: boom")), false);
  assert.equal(isUnknownLocalityError("nope"), false);
});

test("only the name Washington is read as the District of Columbia", () => {
  assert.equal(geoMatches("Washington, DC", geo("District of Columbia", "District of Columbia")), true);
  assert.equal(geoMatches("Seattle", geo("District of Columbia", "District of Columbia")), false);
});

test("a three-letter name is taken as an abbreviation and passed through; four letters are checked", async () => {
  let probes = 0;
  const probe = async (q: string) => (probes++, q === "Lima" ? geo("Lima", "Lima", "Peru") : geo("Elsewhere", "X"));
  assert.equal(await resolveCityQuery("Rio, Brazil", probe), "Rio, Brazil");
  assert.equal(probes, 0);
  assert.equal(await resolveCityQuery("Lima, Peru", probe), "Lima");
  assert.ok(probes >= 2);
});

test("the fallback is the trimmed city name", async () => {
  const probe = async (q: string) => (q === "Boise" ? geo("Boise", "Idaho") : geo("Crouch", "Idaho"));
  assert.equal(await resolveCityQuery("  Boise , ID", probe), "Boise");
});

test("every US state abbreviation expands to the state's full name", () => {
  const states: Record<string, string> = {
    AL: "alabama", AK: "alaska", AZ: "arizona", AR: "arkansas", CA: "california", CO: "colorado", CT: "connecticut",
    DE: "delaware", DC: "district of columbia", FL: "florida", GA: "georgia", HI: "hawaii", ID: "idaho", IL: "illinois",
    IN: "indiana", IA: "iowa", KS: "kansas", KY: "kentucky", LA: "louisiana", ME: "maine", MD: "maryland",
    MA: "massachusetts", MI: "michigan", MN: "minnesota", MS: "mississippi", MO: "missouri", MT: "montana",
    NE: "nebraska", NV: "nevada", NH: "new hampshire", NJ: "new jersey", NM: "new mexico", NY: "new york",
    NC: "north carolina", ND: "north dakota", OH: "ohio", OK: "oklahoma", OR: "oregon", PA: "pennsylvania",
    RI: "rhode island", SC: "south carolina", SD: "south dakota", TN: "tennessee", TX: "texas", UT: "utah",
    VT: "vermont", VA: "virginia", WA: "washington", WV: "west virginia", WI: "wisconsin", WY: "wyoming",
  };
  assert.equal(Object.keys(states).length, 51);
  for (const [abbr, name] of Object.entries(states)) {
    assert.equal(parseCityQuery(`Somewhere, ${abbr}`).region, name, abbr);
    assert.equal(parseCityQuery(`Somewhere, ${abbr.toLowerCase()}`).region, name, `${abbr} in lower case`);
  }
  assert.equal(parseCityQuery("Somewhere, Narnia").region, "narnia", "anything else is kept as typed");
});
