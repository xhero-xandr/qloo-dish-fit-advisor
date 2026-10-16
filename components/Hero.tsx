export function Hero({ children }: { children?: React.ReactNode }) {
  return (
    <header className="no-print">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-800 dark:border-orange-900 dark:bg-orange-950/60 dark:text-orange-300">
        <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
        Built on Qloo&apos;s live taste graph — no mock data
      </div>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        Dish-Market{" "}
        <span className="bg-gradient-to-r from-orange-600 to-amber-500 bg-clip-text text-transparent">Fit Advisor</span>
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
        Test a new dish or menu before you invest in it. Describe the concept and a city — get real venues to pilot it
        in, who their audience is, and a cited 4-week plan, all grounded in Qloo&apos;s taste graph.
      </p>
      <ul className="mt-5 flex flex-wrap gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">
        {["Real, named venues", "Audience & cross-domain taste", "Plan from the venue's real hours", "Every claim cites its source"].map(
          (t) => (
            <li key={t} className="rounded-full border border-zinc-200 bg-white/70 px-3 py-1 dark:border-zinc-800 dark:bg-zinc-900/50">
              {t}
            </li>
          )
        )}
      </ul>
      {children}
    </header>
  );
}
