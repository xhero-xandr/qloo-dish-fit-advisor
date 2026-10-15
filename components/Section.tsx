export function Section({
  title,
  subtitle,
  id,
  children,
}: {
  title: string;
  subtitle?: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-16">
      <div className="mb-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
          <span className="h-3.5 w-1 rounded-full bg-orange-500" />
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 pl-3 text-xs text-zinc-400">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
