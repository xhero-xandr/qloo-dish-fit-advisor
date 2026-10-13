import { AGE_LABELS } from "./constants";
import { Section } from "./Section";
import type { CityResult, Demographics } from "./types";

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

export function ComparisonSummary({ results }: { results: CityResult[] }) {
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
            {stats.map((s) =>
              s.error ? (
                <tr key={s.city}>
                  <td className="px-4 py-2.5 font-medium">{s.city}</td>
                  <td colSpan={4} className="px-4 py-2.5 text-xs text-red-500" title={s.error}>
                    ⚠ {s.error}
                  </td>
                </tr>
              ) : (
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
                    {s.venueCount}
                  </td>
                  <td className={`px-4 py-2.5 ${s.avgRating === maxRating && maxRating > 0 ? "font-semibold" : ""}`}>
                    {s.avgRating !== null ? `★ ${s.avgRating.toFixed(1)}` : "—"}
                  </td>
                  <td className="px-4 py-2.5">{dominantAgeLabel(s.demo)}</td>
                  <td className="px-4 py-2.5">{genderLeanLabel(s.demo)}</td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
