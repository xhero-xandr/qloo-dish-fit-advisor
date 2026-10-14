import { PRICE_LABEL } from "./constants";
import type { VenueCandidate } from "./types";

export function VenueCard({ venue, rank }: { venue: VenueCandidate; rank: number }) {
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
