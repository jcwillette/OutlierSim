---
name: frc-game-from-manual
description: Generate a playable OutlierSim game module from an FRC game manual (PDF) and reveal video. Use when the user provides a manual and/or game reveal video, asks to "make the game for <year>", to add or update a season, or to stress-test or calibrate a past season against real match data.
---

# FRC game from manual

Turn an FRC game manual (plus the reveal video) into `src/games/<year>-<slug>/`. That folder holds a typed `GameDefinition`, optional `rules.ts` and `bots.ts`, `SOURCES.md` and, for past seasons, `calibration.ts` and `CALIBRATION.md`. The generic engine does the rest.

At kickoff the owner hands the result to students within hours or days, so **get to a playable, honest game first, then refine**. Every number must be traceable to the manual or marked as an assumption.

Read `CLAUDE.md` first if it isn't already in context. The schema source of truth is `src/engine/sim/types.ts`, so read it fully before writing a definition. `src/games/0000-reference/` is a complete worked example of every feature.

## Inputs

- **Manual PDF** (required). If the user gives a URL, `curl -L -o work/<id>/manual.pdf <url>`. FIRST's blob storage is reachable from the cloud container.
- **Reveal or animation video** (strongly recommended). YouTube is normally **blocked** in cloud sessions, so ask the user to upload the video file. Don't try to work around the network policy. If the user says the host is allowed, `pip install yt-dlp` and pass the URL.
- Optional: WPILib's AprilTag field layout JSON for the season (exact field size and element poses), and the official field drawings PDF.
- `work/` is git-ignored. **Never commit manuals, videos or frames** (copyright, size).

Pick the id `<year>-<slug>` (lowercase game name, e.g. `2027-<name>`) and create a branch `game/<id>`.

## Step 1: Ingest

```bash
tools/ingest-manual.sh work/<id>/manual.pdf <id>
tools/ingest-video.sh work/<id>/video.mp4 <id> 3
```

Then **read, don't skim**:

1. `work/<id>/manual/headings.txt` and `index.md` map out the manual.
2. Read in full the text pages for: Game Overview, Arena/Field (every element), Game Pieces, Match timing and periods, Scoring (the points table), Ranking Points, Human Player rules, and the robot construction limits that affect play (frame perimeter, height, extension).
3. Look at the contact sheets in `manual/sheets/`, then the high-res figure pages in `manual/hi/`. Dimensioned field drawings matter most. Render any page in more detail with `tools/ingest-manual.sh <pdf> <id> --page N`.
4. Look at the video sheets in `video/sheets/` for layout, element shapes, and how pieces move and get scored. Use `captions.txt` if present. **The manual wins every conflict with the video.**

## Step 2: Extract to a checklist (before writing code)

Copy `extraction-checklist.md` (in this skill folder) to `work/<id>/checklist.md` and fill in every row with a value, a citation (`Manual p.34, Table 6-2`), and a confidence (high / med / low). Convert all imperial units to meters and kilograms here, once, showing the arithmetic (1 in = 0.0254 m, 1 lb = 0.4536 kg).

Use `mapping-cookbook.md` to decide how each mechanic maps onto the schema, `rules.ts` or a simplification. List anything the engine can't represent under **Simplifications**. Tell the user about these. Don't silently drop rules.

## Step 3: Write the module

1. `cp -r src/games/_template src/games/<id>`. The template is typechecked in CI, so it always matches the schema. Fill in `definition.ts` from the checklist. Remember:
   - **Coordinates**: WPILib frame (meters, origin at the blue alliance wall corner, +X toward red, +Y left as seen from blue). Author **only the blue half**. Set `field.symmetry` to `'rotational'` or `'mirror'` to match the real field, and check the drawings: 2023 and 2025-style fields are rotational, 2024-style fields are mirrored.
   - Mark anything that exists once (center-line pieces, shared elements) as `side: 'neutral'`.
   - Every `source` field cites the manual.
   - Model field geometry with the minimum set of boxes, cylinders and hulls that gives the right _driving_ feel: footprints, chokepoints, things to drive around or under, and scoring heights. Elements robots drive under, such as a high stage, need `solid: false` on the overhead part and separate solid legs.
   - Make apertures generous enough to reflect real scoring success, but no bigger than the real opening.
