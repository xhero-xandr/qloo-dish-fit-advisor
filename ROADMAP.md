# Roadmap

Where the project stands and what is planned, in priority order. Items marked **needs owner**
cannot be done from the code alone.

## Before the demo is judged (Nov 2–16)

| # | Item | Status |
|---|------|--------|
| 1 | Run the app under a process supervisor (aaPanel/PM2) instead of a hand-started process | needs owner |
| 2 | Enable Gemini billing so judges are not pushed onto the no-LLM fallback by the free daily quota | needs owner |
| 3 | Keep `.claude/` and other local tooling out of the public repository | done |
| 4 | Unit tests for the parts that decide correctness without a network: opening-hours checks, the session signature, the rate limiter | done |
| 5 | Code-side check that numbers inside a cited claim appear in the cited facts (verdict, recommendation, risks). Venue names are still unchecked | done (numbers) |
| 4b | The checks applied to the model's answer (citations, own-venue rule, numbers, tasting window) live in `lib/guards.ts` with 11 tests | done |
| 4c | Varied, non-preset input (other cuisines, ambiguous and non-US cities, another language, gibberish, an injection attempt) run live; the problems found are fixed and tested | done |
| 4d | Tests for the Qloo client (params, spacing, 429 retry, quota exhaustion), model parking, the sign-in and analyze routes (status codes, limits, cookie flags) | done |
| 6 | Split `lib/pilot-package.ts` into `facts.ts`, `venues.ts` (data shaping), `tags.ts` (baseline tag choice) and `result-cache.ts`, each with tests; `pilot-package.ts` keeps only the orchestration | done |

## After the hackathon

Qloo endpoints and parameters we do not use yet (from the public API reference), each of which needs the
five-concept comparison before it ships:

- **Heatmap** (`filter.type=urn:heatmap`, one tag or entity as the signal): affinity per grid point, so a verdict
  could name the part of the city where the concept fits best.
- **Analysis Compare** (`/v2/analysis/compare`): Qloo's own comparison of two entity groups, as a possible
  replacement for the home-made `fitScore` in the city comparison.
- **Trending** (`/v2/trending`): weekly popularity percentile and velocity for an entity.
- **Place ranking:** `sort_by=quality` / `bias.quality`, `filter.hours` (open on a given weekday), and the external
  filters (Resy, Michelin, Tripadvisor ratings) as extra facts.
- **Taste Analysis** (`filter.type=urn:tag` with a signal): tags that describe an audience or location.
- `feature.semantic_search` on `/v2/tags`, which we use, is marked Beta by Qloo; keep the deterministic tag fallback.

- An MCP server exposing the analysis, so other agents can call it.
- Persist caches and rate limits outside process memory.
- A fixed evaluation set of five concepts, run against any prompt or data change, so verdict
  stability is checked automatically instead of by hand.

## Known limits

- Qloo quota is 10,000 requests a month, shared by every visitor; repeats are cached for 12 hours.
- Verdicts are sensitive to the prompt and to the fact set; every change needs the five-concept comparison.
- Plan "menu notes" often restate what the venue already sells.
