import { AgentPanel } from "./AgentPanel";
import { Citations } from "./Citations";
import { CulturalAffinityPanel } from "./CulturalAffinity";
import { DemographicsChart } from "./DemographicsChart";
import { Section } from "./Section";
import { TextBlock } from "./TextBlock";
import type { PilotPackage } from "./types";
import { VenueCard } from "./VenueCard";

// Not generated and not from Qloo: the standard way to decide whether a one-night pilot worked.
// Agreeing the numbers beforehand is the point; the thresholds are examples to adjust.
const JUDGING_STEPS = [
  {
    title: "Agree the bar before the night",
    text: 'write down, with the venue, what counts as success (for example "at least 60% of guests would order it again and one dish clearly stands out") so the result can\'t be argued afterwards.',
  },
  {
    title: "Count what happened",
    text: "guests booked vs. guests who came, how many portions of each dish were eaten, and what was left on the plates.",
  },
  {
    title: "Ask one question on the way out",
    text: '"Would you order this again at this venue?" — a yes/no on paper beats a general impression.',
  },
  {
    title: "Decide the next step in advance",
    text: "most guests say yes and the owner is interested: negotiate a limited-time menu; only one or two dishes land: rework the menu and run a second night; lukewarm across the board: stop, or try another venue from the shortlist.",
  },
  {
    title: "Settle the practicalities first",
    text: "who holds the licence to serve alcohol and which food-safety rules apply to a guest chef in that venue's kitchen — Qloo has no data on either.",
  },
];

function StepNumber({ n }: { n: number }) {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white dark:bg-white dark:text-slate-900">
      {n}
    </span>
  );
}

export function Results({ result }: { result: PilotPackage }) {
  const agentPlan = result.agent?.analysis?.pilotPlan ?? [];
  const facts = new Map((result.agent?.facts ?? []).map((f) => [f.id, f]));
  return (
    <div className="mt-10 flex flex-col gap-10">
      {(result.resolvedLocation || result.cachedAt) && (
        <div className="-mb-4 flex flex-col gap-1 text-xs text-slate-400">
          {result.resolvedLocation && (
            <p>
              Results for <span className="font-medium text-slate-600 dark:text-slate-300">{result.resolvedLocation}</span> (where Qloo
              placed &quot;{result.city}&quot;). Not the city you meant? Add a state or country, e.g. &quot;Paris, TX&quot;.
            </p>
          )}
          {result.cachedAt && (
            <p>
              From cache: analyzed {new Date(result.cachedAt).toLocaleString()}. Repeats are reused for up to 12 hours to
              protect the shared API quotas; a new concept or city always runs fresh.
            </p>
          )}
        </div>
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

      <nav
        aria-label="Sections"
        className="no-print sticky top-0 z-10 -mx-2 flex gap-1.5 overflow-x-auto border-b border-slate-200 bg-white/90 px-2 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90"
      >
        {[
          result.agent ? ["verdict", "Verdict"] : undefined,
          ["plan", "Pilot plan"],
          ["venues", "Venues"],
          result.aggregateDemographics ? ["audience", "Audience"] : undefined,
          result.culturalAffinity ? ["culture", "Beyond food"] : undefined,
          ["letter", "Letter"],
        ]
          .filter((x): x is string[] => Boolean(x))
          .map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="shrink-0 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
            >
              {label}
            </a>
          ))}
      </nav>

      {result.agent && (
        <div id="verdict" className="scroll-mt-16">
          <AgentPanel agent={result.agent} />
        </div>
      )}

      {agentPlan.length > 0 ? (
        <Section id="plan" title="Pilot plan" subtitle="Written by the agent from the cited Qloo facts">
          <ol className="flex flex-col gap-2.5">
            {agentPlan.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-slate-700 dark:text-slate-300">
                <StepNumber n={i + 1} />
                <span>
                  <strong className="font-medium text-slate-900 dark:text-slate-100">{step.when}:</strong> {step.text}
                  <Citations ids={step.facts} facts={facts} />
                </span>
              </li>
            ))}
          </ol>
        </Section>
      ) : (
        <Section id="plan" title="4-week pilot plan" subtitle="Generic template — the same steps for every concept">
          <ol className="flex flex-col gap-2">
            {result.pilotPlan.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-slate-700 dark:text-slate-300">
                <StepNumber n={i + 1} />
                {step}
              </li>
            ))}
          </ol>
        </Section>
      )}

      <Section title="How to judge the pilot" subtitle="General practice for a one-night pilot — not derived from Qloo data">
        <ul className="flex flex-col gap-2.5 text-sm text-slate-700 dark:text-slate-300">
          {JUDGING_STEPS.map((step) => (
            <li key={step.title} className="flex gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
              <span>
                <strong className="font-medium text-slate-900 dark:text-slate-100">{step.title}:</strong> {step.text}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      {result.matchedTag && (
        <section>
          <p className="text-sm text-slate-500">
            Matched Qloo tag:{" "}
            <span className="rounded-full border border-slate-300 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300">
              {result.matchedTag.name}
            </span>{" "}
            <span className="text-xs text-slate-400">({result.matchedTag.type.replace("urn:tag:", "")})</span>
          </p>
        </section>
      )}

      <Section id="venues" title={`Candidate pilot venues`} subtitle={`${result.venues.length} real, named venues in ${result.city}`}>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {result.venues.map((v, i) => (
            <VenueCard key={i} venue={v} rank={i + 1} recommended={v.name === result.agent?.analysis?.recommendedVenue?.name} />
          ))}
          {result.venues.length === 0 && (
            <p className="text-sm text-slate-500">No matching venues found for this city/concept.</p>
          )}
        </div>
      </Section>

      {result.aggregateDemographics && (
        <Section id="audience" title="Audience affinity profile" subtitle={`Averaged across ${result.venues.length} matched venues`}>
          <DemographicsChart demo={result.aggregateDemographics} />
        </Section>
      )}

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
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700 dark:border-slate-800 dark:text-slate-300"
                title={`${r.mentions} mentions`}
              >
                {r.keyword} <span className="text-slate-400">× {r.mentions}</span>
              </span>
            ))}
          </div>
        </Section>
      )}

      {result.culturalAffinity && (
        <Section
          id="culture"
          title="Cultural affinity (beyond food)"
          subtitle="Cross-domain Qloo graph signal seeded with the matched venues — their audience, other categories"
        >
          <CulturalAffinityPanel data={result.culturalAffinity} />
        </Section>
      )}

      <Section title="Tasting concept brief">
        <TextBlock text={result.tastingBrief} />
      </Section>

      <div className="no-print">
        <Section id="letter" title="Venue owner outreach letter">
          <TextBlock text={result.ownerLetter} highlighted copyable />
        </Section>
      </div>
    </div>
  );
}
