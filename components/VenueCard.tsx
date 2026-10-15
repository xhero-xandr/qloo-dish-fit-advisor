import { PRICE_LABEL } from "./constants";
import type { VenueCandidate } from "./types";

/** "+15125319142" -> "(512) 531-9142"; anything else is shown as Qloo gave it. */
function formatPhone(phone: string): string {
  const m = phone.match(/^\+?1?(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : phone;
}

export function VenueCard({ venue, rank, recommended }: { venue: VenueCandidate; rank: number; recommended?: boolean }) {
  return (
    <div
      className={`overflow-hidden rounded-xl border bg-white shadow-sm dark:bg-zinc-950 ${
        recommended
          ? "border-emerald-400 ring-2 ring-emerald-200 dark:border-emerald-700 dark:ring-emerald-900"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      {venue.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={venue.imageUrl} alt={venue.name} className="h-36 w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-36 w-full items-center justify-center bg-zinc-100 text-zinc-300 dark:bg-zinc-900">
          No image
        </div>
      )}
      <div className="p-4">
        {recommended && (
          <p className="mb-2 inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            Recommended for the pilot
          </p>
        )}
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
        {venue.hours && <p className="mt-0.5 text-xs text-zinc-400">🕑 {venue.hours}</p>}
        {venue.description && <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{venue.description}</p>}
        {venue.dietaryOptions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {venue.dietaryOptions.map((d, j) => (
              <span
                key={j}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                title="Dietary option listed by Qloo for this venue"
              >
                🌱 {d}
              </span>
            ))}
          </div>
        )}
        {venue.reviewKeywords.length > 0 && (
          <p className="mt-2 text-xs text-zinc-500">
            <span className="text-zinc-400">Reviews mention:</span>{" "}
            {venue.reviewKeywords.map((k) => `${k.keyword} (${k.mentions})`).join(", ")}
          </p>
        )}
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
              ☎ {formatPhone(venue.phone)}
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
