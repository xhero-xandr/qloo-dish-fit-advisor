const PILLS = ["Real, named venues", "Audience & cross-domain taste", "Plan from the venue's real hours", "Every claim cites its source"];

/**
 * `compact` is the signed-in version: the tool matters more than the pitch, so the form stays above
 * the fold. `minimal` is title only, once results are on screen.
 */
export function Hero({
  children,
  compact,
  minimal,
  aside,
}: {
  children?: React.ReactNode;
  compact?: boolean;
  minimal?: boolean;
  /** Sits at the right end of the badge row (sign out). */
  aside?: React.ReactNode;
}) {
  const small = compact || minimal;
  return (
    <header className="no-print">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-800 dark:border-orange-900 dark:bg-orange-950/60 dark:text-orange-300">
          <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
          Built on Qloo&apos;s live taste graph — no mock data
        </div>
        {aside}
      </div>
      <h1 className={`font-semibold tracking-tight ${small ? "text-3xl sm:text-4xl" : "text-4xl sm:text-6xl sm:leading-[1.05]"}`}>
        Dish-Market{" "}
        <span className="bg-gradient-to-r from-orange-600 to-amber-500 bg-clip-text text-transparent">Fit Advisor</span>
      </h1>
      {!minimal && (
        <>
          <p className={`max-w-2xl leading-relaxed text-zinc-600 dark:text-zinc-400 ${compact ? "mt-3 text-base" : "mt-5 text-lg sm:text-xl"}`}>
            Test a new dish or menu before you invest in it. Describe the concept and a city — get real venues to pilot it
            in, who their audience is, and a cited 4-week plan, all grounded in Qloo&apos;s taste graph.
          </p>
          {!compact && (
            <ul className="mt-6 flex flex-wrap gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">
              {PILLS.map((t) => (
                <li key={t} className="rounded-full border border-zinc-200 bg-white/70 px-3 py-1 dark:border-zinc-800 dark:bg-zinc-900/50">
                  {t}
                </li>
              ))}
            </ul>
          )}
          {children}
        </>
      )}
    </header>
  );
}
