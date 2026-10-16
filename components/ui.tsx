import type { ButtonHTMLAttributes } from "react";

/** Shared text-field look; the accent focus ring is the brand's interactive colour. */
export const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-200 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-accent-900";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold shadow-sm transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400";

const BUTTON_VARIANTS = {
  primary:
    "bg-accent-600 px-6 py-3 text-white hover:-translate-y-px hover:bg-accent-700 hover:shadow-md hover:shadow-accent-600/30 motion-reduce:transform-none",
  secondary:
    "border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTON_VARIANTS }) {
  return <button {...props} className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${className}`} />;
}

/** A small pill button: selected = filled accent, otherwise outlined. */
export function Chip({
  active,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={`rounded-full border px-2.5 py-0.5 text-xs transition disabled:opacity-50 ${
        active
          ? "border-accent-600 bg-accent-600 text-white"
          : "border-slate-200 text-slate-600 hover:border-accent-400 hover:text-accent-700 dark:border-slate-800 dark:text-slate-400 dark:hover:text-accent-300"
      } ${className}`}
    />
  );
}
