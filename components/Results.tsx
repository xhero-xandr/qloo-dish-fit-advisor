"use client";

import { useState } from "react";
import { ownerLetterFor } from "@/lib/letter";
import { AgentPanel } from "./AgentPanel";
import { Explainers } from "./Explainers";
import { AudienceSection, GuestGroups } from "./AudienceSection";
import { BriefSummary } from "./BriefSummary";
import { Citations } from "./Citations";
import { CulturalAffinityPanel } from "./CulturalAffinity";
import { KeywordBars } from "./KeywordBars";
import { MobileTabs, type ReportTab } from "./MobileTabs";
import { ReportHeader, priceSummary } from "./ReportHeader";
import { Section } from "./Section";
import { TagChoice } from "./TagChoice";
import { TextBlock } from "./TextBlock";
import type { PilotPackage } from "./types";
import { VenueCard } from "./VenueCard";
import { WhyAndWhere } from "./WhyAndWhere";

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

const DESKTOP_SECTIONS: [string, string][] = [
  ["verdict", "Verdict"],
  ["audience", "Audience"],
  ["culture", "Beyond food"],
  ["venues", "Venues"],
  ["plan", "Pilot plan"],
  ["letter", "Letter"],
];

export function Results({
  result,
  cityCount = 1,
  busy = false,
  onRetag,
  onEditMenu,
}: {
  result: PilotPackage;
  cityCount?: number;
  busy?: boolean;
  /** Re-run with a category the chef picked, or with none to let the agent choose again. */
  onRetag?: (tag?: { id: string; name: string }) => void;
  /** The phone's Menu tab: back to the form. */
  onEditMenu?: () => void;
}) {
  const [tab, setTab] = useState<ReportTab>("verdict");
  const agentPlan = result.agent?.analysis?.pilotPlan ?? [];
  const facts = new Map((result.agent?.facts ?? []).map((f) => [f.id, f]));
  // Two branches can share a name; only the first one is the recommended venue.
  const recommendedName = result.agent?.analysis?.recommendedVenue?.name;
  const recommendedIndex = recommendedName
    ? result.venues.findIndex((v) => v.name === recommendedName)
    : -1;
  const prices = priceSummary(result);
  // The chef may pick another venue than the agent's; the letter follows that choice.
  const [picked, setPicked] = useState<number>();
  const chosenIndex = picked ?? (recommendedIndex >= 0 ? recommendedIndex : 0);
  const chosenVenue = result.venues[chosenIndex];
  const letter =
    picked === undefined || picked === recommendedIndex
      ? result.ownerLetter
      : ownerLetterFor(
          chosenVenue,
          result.dishLabel ?? result.concept,
          result.city,
        );

  // On a phone one group shows at a time (bottom tabs); on a wide screen and in print, all of them.
  const group = (name: ReportTab) =>
    `flex flex-col gap-8 lg:flex print:flex ${tab === name ? "" : "max-lg:hidden"}`;

  return (
    <div className="flex flex-col gap-8 pb-24 lg:pb-0">
      <nav
        aria-label="Sections"
        className="no-print sticky top-0 z-10 -mx-2 hidden gap-1.5 overflow-x-auto border-b border-zinc-200 bg-white/90 px-2 py-2 backdrop-blur lg:flex dark:border-zinc-800 dark:bg-zinc-950/90"
      >
        {DESKTOP_SECTIONS.filter(
          ([id]) => id !== "culture" || result.culturalAffinity,
        ).map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="shrink-0 rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            {label}
          </a>
        ))}
      </nav>

      <div id="verdict" className={`scroll-mt-16 ${group("verdict")}`}>
        <ReportHeader result={result} letter={letter} />
        {result.limitations.length > 0 && (
          <section className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <strong>Limitations</strong>
            <ul className="mt-1 list-inside list-disc">
              {result.limitations.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </section>
        )}
        <WhyAndWhere result={result} recommendedIndex={recommendedIndex} />
        <TagChoice
          result={result}
          cityCount={cityCount}
          busy={busy}
          onRetag={onRetag}
        />
        <BriefSummary result={result} />
        {(result.resolvedLocation || result.cachedAt) && (
          <div className="flex flex-col gap-1 text-xs text-zinc-500">
            {result.resolvedLocation && (
              <p>
                Results for{" "}
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {result.resolvedLocation}
                </span>{" "}
                (where Qloo placed &quot;{result.city}&quot;). Not the city you
                meant? Add a state or country, e.g. &quot;Paris, TX&quot;.
              </p>
            )}
            {result.cachedAt && (
              <p>
                From cache: analyzed{" "}
                {new Date(result.cachedAt).toLocaleString()}. Repeats are reused
                for up to 12 hours to protect the shared API quotas; a new
                concept or city always runs fresh.
              </p>
            )}
          </div>
        )}
      </div>

      <div id="audience" className={`scroll-mt-16 ${group("audience")}`}>
        {result.aggregateDemographics ? (
          <AudienceSection
            result={result}
            aggregate={result.aggregateDemographics}
            recommendedIndex={recommendedIndex}
          />
        ) : (
          <>
            <p className="text-sm text-zinc-500">
              Qloo returned no age or gender data for these venues.
            </p>
            <GuestGroups result={result} />
          </>
        )}
        {result.regionInsights.length > 0 && (
          <Section
            title="What guests talk about"
            subtitle={`Review-keyword mentions, all ${result.venues.length} matched venue${result.venues.length === 1 ? "" : "s"} together${
              result.venues.length < 3
                ? " — too few to speak for the whole city"
                : ""
            }`}
          >
            <div className="flex flex-col gap-4">
              <KeywordBars items={result.regionInsights} />
              <Explainers
                shows="The words and dishes that come up most in reviews of these venues, counted across all of them."
                use="See what guests already value or notice: a dish they order, a vegetarian option, the wait. Answer it in your tasting menu and in how you run the night."
                notMean="It is not a rating or a mood: “wait time” may be a complaint. And these are reviews of the venues, not of your dish."
              />
            </div>
          </Section>
        )}
        {result.culturalAffinity && (
          <div id="culture" className="scroll-mt-16">
            <Section
              title="Beyond food: what these guests also like"
              subtitle="Ideas for promotion and collaborations — Qloo's cross-domain signal for the audience of the matched venues"
            >
              <div className="flex flex-col gap-4">
                <CulturalAffinityPanel data={result.culturalAffinity} />
                <Explainers
                  shows="Brands, TV shows, music and podcasts that people who like these venues like more than the average person, from Qloo's taste data across categories."
                  use="Ideas for the evening and its promotion: a playlist, a local brand to partner with, the shows and podcasts to reference or advertise near."
                  notMean="It does not show that these guests will buy your dish, and the list is not ranked by how popular each item is."
                />
              </div>
            </Section>
          </div>
        )}
      </div>

      <div id="venues" className={`scroll-mt-16 ${group("venues")}`}>
        <Section
          plain
          title="Candidate pilot venues"
          subtitle={`${result.venues.length} real, named venues in ${result.city}`}
        >
          {prices && (
            <p className="mb-4 text-sm text-zinc-500">
              Price level of these venues: {prices}. A reference for where the
              dish would sit, not a price recommendation.
            </p>
          )}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {result.venues.map((v, i) => (
              <VenueCard
                key={i}
                venue={v}
                rank={i + 1}
                recommended={i === recommendedIndex}
                chosen={i === chosenIndex}
                onChoose={() => setPicked(i)}
              />
            ))}
            {result.venues.length === 0 && (
              <p className="text-sm text-zinc-500">
                No matching venues found for this city/concept.
              </p>
            )}
          </div>
        </Section>
      </div>

      <div id="plan" className={`scroll-mt-16 ${group("plan")}`}>
        <Section
          title="4-week pilot plan"
          subtitle={
            agentPlan.length > 0
              ? "Written by the agent from the cited Qloo facts"
              : "Generic template — the same steps for every concept"
          }
        >
          {agentPlan.length > 0 &&
            picked !== undefined &&
            picked !== recommendedIndex &&
            recommendedName &&
            chosenVenue && (
              <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                The agent wrote this plan for {recommendedName}. You chose{" "}
                {chosenVenue.name}: the letter below follows your choice; check
                the plan&apos;s day and time against {chosenVenue.name}&apos;s
                hours under Venues.
              </p>
            )}
          <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {(agentPlan.length > 0
              ? agentPlan.map((s) => ({
                  when: s.when,
                  text: s.text,
                  ids: s.facts,
                }))
              : result.pilotPlan.map((text, i) => ({
                  when: `Step ${i + 1}`,
                  text,
                  ids: [] as string[],
                }))
            ).map((step, i) => (
              <li
                key={i}
                className="border-t-[3px] border-accent-400 pt-2.5 text-sm leading-relaxed"
              >
                <p className="text-xs font-semibold text-accent-800 dark:text-accent-300">
                  {step.when}
                </p>
                <p className="mt-1 text-zinc-800 dark:text-zinc-200">
                  {step.text}
                  <Citations ids={step.ids} facts={facts} />
                </p>
              </li>
            ))}
          </ol>
        </Section>

        <Section
          title="How to judge the pilot"
          subtitle="General practice for a one-night pilot — not derived from Qloo data"
        >
          <ul className="flex flex-col gap-2.5 text-sm text-zinc-700 dark:text-zinc-300">
            {JUDGING_STEPS.map((step) => (
              <li key={step.title} className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                <span>
                  <strong className="font-medium text-zinc-900 dark:text-zinc-100">
                    {step.title}:
                  </strong>{" "}
                  {step.text}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Tasting concept brief">
          <TextBlock text={result.tastingBrief} />
        </Section>
        <div id="letter" className="no-print scroll-mt-16">
          <Section
            title="Venue owner outreach letter"
            subtitle={
              chosenVenue
                ? `For ${chosenVenue.name}${chosenIndex === recommendedIndex ? ", the agent's pick" : ", the venue you chose"}. Choose another venue under Venues to rewrite it.`
                : undefined
            }
          >
            <TextBlock text={letter} highlighted copyable />
          </Section>
        </div>
      </div>

      {result.agent && (
        <div className={group("verdict")}>
          <AgentPanel agent={result.agent} />
        </div>
      )}

      <MobileTabs
        active={tab}
        onChange={(t) => {
          setTab(t);
          window.scrollTo({ top: 0 });
        }}
        onMenu={onEditMenu}
      />
    </div>
  );
}
