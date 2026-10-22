import type { PilotPackage } from "./types";

type Tag = { id: string; name: string };

const PICKED_BY = {
  agent: "Picked by the agent from Qloo's categories.",
  rules:
    "Picked by rule-based matching, because the agent was unavailable or its pick had too few venues here.",
  you: "You picked this category.",
} as const;

function kind(type: string): string {
  const parts = type.replace("urn:tag:", "").split(":");
  return parts[0] === "genre" ? (parts[1] ?? parts[0]) : parts[0];
}

/** How the description was read as a Qloo category, with the other categories found, so the chef can correct it. */
export function TagChoice({
  result,
  cityCount,
  busy,
  onRetag,
}: {
  result: PilotPackage;
  cityCount: number;
  busy: boolean;
  onRetag?: (tag?: Tag) => void;
}) {
  const choice = result.tagChoice;
  // A chosen category with no venues has no matched tag, but the choice still has to be shown and undoable.
  const tag =
    result.matchedTag ??
    (result.details?.tag
      ? {
          ...result.details.tag,
          type: result.details.tag.id.slice(
            0,
            result.details.tag.id.lastIndexOf(":"),
          ),
        }
      : undefined);
  if (!tag) return null;
  const candidates = choice?.candidates ?? [];
  return (
    <section className="no-print rounded-xl border border-zinc-200 px-5 py-4 dark:border-zinc-800">
      <p className="text-sm">
        We read your dish as{" "}
        <span className="rounded-full bg-accent-100 px-2.5 py-0.5 font-semibold text-accent-900 dark:bg-accent-950 dark:text-accent-200">
          {tag.name}
        </span>{" "}
        <span className="text-xs text-zinc-500">({kind(tag.type)})</span>
      </p>
      {choice && (
        <p className="mt-1 text-xs text-zinc-500">
          {PICKED_BY[choice.chosenBy]}
          {choice.chosenBy === "you" && onRetag && (
            <>
              {" "}
              <button
                type="button"
                disabled={busy}
                onClick={() => onRetag(undefined)}
                className="font-medium text-accent-700 underline underline-offset-2 hover:text-accent-800 disabled:opacity-50 dark:text-accent-400"
              >
                Let the agent choose again
              </button>
            </>
          )}
        </p>
      )}
      {onRetag && candidates.length > 0 && (
        <div className="mt-3">
          {candidates.every((c) => c.venueCount === 0) && (
            <p className="mb-1.5 text-xs text-zinc-500">
              The other categories found for your description have no venues
              in {result.city}, so this one is the only workable match here.
            </p>
          )}
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Not the right kind of food? Try another category
            {cityCount > 1 ? ` (re-runs all ${cityCount} cities)` : ""}:
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {candidates.map((c) => {
              const none = c.venueCount === 0;
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={busy || none}
                  onClick={() => onRetag({ id: c.id, name: c.name })}
                  title={none ? `No venues in ${result.city}` : kind(c.type)}
                  className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-700 transition hover:border-accent-400 hover:text-accent-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-300 dark:hover:text-accent-300"
                >
                  {c.name}
                  {c.venueCount !== undefined && (
                    <span className="ml-1 text-zinc-400">
                      · {none ? "no venues" : `${c.venueCount} venue${c.venueCount === 1 ? "" : "s"}`}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
