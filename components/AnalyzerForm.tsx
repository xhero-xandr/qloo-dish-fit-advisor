"use client";

import { useRef, useState } from "react";
import { PRESETS, QUICK_CITIES } from "./constants";
import { DIETARY_OPTIONS, MAX_CONCEPT_LENGTH, type Details } from "@/lib/input";
import type { MenuRead } from "@/lib/menu-handler";
import { MenuImport } from "./MenuImport";
import { Button, Chip, inputClass } from "./ui";

const TABS = [
  ["text", "Type it", "Type it"],
  ["upload", "Upload photo or file", "Photo or file"],
  ["link", "Google link", "Google link"],
] as const;
type Tab = (typeof TABS)[number][0];

/** What the last upload or link gave, shown above the field it filled. */
interface Imported {
  from: string;
  total: number;
  included: number;
  byLines: boolean;
}

interface Props {
  concept: string;
  setConcept: (value: string) => void;
  cities: string[];
  setCities: (update: (prev: string[]) => string[]) => void;
  details: Details;
  setDetails: (details: Details) => void;
  loading: boolean;
  onRun: (concept: string, cities: string[], details: Details) => void;
}

export function AnalyzerForm({
  concept,
  setConcept,
  cities,
  setCities,
  details,
  setDetails,
  loading,
  onRun,
}: Props) {
  const [draft, setDraft] = useState("");
  const [tab, setTab] = useState<Tab>("text");
  const [imported, setImported] = useState<Imported>();
  const field = useRef<HTMLTextAreaElement>(null);

  function showField() {
    setTab("text");
    requestAnimationFrame(() => field.current?.focus());
  }

  function handleRead(read: MenuRead, from: string) {
    setConcept(read.text);
    setImported({
      from,
      total: read.dishes.length,
      included: read.included,
      byLines: read.readBy === "lines",
    });
    showField();
  }

  function addCity(raw: string) {
    const value = raw.trim();
    if (!value) return;
    setCities((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setDraft("");
  }

  function removeCity(value: string) {
    setCities((prev) => prev.filter((c) => c !== value));
  }

  function toggleQuickCity(value: string) {
    setCities((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value],
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addCity(draft);
    } else if (e.key === "Backspace" && draft === "" && cities.length > 0) {
      removeCity(cities[cities.length - 1]);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pending = draft.trim() ? [...cities, draft.trim()] : cities;
    if (!concept.trim()) return showField();
    if (pending.length === 0) return;
    setCities(() => pending);
    setDraft("");
    onRun(concept, pending, details);
  }

  function applyPreset(p: (typeof PRESETS)[number]) {
    setConcept(p.concept);
    setCities(() => [p.city]);
    setDraft("");
    setDetails({});
    setImported(undefined);
    onRun(p.concept, [p.city], {});
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="no-print grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start"
    >
      <section className="flex min-w-0 flex-col gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-700 dark:text-accent-400">
            Step 1 · Your menu
          </p>
          <h1 className="mt-1.5 text-3xl font-semibold leading-tight tracking-tight">
            What do you want to test?
          </h1>
          <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
            One dish, a few, or a whole menu. Type it, upload a photo or file,
            or paste a Google Docs or Sheets link. The agent works out what
            kind of food it is and finds the venues and guests that already
            like it.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="How to add the menu"
          className="flex gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900"
        >
          {TABS.map(([id, label, short]) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`panel-${id}`}
              onClick={() => setTab(id)}
              className="min-h-[40px] flex-1 rounded-lg px-2 text-sm font-medium text-zinc-600 transition aria-selected:bg-white aria-selected:text-zinc-900 aria-selected:shadow-sm dark:text-zinc-400 dark:aria-selected:bg-zinc-800 dark:aria-selected:text-zinc-100"
            >
              <span className="max-sm:hidden">{label}</span>
              <span className="sm:hidden">{short}</span>
            </button>
          ))}
        </div>

        {tab !== "text" && (
          <div
            role="tabpanel"
            id={`panel-${tab}`}
            aria-labelledby={`tab-${tab}`}
          >
            <MenuImport
              key={tab}
              mode={tab}
              disabled={loading}
              onRead={handleRead}
            />
          </div>
        )}

        <div
          role="tabpanel"
          id="panel-text"
          aria-labelledby="tab-text"
          hidden={tab !== "text"}
        >
          {imported && (
            <div className="mb-3 rounded-xl bg-accent-50 px-4 py-3 text-sm text-accent-950 dark:bg-accent-950/60 dark:text-accent-100">
              <p>
                <strong className="font-semibold">
                  Read {imported.total}{" "}
                  {imported.total === 1 ? "dish" : "dishes"} from{" "}
                  {imported.from}.
                </strong>{" "}
                Check the list below and fix anything that was misread.
              </p>
              {imported.included < imported.total && (
                <p className="mt-1">
                  Only the first {imported.included} fit in the field&apos;s{" "}
                  {MAX_CONCEPT_LENGTH} characters. Remove some to make room for
                  others.
                </p>
              )}
              {imported.byLines && (
                <p className="mt-1">
                  The language model was unavailable, so each line was taken
                  as a dish.
                </p>
              )}
            </div>
          )}
          <label htmlFor="concept" className="block font-medium">
            Dish or menu
          </label>
          <textarea
            ref={field}
            id="concept"
            className={`${inputClass} mt-2 resize-y text-base`}
            rows={5}
            placeholder="e.g. izakaya-style small plates, or: braised short rib with miso-glazed carrots and sesame crumble, a modern bistro dish"
            value={concept}
            maxLength={MAX_CONCEPT_LENGTH}
            onChange={(e) => setConcept(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                e.currentTarget.form?.requestSubmit();
            }}
            required={tab === "text"}
          />
          {concept.length > MAX_CONCEPT_LENGTH * 0.75 && (
            <p className="mt-1 text-right text-xs text-zinc-500">
              {concept.length} / {MAX_CONCEPT_LENGTH}
            </p>
          )}
        </div>

        <DetailsFields details={details} setDetails={setDetails} />

        <div>
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Or start with an example
          </p>
          <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PRESETS.map((p) => (
              <li key={p.concept} className="min-w-0">
                <button
                  type="button"
                  onClick={() => applyPreset(p)}
                  disabled={loading}
                  className="flex w-full items-baseline justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-left text-sm text-zinc-700 transition hover:border-accent-400 hover:text-accent-700 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:text-accent-300"
                >
                  <span className="min-w-0 truncate">{p.concept}</span>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {p.city.split(",")[0]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <aside className="flex flex-col gap-5 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-700 dark:text-accent-400">
            Step 2 · Where
          </p>
          <h2 className="mt-1.5 text-xl font-semibold">
            <label htmlFor="city">Cities to test in</label>
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Add one, or several to compare them side by side.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-2 shadow-sm focus-within:border-accent-500 focus-within:ring-2 focus-within:ring-accent-200 dark:border-zinc-700 dark:bg-zinc-900 dark:focus-within:ring-accent-900">
          {cities.map((c) => (
            <span
              key={c}
              className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            >
              {c}
              <button
                type="button"
                onClick={() => removeCity(c)}
                className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                aria-label={`Remove ${c}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            id="city"
            className="min-w-[140px] flex-1 bg-transparent px-1 py-1.5 text-sm outline-none"
            placeholder={
              cities.length === 0
                ? "Type a city and press Enter…"
                : "Add another…"
            }
            value={draft}
            maxLength={100}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => addCity(draft)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_CITIES.map((c) => (
            <Chip
              key={c}
              active={cities.includes(c)}
              onClick={() => toggleQuickCity(c)}
            >
              + {c}
            </Chip>
          ))}
        </div>
        <Button type="submit" disabled={loading} className="w-full text-base">
          {loading
            ? "Analyzing…"
            : cities.length > 1
              ? `Compare ${cities.length} cities`
              : "Analyze"}
        </Button>
      </aside>
    </form>
  );
}

function toggle<T>(list: readonly T[] | undefined, value: T): T[] | undefined {
  const has = list?.includes(value);
  const next = has
    ? (list ?? []).filter((x) => x !== value)
    : [...(list ?? []), value];
  return next.length > 0 ? next : undefined;
}

function countSet(d: Details): number {
  return (d.dietary?.length ?? 0) + (d.season ? 1 : 0);
}

/** Optional requests: dietary needs (checked against Qloo's data) and the season (read by the plan). Audience and price level are shown as results, not asked for. */
function DetailsFields({
  details,
  setDetails,
}: {
  details: Details;
  setDetails: (d: Details) => void;
}) {
  const set = countSet(details);
  const update = (patch: Partial<Details>) => {
    const next = { ...details, ...patch };
    (Object.keys(next) as (keyof Details)[]).forEach(
      (k) => next[k] === undefined && delete next[k],
    );
    setDetails(next);
  };
  const row = "mt-1.5 flex flex-wrap gap-1.5";
  const label = "text-xs font-medium text-zinc-600 dark:text-zinc-400";
  return (
    <details
      className="rounded-xl border border-zinc-200 bg-white/60 dark:border-zinc-800 dark:bg-zinc-900/40"
      open={set > 0}
    >
      <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-medium">
        Add details (optional)
        {set > 0 && (
          <span className="ml-2 rounded-full bg-accent-100 px-2 py-0.5 text-xs text-accent-800 dark:bg-accent-950 dark:text-accent-300">
            {set} set
          </span>
        )}
      </summary>
      <div className="flex flex-col gap-4 border-t border-zinc-200 px-4 py-4 dark:border-zinc-800">
        <div>
          <p className={label}>Dietary needs the dish meets</p>
          <p className="text-xs text-zinc-500">
            Checked against what Qloo lists for each venue.
          </p>
          <div className={row}>
            {DIETARY_OPTIONS.map((d) => (
              <Chip
                key={d}
                active={details.dietary?.includes(d)}
                onClick={() => update({ dietary: toggle(details.dietary, d) })}
              >
                {d}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="season" className={label}>
            Season or timing
          </label>
          <p className="text-xs text-zinc-500">
            Read by the plan, not by Qloo: e.g. &quot;summer&quot;,
            &quot;weekend brunch&quot;.
          </p>
          <input
            id="season"
            className={`${inputClass} mt-1.5 py-2`}
            value={details.season ?? ""}
            maxLength={80}
            onChange={(e) => update({ season: e.target.value || undefined })}
          />
        </div>
      </div>
    </details>
  );
}
