"use client";

import { useState } from "react";
import { curlFor, describeRequest, type FactSource } from "@/lib/provenance";

function CopyCurl({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        })
      }
      className="shrink-0 rounded border border-zinc-300 px-1.5 py-0.5 text-[12px] text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
    >
      {copied ? "Copied" : "Copy as curl"}
    </button>
  );
}

/**
 * The Qloo request behind a fact: what was asked, with a command that repeats it. The curl uses a placeholder
 * for the key. Built from inline elements only, because it sits inside paragraphs.
 */
export function FactSourceView({ source }: { source?: FactSource }) {
  const [open, setOpen] = useState(false);
  if (!source) return null;
  const n = source.requests.length;
  return (
    <span className="mt-0.5 block text-[13px] text-zinc-500">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="cursor-pointer select-none text-left hover:text-zinc-700 dark:hover:text-zinc-300"
      >
        {open ? "▾" : "▸"} Where this comes from · {n} Qloo request
        {n === 1 ? "" : "s"}
      </button>
      {open && (
        <span className="mt-1 block space-y-1.5 rounded-lg bg-zinc-100 px-2.5 py-2 dark:bg-zinc-900">
          {source.note && (
            <span className="block text-zinc-600 dark:text-zinc-400">
              {source.note}
            </span>
          )}
          {source.requests.map((r, i) => (
            <span key={i} className="flex items-start justify-between gap-2">
              <code className="break-all font-mono text-[12px] text-zinc-700 dark:text-zinc-300">
                {describeRequest(r)}
              </code>
              <CopyCurl text={curlFor(source.base, r)} />
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
