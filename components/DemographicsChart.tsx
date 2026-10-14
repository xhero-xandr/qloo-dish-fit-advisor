import { AGE_LABELS } from "./constants";
import type { Demographics } from "./types";

export function DemographicsChart({ demo }: { demo: Demographics }) {
  const ageEntries = Object.entries(demo.age ?? {});
  const maxAbs = Math.max(0.01, ...ageEntries.map(([, v]) => Math.abs(v)));
  const male = demo.gender?.male ?? 0;
  const female = demo.gender?.female ?? 0;
  const genderMax = Math.max(0.01, Math.abs(male), Math.abs(female));

  return (
    <div className="grid grid-cols-1 gap-6 rounded-xl border border-zinc-200 p-5 sm:grid-cols-5 dark:border-zinc-800">
      <div className="sm:col-span-3">
        <p className="mb-3 text-xs font-medium text-zinc-500">Age affinity (relative to general population)</p>
        <div className="flex flex-col gap-2">
          {ageEntries.map(([bucket, value]) => (
            <div key={bucket} className="flex items-center gap-3">
              <span className="w-12 shrink-0 text-xs text-zinc-500">{AGE_LABELS[bucket] ?? bucket}</span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                  className={`h-full rounded-full ${value >= 0 ? "bg-emerald-500" : "bg-rose-400"}`}
                  style={{ width: `${(Math.abs(value) / maxAbs) * 100}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-xs text-zinc-400">{value.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="sm:col-span-2">
        <p className="mb-3 text-xs font-medium text-zinc-500">Gender skew</p>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-xs text-zinc-500">Male</span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div className="h-full rounded-full bg-sky-500" style={{ width: `${(Math.abs(male) / genderMax) * 100}%` }} />
            </div>
            <span className="w-10 shrink-0 text-right text-xs text-zinc-400">{male.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-xs text-zinc-500">Female</span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div className="h-full rounded-full bg-pink-500" style={{ width: `${(Math.abs(female) / genderMax) * 100}%` }} />
            </div>
            <span className="w-10 shrink-0 text-right text-xs text-zinc-400">{female.toFixed(2)}</span>
          </div>
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-zinc-400">
          Scores are Qloo affinity deltas vs. the general population for people who like these venues — not a
          prediction about any individual.
        </p>
      </div>
    </div>
  );
}
