const PARTS = ["Verdict & recommendation", "Cited 4-week pilot plan", "Real venues with hours", "Audience profile", "Beyond-food affinity", "Owner outreach letter"];

/** Shown before the first analysis so the page says what the result will contain. */
export function EmptyState() {
  return (
    <div className="no-print mt-10 rounded-xl border border-dashed border-slate-300 px-5 py-6 dark:border-slate-700">
      <p className="text-sm font-medium">What you will get</p>
      <p className="mt-0.5 text-xs text-slate-500">One page per city, about 15–40 seconds each, ready to print or save as PDF.</p>
      <ul className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
        {PARTS.map((p) => (
          <li key={p} className="rounded-full border border-slate-200 px-3 py-1 dark:border-slate-800">
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}
