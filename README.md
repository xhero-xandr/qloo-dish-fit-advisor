# Dish-Market Fit Advisor

Built for the [Qloo Agentic Hackathon](https://qloo.devpost.com/).

## Problem

Independent cooks and small food operators guess their way into expensive
mistakes: they pick a dish or menu concept, then find a venue and an audience
by trial and error — wasted ingredients, an empty tasting event, a pitch to
the wrong venue owner. There is no cheap way to check, before spending money,
whether a concept actually has an audience in a given city and which real
venues already attract that audience.

## What it does

You type a dish/menu concept (free text) and a city. The app runs a
Gemini agent that uses Qloo as its tools, plus a deterministic data pipeline:

1. **Agent: concept → taste tags.** Gemini gets two Qloo tools —
   `search_tags` (`GET /v2/tags`) and `find_venues`
   (`GET /v2/insights`, `filter.type=urn:entity:place`) — and a budget of 6
   calls. It splits the concept into its parts, searches each, and verifies
   which tag actually has venues in the city. For "Korean fried chicken with
   natural wine pairing" it picks *Korean Fried Chicken* as the primary tag
   (verified venues) and *Natural Wine* as a secondary signal, where a
   keyword heuristic would settle for the broad *Korean*. Code accepts only
   tag ids a Qloo tool actually returned.
2. **Pipeline: venues and audience.** For the chosen tag, real named venues
   (address, rating, price, hours, phone, dietary tags), each venue's
   audience age/gender affinity (`filter.type=urn:demographics`), review
   keywords, and cross-domain affinity — brands, TV shows, artists,
   podcasts — seeded with the matched venues themselves
   (`signal.interests.entities` + `signal.location`).
3. **Agent: analysis with citations.** Every datum from step 2 is numbered
   as a fact (F1, F2, …). Gemini writes a verdict, a recommended venue, a
   pilot plan scheduled from that venue's real opening hours, menu
   adjustments, and risks — each item citing the facts it relies on. Code
   drops any item without a valid citation and any recommended venue that
   isn't in the list; the UI lets you tap a citation to read the fact.

If Gemini is unavailable (no key, overload, error), every step falls back to
the deterministic path — keyword-based tag ranking and a template plan — and
the UI says so.

### Why this needs Qloo, not just an LLM

An LLM alone cannot name real Korean fried chicken spots in New York, tell
you which one is closed on Fridays, or tell you that their regulars
over-index on *Master of None* and The Infatuation. It would either refuse
specifics or hallucinate plausible ones. Here the model never states a fact
of its own: venues, hours, ratings, demographics, and affinities all come
from live Qloo calls, and the model's job is limited to choosing what to
look up and turning cited facts into a plan.

### Why this over existing food-intelligence tools

Tools like Tastewise or Datassential solve an adjacent problem well, but for
a different buyer: they're enterprise platforms with quote-based pricing and
a sales-demo onboarding flow, built for marketing teams at large food
brands — not something an independent chef can open and get an answer from
in two minutes for one concept. This app is free, self-serve, and scoped to
one concrete decision: type a concept and a city, get a venue shortlist,
audience data, and a plan — no sales call required.

## Qloo workflows used

| Step | Endpoint | Why |
|---|---|---|
| Tag resolution (agent tool `search_tags`) | `GET /v2/tags` (semantic search) | Map free-text concept to Qloo's controlled taste vocabulary |
| Venue discovery (agent tool `find_venues`) | `GET /v2/insights?filter.type=urn:entity:place` | Real venues in a city filtered by a taste tag; the agent uses the count to decide which tag can anchor a pilot |
| Audience profile | `GET /v2/insights?filter.type=urn:demographics` | Age/gender affinity skew for a specific venue's audience |
| Cross-domain affinity | `GET /v2/insights?filter.type=urn:entity:brand\|tv_show\|artist\|podcast` with `signal.interests.entities` (the matched venues) + `signal.location.query` | What the matched venues' own audience tends toward in other categories entirely |
| Dietary signals | `tags` on each matched venue (`urn:tag:dietary_option:qloo:*`) | Vegan/vegetarian/gluten-free/halal/etc. flags Qloo already attaches to a venue, surfaced as badges and given to the agent as facts |

The cross-domain step is the part that actually exercises Qloo's taste
**graph** rather than a single-category lookup. How it's seeded matters a
lot, and we tested the alternatives: a tag with no location returns the
tag's global audience ("izakaya" in Austin → Sapporo Beer, Japanese fashion
labels); a narrow tag *with* location returns generic city culture
("korean_fried_chicken" + New York → The New Yorker, MoMA). Seeding with the
matched venues returns their actual regulars' tastes — for the Korean fried
chicken spots in New York: The Infatuation, Eater, *Master of None*,
*Awkwafina Is Nora from Queens*, Dumbfoundead, *2 Dope Queens*.

