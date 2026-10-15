import { AGE_LABELS } from "./constants";
import type { Demographics } from "./types";

/** A bar from a centre line: right (green or the given colour) over-indexes, left (rose) under-indexes. */
function DivergingBar({ value, max, positive }: { value: number; max: number; positive: string }) {
  const half = (Math.abs(value) / max) * 50;
  return (
    <div className="relative h-3 flex-1 rounded-full bg-zinc-100 dark:bg-zinc-800">
      <div className="absolute inset-y-0 left-1/2 w-px bg-zinc-300 dark:bg-zinc-600" />
      <div
        className={`absolute inset-y-0 rounded-full ${value >= 0 ? `left-1/2 ${positive}` : "right-1/2 bg-rose-400"}`}
        style={{ width: `${half}%` }}
      />
    </div>
  );
}

function signed(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
}

export function DemographicsChart({ demo }: { demo: Demographics }) {
  const ageEntries = Object.entries(demo.age ?? {});
  const male = demo.gender?.male ?? 0;
  const female = demo.gender?.female ?? 0;
  // One scale for every bar, so age and gender can be compared at a glance.
  const max = Math.max(0.01, ...ageEntries.map(([, v]) => Math.abs(v)), Math.abs(male), Math.abs(female));

  return (
    <div className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="mb-4 flex items-center justify-between text-[11px] text-zinc-400">
        <span>← fewer than the general population</span>
        <span>more than the general population →</span>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-5">
        <div className="sm:col-span-3">
          <p className="mb-3 text-xs font-medium text-zinc-500">Age</p>
          <div className="flex flex-col gap-2">
            {ageEntries.map(([bucket, value]) => (
              <div key={bucket} className="flex items-center gap-3">
                <span className="w-12 shrink-0 text-xs text-zinc-500">{AGE_LABELS[bucket] ?? bucket}</span>
                <DivergingBar value={value} max={max} positive="bg-emerald-500" />
                <span className="w-11 shrink-0 text-right text-xs text-zinc-400">{signed(value)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <p className="mb-3 text-xs font-medium text-zinc-500">Gender</p>
          <div className="flex flex-col gap-2">
            {[
              ["Male", male, "bg-sky-500"],
              ["Female", female, "bg-pink-500"],
            ].map(([label, value, color]) => (
              <div key={label as string} className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-xs text-zinc-500">{label as string}</span>
                <DivergingBar value={value as number} max={max} positive={color as string} />
                <span className="w-11 shrink-0 text-right text-xs text-zinc-400">{signed(value as number)}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-zinc-400">
            Qloo affinity scores vs. the general population for people who like these venues — a tendency of the
            audience, not a prediction about any individual.
          </p>
        </div>
      </div>
    </div>
  );
}
