import { AgentPanel } from "./AgentPanel";
import { Citations } from "./Citations";
import { CulturalAffinityPanel } from "./CulturalAffinity";
import { DemographicsChart } from "./DemographicsChart";
import { Section } from "./Section";
import { TextBlock } from "./TextBlock";
import type { PilotPackage } from "./types";
import { VenueCard } from "./VenueCard";

function StepNumber({ n }: { n: number }) {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-semibold text-white dark:bg-white dark:text-zinc-900">
      {n}
    </span>
  );
}

export function Results({ result }: { result: PilotPackage }) {
  const agentPlan = result.agent?.analysis?.pilotPlan ?? [];
  const facts = new Map((result.agent?.facts ?? []).map((f) => [f.id, f]));
  return (
    <div className="mt-10 flex flex-col gap-10">
      {result.resolvedLocation && (
        <p className="text-xs text-zinc-400">
          Showing results for <span className="font-medium text-zinc-600 dark:text-zinc-300">{result.resolvedLocation}</span> — the
          location Qloo actually geocoded &quot;{result.city}&quot; to. If that&apos;s not the city you meant, add a state/country
          to disambiguate (e.g. &quot;Paris, TX&quot; vs &quot;Paris, France&quot;).
        </p>
      )}
      {result.cachedAt && (
        <p className="text-xs text-zinc-400">
          Served from cache — this exact concept and city was analyzed {new Date(result.cachedAt).toLocaleString()}, and
          that result (Qloo data and agent analysis) is reused for up to 12 hours instead of re-querying, to protect the
          shared Qloo and Gemini quotas. Nothing in it is changed or regenerated.
        </p>
      )}
      {result.limitations.length > 0 && (
        <section className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          <strong>Limitations</strong>
          <ul className="mt-1 list-inside list-disc">
            {result.limitations.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </section>
      )}

      {result.matchedTag && (
        <section>
          <p className="text-sm text-zinc-500">
            Matched Qloo tag:{" "}
            <span className="rounded-full border border-zinc-300 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
              {result.matchedTag.name}
            </span>{" "}
            <span className="text-xs text-zinc-400">({result.matchedTag.type.replace("urn:tag:", "")})</span>
          </p>
        </section>
      )}

      {result.agent && <AgentPanel agent={result.agent} />}

      {result.aggregateDemographics && (
        <Section title="Audience affinity profile" subtitle={`Averaged across ${result.venues.length} matched venues`}>
          <DemographicsChart demo={result.aggregateDemographics} />
        </Section>
      )}

      <Section title={`Candidate pilot venues`} subtitle={`${result.venues.length} real, named venues in ${result.city}`}>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {result.venues.map((v, i) => (
            <VenueCard key={i} venue={v} rank={i + 1} />
          ))}
          {result.venues.length === 0 && (
            <p className="text-sm text-zinc-500">No matching venues found for this city/concept.</p>
          )}
        </div>
      </Section>

      {result.regionInsights.length > 0 && (
        <Section
          title="What reviews of these venues talk about"
          subtitle={`Review-keyword mentions summed across ${result.venues.length} matched venue${
            result.venues.length === 1 ? "" : "s"
          }${result.venues.length < 3 ? " — too few to speak for the whole city" : ""}`}
        >
          <div className="flex flex-wrap gap-2">
            {result.regionInsights.map((r, i) => (
              <span
                key={i}
                className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-700 dark:border-zinc-800 dark:text-zinc-300"
                title={`${r.mentions} mentions`}
              >
                {r.keyword} <span className="text-zinc-400">× {r.mentions}</span>
              </span>
            ))}
          </div>
        </Section>
      )}

      {result.culturalAffinity && (
        <Section
          title="Cultural affinity (beyond food)"
          subtitle="Cross-domain Qloo graph signal seeded with the matched venues — their audience, other categories"
        >
          <CulturalAffinityPanel data={result.culturalAffinity} />
        </Section>
      )}

      <Section title="Tasting concept brief">
        <TextBlock text={result.tastingBrief} />
      </Section>

      {agentPlan.length > 0 ? (
        <Section title="Pilot plan" subtitle="Written by the agent from the cited Qloo facts">
          <ol className="flex flex-col gap-2.5">
            {agentPlan.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                <StepNumber n={i + 1} />
                <span>
                  <strong className="font-medium text-zinc-900 dark:text-zinc-100">{step.when}:</strong> {step.text}
                  <Citations ids={step.facts} facts={facts} />
                </span>
              </li>
            ))}
          </ol>
        </Section>
      ) : (
        <Section title="4-week pilot plan" subtitle="Generic template — the same steps for every concept">
          <ol className="flex flex-col gap-2">
            {result.pilotPlan.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                <StepNumber n={i + 1} />
                {step}
              </li>
            ))}
          </ol>
        </Section>
      )}

      <div className="no-print">
        <Section title="Venue owner outreach letter">
          <TextBlock text={result.ownerLetter} highlighted copyable />
        </Section>
      </div>
    </div>
  );
}
