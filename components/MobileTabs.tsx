"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

export type ReportTab = "verdict" | "venues" | "audience" | "plan";

const ICON =
  "h-6 w-6 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.7]";

const TABS: { id: ReportTab; label: string; icon: React.ReactNode }[] = [
  {
    id: "verdict",
    label: "Verdict",
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} aria-hidden="true">
        <path d="M4 12l5 5L20 6" />
      </svg>
    ),
  },
  {
    id: "venues",
    label: "Venues",
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} aria-hidden="true">
        <path d="M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    ),
  },
  {
    id: "audience",
    label: "Audience",
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} aria-hidden="true">
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5a3 3 0 0 1 0 6M18 14c2 .6 3 2.8 3 6" />
      </svg>
    ),
  },
  {
    id: "plan",
    label: "Plan",
    icon: (
      <svg viewBox="0 0 24 24" className={ICON} aria-hidden="true">
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M8 3v4M16 3v4M4 10h16" />
      </svg>
    ),
  },
];

const noSubscribe = () => () => {};

const BUTTON =
  "flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium text-zinc-500 aria-[current=page]:font-semibold aria-[current=page]:text-accent-700 dark:text-zinc-400 dark:aria-[current=page]:text-accent-400";

/** The phone's bottom bar: one result section at a time, and a way back to the menu form. */
export function MobileTabs({
  active,
  onChange,
  onMenu,
}: {
  active: ReportTab;
  onChange: (tab: ReportTab) => void;
  onMenu?: () => void;
}) {
  // Rendered into <body>: the results fade in with a transform, which would pin a fixed bar to them, not the screen.
  const onClient = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  if (!onClient) return null;
  return createPortal(
    <nav
      aria-label="Result sections"
      className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-zinc-200 bg-white/95 px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden dark:border-zinc-800 dark:bg-zinc-950/95"
    >
      <button type="button" onClick={onMenu} className={BUTTON}>
        <svg viewBox="0 0 24 24" className={ICON} aria-hidden="true">
          <path d="M5 4h14v16H5zM9 8h6M9 12h6M9 16h4" />
        </svg>
        Menu
      </button>
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          aria-current={active === t.id ? "page" : undefined}
          className={BUTTON}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </nav>,
    document.body,
  );
}
