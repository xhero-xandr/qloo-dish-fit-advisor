import type { ButtonHTMLAttributes } from "react";

/** Shared text-field look; the orange focus ring is the brand's interactive colour. */
export const inputClass =
  "w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:ring-orange-900";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold shadow-sm transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400";

const BUTTON_VARIANTS = {
  primary: "bg-orange-600 px-6 py-3 text-white hover:bg-orange-700",
  secondary:
    "border border-zinc-300 px-4 py-2 font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTON_VARIANTS }) {
  return <button {...props} className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${className}`} />;
}

/** A small pill button: selected = filled orange, otherwise outlined. */
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
          ? "border-orange-600 bg-orange-600 text-white"
          : "border-zinc-200 text-zinc-600 hover:border-orange-400 hover:text-orange-700 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-orange-300"
      } ${className}`}
    />
  );
}
