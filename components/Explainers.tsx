/** The same three questions under every chart: what it shows, how to use it, what it does not mean. */
export function Explainers({
  shows,
  use,
  notMean,
}: {
  shows: React.ReactNode;
  use: React.ReactNode;
  notMean: React.ReactNode;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {(
        [
          ["What this shows", shows],
          ["How to use it", use],
          ["What it does not mean", notMean],
        ] as const
      ).map(([title, text]) => (
        <div
          key={title}
          className="rounded-xl bg-zinc-100 px-4 py-3 dark:bg-zinc-900"
        >
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {text}
          </p>
        </div>
      ))}
    </div>
  );
}
