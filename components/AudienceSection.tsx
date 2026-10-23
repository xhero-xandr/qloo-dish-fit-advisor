import {
  AGE_BUCKETS,
  coreAgeLabel,
  describeAudience,
  genderLean,
  levelOf,
  MORE,
  MUCH,
  type Level,
} from "@/lib/audience";
import { AGE_LABELS } from "./constants";
import type { Demographics, PilotPackage } from "./types";

// Blue for "likes it more", orange for "less", grey for "about average": one diverging pair, and
// every cell also carries the word, so colour is never the only cue.
const LEVEL_STYLE: Record<Level, string> = {
  "much more": "bg-blue-700 text-white",
  more: "bg-blue-200 text-blue-950 dark:bg-blue-900 dark:text-blue-100",
  "about average":
    "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  less: "bg-orange-200 text-orange-950 dark:bg-orange-900 dark:text-orange-100",
  "much less": "bg-orange-700 text-white",
};
const LEVELS: Level[] = [
  "much more",
  "more",
  "about average",
  "less",
  "much less",
];

function signed(n: number): string {
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}`;
}

function Explainer({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-zinc-100 px-4 py-3 dark:bg-zinc-900">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        {children}
      </p>
    </div>
  );
}

/** Who likes the matched venues, in words first; Qloo's scores stay one click away. */
export function AudienceSection({
  result,
  aggregate,
  recommendedIndex,
}: {
  result: PilotPackage;
  aggregate: Demographics;
  recommendedIndex: number;
}) {
  const core = coreAgeLabel(aggregate);
  const withData = result.venues.filter((v) => v.demographics);
  const places =
    result.venues.length === 1
      ? "this venue"
      : `these ${result.venues.length} venues`;

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-700 dark:text-accent-400">
            Audience · {result.city}
          </p>
          <h2 className="mt-1 text-xl font-semibold">
            {core
              ? `Your likely guests: people aged ${core}`
              : "No age group clearly stands out"}
          </h2>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            {describeAudience(aggregate, places)}
          </p>
        </div>

        <ul
          className="grid grid-cols-3 gap-1.5 sm:grid-cols-6"
          aria-label="Age groups"
        >
          {AGE_BUCKETS.map((b) => {
            const score = aggregate.age?.[b] ?? 0;
            const level = levelOf(score);
            return (
              <li
                key={b}
                title={`Qloo score ${signed(score)}`}
                className={`rounded-xl px-1 py-2.5 text-center ${LEVEL_STYLE[level]}`}
              >
                <span className="block text-sm font-semibold">
                  {AGE_LABELS[b]}
                </span>
                <span className="block text-xs">{level}</span>
              </li>
            );
          })}
        </ul>
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
          {LEVELS.map((l) => (
            <span
              key={l}
              className={`rounded-full px-2 py-0.5 font-medium ${LEVEL_STYLE[l]}`}
            >
              {l}
            </span>
          ))}
          <span>than the average person</span>
        </p>

        <div className="grid gap-3 md:grid-cols-3">
          <Explainer title="What this shows">
            Which age groups and genders like the venues that match your dish
            more, or less, than the average person. It comes from Qloo&apos;s
            data on what people like, not from a survey of these venues.
          </Explainer>
          <Explainer title="How to use it">
            Cook and promote for the groups marked <strong>more</strong>: pick
            the venue whose guests are the people you cook for, set prices and
            portions for them, and invite them where they already are (see
            &quot;Beyond food&quot;).
          </Explainer>
          <Explainer title="What it does not mean">
            It is not the share of guests or a headcount, and it says nothing
            about any one person. <strong>Less</strong> does not mean they never
            come; it means they are not the core of this crowd.
          </Explainer>
        </div>
      </section>

      {withData.length > 0 && (
        <section className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <div>
            <h2 className="text-lg font-semibold">
              Whose place is each venue?
            </h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Use this to choose where to run the tasting night: the closer a
              venue&apos;s crowd is to the people you cook for, the more the
              pilot will tell you.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {result.venues.map((v, i) =>
              v.demographics ? (
                <li
                  key={i}
                  className={`rounded-xl border p-3.5 ${
                    i === recommendedIndex
                      ? "border-2 border-accent-500"
                      : "border-zinc-200 dark:border-zinc-800"
                  }`}
                >
                  {i === recommendedIndex && (
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-accent-700 dark:text-accent-400">
                      Suggested for the pilot
                    </p>
                  )}
                  <p className="font-medium leading-snug">{v.name}</p>
                  <p className="mt-1 text-lg font-semibold text-blue-700 dark:text-blue-300">
                    {coreAgeLabel(v.demographics) ?? "No age group stands out"}
                  </p>
                  <p className="text-sm text-zinc-500">
                    {genderLean(v.demographics)}
                  </p>
                </li>
              ) : null,
            )}
          </ul>

          <details className="text-sm">
            <summary className="cursor-pointer select-none font-medium">
              Details: every group, every venue (with Qloo&apos;s scores)
            </summary>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              Under each word is Qloo&apos;s score. 0 is the average person;
              above 0 the group likes the venue more, below 0 less. The words
              use our own cut-offs: within ±{MORE.toFixed(2)} &quot;about
              average&quot;, up to ±{MUCH.toFixed(2)} &quot;more / less&quot;,
              beyond that &quot;much more / much less&quot;. Qloo does not
              publish the baseline, so compare groups within one venue rather
              than between cities.
            </p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-center text-xs">
                <thead>
                  <tr className="text-zinc-500">
                    <th scope="col" className="px-2 py-2 text-left font-medium">
                      Venue
                    </th>
                    {AGE_BUCKETS.map((b) => (
                      <th key={b} scope="col" className="px-1 py-2 font-medium">
                        {AGE_LABELS[b]}
                      </th>
                    ))}
                    <th scope="col" className="px-1 py-2 font-medium">
                      Men
                    </th>
                    <th scope="col" className="px-1 py-2 font-medium">
                      Women
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ...withData.map((v) => [v.name, v.demographics!] as const),
                    ["All together", aggregate] as const,
                  ].map(([name, d], i) => (
                    <tr
                      key={i}
                      className="border-t border-zinc-100 dark:border-zinc-800"
                    >
                      <th
                        scope="row"
                        className="whitespace-nowrap px-2 py-1.5 text-left font-medium"
                      >
                        {name}
                      </th>
                      {[
                        ...AGE_BUCKETS.map((b) => d.age?.[b] ?? 0),
                        d.gender?.male ?? 0,
                        d.gender?.female ?? 0,
                      ].map((score, j) => (
                        <td key={j} className="px-1 py-1.5">
                          <span
                            className={`inline-block min-w-[76px] rounded-full px-1.5 py-0.5 ${LEVEL_STYLE[levelOf(score)]}`}
                          >
                            <span className="block font-semibold">
                              {levelOf(score)}
                            </span>
                            <span className="block tabular-nums opacity-80">
                              {signed(score)}
                            </span>
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      )}
    </div>
  );
}
