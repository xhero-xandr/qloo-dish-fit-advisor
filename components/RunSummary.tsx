/** What is being tested, above the report, with the way back to the steps. */
export function RunSummary({
  concept,
  cities,
  onEdit,
}: {
  concept: string;
  cities: string[];
  onEdit: () => void;
}) {
  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800">
      <p className="min-w-0 text-sm text-zinc-500">
        Testing{" "}
        <span
          className="font-semibold text-zinc-900 dark:text-zinc-100"
          title={concept}
        >
          {concept.length > 80 ? `${concept.slice(0, 80)}…` : concept}
        </span>{" "}
        in{" "}
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          {cities.join(", ")}
        </span>
      </p>
      <button
        type="button"
        onClick={onEdit}
        className="min-h-[40px] rounded-xl border border-zinc-300 bg-white px-4 text-sm font-medium hover:border-accent-400 dark:border-zinc-700 dark:bg-zinc-900"
      >
        Change dish or cities
      </button>
    </div>
  );
}
