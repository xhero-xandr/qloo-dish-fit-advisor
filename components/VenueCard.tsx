import { AGE_BUCKETS, coreAgeLabel, genderLean, levelOf } from "@/lib/audience";
import { LEVEL_STYLE } from "./AudienceSection";
import { AGE_LABELS, PRICE_LABEL } from "./constants";
import type { VenueCandidate } from "./types";

const DAY_LETTERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** "+15125319142" -> "(512) 531-9142"; anything else is shown as Qloo gave it. */
function formatPhone(phone: string): string {
  const m = phone.match(/^\+?1?(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : phone;
}

/** "11:00–22:00" -> "11–22", to fit a day cell on a phone. */
function shortHours(text: string): string {
  return text.replace(/:00/g, "");
}

/** A venue as a pilot candidate: when it is open, who its guests are, what reviews mention, and a button to choose it. */
export function VenueCard({
  venue,
  rank,
  recommended,
  chosen,
  onChoose,
}: {
  venue: VenueCandidate;
  rank: number;
  recommended?: boolean;
  chosen?: boolean;
  onChoose?: () => void;
}) {
  const d = venue.demographics;
  return (
    <article
      className={`flex flex-col gap-4 rounded-2xl bg-white p-5 dark:bg-zinc-950 ${
        chosen
          ? "border-2 border-accent-500"
          : "border border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <div className="flex flex-wrap items-start gap-3">
        {venue.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={venue.imageUrl}
            alt=""
            className="h-12 w-12 shrink-0 rounded-xl object-cover sm:h-16 sm:w-16"
            loading="lazy"
          />
        )}
        <div className="min-w-0 flex-1 basis-40">
          {recommended && (
            <p className="text-[11px] font-semibold uppercase tracking-widest text-accent-700 dark:text-accent-400">
              Agent&apos;s pick
            </p>
          )}
          <h3 className="text-lg font-semibold leading-snug">
            <span className="mr-1.5 text-sm font-normal text-zinc-400">
              #{rank}
            </span>
            {venue.name}
          </h3>
          <p className="text-sm text-zinc-500">
            {[
              venue.address,
              venue.rating ? `★ ${venue.rating.toFixed(1)}` : undefined,
              venue.priceLevel ? PRICE_LABEL[venue.priceLevel] : undefined,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {onChoose && (
          <button
            type="button"
            onClick={onChoose}
            aria-pressed={chosen}
            className={`no-print min-h-[44px] shrink-0 rounded-xl px-3.5 text-sm font-semibold max-sm:w-full ${
              chosen
                ? "bg-accent-600 text-white"
                : "border border-zinc-300 bg-white hover:border-accent-400 dark:border-zinc-700 dark:bg-zinc-900"
            }`}
          >
            {chosen ? "Chosen" : "Choose"}
          </button>
        )}
      </div>

      {venue.openingDays && (
        <div>
          <p className="mb-1 text-xs font-medium text-zinc-500">Open</p>
          <ul className="grid grid-cols-7 gap-1 text-center">
            {venue.openingDays.map((h, i) => {
              const open = h !== "closed" && h !== "unknown";
              return (
                <li
                  key={i}
                  title={`${DAY_LETTERS[i]}: ${h}`}
                  className={`rounded-md px-0.5 py-1 ${
                    open
                      ? "bg-accent-50 text-accent-950 dark:bg-accent-950/60 dark:text-accent-100"
                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-900"
                  }`}
                >
                  <span className="block text-xs font-semibold">
                    {DAY_LETTERS[i]}
                  </span>
                  <span className="block text-[11px] leading-tight">
                    {open ? shortHours(h) : h === "closed" ? "closed" : "?"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {d && (
        <div>
          <p className="mb-1 text-xs font-medium text-zinc-500">
            Its guests:{" "}
            <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
              {coreAgeLabel(d) ?? "no age group stands out"}
            </strong>
            , {genderLean(d)}
          </p>
          <ul
            className="grid grid-cols-6 gap-1 text-center"
            aria-label="Age groups compared with the average person"
          >
            {AGE_BUCKETS.map((b) => {
              const level = levelOf(d.age?.[b] ?? 0);
              return (
                <li
                  key={b}
                  title={`${AGE_LABELS[b]}: ${level}`}
                  className={`rounded-md py-1 text-[11px] ${LEVEL_STYLE[level]}`}
                >
                  <span className="block font-semibold">{AGE_LABELS[b]}</span>
                  <span className="block leading-tight">
                    {level === "about average" ? "avg" : level}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {venue.reviewKeywords.length > 0 && (
        <p className="text-sm">
          <span className="text-zinc-500">Reviews mention:</span>{" "}
          {venue.reviewKeywords
            .map((k) => `${k.keyword} (${k.mentions})`)
            .join(", ")}
        </p>
      )}
      {venue.dietaryOptions.length > 0 && (
        <p className="text-sm">
          <span className="text-zinc-500">Dietary options:</span>{" "}
          {venue.dietaryOptions.join(", ")}
        </p>
      )}
      {venue.description && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {venue.description}
        </p>
      )}

      {(venue.phone || venue.website) && (
        <div className="mt-auto flex flex-wrap items-center gap-3 text-sm">
          {venue.phone && (
            <a
              href={`tel:${venue.phone}`}
              className="font-medium text-accent-700 underline underline-offset-2 dark:text-accent-400"
            >
              {formatPhone(venue.phone)}
            </a>
          )}
          {venue.website && (
            <a
              href={venue.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Website ↗
            </a>
          )}
        </div>
      )}
    </article>
  );
}
