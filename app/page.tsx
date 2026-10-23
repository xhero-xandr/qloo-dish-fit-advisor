"use client";

import { useCallback, useRef, useState } from "react";
import { AppBar } from "@/components/AppBar";
import { AnalyzerForm } from "@/components/AnalyzerForm";
import { ComparisonSummary } from "@/components/ComparisonSummary";
import { EmptyState } from "@/components/EmptyState";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { LoginPanel } from "@/components/LoginPanel";
import { MethodologyDetails } from "@/components/MethodologyDetails";
import { Results } from "@/components/Results";
import { RunSummary } from "@/components/RunSummary";
import { Button } from "@/components/ui";
import type { Details } from "@/lib/input";
import { useComparison } from "@/hooks/useComparison";
import { useSession } from "@/hooks/useSession";

const SIGNED_OUT_GRID =
  "grid gap-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start";

export default function Home() {
  const { auth, authRequired, demo, refresh, signOut } = useSession();
  const [concept, setConcept] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const [details, setDetails] = useState<Details>({});
  const [editing, setEditing] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  // On a phone the results start well below the form; bring the first finished city into view.
  const scrollToResults = useCallback(() => {
    setTimeout(
      () =>
        resultsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      60,
    );
  }, []);

  const comparison = useComparison(refresh, scrollToResults);
  const { loading, results, requested, activeCity, setActiveCity } = comparison;
  const active = results.find((r) => r.city === activeCity);
  const showForm = results.length === 0 || editing;

  function run(
    nextConcept: string,
    nextCities: string[],
    nextDetails: Details,
  ) {
    setEditing(false);
    comparison.run(nextConcept, nextCities, nextDetails);
  }

  async function handleSignOut() {
    comparison.reset();
    await signOut();
  }

  return (
    <div className="min-h-screen text-zinc-900 dark:text-zinc-50">
      <main className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8 print:max-w-none print:p-0">
        <AppBar
          signedIn={auth === "ok" && authRequired}
          onSignOut={handleSignOut}
        />
        {auth === "checking" && (
          // Same grid as the signed-out view, so nothing jumps once the session answer arrives.
          <div className={SIGNED_OUT_GRID}>
            <Hero />
            <div
              className="no-print h-64 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900"
              aria-hidden
            />
          </div>
        )}

        {auth === "required" && (
          <div className="no-print">
            <div className={SIGNED_OUT_GRID}>
              <Hero />
              <LoginPanel demo={demo} onSignedIn={refresh} />
            </div>
            <HowItWorks />
            <div className="mt-8">
              <MethodologyDetails />
            </div>
          </div>
        )}

        {auth === "ok" && (
          <div className="flex flex-col gap-8">
            {showForm ? (
              <>
                {results.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="no-print self-start text-sm font-medium text-accent-700 underline underline-offset-2 dark:text-accent-400"
                  >
                    ← Back to the results
                  </button>
                )}
                <AnalyzerForm
                  concept={concept}
                  setConcept={setConcept}
                  cities={cities}
                  setCities={setCities}
                  details={details}
                  setDetails={setDetails}
                  loading={loading}
                  onRun={run}
                />
                {results.length === 0 && (
                  <div className="no-print flex flex-col gap-4">
                    <EmptyState />
                    <MethodologyDetails />
                  </div>
                )}
              </>
            ) : (
              <>
                <RunSummary
                  concept={concept}
                  cities={requested}
                  onEdit={() => {
                    setEditing(true);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
                {loading && results.length === 0 && (
                  <LoadingSkeleton cities={requested.length || 1} />
                )}
                {results.length > 0 && (
                  <div
                    ref={resultsRef}
                    className="print-surface fade-up flex scroll-mt-4 flex-col gap-10"
                  >
                    {loading && (
                      <p
                        role="status"
                        aria-live="polite"
                        className="no-print rounded-xl border border-accent-200 bg-accent-50 px-4 py-2.5 text-sm text-accent-900 dark:border-accent-900 dark:bg-accent-950/60 dark:text-accent-200"
                      >
                        {results.length} of {requested.length}{" "}
                        {requested.length === 1 ? "city" : "cities"} ready — the
                        rest are still running and will appear here.
                      </p>
                    )}

                    {results.length > 1 && !loading && (
                      <ComparisonSummary results={results} />
                    )}

                    {(results.length > 1 || requested.length > 1) && (
                      <div className="no-print flex flex-wrap gap-2 border-b border-zinc-200 pb-3 dark:border-zinc-800">
                        {results.map((r) => (
                          <button
                            key={r.city}
                            onClick={() => setActiveCity(r.city)}
                            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                              activeCity === r.city
                                ? "bg-accent-600 text-white"
                                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                            }`}
                          >
                            {r.city}
                            {r.error && (
                              <span
                                className="ml-1"
                                title={r.error}
                                aria-label="failed"
                              >
                                ⚠
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {active?.error && (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                        <p>{active.error}</p>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={loading}
                          onClick={() => comparison.retry(active.city)}
                          className="px-3 py-1.5 text-xs"
                        >
                          Try {active.city} again
                        </Button>
                      </div>
                    )}
                    {active?.data && (
                      <>
                        <Results
                          result={active.data}
                          cityCount={requested.length}
                          busy={loading}
                          onEditMenu={() => {
                            setEditing(true);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          onRetag={(tag) => {
                            const rest = { ...(active.data?.details ?? {}) };
                            delete rest.tag;
                            run(
                              active.data!.concept,
                              requested,
                              tag ? { ...rest, tag } : rest,
                            );
                          }}
                        />
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