2. **Robot archetypes** (3-5): design them from what the reveal and manual imply competitive robots will do. Typical set: a "full-field" all-rounder, a specialist for the most valuable task, a cheap or simple robot (what rookies build), and optionally a defender. Use real-world numbers:
   - Swerve top speed 4.0-5.0 m/s and acceleration 8-12 m/s². Tank/kitbot 3-3.5 m/s.
   - Intake 0.2-0.5 s.
   - Placing 0.4-1.5 s, more for high levels.
   - Shooter spread 1-3° for good robots, 4-6° for basic ones.
   - Climb 3-8 s.
   - Frame and bumper size from the robot rules, typically 0.8-0.95 m square with bumpers.
3. `rules.ts` holds only the mechanics the schema can't express (see the cookbook). Keep the rules state in `ctx.vars`. Use `ctx.setIndicator` so players can see the mechanic's state on the HUD.
4. `bots.ts` / `botHints` is optional. Use `targetWeights` to stop bots wasting time on low-value targets, `endgamePreference`, and a `defenseShare` (0-0.34) if defense is a big part of the game.
5. Register the game in `src/games/index.ts`, newest first.
6. Fill in `SOURCES.md` with every value, its citation and confidence, plus Simplifications and Open questions. Delete `calibration.ts` for a new season, since there's no real data yet.

## Step 4: Verify

Run each check and fix problems before moving on:

```bash
npm run typecheck && npm run lint
npx vitest run tests/games.test.ts        # validity, idle match, bots can score, archetypes drive
npm run sim -- --game <id> --matches 20    # sane score ranges, pieces scored per target, climbs, RP rates
npm run test:e2e                           # loads in a browser, no errors, screenshot in test-results/<id>.png
```

- **Validation warnings** (missing citations, odd sizes) usually point to extraction mistakes. Resolve them or justify them in SOURCES.md.
- **Plausibility** of `npm run sim` output:
  - Per-target piece counts should look like a real event, not 0 and not hundreds.
  - Endgame should get attempted.
  - Bonus RP rates should be plausible: early-season RP thresholds are usually hit by under 30% of alliances.
  - If bots never use a target, it's unreachable or its shot is impossible. Check the zones and aperture heights.
- **Visual check**: build, run `vite preview`, and use Playwright (flags in CLAUDE.md) to screenshot the driver, chase and overhead views. Compare them side by side with video frames of the same area: element positions, relative sizes, colors and where pieces are staged. Fix anything that looks wrong.
- Play-test the student's experience: drive with the keyboard, score each target type, do the endgame action, and read the results screen.

## Step 5: Calibrate (past seasons, or once real events exist)

Fill in `src/games/<id>/calibration.ts` (from the template).

1. Pick 2-4 TBA events: an early-week district event (typical teams), a strong regional or district championship, and a championship division (elite play).
2. Run `npm run calibrate -- --game <id> --dump` to see the year's `score_breakdown` fields.
3. Write metrics for auto, teleop and endgame points plus the key piece counts, and register `calibration` in `src/games/index.ts`.

```bash
npm run calibrate -- --game <id> --matches 30 --difficulty hard
npm run calibrate -- --game <id> --matches 30 --difficulty normal --write
```

`hard` bots should land around the strong-event p50-p90 range, and `normal` around typical-event p50. If they're far off, tune **archetype numbers** (cycle times, speeds, accuracy), not the scoring rules, and note each change in CALIBRATION.md. If a gap comes from a missing engine capability, record it in `docs/ROADMAP.md` under Known gaps. When stress-testing past seasons, these gaps are the point: write them down plainly.

## Step 6: Ship

- Update `CHANGELOG.md` and `docs/ROADMAP.md`.
- Commit on `game/<id>` with `feat(games): add <year> <name>` and open a PR. Its body should summarize the simplifications and open questions, show a screenshot, and include the sim/calibration table.
- After merge, Pages redeploys. Give the owner the student link: `https://<owner>.github.io/<repo>/?game=<id>`.
- Team Updates during the season change rules. Edit the definition, cite the update in SOURCES.md, and open a PR.

## Kickoff-day fast path

When time matters most, do Steps 1-4 with only the scoring table, timing, field layout and piece staging done carefully. Use one or two archetypes and skip `rules.ts` mechanics that don't change cycles much, listing them under Simplifications. Ship that, then iterate.
