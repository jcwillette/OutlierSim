# 0005: Win probability runs headless matches in Web Workers

- Status: accepted
- Date: 2026-11-24

## Context

Spectator mode should estimate how likely each alliance is to win with a given setup (robots, roles, strategy, bot skill) over about 1000 match-ups. One headless match is ~1-2 s of CPU (Rapier at 60 Hz plus six bot planners), so 1000 on the page's main thread would take half an hour and freeze the UI. The engine is already DOM-free (ADR 0002) and deterministic per seed.

## Decision

- Each match-up is a full, unmodified `Match` + `attachBots` run (`runMatchup` in `src/ui/montecarlo.ts`): no reduced physics rate or simplified model, so the estimate matches what spectators see.
- Runs fan out to module Web Workers (`src/ui/montecarlo.worker.ts`), one per logical core (at most 16; `defaultThreads`). The page is nearly idle during a run, so it doesn't need a core of its own: on 4 cores, 4 workers did 19 % more match-ups per second than 3, and 6 workers were no faster than 4. Each worker loads its own Rapier instance, gets the spec once, then pulls one seed at a time from the page, so slow cores don't stall the tail. Results stream back per match-up and the UI redraws at most once per frame.
- Match-up `i` uses seed `baseSeed + i`. Random robot slots are dealt from a stream derived from the seed (`dealRng`), separate from the match's own stream, so any sample can be replayed exactly in the 3D view.
- Win rates carry a 95 % Wilson interval so small or stopped runs aren't over-read.

## Consequences

- The worker is a second bundle that duplicates the engine and Rapier's inlined WASM (~4.4 MB). It is only fetched when a run starts.
- 1000 match-ups still take minutes. The screen shows progress, an ETA and partial results, and Stop keeps them. Matches got about 2× faster without changing any result (ADR 0006). With one worker per core, a 2023 run on 4 cores went from 7.3 min (first version) to about 2.7 min.
- Nav grids and shot spots are cached per game definition, so each worker builds them once per run, not once per match.
- `src/ui/montecarlo.ts` stays DOM-free so it is unit-tested in Node and could back a parallel CLI later.
