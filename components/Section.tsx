/** A titled block of the report. `plain` drops the card, for sections whose content is already cards. */
export function Section({
  title,
  subtitle,
  id,
  plain,
  children,
}: {
  title: string;
  subtitle?: string;
  id?: string;
  plain?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-16 ${
        plain
          ? ""
          : "rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
      }`}
    >
      <div className="mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
