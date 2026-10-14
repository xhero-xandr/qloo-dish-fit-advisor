"use client";

import { useState } from "react";
import { ComparisonSummary } from "@/components/ComparisonSummary";
import { PRESETS, QUICK_CITIES } from "@/components/constants";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { MethodologyDetails } from "@/components/MethodologyDetails";
import { Results } from "@/components/Results";
import type { CityResult } from "@/components/types";

export default function Home() {
  const [concept, setConcept] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const [cityDraft, setCityDraft] = useState("");
  const [loading, setLoading] = useState(false);
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

  // Cities are kicked off together, but the actual Qloo rate limiting happens
  // server-side (lib/qloo.ts serializes every outbound call through one queue
  // and retries on 429 instead of failing), so this concurrency is just about
  // how many requests are in flight to our own API, not a rate-limit workaround.
  // Results stream in as each city finishes rather than waiting on all of them.
  const CITY_CONCURRENCY = 6;

  async function analyzeOneCity(c: string, cty: string): Promise<CityResult> {
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
  }

  async function runComparison(c: string, cities: string[]) {
    setLoading(true);
    setResults([]);
    setActiveCity(null);
    const queue = [...cities];
    let firstSet = false;
    // analyzeOneCity never throws — per-city failures land in that city's result.
    async function worker() {
      while (queue.length > 0) {
        const cty = queue.shift();
        if (!cty) return;
        const r = await analyzeOneCity(c, cty);
        setResults((prev) => [...prev, r]);
        if (!firstSet && r.data) {
          firstSet = true;
          setActiveCity(r.city);
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CITY_CONCURRENCY, cities.length) }, worker));
    setActiveCity((current) => current ?? cities[0] ?? null);
    setLoading(false);
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
      <main className="mx-auto max-w-4xl px-6 py-14 print:max-w-none print:p-0">
        <header className="mb-10 no-print">
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

          <MethodologyDetails />
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 no-print">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">
              The dish/menu concept you want to validate — not what you feel like eating
            </label>
            <input
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="e.g. izakaya-style small plates"
              value={concept}
              maxLength={200}
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
                maxLength={100}
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

        <div className="mt-4 flex flex-wrap gap-2 no-print">
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

        {loading && <LoadingSkeleton />}

        {results.length > 0 && !loading && (
          <div className="print-surface mt-10 flex flex-col gap-8">
            {results.length > 1 && <ComparisonSummary results={results} />}

            {results.length > 1 && (
              <div className="no-print flex flex-wrap gap-2 border-b border-zinc-200 pb-3 dark:border-zinc-800">
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
                    {r.error && (
                      <span className="ml-1 text-red-400" title={r.error}>
                        ⚠
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {active?.error && (
              <p className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                {active.error}
              </p>
            )}
            {active?.data && (
              <>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="no-print self-start rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  🖨 Print / Save as PDF
                </button>
                <div className="hidden print:block">
                  <h1 className="text-xl font-semibold">Pilot package: &quot;{active.data.concept}&quot;</h1>
                  <p className="text-sm text-zinc-500">{active.data.city} · generated by Dish-Market Fit Advisor, grounded in live Qloo data</p>
                  <hr className="my-4" />
                </div>
                <Results result={active.data} />
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
