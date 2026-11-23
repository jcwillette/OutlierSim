# Changelog

Format: newest first. One entry per merged PR.

## Unreleased

- Fix: the pre-match countdown runs on wall-clock time, so slow frames don't stretch it. The e2e smoke test waits on match state instead of fixed sleeps, because software WebGL on CI runners is slow.
- Pipeline policy (ADR 0004): games are built only from the manual and video. Comparing with real matches is opt-in and only runs on the owner's request. The skill's verify step now uses checks derived from the manual (piece ceiling, cycle math, RP design intent, difficulty ordering), and the calibration starter moved out of the default template to `src/games/_template-calibration/`.
- M5: generation pipeline. Adds the `frc-game-from-manual` skill (pipeline, extraction checklist, mapping cookbook), the `src/games/_template` starter, `tools/ingest-manual.sh`, `tools/ingest-video.sh`, `npm run calibrate` (TBA comparison, writes CALIBRATION.md), a Playwright smoke test with a CI job, and `?game=` deep links. Also fixes `aria-label` attributes in the menu.
- M4: generic bot AI (nav grid + A*, cycle-rate utility planner, shot spots, approach headings, endgame timing, defense role, easy/normal/hard), wired into the client. The menu gains partner/opponent difficulty, mixed robot types, and an auto-routine toggle for the player. Adds a headless `npm run sim` CLI.

- M3: playable 3D client. It has a Three.js field built from the definition, driver-station/chase/overhead cameras, field-oriented keyboard and gamepad driving, auto-intake, a HUD with context hints, indicators and announcements, a pause menu, and a results screen with score and RP breakdowns.

- M2: fictional reference game `0000-reference` (shooting, placing, both station modes, recycling, climb, awards, RPs, Overdrive rules hook), games registry, and per-game validity/smoke tests. Shooters now solve for hood pitch and flywheel speed within `pitchRangeDeg`. Pieces have no drag in flight and rolling resistance on the ground.

- M1: headless sim core (`src/engine/sim`). It covers the `GameDefinition` schema, blue-half authoring with rotational/mirror expansion, validation, Rapier world, traction-limited swerve drive, intake, HP stations, timed placing, ballistic shooting with spread, aperture scoring, recycling, endgame actions, leave/park awards, RPs, fouls, rules hooks and a score ledger.

- M0: project scaffold (Vite, TypeScript, Three.js, Rapier, Vitest, ESLint, Prettier), CI and GitHub Pages workflows, ADRs 0001-0003.
