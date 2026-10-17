"use client";

import { useCallback, useRef, useState } from "react";
import type { CityResult } from "@/components/types";
import type { Details } from "@/lib/input";

// Cities are kicked off together, but the actual Qloo rate limiting happens server-side
// (lib/qloo.ts serializes every outbound call through one queue and retries on 429), so this
// is only about how many requests are in flight to our own API.
const CITY_CONCURRENCY = 6;

async function analyzeOneCity(
  concept: string,
  city: string,
  details: Details,
  onUnauthorized: () => void,
): Promise<CityResult> {
  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ concept, city, details }),
    });
    const data = await res.json();
    if (res.status === 401) onUnauthorized();
    if (!res.ok) throw new Error(data.error ?? "Request failed");
    return { city, data };
  } catch (err) {
    return {
      city,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Runs one concept across one or more cities. Results are exposed as each city finishes, in the
 * order the cities were asked for, so the first finished city can be read while others still run.
 */
export function useComparison(
  onUnauthorized: () => void,
  onFirstResult?: () => void,
) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CityResult[]>([]);
  const [requested, setRequested] = useState<string[]>([]);
  const [concept, setConcept] = useState("");
  const [runDetails, setRunDetails] = useState<Details>({});
  const [activeCity, setActiveCity] = useState<string | null>(null);
  const runId = useRef(0);

  const run = useCallback(
    async (
      nextConcept: string,
      cities: string[],
      nextDetails: Details = {},
    ) => {
      const id = ++runId.current;
      setLoading(true);
      setResults([]);
      setActiveCity(null);
      setConcept(nextConcept);
      setRunDetails(nextDetails);
      setRequested(cities);
      const queue = [...cities];
      let first = true;
      async function worker() {
        while (queue.length > 0) {
          const city = queue.shift();
          if (!city) return;
          const r = await analyzeOneCity(
            nextConcept,
            city,
            nextDetails,
            onUnauthorized,
          );
          if (id !== runId.current) return; // a newer run replaced this one
          setResults((prev) => [...prev, r]);
          if (first) {
            first = false;
            setActiveCity((current) => current ?? r.city);
            onFirstResult?.();
          }
        }
      }
      await Promise.all(
        Array.from(
          { length: Math.min(CITY_CONCURRENCY, cities.length) },
          worker,
        ),
      );
      if (id !== runId.current) return;
      setActiveCity((current) => current ?? cities[0] ?? null);
      setLoading(false);
    },
    [onUnauthorized, onFirstResult],
  );

  /** Re-run a single city, e.g. one that failed on a rate limit. */
  const retry = useCallback(
    async (city: string) => {
      const id = runId.current;
      setResults((prev) => prev.filter((r) => r.city !== city));
      setLoading(true);
      const r = await analyzeOneCity(concept, city, runDetails, onUnauthorized);
      if (id !== runId.current) return;
      setResults((prev) => [...prev, r]);
      setLoading(false);
    },
    [concept, runDetails, onUnauthorized],
  );

  const reset = useCallback(() => {
    runId.current++;
    setResults([]);
    setRequested([]);
    setActiveCity(null);
    setLoading(false);
  }, []);

  const ordered = [...results].sort(
    (a, b) => requested.indexOf(a.city) - requested.indexOf(b.city),
  );
  return {
    loading,
    results: ordered,
    requested,
    concept,
    activeCity,
    setActiveCity,
    run,
    retry,
    reset,
  };
}
