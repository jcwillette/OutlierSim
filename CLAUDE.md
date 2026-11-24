# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

OutlierSim turns an FRC game manual (PDF) and game reveal video into a 3D, single-player, browser-playable simulation of that season's game. The student drives one robot in a 3v3 match with AI partners and opponents. The owner (an FRC mentor) will feed the 2027 manual at kickoff and hand the result to students. Before that, they stress test the pipeline on past seasons. Static site, deployed to GitHub Pages.

**Games are built only from the manual, the reveal video and general FRC engineering knowledge.** The 2027 game will have no matches at kickoff, so nothing in the default pipeline may use real match data. That includes TBA, Statbotics, match13 and remembered results. Past-season stress tests are built the same blind way. Compare with real matches (`npm run calibrate`) **only when the owner explicitly asks** (ADR 0004).

## Commands

```bash
npm run dev                          # Vite dev server
npm run lint && npm run format:check # ESLint + Prettier (npm run format to fix)
npm run typecheck                    # tsc --noEmit
npm test                             # all Vitest tests (unit + headless matches)
npx vitest run tests/smoke.test.ts   # single file
npx vitest run -t "loads Rapier"     # single test by name
npm run build                        # typecheck + production build to dist/
npm run sim -- --game 0000-reference --matches 20 [--difficulty hard] [--archetypes a,b,c] [--tuning t.json] [--json out.json]
                                     # headless bot-vs-bot matches (~0.6-0.9 s each) -> score/RP/piece stats, win rates
npm run bench [-- --game <id>] [--matches 6] [--json before.json | --compare before.json]
                                     # ms per match + a fingerprint of every match; --compare fails if any match changed (ADR 0006)
npm run plausibility -- --game <id> [--matches 12] [--difficulties easy,normal,hard] [--lineups all|a,b] [--md out.md]
                                     # validation + bots' geometry audit + piece ceiling + every lineup vs itself in workers -> SOURCES.md table + checks
npm run test:e2e                     # build + Playwright: every game loads, plays, spectates, runs win-probability workers; screenshots in test-results/
npm run calibrate -- --game <id> [--events 2024casj,...] [--matches 30] [--difficulty hard] [--write | --dump]
                                     # ONLY when the owner asks: compare sim vs real TBA matches
tools/ingest-manual.sh <manual.pdf> <id> [--page N]   # -> work/<id>/manual/ (text per page, topic index, sheets, figures)
tools/ingest-video.sh <video-file-or-URL> <id> [secs] # -> work/<id>/video/ (frames, scene changes, sheets, captions)
```

CI (`.github/workflows/ci.yml`) runs lint, format check, typecheck, test and build on every PR, plus an `e2e` job that installs Playwright. `pages.yml` deploys `dist/` on push to `main`, with `VITE_BASE=/<repo>/`.

## Architecture

One generic engine plus one declarative module per game (ADR 0003). Check `docs/ROADMAP.md` for which parts exist yet.

- `src/engine/sim/`: the headless, deterministic core.
  - Rapier physics at a fixed 60 Hz step, match clock and phases, scoring sensors, and a score ledger with a TBA-style breakdown.
  - Step the physics with `stepWorld(world)` (`bodyState.ts`), not `world.step()`; it skips Rapier's per-step soft-body bookkeeping. `Robot` pose / velocity getters and `Piece.position` are cached per `bodyEpoch`, which advances on every step and every `RigidBody` mutator call (wrapped once in `bodyState.ts`), so setting a body directly (tests do) is always seen.
  - Rapier's world is not the field frame (`PhysicsFrame` in `frame.ts`, ADR 0007). It is centered on the field, so float32 rounds both halves alike, and on even seeds it is the field's mirror / rotation image (`MatchOptions.flipPhysics`), so Rapier's handedness favors neither end over a run. Read poses through `Robot` / `Piece` getters and move bodies with `setPosition` / `setVelocity` (field coordinates). Raw `body` calls see physics coordinates; go through `match.physics` if you must use them.
  - **Must never import Three.js, the DOM, `ui/`, `input/` or `render/`.** ESLint `no-restricted-imports` enforces this for `sim/`, `ai/` and `games/`. That rule is what lets full matches run in Node for tests and calibration.
  - Fouls a game declares (`fouls.contact` protected-zone contact, `fouls.pinning`) are called by `Referee` (`referee.ts`) every tick of auto and teleop, on bumper contact (`robotGap` under `CONTACT_GAP`, 3 cm). ADR 0008. Only what can't be declared goes through `ctx.foul()` in `rules.ts`.
  - Ramps: a `hull` with `nav: 'ramp'` gets its floor edges continued 3 cm below the floor in physics (`sinkRampBase`), so the pitch-locked box robots can drive up from any speed.
  - Endgame attempts roll `RobotArchetype.endgameSuccess` (default 1: no roll, so no match changes) and earn `EndgameAction.fallback` on a failure.
  - `authoring.ts` has the helpers definitions use: `IN`, `FT`, `LB`, `DEG`, `feet()`, `rect()`, `poly()`, `circle()`, `cite()`.
