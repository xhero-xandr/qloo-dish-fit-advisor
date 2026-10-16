"use client";

import { useState } from "react";

export function TextBlock({ text, highlighted, copyable }: { text: string; highlighted?: boolean; copyable?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      className={`relative rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap ${
        highlighted
          ? "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200"
          : "text-slate-700 dark:text-slate-300"
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
          className="no-print absolute right-3 top-3 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      )}
      {text}
    </div>
  );
}
