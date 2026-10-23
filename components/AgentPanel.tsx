import { FactSourceView } from "./FactSource";
import type { AgentOutput } from "./types";

export function AgentPanel({ agent }: { agent: AgentOutput }) {
  const { tagDecision, analysis } = agent;
  const models = Array.from(
    new Set([tagDecision?.model, analysis?.model].filter(Boolean)),
  );

  return (
    <section className="flex flex-col gap-5 rounded-xl border border-accent-200 bg-white p-5 shadow-sm shadow-accent-900/5 dark:border-accent-900/60 dark:bg-zinc-950">
      <div>
        <h2 className="text-lg font-semibold">How the agent worked this out</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          Written by an AI agent (
          {models.length > 0 ? models.join(", ") : "language model"}) working
          only from Qloo data. Every claim cites numbered Qloo facts; tap one to
          read it and see the Qloo request it came from. A citation shows where
          a claim comes from, not that the reasoning is right
          {analysis && analysis.droppedItems > 0
            ? ` — ${analysis.droppedItems} claim(s) without a valid citation were discarded`
            : ""}
          {analysis && analysis.correctedItems > 0
            ? `${analysis.droppedItems > 0 ? "; " : " — "}${analysis.correctedItems} tasting time${analysis.correctedItems === 1 ? " was" : "s were"} moved into the venue's real opening hours`
            : ""}
          .
        </p>
      </div>

      {agent.notes.length > 0 && (
        <ul className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          {agent.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}

      {tagDecision && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-zinc-500">
            How the agent read your concept
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-zinc-900 px-2.5 py-0.5 text-xs font-medium text-white dark:bg-white dark:text-zinc-900">
              {tagDecision.primary.name}
            </span>
            {tagDecision.secondary.map((s) => (
              <span
                key={s.id}
                className="rounded-full border border-zinc-300 px-2.5 py-0.5 text-xs text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
              >
                + {s.name}
                {s.venueCount !== undefined
                  ? ` · ${s.venueCount} venue${s.venueCount === 1 ? "" : "s"}`
                  : ""}
              </span>
            ))}
          </div>
          <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
            {tagDecision.reasoning}
          </p>
          {tagDecision.override && (
            <p className="mt-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
              Overruled by code: the agent picked &quot;
              {tagDecision.override.agentTag}&quot;, which has only{" "}
              {tagDecision.override.agentVenueCount} operating venue
              {tagDecision.override.agentVenueCount === 1 ? "" : "s"} here, so
              the baseline tag &quot;{tagDecision.override.usedTag}&quot; (
              {tagDecision.override.usedVenueCount} venues) was used instead.
              The agent&apos;s pick is kept as a secondary signal.
            </p>
          )}
          <details className="no-print mt-1.5 text-xs text-zinc-500">
            <summary className="cursor-pointer select-none">
              Agent steps ({tagDecision.toolCalls.length} Qloo tool calls)
            </summary>
            <ol className="mt-1.5 list-decimal space-y-0.5 pl-5">
              {tagDecision.toolCalls.map((c, i) => (
                <li key={i}>
                  <span className="font-mono">{c.tool}</span>(&quot;{c.input}
                  &quot;) → {c.summary}
                </li>
              ))}
            </ol>
          </details>
        </div>
      )}

      <details className="no-print text-xs text-zinc-500">
        <summary className="cursor-pointer select-none">
          All Qloo facts given to the agent ({agent.facts.length})
        </summary>
        <ol className="mt-1.5 space-y-0.5">
          {agent.facts.map((f) => (
            <li key={f.id}>
              <span className="font-mono text-sky-700 dark:text-sky-300">
                {f.id}
              </span>{" "}
              {f.text}
              <FactSourceView source={f.source} />
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}
