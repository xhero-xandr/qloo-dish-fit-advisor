"use client";

import { useState } from "react";
import { PRESETS, QUICK_CITIES } from "./constants";
import {
  AGE_GROUPS,
  DIETARY_OPTIONS,
  MAX_CONCEPT_LENGTH,
  type Details,
} from "@/lib/input";
import { AGE_LABELS } from "./constants";
import { Button, Chip, inputClass } from "./ui";

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
    if (!concept.trim() || pending.length === 0) return;
    setCities(() => pending);
    setDraft("");
    onRun(concept, pending, details);
  }

  function applyPreset(p: (typeof PRESETS)[number]) {
    setConcept(p.concept);
    setCities(() => [p.city]);
    setDraft("");
    setDetails({});
    onRun(p.concept, [p.city], {});
  }

  return (
    <div className="no-print">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-zinc-500">
          Start with an example:
        </span>
        {PRESETS.map((p) => (
          <Chip
            key={p.concept}
            onClick={() => applyPreset(p)}
            disabled={loading}
            className="px-3 py-1"
          >
            {p.concept} · {p.city.split(",")[0]}
          </Chip>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <label htmlFor="concept" className="block text-sm font-medium">
            Dish or menu
          </label>
          <p className="mb-1.5 text-xs text-zinc-500">
            A cuisine, a dish, or a full description with ingredients and
            dishes. The agent reads it into what kind of food it is.
          </p>
          <textarea
            id="concept"
            className={`${inputClass} resize-y`}
            rows={3}
            placeholder="e.g. izakaya-style small plates, or: braised short rib with miso-glazed carrots and sesame crumble, a modern bistro dish"
            value={concept}
            maxLength={MAX_CONCEPT_LENGTH}
            onChange={(e) => setConcept(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                e.currentTarget.form?.requestSubmit();
            }}
            required
          />
          {concept.length > MAX_CONCEPT_LENGTH * 0.75 && (
            <p className="mt-1 text-right text-xs text-zinc-500">
              {concept.length} / {MAX_CONCEPT_LENGTH}
            </p>
          )}
        </div>

        <DetailsFields details={details} setDetails={setDetails} />

        <div>
          <label htmlFor="city" className="block text-sm font-medium">
            Cities to pilot in
          </label>
          <p className="mb-1.5 text-xs text-zinc-500">
            Add one, or several to compare them side by side.
          </p>
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
          <div className="mt-2 flex flex-wrap gap-1.5">
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
        </div>

        <Button type="submit" disabled={loading} className="w-full">
          {loading
            ? "Analyzing…"
            : cities.length > 1
              ? `Compare ${cities.length} cities`
              : "Analyze"}
        </Button>
      </form>
    </div>
  );
}

const PRICES = [1, 2, 3, 4] as const;

function toggle<T>(list: readonly T[] | undefined, value: T): T[] | undefined {
  const has = list?.includes(value);
  const next = has
    ? (list ?? []).filter((x) => x !== value)
    : [...(list ?? []), value];
  return next.length > 0 ? next : undefined;
}

function countSet(d: Details): number {
  return (
    (d.dietary?.length ?? 0) +
    (d.audience?.age?.length ?? 0) +
    (d.audience?.gender ? 1 : 0) +
    (d.prices?.length ?? 0) +
    (d.season ? 1 : 0)
  );
}

/** Optional requests that Qloo's data can answer: dietary needs, audience, price level; plus the season for the plan. */
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
          <p className={label}>Who it is for</p>
          <p className="text-xs text-zinc-500">
            Sent to Qloo as an audience signal, so it changes which venues come
            back.
          </p>
          <div className={row}>
            {AGE_GROUPS.map((g) => (
              <Chip
                key={g}
                active={details.audience?.age?.includes(g)}
                onClick={() => {
                  const age = toggle(details.audience?.age, g);
                  update({
                    audience:
                      age || details.audience?.gender
                        ? { age, gender: details.audience?.gender }
                        : undefined,
                  });
                }}
              >
                {AGE_LABELS[g]}
              </Chip>
            ))}
            {(["female", "male"] as const).map((g) => (
              <Chip
                key={g}
                active={details.audience?.gender === g}
                onClick={() => {
                  const gender = details.audience?.gender === g ? undefined : g;
                  update({
                    audience:
                      details.audience?.age || gender
                        ? { age: details.audience?.age, gender }
                        : undefined,
                  });
                }}
              >
                {g === "female" ? "Women" : "Men"}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <p className={label}>Price level</p>
          <p className="text-xs text-zinc-500">
            Compared with each venue&apos;s own price level.
          </p>
          <div className={row}>
            {PRICES.map((p) => (
              <Chip
                key={p}
                active={details.prices?.includes(p)}
                onClick={() => update({ prices: toggle(details.prices, p) })}
              >
                {"$".repeat(p)}
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
