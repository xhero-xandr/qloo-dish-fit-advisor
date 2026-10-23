"use client";

import { useState } from "react";
import { coreAgeLabel, genderLean } from "@/lib/audience";
import { oneLine } from "@/lib/input";
import { PRICE_LABEL } from "./constants";
import type { Fit, PilotPackage } from "./types";

const HEADLINE: Record<Fit, (city: string) => string> = {
  strong: (city) => `Worth a pilot: a strong match in ${city}`,
  moderate: (city) => `Worth a careful pilot: a partial match in ${city}`,
  weak: (city) => `A weak match in ${city}`,
};

/** "$ × 3, $$ × 1" for the matched venues, or undefined when Qloo lists no price levels. */
export function priceSummary(result: PilotPackage): string | undefined {
  const text = [1, 2, 3, 4]
    .map(
      (level) =>
        [
          level,
          result.venues.filter((v) => v.priceLevel === level).length,
        ] as const,
    )
    .filter(([, count]) => count > 0)
    .map(([level, count]) => `${PRICE_LABEL[level]} × ${count}`)
    .join(", ");
  return text || undefined;
}

function headline(result: PilotPackage): string {
  if (result.venues.length === 0) return `No venues to pilot in ${result.city}`;
  const fit = result.agent?.analysis?.verdict?.fit;
  return fit
    ? HEADLINE[fit](result.city)
    : `${result.venues.length} venue${result.venues.length === 1 ? "" : "s"} to pilot in ${result.city}`;
}

function Tile({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3.5 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold first-letter:uppercase">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-zinc-500">{note}</p>
    </div>
  );
}

/** The answer first: a one-line headline and the four numbers a chef decides on. */
export function ReportHeader({
  result,
  letter,
}: {
  result: PilotPackage;
  letter: string;
}) {
  const [copied, setCopied] = useState(false);
  const fit = result.agent?.analysis?.verdict?.fit;
  const audience = result.aggregateDemographics;
  const core = audience ? coreAgeLabel(audience) : undefined;
  const prices = priceSummary(result);
  const tag = result.matchedTag?.name;

  async function copyLetter() {
    try {
      await navigator.clipboard.writeText(letter);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the letter is still on the page to select by hand.
    }
  }

  return (
    <header className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-zinc-500">
            {oneLine(result.concept)} · {result.city}
            {tag && (
              <>
                {" "}
                · read as{" "}
                <strong className="font-semibold text-accent-800 dark:text-accent-300">
                  {tag}
                </strong>
              </>
            )}
          </p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
            {headline(result)}
          </h1>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
          >
            Save as PDF
          </button>
          {result.venues.length > 0 && (
            <button
              type="button"
              onClick={copyLetter}
              className="rounded-xl bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-700"
            >
              {copied ? "Letter copied" : "Copy letter to venue"}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="Fit"
          value={fit ?? "—"}
          note={
            fit
              ? "The agent's verdict, from Qloo facts"
              : "No agent verdict this time"
          }
        />
        <Tile
          label="Venues to pilot in"
          value={String(result.venues.length)}
          note={tag ? `Matched “${tag}” in Qloo` : "No matching category"}
        />
        <Tile
          label="Core guests"
          value={core ?? (audience ? "No clear group" : "—")}
          note={
            audience
              ? genderLean(audience).replace(/^./, (c) => c.toUpperCase())
              : "No audience data"
          }
        />
        <Tile
          label="Price level"
          value={prices ?? "Not listed"}
          note="Of the matched venues"
        />
      </div>
    </header>
  );
}
