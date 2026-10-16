"use client";

import { useState } from "react";

export function TextBlock({ text, highlighted, copyable }: { text: string; highlighted?: boolean; copyable?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      className={`relative rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap ${
        highlighted
          ? "bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
          : "text-zinc-700 dark:text-zinc-300"
      }`}
    >
      {copyable && (
        <button
          onClick={() => {
            navigator.clipboard.writeText(text).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="no-print absolute right-3 top-3 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-600 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      )}
      {text}
    </div>
  );
}
