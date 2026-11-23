# Changelog

Format: newest first. One entry per merged PR.

## Unreleased

- Spectator mode: **Watch 6 bots** in the menu (or `?watch=1`) runs a match with six bots and no player robot, with a difficulty per alliance. It adds a broadcast-style sideline camera that pans with the robots. You can follow any robot (`1`-`6`, `Tab`, gamepad bumpers) with a ring marker and a panel saying what its bot is doing and how many points it has scored. Playback runs from 0.25x to 4x (`[` / `]`, D-pad). The e2e smoke test now also watches every game in spectator mode.
- Game: **2023 Charged Up** (`2023-chargedup`), a blind stress-test build from the 2023 manual and January Team Updates only. It has 27 individual nodes per alliance with links, supercharge, the co-op grid, and the Sustainability and Activation RPs. The Charge Station is a drivable ramp with slots: dock and engage, one robot at a time, and LEVEL is decided by who boarded last. It also has a shelf double substation, a single-substation chute, and four archetypes (elevator, mid-level arm, cube specialist, kitbot). Everything is cited in `SOURCES.md`, with simplifications and a plausibility table.
- Engine (generic, needed by 2023):
  - New schema features:
    - `cone` piece shape.
    - `ScoringTarget.display`: scored pieces are drawn in their target.
    - `HumanPlayerStation.handoffHeight` / `handoffSec`: shelf stations need a tall intake and time to line up.
    - `EndgameAction.oneAtATime`: robots board a shared platform one by one.
    - `AllianceSummary.sources`: points by source, for custom RPs.
  - Robots that finish an endgame action in auto are released at teleop.
  - Preload is a priority list ("1 cone or 1 cube"), and the validator only warns if a robot can hold none of it.
- Bot AI:
  - Plans auto endgame actions near the end of auto.
  - Endgame claims are per physical spot.
  - Accounts for a queue on one-at-a-time actions.
  - Idle bots pre-position for the endgame.
  - When full, it judges score options over the whole cycle, including the trip to the next piece, so it no longer dumps a preload low when the top is worth more.
  - Skips place spots where a robot is parked, and backs off spots it got stuck on.
  - Respects station handoff height. The reference game's scores are unchanged (about 650 normal / 470 easy).
- Skill: corrected the symmetry guidance (2023 is mirrored, not rotational). The mapping cookbook covers node grids, shelf stations, one-at-a-time platforms and auto docking.

- Fix: the pre-match countdown runs on wall-clock time, so slow frames don't stretch it. The e2e smoke test waits on match state instead of fixed sleeps, because software WebGL on CI runners is slow.
- Pipeline policy (ADR 0004): games are built only from the manual and video. Comparing with real matches is opt-in and only runs on the owner's request. The skill's verify step now uses checks derived from the manual (piece ceiling, cycle math, RP design intent, difficulty ordering), and the calibration starter moved out of the default template to `src/games/_template-calibration/`.
- M5: generation pipeline. Adds the `frc-game-from-manual` skill (pipeline, extraction checklist, mapping cookbook), the `src/games/_template` starter, `tools/ingest-manual.sh`, `tools/ingest-video.sh`, `npm run calibrate` (TBA comparison, writes CALIBRATION.md), a Playwright smoke test with a CI job, and `?game=` deep links. Also fixes `aria-label` attributes in the menu.
- M4: generic bot AI (nav grid + A*, cycle-rate utility planner, shot spots, approach headings, endgame timing, defense role, easy/normal/hard), wired into the client. The menu gains partner/opponent difficulty, mixed robot types, and an auto-routine toggle for the player. Adds a headless `npm run sim` CLI.

- M3: playable 3D client. It has a Three.js field built from the definition, driver-station/chase/overhead cameras, field-oriented keyboard and gamepad driving, auto-intake, a HUD with context hints, indicators and announcements, a pause menu, and a results screen with score and RP breakdowns.

- M2: fictional reference game `0000-reference` (shooting, placing, both station modes, recycling, climb, awards, RPs, Overdrive rules hook), games registry, and per-game validity/smoke tests. Shooters now solve for hood pitch and flywheel speed within `pitchRangeDeg`. Pieces have no drag in flight and rolling resistance on the ground.

- M1: headless sim core (`src/engine/sim`). It covers the `GameDefinition` schema, blue-half authoring with rotational/mirror expansion, validation, Rapier world, traction-limited swerve drive, intake, HP stations, timed placing, ballistic shooting with spread, aperture scoring, recycling, endgame actions, leave/park awards, RPs, fouls, rules hooks and a score ledger.

- M0: project scaffold (Vite, TypeScript, Three.js, Rapier, Vitest, ESLint, Prettier), CI and GitHub Pages workflows, ADRs 0001-0003.
