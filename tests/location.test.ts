import assert from "node:assert/strict";
import { test } from "node:test";
import { geoMatches, parseCityQuery, resolveCityQuery, type Geo } from "../lib/location.ts";

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
