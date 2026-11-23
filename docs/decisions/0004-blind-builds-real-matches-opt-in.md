# 0004: Build games from the manual only; comparing with real matches is opt-in

- Status: accepted
- Date: 2026-11-23

## Context

The owner will feed the 2027 manual at kickoff, when no matches have been played. If the pipeline relies on real match data, through calibration or "does this look like a real event" checks, it can't work at kickoff. Past-season stress tests that peek at real results would also overstate how well the pipeline does on a new game.

## Decision

- A game is generated only from the manual, the reveal video and general FRC engineering knowledge. Real match results, scores, scouting data and event statistics (TBA, Statbotics, match13, recalled outcomes) aren't consulted. The same rule applies to past seasons, which get a blind build.
- Verification uses checks derived from the manual instead:
  - a piece ceiling from available pieces and target capacities
  - cycle-time arithmetic
  - bonus-RP thresholds as the designers' intent
  - difficulty ordering
- `npm run calibrate` and per-game `calibration.ts` and `CALIBRATION.md` remain available, but only on the owner's explicit request. That work happens after the blind build, as its own commit.

## Consequences

- Archetype numbers are estimates, and `SOURCES.md` says what each estimate is based on.
- A stress test shows how a kickoff build will really turn out. Any real-match comparison the owner asks for then measures the blind build's error honestly.
