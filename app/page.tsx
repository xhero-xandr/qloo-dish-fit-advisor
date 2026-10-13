"use client";

import { useState } from "react";

interface Demographics {
  age: Record<string, number>;
  gender: Record<string, number>;
}

interface VenueCandidate {
  name: string;
  address?: string;
  phone?: string;
  rating?: number;
  priceLevel?: number | null;
  description?: string;
  website?: string;
  imageUrl?: string;
  vibeTags: string[];
  demographics?: Demographics;
}

interface RegionInsight {
  keyword: string;
  mentions: number;
}

interface PilotPackage {
  concept: string;
  city: string;
  matchedTag?: { id: string; name: string; type: string };
  resolvedTags: { id: string; name: string; type: string }[];
  venues: VenueCandidate[];
  aggregateDemographics?: Demographics;
  regionInsights: RegionInsight[];
  audienceProfile: string;
  tastingBrief: string;
  pilotPlan: string[];
  ownerLetter: string;
  limitations: string[];
}

const AGE_LABELS: Record<string, string> = {
  "24_and_younger": "≤24",
  "25_to_29": "25–29",
  "30_to_34": "30–34",
  "35_to_44": "35–44",
  "45_to_54": "45–54",
  "55_and_older": "55+",
};

const PRESETS = [
  { concept: "izakaya-style small plates", city: "Austin, TX" },
  { concept: "Korean fried chicken with natural wine pairing", city: "Chicago, IL" },
  { concept: "vegan soul food", city: "Atlanta, GA" },
  { concept: "Neapolitan sourdough pizza", city: "Portland, OR" },
];

const QUICK_CITIES = ["New York, NY", "Los Angeles, CA", "Chicago, IL", "Austin, TX", "Dallas, TX", "Atlanta, GA", "Miami, FL", "Seattle, WA"];

const PRICE_LABEL = ["", "$", "$$", "$$$", "$$$$"];

type CityResult = { city: string; data?: PilotPackage; error?: string };

