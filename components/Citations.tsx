"use client";

import { useState } from "react";
import { FactSourceView } from "./FactSource";
import type { Fact } from "./types";

export function Citations({ ids, facts }: { ids: string[]; facts: Map<string, Fact> }) {
  const [open, setOpen] = useState(false);
  if (ids.length === 0) return null;
  return (
    <span className="ml-1 inline">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex gap-0.5 align-middle"
        aria-expanded={open}
        title={open ? "Hide the Qloo facts behind this" : "Show the Qloo facts behind this"}
      >
        {ids.map((id) => (
          <span
            key={id}
            className="rounded bg-sky-50 px-1 py-px font-mono text-[12px] font-medium text-sky-700 hover:bg-sky-100 dark:bg-sky-950 dark:text-sky-300"
          >
            {id}
          </span>
        ))}
      </button>
      {open && (
        <span className="mt-1.5 block rounded-lg border border-sky-100 bg-sky-50/50 px-2.5 py-1.5 text-[13px] leading-relaxed text-zinc-600 dark:border-sky-900 dark:bg-sky-950/40 dark:text-zinc-300">
          {ids.map((id) => (
            <span key={id} className="block">
              <span className="font-mono text-sky-700 dark:text-sky-300">{id}</span> {facts.get(id)?.text}
              <FactSourceView source={facts.get(id)?.source} />
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
