export function LoadingSkeleton() {
  return (
    <div className="mt-10 flex flex-col gap-8">
      <p className="text-sm text-zinc-500">
        Querying Qloo&apos;s live taste graph — this can take a little while. The shared hackathon API
        key is capped at 5 requests/second, so a request will wait and retry rather than fail; more
        cities means more waiting, not an error.
      </p>
      <div className="flex animate-pulse flex-col gap-8">
        <div className="h-6 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-40 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          ))}
        </div>
        <div className="h-24 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      </div>
    </div>
  );
}
