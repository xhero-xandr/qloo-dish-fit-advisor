import { coreAgeLabel, genderLean } from "@/lib/audience";
import { Citations } from "./Citations";
import { PRICE_LABEL } from "./constants";
import type { PilotPackage } from "./types";

/** The agent's reasoning next to the venue it suggests, so the "why" and the "where" are read together. */
export function WhyAndWhere({
  result,
  recommendedIndex,
}: {
  result: PilotPackage;
  recommendedIndex: number;
}) {
  const analysis = result.agent?.analysis;
  const facts = new Map((result.agent?.facts ?? []).map((f) => [f.id, f]));
  const venue =
    recommendedIndex >= 0 ? result.venues[recommendedIndex] : undefined;
  if (!analysis?.verdict && !venue) return null;
  const guests = venue?.demographics
    ? [coreAgeLabel(venue.demographics), genderLean(venue.demographics)]
        .filter(Boolean)
        .join(", ")
    : undefined;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-semibold">Why</h2>
        {analysis?.verdict ? (
          <p className="mt-2 leading-relaxed text-zinc-800 dark:text-zinc-200">
            {analysis.verdict.text}
            <Citations ids={analysis.verdict.facts} facts={facts} />
          </p>
        ) : (
          <p className="mt-2 text-zinc-500">
            The agent was unavailable, so there is no written verdict this time.
          </p>
        )}
        {analysis && analysis.risks.length > 0 && (
          <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
            <p className="font-semibold">Watch out</p>
            <ul className="mt-1 flex flex-col gap-1">
              {analysis.risks.map((r, i) => (
                <li key={i}>
                  {r.text}
                  <Citations ids={r.facts} facts={facts} />
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis && analysis.menuNotes.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-semibold">For the tasting menu</p>
            <ul className="mt-1 flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
              {analysis.menuNotes.map((n, i) => (
                <li key={i}>
                  {n.text}
                  <Citations ids={n.facts} facts={facts} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {venue && (
        <section className="flex flex-col gap-2 rounded-2xl border border-accent-200 bg-accent-50 p-5 dark:border-accent-900 dark:bg-accent-950/50">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-800 dark:text-accent-300">
            Where to pilot
          </p>
          <h2 className="text-xl font-semibold">{venue.name}</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {[
              venue.address,
              venue.rating ? `★ ${venue.rating.toFixed(1)}` : undefined,
              venue.priceLevel ? PRICE_LABEL[venue.priceLevel] : undefined,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {analysis?.recommendedVenue && (
            <p className="text-[15px] leading-relaxed">
              {analysis.recommendedVenue.why}
              <Citations ids={analysis.recommendedVenue.facts} facts={facts} />
            </p>
          )}
          {venue.hours && (
            <p className="text-sm">
              <strong className="font-semibold">Open:</strong> {venue.hours}
            </p>
          )}
          {guests && (
            <p className="text-sm">
              <strong className="font-semibold">Its guests:</strong> {guests}
            </p>
          )}
          {venue.guests && venue.guests.length > 0 && (
            <p className="text-sm">
              <strong className="font-semibold">Known to draw:</strong>{" "}
              {venue.guests.slice(0, 4).join(", ")}
            </p>
          )}
          <a
            href="#venues"
            className="no-print mt-auto pt-2 text-sm font-medium text-accent-700 underline underline-offset-2 dark:text-accent-400"
          >
            Compare all {result.venues.length} venues
          </a>
        </section>
      )}
    </div>
  );
}
