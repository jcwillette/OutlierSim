# 0003: Generic engine plus declarative per-game definitions and abstracted mechanisms

- Status: accepted
- Date: 2026-11-23

## Context

A new game has to be produced quickly and reliably from a manual. Hand-writing a whole game each season is slow and error-prone.

## Decision

- Each season is a `GameDefinition` (data) in `src/games/<year>-<slug>/definition.ts`. Optional `rules.ts` hooks cover mechanics the schema can't express, and optional `bots.ts` adds strategy hints for the AI.
- Robot mechanisms are abstracted rather than simulated as linkages:
  - Intake is a sensor volume at the front of the robot.
  - Placing is a timed action at a scoring target.
  - Shooting launches a real ballistic projectile, so shots can miss.
  - Climbing and other endgame actions are timed actions inside a zone.
- Every number taken from a manual is cited in `SOURCES.md`.

## Consequences

- When a new game needs something the schema can't express, first try `rules.ts`. Generalize it into the engine only when a second game needs it too.
- The feel depends on robot archetype numbers (speed, cycle times, accuracy). These are engineering estimates from the manual's constraints and typical mechanism speeds (ADR 0004).
