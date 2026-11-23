# Changelog

Format: newest first. One entry per merged PR.

## Unreleased

- M2: fictional reference game `0000-reference` (shooting, placing, both station modes, recycling, climb, awards, RPs, Overdrive rules hook), games registry, and per-game validity/smoke tests. Shooters now solve for hood pitch and flywheel speed within `pitchRangeDeg`. Pieces have no drag in flight and rolling resistance on the ground.

- M1: headless sim core (`src/engine/sim`). It covers the `GameDefinition` schema, blue-half authoring with rotational/mirror expansion, validation, Rapier world, traction-limited swerve drive, intake, HP stations, timed placing, ballistic shooting with spread, aperture scoring, recycling, endgame actions, leave/park awards, RPs, fouls, rules hooks and a score ledger.

- M0: project scaffold (Vite, TypeScript, Three.js, Rapier, Vitest, ESLint, Prettier), CI and GitHub Pages workflows, ADRs 0001-0003.
