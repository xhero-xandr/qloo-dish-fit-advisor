const CODE = "rounded bg-zinc-200/70 px-1 py-0.5 text-[13px] dark:bg-zinc-800";

export function MethodologyDetails() {
  return (
    <details className="mt-5 max-w-2xl rounded-xl border border-zinc-200 bg-white/60 text-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/40">
      <summary className="cursor-pointer select-none px-4 py-2.5 font-medium text-zinc-600 dark:text-zinc-300">
        How this works &amp; where the data comes from
      </summary>
      <div className="border-t border-zinc-200 px-4 py-3 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        <ol className="list-decimal space-y-1.5 pl-4">
          <li>
            An AI agent maps your concept to Qloo taste tags by calling Qloo
            itself (<code className={CODE}>GET /v2/tags</code>), and checks
            which tag has real venues in your city (
            <code className={CODE}>GET /v2/insights</code>, places).
          </li>
          <li>
            For those venues the app pulls hours, ratings, dietary tags and
            review keywords, each venue&apos;s audience (
            <code className={CODE}>urn:demographics</code>), and the brands, TV
            shows, artists and podcasts that same audience favors, seeded with
            the venues themselves.
          </li>
          <li>
            Every datum becomes a numbered fact. The agent writes the verdict,
            the recommended venue, the 4-week plan and the letter from those
            facts only, and cites the facts behind each claim. Code discards
            claims without a valid citation and moves any tasting time that
            falls outside the venue&apos;s real opening hours.
          </li>
          <li>
            Every venue, rating, hour, phone number and demographic score is a
            live Qloo result. The agent&apos;s wording is its own, so check the
            cited fact before relying on a claim. If the AI is unavailable the
            app falls back to keyword matching and a template plan, and says so.
          </li>
        </ol>
        <p className="mt-2 text-xs text-zinc-500">
          Full methodology, known limitations, and source code:{" "}
          <a
            href="https://github.com/xhero-xandr/qloo-dish-fit-advisor"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            GitHub repo
          </a>
          .
        </p>
      </div>
    </details>
  );
}
