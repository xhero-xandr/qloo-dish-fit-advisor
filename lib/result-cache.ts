// A small in-memory cache for finished analyses. Identical requests reuse a result instead of
// re-spending Qloo and Gemini quota, and a second request for something already running joins that run.

export interface CacheOptions {
  ttlMs: number;
  /** A result computed without the agent (a transient outage) is kept for a shorter time. */
  degradedTtlMs: number;
  maxEntries: number;
  now?: () => number;
}

interface Entry<T> {
  data: T;
  fetchedAt: number;
  expiresAt: number;
}

export function cacheKey(concept: string, city: string, details?: unknown): string {
  const base = `${concept.trim().toLowerCase()}::${city.trim().toLowerCase()}`;
  return details ? `${base}::${JSON.stringify(details)}` : base;
}

export function createResultCache<T>(options: CacheOptions) {
  const now = options.now ?? Date.now;
  const entries = new Map<string, Entry<T>>();
  const inFlight = new Map<string, Promise<{ data: T; cachedAt?: string }>>();

  function store(key: string, data: T, degraded: boolean) {
    if (entries.size >= options.maxEntries) {
      for (const [k, v] of entries) if (v.expiresAt <= now()) entries.delete(k);
      if (entries.size >= options.maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest !== undefined) entries.delete(oldest);
      }
    }
    const t = now();
    entries.set(key, { data, fetchedAt: t, expiresAt: t + (degraded ? options.degradedTtlMs : options.ttlMs) });
  }

  /** The cached result (with when it was fetched), a run already in progress, or a fresh `compute()`. */
  async function getOrCompute(
    key: string,
    compute: () => Promise<T>,
    isDegraded: (data: T) => boolean = () => false
  ): Promise<{ data: T; cachedAt?: string }> {
    const hit = entries.get(key);
    if (hit && hit.expiresAt > now()) return { data: hit.data, cachedAt: new Date(hit.fetchedAt).toISOString() };

    const pending = inFlight.get(key);
    if (pending) return pending;

    const run = compute().then((data) => {
      store(key, data, isDegraded(data));
      return { data };
    });
    inFlight.set(key, run);
    try {
      return await run;
    } finally {
      inFlight.delete(key);
    }
  }

  return { getOrCompute, size: () => entries.size };
}