export default function Home() {
  const [concept, setConcept] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const [cityDraft, setCityDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CityResult[]>([]);
  const [activeCity, setActiveCity] = useState<string | null>(null);

  function addCity(raw: string) {
    const value = raw.trim();
    if (!value) return;
    setCities((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setCityDraft("");
  }

  function removeCity(value: string) {
    setCities((prev) => prev.filter((c) => c !== value));
  }

  function toggleQuickCity(value: string) {
    setCities((prev) => (prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]));
  }

  function handleCityKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addCity(cityDraft);
    } else if (e.key === "Backspace" && cityDraft === "" && cities.length > 0) {
      removeCity(cities[cities.length - 1]);
    }
  }

  async function runComparison(c: string, cities: string[]) {
    setLoading(true);
    setError(null);
    setResults([]);
    setActiveCity(null);
    try {
      const settled = await Promise.all(
        cities.map(async (cty): Promise<CityResult> => {
          try {
            const res = await fetch("/api/analyze", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ concept: c, city: cty }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Request failed");
            return { city: cty, data };
          } catch (err) {
            return { city: cty, error: err instanceof Error ? err.message : "Unknown error" };
          }
        })
      );
      setResults(settled);
      setActiveCity(settled.find((r) => r.data)?.city ?? settled[0]?.city ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pending = cityDraft.trim() ? [...cities, cityDraft.trim()] : cities;
    if (!concept.trim() || pending.length === 0) return;
    setCities(pending);
    setCityDraft("");
    runComparison(concept, pending);
  }

  function applyPreset(p: (typeof PRESETS)[number]) {
    setConcept(p.concept);
    setCities([p.city]);
    setCityDraft("");
    runComparison(p.concept, [p.city]);
  }

  const active = results.find((r) => r.city === activeCity);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white text-zinc-900 dark:from-black dark:to-zinc-950 dark:text-zinc-50">
      <main className="mx-auto max-w-4xl px-6 py-14">
        <header className="mb-10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Live Qloo taste graph — no mock data
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Dish-Market Fit Advisor</h1>
          <p className="mt-3 max-w-2xl text-zinc-600 dark:text-zinc-400">
            For chefs, food technologists, and restaurant operators: before you invest in a new dish or
            menu, test it here. Describe the concept you&apos;re considering and a city — get real
            candidate pilot venues, their actual audience affinity, and a launch plan, grounded in
            Qloo&apos;s taste graph instead of a guess.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">
              The dish/menu concept you want to validate — not what you feel like eating
            </label>
            <input
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="e.g. izakaya-style small plates"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">
              City or cities to pilot in — add one or more to compare them side by side
            </label>
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-2 shadow-sm focus-within:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
              {cities.map((c) => (
                <span
                  key={c}
                  className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                >
                  {c}
                  <button
                    type="button"
                    onClick={() => removeCity(c)}
                    className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                    aria-label={`Remove ${c}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                className="min-w-[140px] flex-1 bg-transparent px-1 py-1.5 text-sm outline-none"
                placeholder={cities.length === 0 ? "Type a city and press Enter…" : "Add another…"}
                value={cityDraft}
                onChange={(e) => setCityDraft(e.target.value)}
                onKeyDown={handleCityKeyDown}
                onBlur={() => addCity(cityDraft)}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUICK_CITIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleQuickCity(c)}
                  className={`rounded-full border px-2.5 py-0.5 text-xs transition ${
                    cities.includes(c)
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                      : "border-zinc-200 text-zinc-500 hover:border-zinc-400 dark:border-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  + {c}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="self-start rounded-xl bg-zinc-900 px-6 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {loading
              ? "Analyzing…"
              : cities.length > 1
              ? `Compare ${cities.length} cities`
              : "Analyze"}
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="self-center text-xs text-zinc-400">Try:</span>
          {PRESETS.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => applyPreset(p)}
              disabled={loading}
              className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600 transition hover:border-zinc-400 hover:text-zinc-900 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              {p.concept} · {p.city.split(",")[0]}
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-8 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        {loading && <LoadingSkeleton />}

        {results.length > 0 && !loading && (
          <div className="mt-10 flex flex-col gap-8">
            {results.length > 1 && <ComparisonSummary results={results} />}

            {results.length > 1 && (
              <div className="flex flex-wrap gap-2 border-b border-zinc-200 pb-3 dark:border-zinc-800">
                {results.map((r) => (
                  <button
                    key={r.city}
                    onClick={() => setActiveCity(r.city)}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                      activeCity === r.city
                        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {r.city}
                    {r.error && <span className="ml-1 text-red-400">⚠</span>}
                  </button>
                ))}
              </div>
            )}

            {active?.error && (
              <p className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                {active.error}
              </p>
            )}
            {active?.data && <Results result={active.data} />}
          </div>
        )}
      </main>
    </div>
  );
}

function dominantAgeLabel(demo?: Demographics): string {
  if (!demo) return "—";
  const entries = Object.entries(demo.age ?? {});
  if (entries.length === 0) return "—";
  const top = entries.sort((a, b) => b[1] - a[1])[0];
  return AGE_LABELS[top[0]] ?? top[0];
}

function genderLeanLabel(demo?: Demographics): string {
  if (!demo) return "—";
  const lean = (demo.gender?.male ?? 0) - (demo.gender?.female ?? 0);
  if (lean > 0.1) return "skews male";
  if (lean < -0.1) return "skews female";
  return "balanced";
}

interface CityStats {
  city: string;
  error?: string;
  venueCount: number;
  avgRating: number | null;
  demo?: Demographics;
  /** Simple composite used only to pick a headline city — more venues and higher ratings both count. */
  fitScore: number;
}

function computeStats(results: CityResult[]): CityStats[] {
  return results.map((r) => {
    const venues = r.data?.venues ?? [];
    const ratings = venues.map((v) => v.rating).filter((n): n is number => typeof n === "number");
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
    return {
      city: r.city,
      error: r.error,
      venueCount: venues.length,
      avgRating,
      demo: r.data?.aggregateDemographics,
      fitScore: venues.length * 2 + (avgRating ?? 0),
    };
  });
}

function ComparisonSummary({ results }: { results: CityResult[] }) {
  const stats = computeStats(results);
  const usable = stats.filter((s) => !s.error);
  const winner = usable.length > 0 ? [...usable].sort((a, b) => b.fitScore - a.fitScore)[0] : undefined;
  const maxVenues = Math.max(0, ...stats.map((s) => s.venueCount));
  const maxRating = Math.max(0, ...stats.map((s) => s.avgRating ?? 0));

  return (
    <Section title="City comparison" subtitle={`${results.length} cities analyzed for the same concept`}>
      {winner && usable.length > 1 && (
        <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          <strong>{winner.city}</strong> looks like the strongest fit — {winner.venueCount} matching venue
          {winner.venueCount === 1 ? "" : "s"}
          {winner.avgRating !== null ? ` averaging ★${winner.avgRating.toFixed(1)}` : ""}, vs.{" "}
          {usable
            .filter((s) => s.city !== winner.city)
            .map((s) => `${s.city} (${s.venueCount}${s.avgRating !== null ? `, ★${s.avgRating.toFixed(1)}` : ""})`)
            .join(", ")}
          .
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-2.5 font-medium">City</th>
              <th className="px-4 py-2.5 font-medium">Venues found</th>
              <th className="px-4 py-2.5 font-medium">Avg rating</th>
              <th className="px-4 py-2.5 font-medium">Dominant age group</th>
              <th className="px-4 py-2.5 font-medium">Gender skew</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {stats.map((s) => (
              <tr key={s.city} className={winner?.city === s.city ? "bg-emerald-50/60 dark:bg-emerald-950/30" : undefined}>
                <td className="px-4 py-2.5 font-medium">
                  {s.city}
                  {winner?.city === s.city && (
                    <span className="ml-1.5 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      BEST FIT
                    </span>
                  )}
                </td>
                <td className={`px-4 py-2.5 ${s.venueCount === maxVenues && maxVenues > 0 ? "font-semibold" : ""}`}>
                  {s.error ? "—" : s.venueCount}
                </td>
                <td className={`px-4 py-2.5 ${s.avgRating === maxRating && maxRating > 0 ? "font-semibold" : ""}`}>
                  {s.avgRating !== null ? `★ ${s.avgRating.toFixed(1)}` : "—"}
                </td>
                <td className="px-4 py-2.5">{dominantAgeLabel(s.demo)}</td>
                <td className="px-4 py-2.5">{genderLeanLabel(s.demo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function LoadingSkeleton() {
  return (
    <div className="mt-10 flex animate-pulse flex-col gap-8">
      <div className="h-6 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-40 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        ))}
      </div>
      <div className="h-24 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}

function Results({ result }: { result: PilotPackage }) {
  return (
    <div className="mt-10 flex flex-col gap-10">
      {result.limitations.length > 0 && (
        <section className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          <strong>Limitations</strong>
          <ul className="mt-1 list-inside list-disc">
            {result.limitations.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </section>
      )}

      {result.matchedTag && (
        <section>
          <p className="text-sm text-zinc-500">
            Matched Qloo tag:{" "}
            <span className="rounded-full border border-zinc-300 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
              {result.matchedTag.name}
            </span>{" "}
            <span className="text-xs text-zinc-400">({result.matchedTag.type.replace("urn:tag:", "")})</span>
          </p>
        </section>
      )}

      {result.aggregateDemographics && (
        <Section title="Audience affinity profile" subtitle={`Averaged across ${result.venues.length} matched venues`}>
          <DemographicsChart demo={result.aggregateDemographics} />
        </Section>
      )}

      <Section title={`Candidate pilot venues`} subtitle={`${result.venues.length} real, named venues in ${result.city}`}>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {result.venues.map((v, i) => (
            <VenueCard key={i} venue={v} rank={i + 1} />
          ))}
          {result.venues.length === 0 && (
            <p className="text-sm text-zinc-500">No matching venues found for this city/concept.</p>
          )}
        </div>
      </Section>

      {result.regionInsights.length > 0 && (
        <Section
          title="What this region's audience actually values"
          subtitle="Aggregated review-keyword mentions across matched venues — not complaints, just what gets talked about"
        >
          <div className="flex flex-wrap gap-2">
            {result.regionInsights.map((r, i) => (
              <span
                key={i}
                className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-700 dark:border-zinc-800 dark:text-zinc-300"
                title={`${r.mentions} mentions`}
              >
                {r.keyword} <span className="text-zinc-400">× {r.mentions}</span>
              </span>
            ))}
          </div>
        </Section>
      )}

      <Section title="Tasting concept brief">
        <TextBlock text={result.tastingBrief} />
      </Section>

      <Section title="4-week pilot plan">
        <ol className="flex flex-col gap-2">
          {result.pilotPlan.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-zinc-700 dark:text-zinc-300">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-semibold text-white dark:bg-white dark:text-zinc-900">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Venue owner outreach letter">
        <TextBlock text={result.ownerLetter} highlighted copyable />
      </Section>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">{title}</h2>
        {subtitle && <p className="text-xs text-zinc-400">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function TextBlock({ text, highlighted, copyable }: { text: string; highlighted?: boolean; copyable?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      className={`relative rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap ${
        highlighted
          ? "bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
          : "text-zinc-700 dark:text-zinc-300"
      }`}
    >
      {copyable && (
        <button
          onClick={() => {
            navigator.clipboard.writeText(text).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="absolute right-3 top-3 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-600 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      )}
      {text}
    </div>
  );
}

function DemographicsChart({ demo }: { demo: Demographics }) {
  const ageEntries = Object.entries(demo.age ?? {});
  const maxAbs = Math.max(0.01, ...ageEntries.map(([, v]) => Math.abs(v)));
  const male = demo.gender?.male ?? 0;
  const female = demo.gender?.female ?? 0;
  const genderMax = Math.max(0.01, Math.abs(male), Math.abs(female));

  return (
    <div className="grid grid-cols-1 gap-6 rounded-xl border border-zinc-200 p-5 sm:grid-cols-5 dark:border-zinc-800">
      <div className="sm:col-span-3">
        <p className="mb-3 text-xs font-medium text-zinc-500">Age affinity (relative to general population)</p>
        <div className="flex flex-col gap-2">
          {ageEntries.map(([bucket, value]) => (
            <div key={bucket} className="flex items-center gap-3">
              <span className="w-12 shrink-0 text-xs text-zinc-500">{AGE_LABELS[bucket] ?? bucket}</span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                  className={`h-full rounded-full ${value >= 0 ? "bg-emerald-500" : "bg-rose-400"}`}
                  style={{ width: `${(Math.abs(value) / maxAbs) * 100}%`, marginLeft: value < 0 ? "0" : undefined }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-xs text-zinc-400">{value.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="sm:col-span-2">
        <p className="mb-3 text-xs font-medium text-zinc-500">Gender skew</p>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-xs text-zinc-500">Male</span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div className="h-full rounded-full bg-sky-500" style={{ width: `${(Math.abs(male) / genderMax) * 100}%` }} />
            </div>
            <span className="w-10 shrink-0 text-right text-xs text-zinc-400">{male.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-xs text-zinc-500">Female</span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div className="h-full rounded-full bg-pink-500" style={{ width: `${(Math.abs(female) / genderMax) * 100}%` }} />
            </div>
            <span className="w-10 shrink-0 text-right text-xs text-zinc-400">{female.toFixed(2)}</span>
          </div>
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-zinc-400">
          Scores are Qloo affinity deltas vs. the general population for people who like these venues — not a
          prediction about any individual.
        </p>
      </div>
    </div>
  );
}

function VenueCard({ venue, rank }: { venue: VenueCandidate; rank: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      {venue.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={venue.imageUrl} alt={venue.name} className="h-36 w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-36 w-full items-center justify-center bg-zinc-100 text-zinc-300 dark:bg-zinc-900">
          No image
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium leading-tight">
            <span className="mr-1.5 text-xs text-zinc-400">#{rank}</span>
            {venue.name}
          </h3>
          <div className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-500">
            {venue.rating && <span>★ {venue.rating.toFixed(1)}</span>}
            {venue.priceLevel ? <span>{PRICE_LABEL[venue.priceLevel]}</span> : null}
          </div>
        </div>
        {venue.address && <p className="mt-1 text-xs text-zinc-500">{venue.address}</p>}
        {venue.description && <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{venue.description}</p>}
        {venue.vibeTags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {venue.vibeTags.map((t, j) => (
              <span
                key={j}
                className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
              >
                {t}
              </span>
            ))}
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {venue.phone && (
            <a
              href={`tel:${venue.phone}`}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900"
            >
              ☎ {venue.phone}
            </a>
          )}
          {venue.website && (
            <a
              href={venue.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-zinc-500 underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Website ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