- `src/engine/ai/`: the generic bot AI. It is headless and drives robots only through `RobotCommand`, the same as the player, so it never cheats.
  - `NavGrid` is an inflated occupancy grid with A* and string-pull smoothing, built from solid elements taller than 0.2 m (`FieldElement.nav` overrides: `'wall'`, `'ramp'`, `'none'`). Bots use it through `AllianceNav`: each alliance plans on a grid laid out from its own wall, so red's half is never a slightly different maze (cell alignment, tie-breaks). Fixed turn or side preferences go through `handedness()`. Both are ADR 0007. Nav grids and shot spots (`PointIndex`, exact nearest-spot queries) are cached per `GameDefinition` object and shared by every match of it, so never mutate a definition: `applyTuning` returns a copy.
  - `BotBrain` is a utility planner. Each option is scored as points per second over the whole cycle (fetch, travel to score, action time), with hysteresis.
  - It picks shot spots precomputed with `solveShot`, uses approach headings so intakes can reach pieces, makes time-boxed endgame decisions, and plays defense when `botHints.defenseShare` > 0.
  - Teammates coordinate like an alliance on a radio:
    - soft claims on targets, pieces and stations
    - shared intents, so two bots don't head for overlapping spots
    - paths that avoid parked robots (`NavGrid.findPath` dynamic obstacles)
    - yielding in lane conflicts (`yieldPriority`)
  - Opponents defend opportunistically (`harassOption`, `botHints.defenseOpportunism`).
  - Protected zones come from the declared contact fouls unless `botHints.protectedZones` / `endgameProtectedZones` override them. Bots keep their whole body out of the opponent's (path penalty inflated by the robot size), skip loose pieces there, and steer wider around opponents while partly inside one.
  - Defense is clean (`worthDefending`, `watchPin`):
    - it never marks an opposing defender;
    - it keeps 0.6 m from the opponent's `botHints.protectedZones` (plus `endgameProtectedZones` in the endgame);
    - it breaks off pins after 3 s, backs off past the pin release gap (`fouls.pinning.releaseGap`, default 6 ft) and waits 4 s before re-engaging.
  - Bots have tunnel-vision lapses (`SKILL.lapse` plus robot unreliability), where they ignore teammates.
  - `attachBots` takes per-robot `roles` and per-alliance `strategies` (`AllianceStrategy`).
