import type { CulturalAffinity as CulturalAffinityData, CulturalSignalItem } from "./types";

function SignalRow({ title, items }: { title: string; items: CulturalSignalItem[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-zinc-500">{title}</p>
      <div className="flex flex-wrap gap-3">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white py-1 pl-1 pr-3 dark:border-zinc-800 dark:bg-zinc-950"
          >
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageUrl} alt={item.name} className="h-8 w-8 rounded object-cover" loading="lazy" />
            ) : (
              <div className="h-8 w-8 rounded bg-zinc-100 dark:bg-zinc-800" />
            )}
            <div>
              <p className="text-xs font-medium leading-tight">{item.name}</p>
              {item.subtitle && <p className="text-[10px] leading-tight text-zinc-400">{item.subtitle}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CulturalAffinityPanel({ data }: { data: CulturalAffinityData }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      <p className="text-xs leading-relaxed text-zinc-500">
        This isn&apos;t menu data — it&apos;s Qloo&apos;s cross-domain taste graph: the same audience
        signal that matched your venues, projected onto other categories entirely. Useful for picking a
        tasting-night playlist, a cross-promotion partner, or just understanding who this audience is
        beyond food.
      </p>
      <SignalRow title="This audience also tends toward these brands" items={data.brands} />
      <SignalRow title="...and these TV shows" items={data.tvShows} />
      <SignalRow title="...these artists" items={data.artists} />
      <SignalRow title="...and these podcasts" items={data.podcasts} />
    </div>
  );
}
