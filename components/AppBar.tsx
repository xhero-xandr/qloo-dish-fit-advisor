/** Top bar: the brand on the left; when the demo gate is on, who is signed in and how to leave on the right. */
export function AppBar({
  signedIn,
  onSignOut,
}: {
  signedIn?: boolean;
  onSignOut?: () => void;
}) {
  return (
    <div className="no-print mb-10 flex items-center justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-600 text-sm font-bold text-white"
        >
          D
        </span>
        <span className="text-sm font-semibold tracking-tight">
          Dish-Market Fit Advisor
        </span>
      </div>
      {signedIn && onSignOut && (
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 text-xs text-zinc-600 sm:flex dark:text-zinc-400">
            <span
              aria-hidden
              className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-100 text-[13px] font-semibold text-accent-800 dark:bg-accent-950 dark:text-accent-300"
            >
              D
            </span>
            Demo account
          </span>
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              className="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <path
                d="M8 4H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M12 7l3 3-3 3M15 10H8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
