const PILLS = [
  "Real, named venues",
  "Audience & cross-domain taste",
  "Plan from the venue's real hours",
  "Every claim cites its source",
];

/** The signed-out pitch above the sign-in panel. */
export function Hero() {
  return (
    <header className="no-print">
      <div className="mb-4 flex items-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-accent-200 bg-accent-50 px-3 py-1 text-xs font-medium text-accent-800 dark:border-accent-900 dark:bg-accent-950/60 dark:text-accent-300">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-500" />
          Built on Qloo&apos;s live taste graph — no mock data
        </div>
      </div>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl sm:leading-[1.05]">
        Dish-Market{" "}
        <span className="bg-gradient-to-r from-accent-600 to-amber-500 bg-clip-text text-transparent">
          Fit Advisor
        </span>
      </h1>
      <>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-zinc-600 sm:text-xl dark:text-zinc-400">
          Test a new dish or menu before you invest in it. Describe the concept
          and a city — get real venues to pilot it in, who their audience is,
          and a cited 4-week plan, all grounded in Qloo&apos;s taste graph.
        </p>
        {
          <ul className="mt-6 flex flex-wrap gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">
            {PILLS.map((t) => (
              <li
                key={t}
                className="rounded-full border border-zinc-200 bg-white/70 px-3 py-1 dark:border-zinc-800 dark:bg-zinc-900/50"
              >
                {t}
              </li>
            ))}
          </ul>
        }
      </>
    </header>
  );
}
