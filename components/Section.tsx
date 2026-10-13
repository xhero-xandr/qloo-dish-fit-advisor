export function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">{title}</h2>
        {subtitle && <p className="text-xs text-zinc-400">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
