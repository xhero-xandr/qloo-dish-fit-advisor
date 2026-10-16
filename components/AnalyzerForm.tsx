"use client";

import { useState } from "react";
import { PRESETS, QUICK_CITIES } from "./constants";
import { Button, Chip, inputClass } from "./ui";

interface Props {
  concept: string;
  setConcept: (value: string) => void;
  cities: string[];
  setCities: (update: (prev: string[]) => string[]) => void;
  loading: boolean;
  onRun: (concept: string, cities: string[]) => void;
}

export function AnalyzerForm({ concept, setConcept, cities, setCities, loading, onRun }: Props) {
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
    setCities((prev) => (prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]));
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
    onRun(concept, pending);
  }

  function applyPreset(p: (typeof PRESETS)[number]) {
    setConcept(p.concept);
    setCities(() => [p.city]);
    setDraft("");
    onRun(p.concept, [p.city]);
  }

  return (
    <div className="no-print">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-zinc-500">Start with an example:</span>
        {PRESETS.map((p) => (
          <Chip key={p.concept} onClick={() => applyPreset(p)} disabled={loading} className="px-3 py-1">
            {p.concept} · {p.city.split(",")[0]}
          </Chip>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <label htmlFor="concept" className="block text-sm font-medium">
            Dish or menu concept
          </label>
          <p className="mb-1.5 text-xs text-zinc-500">The idea you want to validate — not what you feel like eating.</p>
          <input
            id="concept"
            className={inputClass}
            placeholder="e.g. izakaya-style small plates"
            value={concept}
            maxLength={200}
            onChange={(e) => setConcept(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="city" className="block text-sm font-medium">
            Cities to pilot in
          </label>
          <p className="mb-1.5 text-xs text-zinc-500">Add one, or several to compare them side by side.</p>
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
              placeholder={cities.length === 0 ? "Type a city and press Enter…" : "Add another…"}
              value={draft}
              maxLength={100}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => addCity(draft)}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK_CITIES.map((c) => (
              <Chip key={c} active={cities.includes(c)} onClick={() => toggleQuickCity(c)}>
                + {c}
              </Chip>
            ))}
          </div>
        </div>

        <Button type="submit" disabled={loading} className="self-start">
          {loading ? "Analyzing…" : cities.length > 1 ? `Compare ${cities.length} cities` : "Analyze"}
        </Button>
      </form>
    </div>
  );
}
