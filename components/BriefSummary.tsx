import { AGE_LABELS } from "./constants";
import type { PilotPackage } from "./types";

const PRICE = (levels: number[]) => levels.map((p) => "$".repeat(p)).join(", ");

/** What was understood from a long description and the optional details, so nothing is applied silently. */
export function BriefSummary({ result }: { result: PilotPackage }) {
  const { brief, details } = result;
  if (!brief && !details) return null;
  const asked: string[] = [];
  if (details?.dietary) asked.push(`dietary: ${details.dietary.join(", ")}`);
  if (details?.audience?.age)
    asked.push(
      `ages ${details.audience.age.map((g) => AGE_LABELS[g] ?? g).join(", ")}`,
    );
  if (details?.audience?.gender)
    asked.push(details.audience.gender === "female" ? "women" : "men");
  if (details?.prices) asked.push(`price ${PRICE(details.prices)}`);
  if (details?.season) asked.push(`timing: ${details.season}`);
  // A chosen category is shown by TagChoice; with nothing else to say, say nothing.
  if (!brief && asked.length === 0) return null;
  return (
    <section className="no-print rounded-xl border border-zinc-200 bg-white/70 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/40">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent-700 dark:text-accent-400">
        What was understood
      </p>
      {brief && (
        <p className="mt-1.5">
          Your description was read as{" "}
          <strong className="font-medium">{brief.core}</strong>
          {brief.dishes.length > 0 && (
            <>
              {" "}
              with the dishes{" "}
              <span className="text-zinc-600 dark:text-zinc-400">
                {brief.dishes.join(", ")}
              </span>
            </>
          )}
          . That phrase is what the Qloo tag search used.
        </p>
      )}
      {asked.length > 0 && (
        <p className="mt-1.5 text-zinc-600 dark:text-zinc-400">
          You also asked for: {asked.join(" · ")}. Audience choices shaped which
          venues Qloo returned; dietary and price requests are checked per venue
          below.
        </p>
      )}
    </section>
  );
}
