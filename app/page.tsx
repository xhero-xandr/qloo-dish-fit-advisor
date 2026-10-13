"use client";

import { useState } from "react";

interface VenueCandidate {
  name: string;
  address?: string;
  rating?: number;
  priceLevel?: number | null;
  description?: string;
  website?: string;
  vibeTags: string[];
}

interface PilotPackage {
  concept: string;
  city: string;
  resolvedTags: { id: string; name: string; type: string }[];
  venues: VenueCandidate[];
  audienceProfile: string;
  tastingBrief: string;
  pilotPlan: string[];
  ownerLetter: string;
  limitations: string[];
}

export default function Home() {
  const [concept, setConcept] = useState("izakaya-style small plates");
  const [city, setCity] = useState("Austin, TX");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PilotPackage | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concept, city }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-50">
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">Dish-Market Fit Advisor</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Powered by Qloo&apos;s cultural taste graph. Describe a dish or menu concept and a city —
          get a real audience profile, candidate pilot venues, and a launch plan grounded in actual
          taste-affinity data, not guesses.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4 sm:flex-row">
          <input
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="Dish or menu concept (e.g. izakaya-style small plates)"
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            required
          />
          <input
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm sm:w-56 dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        </form>

        {error && (
          <p className="mt-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        {result && (
          <div className="mt-10 flex flex-col gap-8">
            {result.limitations.length > 0 && (
              <section className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                <strong>Limitations:</strong>
                <ul className="mt-1 list-inside list-disc">
                  {result.limitations.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              </section>
            )}

            <Section title="Resolved Qloo tags">
              <div className="flex flex-wrap gap-2">
                {result.resolvedTags.map((t) => (
                  <span
                    key={t.id}
                    className="rounded-full border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-700"
                    title={t.id}
                  >
                    {t.name} <span className="text-zinc-400">({t.type.replace("urn:tag:", "")})</span>
                  </span>
                ))}
              </div>
            </Section>

            <Section title="Audience profile">
              <pre className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{result.audienceProfile}</pre>
            </Section>

            <Section title={`Candidate pilot venues (${result.venues.length})`}>
              <div className="flex flex-col gap-4">
                {result.venues.map((v, i) => (
                  <div key={i} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                    <div className="flex items-baseline justify-between">
                      <h3 className="font-medium">{v.name}</h3>
                      {v.rating && <span className="text-sm text-zinc-500">★ {v.rating.toFixed(1)}</span>}
                    </div>
                    {v.address && <p className="mt-1 text-sm text-zinc-500">{v.address}</p>}
                    {v.description && <p className="mt-2 text-sm">{v.description}</p>}
                    {v.vibeTags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {v.vibeTags.map((t, j) => (
                          <span key={j} className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {result.venues.length === 0 && (
                  <p className="text-sm text-zinc-500">No matching venues found for this city/concept.</p>
                )}
              </div>
            </Section>

            <Section title="Tasting concept brief">
              <pre className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{result.tastingBrief}</pre>
            </Section>

            <Section title="Pilot plan">
              <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                {result.pilotPlan.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </Section>

            <Section title="Venue owner outreach letter">
              <pre className="whitespace-pre-wrap rounded-lg bg-zinc-100 p-4 text-sm dark:bg-zinc-900">{result.ownerLetter}</pre>
            </Section>
          </div>
        )}
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">{title}</h2>
      {children}
    </section>
  );
}
