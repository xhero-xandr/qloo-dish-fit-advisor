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
    <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/80">
      <p className="min-w-0 text-sm">
        <span className="font-medium">{concept}</span>
        <span className="text-slate-500"> · {cities.join(", ")}</span>
      </p>
      <Button type="button" variant="secondary" onClick={onEdit} className="px-3 py-1.5 text-xs">
        Edit or run another
      </Button>
    </div>
  );
}
