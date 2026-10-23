const STEPS = [
  {
    title: "Describe the dish",
    text: "A concept and one or more cities. No account data, nothing to upload.",
  },
  {
    title: "The agent reads Qloo",
    text: "It finds matching taste tags, checks which have real venues in the city, and pulls each venue's hours, audience and cross-domain taste.",
  },
  {
    title: "Get a cited pilot package",
    text: "A verdict, a 4-week plan built from the venue's real opening hours, a shortlist of venues and an outreach letter. Every claim points to its source fact.",
  },
];

/** Three steps for first-time visitors; the signed-in page skips it to keep the form above the fold. */
export function HowItWorks() {
  return (
    <section aria-label="How it works" className="no-print mt-14">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent-700 dark:text-accent-400">
        How it works
      </p>
      <ol className="mt-4 grid gap-4 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <li
            key={s.title}
            className="rounded-2xl border border-zinc-200 bg-white/70 p-5 dark:border-zinc-800 dark:bg-zinc-900/40"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-100 text-sm font-semibold text-accent-800 dark:bg-accent-950 dark:text-accent-300">
              {i + 1}
            </span>
            <h3 className="mt-3 text-base font-semibold">{s.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {s.text}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
