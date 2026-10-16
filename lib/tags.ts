// Choosing the Qloo tag the venue search runs on, without the agent: the baseline, and the floor the
// agent's own choice must beat. The Qloo calls are passed in, so the logic is tested with stubs.

import { QlooQuotaError, type QlooPlace } from "./qloo.ts";
import type { SearchTags } from "./agent.ts";
import { extractKeywords, rankTagsForPlaceMatching } from "./venues.ts";
import type { Tag } from "./facts.ts";

/** The input couldn't be mapped to Qloo's vocabulary — a client-side problem, not an upstream failure. */
export class ConceptNotFoundError extends Error {}

export function isRateLimitError(error: unknown): boolean {
  return error instanceof QlooQuotaError;
}


/** A pilot needs candidates to choose between; fewer than this and the agent's tag must beat the baseline's. */
export const MIN_PILOT_VENUES = 3;


/** Baseline tag choice: stopword keywords + type-weighted ranking. Also the floor the agent must beat. */
export async function resolveTagDeterministically(
  concept: string,
  findVenues: (tagId: string) => Promise<QlooPlace[]>,
  searchTags: SearchTags
): Promise<{ primaryTag: Tag; places: QlooPlace[]; triedTagNames: string[] }> {
  const queries = [concept, ...extractKeywords(concept)];
  const tagResults = await Promise.all(
    queries.map(async (q) => {
      try {
        return await searchTags(q);
      } catch (error) {
        if (isRateLimitError(error)) throw error;
        return [];
      }
    })
  );
  const candidateTags = Array.from(new Map(tagResults.flat().map((t) => [t.id, t])).values());
  if (candidateTags.length === 0) {
    throw new ConceptNotFoundError(
      `Qloo couldn't find a taste tag close to "${concept}". Try rephrasing the concept (e.g. a specific cuisine or dish type).`
    );
  }

  const rankedTags = rankTagsForPlaceMatching(candidateTags);
  const triedTagNames: string[] = [];
  for (const tag of rankedTags.slice(0, 4)) {
    triedTagNames.push(tag.name);
    try {
      const found = await findVenues(tag.id);
      if (found.length > 0) return { primaryTag: tag, places: found, triedTagNames };
    } catch (error) {
      if (isRateLimitError(error)) throw error;
    }
  }
  return { primaryTag: rankedTags[0], places: [], triedTagNames };
}
