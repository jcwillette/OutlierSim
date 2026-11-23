# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

OutlierSim turns an FRC game manual (PDF) and game reveal video into a 3D, single-player, browser-playable simulation of that season's game. The student drives one robot in a 3v3 match with AI partners and opponents. The owner (an FRC mentor) will feed the 2027 manual at kickoff and hand the result to students. Before that, they stress test the pipeline on past seasons and compare the results to real match data. Static site, deployed to GitHub Pages.

## Commands

```bash
npm run dev                          # Vite dev server
npm run lint && npm run format:check # ESLint + Prettier (npm run format to fix)
npm run typecheck                    # tsc --noEmit
npm test                             # all Vitest tests (unit + headless matches)
npx vitest run tests/smoke.test.ts   # single file
npx vitest run -t "loads Rapier"     # single test by name
npm run build                        # typecheck + production build to dist/
```

CI (`.github/workflows/ci.yml`) runs lint, format check, typecheck, test and build on every PR. `pages.yml` deploys `dist/` on push to `main`, with `VITE_BASE=/<repo>/`.

## Architecture

One generic engine plus one declarative module per game (ADR 0003). Check `docs/ROADMAP.md` for which parts exist yet.

- `src/engine/sim/`: the headless, deterministic core.
  - Rapier physics at a fixed 60 Hz step, match clock and phases, scoring sensors, and a score ledger with a TBA-style breakdown.
  - **Must never import Three.js, the DOM, `ui/`, `input/` or `render/`.** ESLint `no-restricted-imports` enforces this for `sim/`, `ai/` and `games/`. That rule is what lets full matches run in Node for tests and calibration.
- `src/engine/ai/`: the generic bot brain for the 5 non-player robots (cycle planner, endgame timing, defense, nav). It is also headless.
- `src/engine/render/`, `src/engine/input/`, `src/ui/`: browser-only.
  - `FieldView` builds the Three.js scene from the `ExpandedGame` and copies sim state into it each frame (`sync`). It never mutates the match.
  - `CameraRig` has the driver-station, chase and overhead views. It also supplies `driveYaw`, which makes `PlayerController` field-oriented from the active view.
  - `ui/app.ts` holds the `App` (menu, results), `Session` (one match: countdown, the fixed-step `match.advance(dt)`, render) and `Hud`.
  - Non-player robots get controllers from `App.botFactory`.
  - The HUD's context hints come from the `Match` query helpers: `placeOptions`, `shotOptions`, `availableEndgame`, `stationsFor`. The bot AI uses the same helpers.
- `src/games/<year>-<slug>/`: one folder per season.
  - `definition.ts`: the `GameDefinition` data (field, elements, pieces, scoring targets, zones, timing, endgame, RPs, robot archetypes).
  - Optional `rules.ts` hooks, for mechanics the schema can't express.
  - Optional `bots.ts`, for AI strategy hints.
  - `SOURCES.md`: cites the manual for every number.
  - `CALIBRATION.md`: the comparison against real match data.
  - Every game is registered in `src/games/index.ts`.

### Conventions that span files

- **Coordinates**: everything uses WPILib field coordinates: meters, seconds, radians, Z-up, origin at the blue alliance wall corner, +X toward red, +Y left as seen from the blue drivers. The Three.js scene uses the same Z-up frame (cameras set `up = (0,0,1)`), so Rapier poses copy straight across. Cylinders need `rotateX(π/2)` in Three and a roll of π/2 in Rapier. Manual drawings and WPILib's AprilTag layout JSON map directly onto this frame.
- **Mechanisms are abstracted** (ADR 0003).
  - Intake is a sensor volume at the front of the robot.
  - Placing and climbing are timed actions inside a target or zone.
  - Shooting spawns a real ballistic projectile.
  - When a new game needs something the schema can't express, put it in that game's `rules.ts` first. Promote it into the engine only when a second game needs it.
- **Rapier**: call `await RAPIER.init()` before creating a world (browser and Node).
- **IP hygiene**: field and robots use generic primitives and alliance colors, with no _FIRST_ logos or copied assets. The UI says the game is unofficial. Manuals and videos go in the git-ignored `work/` directory and are never committed.

## Checking the client in a browser

Run `npm run build`, then `npx vite preview --port 4173`. Drive it with Playwright using `chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })`. Without those flags WebGL is unavailable in the headless container. `window.outlierSim` exposes the `App` instance. Add `?dev=1` to the URL to list hidden games.

## Generating a game from a manual

Use the `frc-game-from-manual` skill (`.claude/skills/frc-game-from-manual/SKILL.md`). It covers ingesting the PDF and video, extracting values into the schema with citations, verifying via headless matches and screenshots, and calibrating past seasons against The Blue Alliance. `www.thebluealliance.com` is a proxy-authenticated host in the cloud environment, so no API key is needed.

## Workflow and project memory

- Development happens on feature branches (`m<N>-<topic>`, `game/<year>-<slug>`, `fix/...`), with PRs into `main` and Conventional Commit messages. Don't push to `main` directly.
- **Every PR updates** `docs/ROADMAP.md` (status plus newly found gaps) and `CHANGELOG.md`.
- An architectural decision gets an ADR in `docs/decisions/NNNN-*.md`.
- Update this file when commands, architecture or conventions change. It is the continuity record between sessions.
