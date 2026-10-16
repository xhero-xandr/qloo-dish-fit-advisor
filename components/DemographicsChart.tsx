import { AGE_LABELS } from "./constants";
import type { Demographics } from "./types";

// One diverging pair for every bar (checked with the dataviz palette validator, light and dark):
// blue is above the general population, the second hue below. Direction is also the side of the centre line,
// so colour is never the only cue.
const OVER = "bg-[#2563eb] dark:bg-[#4f93ee]";
const UNDER = "bg-[#ea580c] dark:bg-[#dc7332]";

function signed(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
}

function describe(label: string, value: number): string {
  const direction = value === 0 ? "in line with" : value > 0 ? "above" : "below";
  return `${label}: ${signed(value)} — ${direction} the general population`;
}

/** A row: label, a bar from the centre line, the value; hovering or focusing it explains the number. */
function Row({ label, value, max, wide }: { label: string; value: number; max: number; wide?: boolean }) {
  const half = (Math.abs(value) / max) * 50;
  return (
    <div
      tabIndex={0}
      aria-label={describe(label, value)}
      className="group relative flex items-center gap-3 rounded-md py-1 outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
    >
      <span className={`${wide ? "w-14" : "w-12"} shrink-0 text-xs text-zinc-500`}>{label}</span>
      <div className="relative h-3.5 flex-1 rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div className="absolute inset-y-0 left-1/2 w-px bg-zinc-300 dark:bg-zinc-600" />
        <div
          className={`absolute inset-y-0 rounded-full ${value >= 0 ? `left-1/2 ${OVER}` : `right-1/2 ${UNDER}`}`}
          style={{ width: `${half}%` }}
        />
      </div>
      <span className="w-11 shrink-0 text-right text-xs tabular-nums text-zinc-500">{signed(value)}</span>
      <span
        role="tooltip"
        className="pointer-events-none absolute -top-9 left-1/2 z-10 hidden w-max max-w-[16rem] -tranzinc-x-1/2 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs text-white shadow-lg group-hover:block group-focus-visible:block dark:bg-zinc-100 dark:text-zinc-900"
      >
        {describe(label, value)}
      </span>
    </div>
  );
}

export function DemographicsChart({ demo }: { demo: Demographics }) {
  const ageEntries = Object.entries(demo.age ?? {}).map(([bucket, value]) => [AGE_LABELS[bucket] ?? bucket, value] as const);
  const male = demo.gender?.male ?? 0;
  const female = demo.gender?.female ?? 0;
  // One scale for every bar, so age and gender can be compared at a glance.
  const max = Math.max(0.01, ...ageEntries.map(([, v]) => Math.abs(v)), Math.abs(male), Math.abs(female));
  const rows = [...ageEntries, ["Male", male] as const, ["Female", female] as const];

  return (
    <div className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[13px] text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${UNDER}`} aria-hidden /> fewer than the general population
        </span>
        <span className="flex items-center gap-1.5">
          more than the general population <span className={`h-2.5 w-2.5 rounded-full ${OVER}`} aria-hidden />
        </span>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-5">
        <div className="sm:col-span-3">
          <p className="mb-2 text-xs font-medium text-zinc-500">Age</p>
          <div className="flex flex-col">
            {ageEntries.map(([label, value]) => (
              <Row key={label} label={label} value={value} max={max} />
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <p className="mb-2 text-xs font-medium text-zinc-500">Gender</p>
          <div className="flex flex-col">
            <Row label="Male" value={male} max={max} wide />
            <Row label="Female" value={female} max={max} wide />
          </div>
          <p className="mt-4 text-[13px] leading-relaxed text-zinc-500">
            Qloo affinity scores vs. the general population for people who like these venues — a tendency of the
            audience, not a prediction about any individual.
          </p>
        </div>
      </div>
      <details className="no-print mt-4 text-xs text-zinc-500">
        <summary className="cursor-pointer select-none hover:text-zinc-700 dark:hover:text-zinc-300">View as table</summary>
        <table className="mt-2 w-full max-w-xs text-left">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="py-1 font-medium">Group</th>
              <th className="py-1 text-right font-medium">Affinity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-1">{label}</td>
                <td className="py-1 text-right tabular-nums">{signed(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
