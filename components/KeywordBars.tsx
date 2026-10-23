import type { RegionInsight } from "./types";

/** Review keywords as bars, longest first, so the few that dominate stand out from the long tail. */
export function KeywordBars({
  items,
  max = 10,
}: {
  items: RegionInsight[];
  max?: number;
}) {
  const shown = [...items]
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, max);
  const top = Math.max(1, ...shown.map((k) => k.mentions));
  return (
    <ul className="flex max-w-2xl flex-col gap-2">
      {shown.map((k) => (
        <li
          key={k.keyword}
          className="grid grid-cols-[minmax(0,10rem)_1fr_3rem] items-center gap-3 text-sm"
        >
          <span className="truncate" title={k.keyword}>
            {k.keyword}
          </span>
          <span
            className="h-3 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800"
            aria-hidden="true"
          >
            <span
              className="block h-3 rounded bg-accent-400"
              style={{ width: `${(k.mentions / top) * 100}%` }}
            />
          </span>
          <span className="text-right tabular-nums text-zinc-500">
            {k.mentions}
          </span>
        </li>
      ))}
    </ul>
  );
}
