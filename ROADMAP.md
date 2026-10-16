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
| 5 | Code-side check that numbers and venue names inside a cited sentence appear in the cited facts | planned |
| 6 | Split `lib/pilot-package.ts` (fact building, agent call, response shaping) | planned |

## After the hackathon

- An MCP server exposing the analysis, so other agents can call it.
- Persist caches and rate limits outside process memory.
- A fixed evaluation set of five concepts, run against any prompt or data change, so verdict
  stability is checked automatically instead of by hand.

## Known limits

- Qloo quota is 10,000 requests a month, shared by every visitor; repeats are cached for 12 hours.
- Verdicts are sensitive to the prompt and to the fact set; every change needs the five-concept comparison.
- Plan "menu notes" often restate what the venue already sells.
