"use client";

import { useEffect, useState } from "react";

const STAGES = [
  "Finds the Qloo taste tags that match your concept and checks which have real venues in the city",
  "Pulls each venue's hours, reviews, audience and cross-domain taste",
  "Writes the verdict, the 4-week plan and the outreach letter from those facts",
];

export function LoadingSkeleton({ cities }: { cities: number }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="mt-10 flex flex-col gap-8" role="status" aria-live="polite">
      <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm font-medium">
          Analyzing{cities > 1 ? ` ${cities} cities` : ""}… <span className="font-normal text-zinc-400">{seconds}s</span>
        </p>
        <p className="mt-0.5 text-xs text-zinc-500">
          Usually 15–40 seconds per city; it queries Qloo live. For each city the agent:
        </p>
        <ol className="mt-2 flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
          {STAGES.map((s, i) => (
            <li key={s} className="flex gap-2">
              <span className="font-mono text-zinc-400">{i + 1}.</span>
              {s}
            </li>
          ))}
        </ol>
      </div>
      <div className="flex animate-pulse flex-col gap-8">
        <div className="h-6 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-40 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          ))}
        </div>
        <div className="h-24 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      </div>
    </div>
  );
}