All Qloo calls go through the official hackathon endpoint
(`https://hackathon.api.qloo.com`) using the event-issued API key, server-side
only (see `lib/qloo.ts`). No personal data is ever sent to Qloo — only the
free-text concept and city the user types.

## The agent layer (Gemini)

`lib/agent.ts`, `lib/llm.ts`. Gemini is called server-side through the
[Vercel AI SDK](https://ai-sdk.dev) (`ai` + `@ai-sdk/google`): the tag agent
is a `generateText` tool loop (`stopWhen` / `prepareStep`), and the analysis
is `generateText` with `Output.object` and a zod schema.

- **Model:** `gemini-3.5-flash-lite` (configurable via `GEMINI_MODELS`,
  a comma-separated fallback chain). Chosen by measurement: it answered
  tool turns in under a second, while 3.8-flash and 3.6-flash mostly
  returned 503, hung past 90s, or took ~55s per turn — and on the free tier
  3.8-flash allows only 20 requests/day.
- **Reproducible output:** both steps send a fixed `seed` (and
  `temperature: 0`). Measured on `gemini-3.5-flash-lite`: with the seed, 5
  identical requests returned 5 identical answers; without it, 5 different
  ones — and `temperature` made no visible difference either way (0 and 1
  behaved the same), so the seed is what does the work. Over 5 concepts × 2
  runs, the second run returned the same tag, fit, venue, plan, menu notes
  and risks, word for word, as the first. Repeatability is a convenience
  for comparing changes, not something the product's trustworthiness rests
  on; that comes from the code-side checks below.
- **Free-tier quota:** 15 requests/minute and ~500/day per model (from
  Google's own 429 `QuotaFailure` details). One analysis averages ~4.4
  Gemini requests, so ~110 analyses/day. A per-minute 429 is retried by
  the SDK with exponential backoff (4 retries: 2s, 4s, 8s, 16s). The first
  429 for a daily quota parks that model until the reported reset (10
  minutes to 6 hours), so later analyses move on at once instead of each
  sitting through ~30s of retries. Enabling billing on the Google project
  lifts both limits; no code change needed.
- **Groq backup (optional, `GROQ_API_KEY`):** once Gemini is parked, the
  analysis step (verdict, venue, plan) runs on `openai/gpt-oss-120b` via
  Groq instead of falling back to the template. Tag selection stays on
  Gemini only: in testing gpt-oss failed that tool loop in every run
  (calling tools it was told not to, skipping a required call, inventing
  tag ids) while handling the analysis fine. Groq's free tier allows 8K
  tokens/minute and 200K/day, so it is a backup for a few dozen analyses,
  slower than Gemini, and words things differently; the panel names the
  model that answered.
- **Fewer requests per analysis:** the tag agent submits its choice through
  a `submit_choice` tool call in the same loop rather than a separate JSON
  turn, and batches independent tool calls per turn.
- **Grounding:** the model can only reach Qloo through the tools; tag ids
  it returns are checked against what the tools returned; analysis items
  must cite numbered facts and are dropped if they don't; the recommended
  venue must be one of the matched venues and must cite at least one fact
  about *that* venue (citing another venue's facts is stripped).
- **The agent can't do worse than the baseline:** if its primary tag has
  fewer than 3 operating venues, code runs the deterministic tag ranking
  and keeps whichever tag has more venues — visibly, as "Overruled by
  code", with the agent's pick kept as a secondary signal. Added after the
  agent anchored "Neapolitan sourdough pizza" in Portland on a tag with one
  venue, which turned out to be a Detroit-style pizzeria, while the
  baseline tag had four Neapolitan pizzerias.
- **Honest fit:** the verdict carries a strong / moderate / weak fit rating,
  and the model is told to compare the concept's style with each venue's
  own tags and review keywords (given per venue, not just summed). In the
  last evaluation round — 5 concepts × 2 runs, all 10 completed by the
  agent — it rated vegan soul food in Atlanta "moderate" because the
  matched soul-food venues' reviews center on fried chicken and pork chops,
  and Korean fried chicken with natural wine in Chicago "moderate" because
  no matched venue carries natural wine.
- **What the checks can't do:** they verify that a citation exists, not that
  the claim follows from it. The UI says this and makes every citation
  tappable so a reader can check.
- **Data sent to Google:** the concept, the city, and the Qloo-derived fact
  sheet. No personal data.
- **Fallback:** without `GEMINI_API_KEY`, or if a step fails, the app runs
  the deterministic pipeline and shows why.
- **Tuned from live runs, not just written:** the first versions scheduled a
  "pilot" across a venue's whole opening hours for a month, claimed foot
  traffic Qloo doesn't have, and anchored on a tag with a single venue. The
  prompts now fix the format (one tasting night at one venue, on an evening
  the venue is open), forbid foot-traffic/sales/menu-price/wine-list claims,
  and require the thin-evidence and unsupported-secondary signals to be
  stated as risks; the 3-venue minimum is enforced in code, since the model
  ignored it when it was only in the prompt.

Venues that can't host a pilot are filtered before anyone sees them:
Qloo's `is_closed`, plus listings with every day of the week marked closed —
seen live with `is_closed=false`, a stale flag on a shut venue.

## API rate limits

The hackathon key is capped at **5 requests/second and 10,000/month**
(confirmed from Qloo's own `x-second-ratelimit-limit` / `x-month-ratelimit-limit`
response headers), shared across every request this server makes — regardless
of how many browser tabs or concurrent city comparisons triggered them.

Rather than fight that with an artificial request budget, `lib/qloo.ts`
serializes every outbound Qloo call through one spaced queue and retries on
429 (honoring the `x-second-ratelimit-reset` header when present, up to 12
attempts) instead of failing fast — unless `x-month-ratelimit-remaining` is
0, in which case it fails immediately with a clear message, since waiting
can't fix an exhausted monthly quota. An analysis is allowed to take longer than
usual under load; the reverse proxy in front of this app is configured with
an 86400s read timeout specifically so a slow-but-patient retry never gets
cut off upstream. If Qloo raises this key's limits for the event, the app
gets faster automatically — no code change needed.

On top of that, identical concept+city requests are served from an
in-memory cache (`lib/pilot-package.ts`, 12 hours by default, configurable
via `PILOT_CACHE_TTL_MINUTES`) instead of re-querying. The long default is
deliberate: venue data doesn't change hour to hour, and the free Gemini tier
allows ~500 requests/day (~110 analyses at ~4.4 requests each). The cache
only saves quota on repeats — presets, reloads, re-running a comparison — so
each of those costs quota once per half day, not once per visitor. A new
concept or city always runs a fresh analysis, so the daily Gemini quota, not
the cache, is what bounds free-form use. A result where the agent fell back (Gemini
overloaded or out of quota) is cached for only 10 minutes, so a brief outage
doesn't pin the degraded version. The cache is in memory, so a restart
clears it. The
response is marked with `cachedAt` when this happens, and the UI discloses
it rather than silently reusing data. Concurrent identical requests (a
double-submit, a second tab) join the run already in progress instead of
starting a second full pipeline, and the API rejects inputs over 200
(concept) / 100 (city) characters.

## Known limitations

- The multi-city "Best fit" verdict is our own heuristic, not a Qloo score:
  `venues found × 2 + average rating`. More matching venues weighs more
  heavily than a slightly higher rating — a city with 3 modest-rated venues
  can outrank a city with 2 excellent ones. Since at most 4 venues are kept
  per city, any two cities that both hit that cap are separated by average
  rating alone. This is disclosed in the UI next to the verdict, not left as
  an unexplained badge — but it is a coarse heuristic, not a fit model.
- The deterministic fallback's keyword extraction caps at 3 keywords (plus
  the full phrase), so for a long concept later words never reach Qloo —
  "Korean fried chicken with natural wine pairing" only searches "korean",
  "fried", "chicken". The agent path doesn't have this problem; the fallback
  does, and is only used when Gemini is unavailable.
- The agent's citation check proves a cited fact exists, not that it
  supports the claim. In testing, the lighter fallback model occasionally
  cited facts loosely; the prompt forbids claims Qloo can't back (foot
  traffic, sales, menu prices, wine lists), but a reader should still tap
  the citations.
- Venue ordering within a matched tag is by business rating, not by a true
  relevance/affinity score — the plain tag-filter endpoint doesn't return one.
  A future version could cross-check with the signal-based `recommend`
  workflow to rank by affinity instead.
- Demographic data describes *group* taste affinity, not individual
  behavior — it tells you who tends to like a venue, not what any one person
  will do.
- If a concept is too niche for a city, the pipeline tries up to 4 candidate
  tags before giving up; it reports which tags it tried in `limitations`
  rather than silently returning nothing or a bad guess.
- The tasting brief and outreach letter are still fixed templates with Qloo
  data interpolated (the letter addresses the agent's recommended venue).
  The pilot plan is agent-written when Gemini is available and falls back to
  a generic, clearly labelled template otherwise.
- There is no per-IP throttling. The cache, in-flight dedupe, and input caps
  limit waste, but a determined visitor firing many distinct queries can
  still exhaust the shared monthly key (~600 full analyses).
- Venue data is sourced from fixed-location business listings (address,
  phone, hours, rating) — the same shape as Google Places/Yelp. Food trucks,
  street carts, and pop-ups are structurally underrepresented or absent:
  taxonomy tags like `food_truck` and `street_food` exist in Qloo's tag
  vocabulary, but querying them returns stationary venues loosely associated
  with the vibe (wineries, breweries, markets), not actual mobile vendors —
  confirmed by direct testing, not assumed. This app is built for pilots at
  an existing fixed venue; it is not a fit for validating a food-truck or
  street-stall concept, where the decision depends on foot traffic and permit
  location rather than venue listings.
- No foot-traffic or visit-volume data (how many people actually walk in per
  day) is available. Qloo's `popularity` field is a relative affinity/rank
  score within its taste graph, not a visitor count, and it is never
  presented as one in this app. Qloo has no mobile-location-panel data
  (the kind SafeGraph, Placer.ai, or Foursquare provide) — that's a
  different data category entirely. For actual footfall, pair this tool's
  output with a dedicated foot-traffic provider; this app answers "is the
  audience right for this venue," not "how many people pass by it."

## Possible next steps

- **Tune the model.** The agent runs on defaults for everything except
  `seed` and `temperature`. If you run it for real, the next levers are
  output length, reasoning effort, or another model entirely; compare
  candidates on a fixed set of concepts and keep the one with the best
  answers. Don't trust a parameter because the API accepted it: check the
  effect on output (the seed test above is an example).
- **Tighten the fact checks.** Today the code verifies that citations exist,
  that the venue is a matched one and cites its own facts. It does not yet
  check that numbers or venue names in a sentence appear in the facts it
  cites.
- **Expose it as an MCP server**, so other agents can call the same
  analysis directly.

## Running locally

```bash
npm install
cp .env.example .env.local   # fill in QLOO_API_KEY
npm run dev                   # http://localhost:3077
```

Production:

```bash
npm run build
npm run start                 # http://localhost:3077
```

Or via PM2 (what the live demo uses):

```bash
pm2 start ecosystem.config.js
pm2 save
```

## Stack

Next.js 16 (App Router, Route Handlers) + TypeScript + Tailwind CSS. No
database — every request is a fresh, live round-trip to Qloo.

## License

MIT — see [LICENSE](./LICENSE).