- Imperfect robots: `MatchOptions.breakdowns` rolls each robot's breakdown, mechanism failure and power losses from `RobotArchetype.reliability` (seeded). Breakdowns and mechanism failures can clear (more often for reliable robots). `Robot.isOut(t)` blocks driving and mechanisms; `Robot.mechDown` blocks only game-piece handling (endgame still works), and bots with one play defense. It's off by default in the engine (so tests stay deterministic), on in the app (except the player's robot, by default) and in `npm run sim` (`--perfect` turns it off).
  - Ramps (drivable elements 0.05-0.2 m tall) are slow ground, both in A* cost and in bot speed.
  - `attachBots()` wires up a match. Difficulty (`SKILL`) only changes speed, think rate, utility noise and dwell.
  - If bots can't score in a new game, the definition is usually wrong (unreachable zones, impossible shots). `auditDefinition` (`ai/audit.ts`, run for every game by `tests/audit.test.ts` and by `npm run plausibility`) names each target, shot, station, endgame zone or staged piece the bots can't use, with the reason; `tests/games.test.ts` checks that bots score at all. `findShotSpots` and `approachHeading` are the bots' own spot logic, shared with the audit.
- `src/engine/render/`, `src/engine/input/`, `src/ui/`: browser-only.
  - `FieldView` builds the Three.js scene from the `ExpandedGame` and copies sim state into it each frame (`sync`). It never mutates the match.
  - `CameraRig` has the driver-station, chase and overhead views. It also supplies `driveYaw`, which makes `PlayerController` field-oriented from the active view.
  - `ui/app.ts` holds the `App` (menu, results), `Session` (one match: countdown, the fixed-step `match.advance(dt)`, render) and `Hud`.
  - `Session` calls `attachBots()` for the non-player robots. The player's robot can run a `BotBrain` during auto (the "auto routine" option).
  - Spectator mode (`Setup.mode === 'watch'`, `?watch=1`): `Session.player` is null and all six robots are bots. `CameraRig` uses `SPECTATOR_CAMERA_MODES`, starting on the sideline view. The followed robot gets the ring (`FieldView.highlight`), and `describeBot()` turns its `BotBrain.currentPlan` into HUD commentary. Playback speed scales `match.advance`.
  - The menu's alliance composition (preset, strategy, robot and role per slot) lives in `ui/lineup.ts` (DOM-free, unit-tested). Games offer presets via `GameDefinition.lineups`.
  - Win probability (spectator menu, ADR 0005): `ui/montecarlo.ts` (DOM-free, unit-tested) plays one `MonteCarloSpec` per seed (`runMatchup`) and aggregates (`summarize`, Wilson CI, margin histogram). `ui/montecarloPool.ts` (`MonteCarloRun`) fans seeds out to `ui/montecarlo.worker.ts` Web Workers. Random slots are dealt from `dealRng(seed)`, so `App.start(seed)` replays a sampled match-up exactly. `window.outlierSim.mc` is the latest run. Workers default to one per logical core (`defaultThreads`, max 16); `?threads=N` overrides it for measuring.
  - The menu's "Robot & field tuning" lives in `ui/tuning.ts` (DOM-free, unit-tested): per robot type and per human player station overrides in display units (ft, lb, s, %). `applyTuning(def, tuning)` returns a tuned copy of the definition, which `App.start` (and `npm run sim --tuning`) pass to `Match`. Explicit fault rates go in `RobotArchetype.faults` and override `faultRates()` (`sim/faults.ts`).
  - The HUD's context hints come from the `Match` query helpers: `placeOptions`, `shotOptions`, `availableEndgame`, `stationsFor`. The bot AI uses the same helpers.
- `src/games/<year>-<slug>/`: one folder per season.
  - `definition.ts`: the `GameDefinition` data (field, elements, pieces, scoring targets, zones, timing, endgame, RPs, robot archetypes).
    - Archetype drive limits and mass come from `src/engine/sim/drivetrain.ts`: `drive: driveFor(swerve(MOTORS.x, GEARINGS.y, robotLb, { tipping }), maxOmega)` and `mass: onFieldMass(robotLb)`. Don't hand-type m/s numbers.
  - Optional `rules.ts` hooks, for mechanics the schema can't express.
  - `botHints` in the definition: optional AI strategy hints (target weights, endgame preference, defense share).
  - Declarative before custom: protected zones and pins in `fouls`, RPs as `piecesAtLeast` / `endgamePointsAtLeast` / `pointsAtLeast` (ledger sources by base id, `sourceBase()`), nav hints on elements. `custom` RPs and `rules.ts` are for what's truly game-specific.
  - `SOURCES.md`: cites the manual for every number.
  - Only when the owner asks for a real-match comparison: `calibration.ts` (a `CalibrationSpec` mapping TBA `score_breakdown` fields to sim metrics, copied from `src/games/_template-calibration/` and registered next to the definition in `src/games/index.ts`) and the generated `CALIBRATION.md`.
  - `2023-chargedup` (blind stress test) is the worked example of a node grid with adjacency bonuses (`layout.ts`), shelf stations, auto docking, a one-at-a-time Charge Station at its real height (`nav: 'ramp'`), declared G207/G202 fouls and a `pointsAtLeast` RP.
  - `src/games/_template/` is the typechecked starter, and `_template-calibration/` the opt-in calibration starter. Neither is registered.
  - Every game is registered in `src/games/index.ts`.

### Conventions that span files

- **Coordinates**: everything uses WPILib field coordinates: meters, seconds, radians, Z-up, origin at the blue alliance wall corner, +X toward red, +Y left as seen from the blue drivers. The Three.js scene uses the same Z-up frame (cameras set `up = (0,0,1)`). Rapier's world is centered and sometimes flipped (`match.physics`), so draw from the `Robot` / `Piece` getters, robots from their field `yaw`. Cylinders need `rotateX(π/2)` in Three and a roll of π/2 in Rapier. Manual drawings and WPILib's AprilTag layout JSON map directly onto this frame.
- **Mechanisms are abstracted** (ADR 0003).
  - Intake is a sensor volume at the front of the robot.
  - Placing and climbing are timed actions inside a target or zone.
    - An endgame action finished in auto (an auto dock) releases the robot when teleop starts.
    - `oneAtATime` actions make teammates board a shared platform one by one.
  - Shooting spawns a real ballistic projectile.
  - Human player shelves: `handoffHeight` needs a tall enough intake, and `handoffSec` is the time to line up and grab.
  - A target's `display` point draws scored pieces in place. Without one, scored pieces are hidden.
  - When a new game needs something the schema can't express, put it in that game's `rules.ts` first. Promote it into the engine only when a second game needs it.
- **Rapier**: call `await RAPIER.init()` before creating a world (browser and Node).
- **Speed-ups never change results** (ADR 0006): the same seed must give the same match, bit for bit. Run `npm run bench -- --json before.json` first and `npm run bench -- --compare before.json` after, and keep `tests/speed.test.ts` passing. Changes that alter matches (Rapier SIMD build, lower physics rate, sparser re-planning) are model changes, not speed-ups.
- **Blue and red play the same game** (ADR 0007): identical alliances must give identical result distributions. `tests/symmetry.test.ts` checks it: red's nav answers are exact images of blue's, and with fixed randomness red's bots mirror blue's decisions and moves. Anything with a fixed direction preference (left first, +x first, a scan order) must go through the alliance's frame. To check a change statistically, run identical alliances and compare blue with red, including spread and bonus-RP rates, not just win rates.
- **IP hygiene**: field and robots use generic primitives and alliance colors, with no _FIRST_ logos or copied assets. The UI says the game is unofficial. Manuals and videos go in the git-ignored `work/` directory and are never committed.

## Checking the client in a browser

Run `npm run build`, then `npx vite preview --port 4173`. Drive it with Playwright using `chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })`. Without those flags WebGL is unavailable in the headless container. `window.outlierSim` exposes the `App` instance. Add `?dev=1` to the URL to list hidden games.

## Generating a game from a manual

This is the project's main workflow. Use the `frc-game-from-manual` skill (`.claude/skills/frc-game-from-manual/`).

- `SKILL.md` is the step-by-step pipeline: ingest, extraction checklist, write module, verify (against manual-derived plausibility checks, not real matches), ship. A real-match comparison is an optional, on-request extra.
- `extraction-checklist.md` is filled in before writing any code.
- `mapping-cookbook.md` maps FRC mechanics onto the schema, `rules.ts` or a documented simplification.
- New games start from `cp -r src/games/_template src/games/<year>-<slug>`. The template is typechecked, so it can't drift from the schema.

Environment notes:

- `www.thebluealliance.com` is proxy-authenticated in the cloud container, so no key is needed. Elsewhere, set `TBA_KEY`. Use it only for an owner-requested comparison.
- Node's `fetch` only uses the proxy with `NODE_USE_ENV_PROXY=1`. The `calibrate` script sets it.
- TBA responses are cached in `work/tba-cache/`.
- YouTube is blocked by the network policy, so ask the user to upload reveal videos.
- FIRST's manual blob storage (`firstfrc.blob.core.windows.net`) is reachable.

## Workflow and project memory

- Development happens on feature branches (`m<N>-<topic>`, `game/<year>-<slug>`, `fix/...`), with PRs into `main` and Conventional Commit messages. Don't push to `main` directly.
- **Every PR updates** `docs/ROADMAP.md` (status plus newly found gaps) and `CHANGELOG.md`.
- An architectural decision gets an ADR in `docs/decisions/NNNN-*.md`.
- Update this file when commands, architecture or conventions change. It is the continuity record between sessions.
