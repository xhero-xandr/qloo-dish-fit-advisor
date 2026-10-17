import { Button } from "./ui";

/** The form folded into one line once results exist, so the results start near the top. */
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
    <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="min-w-0 text-sm">
        <p className="line-clamp-2 font-medium" title={concept}>
          {concept}
        </p>
        <p className="text-zinc-500">{cities.join(", ")}</p>
      </div>
      <Button
        type="button"
        variant="secondary"
        onClick={onEdit}
        className="px-3 py-1.5 text-xs"
      >
        Edit or run another
      </Button>
    </div>
  );
}
