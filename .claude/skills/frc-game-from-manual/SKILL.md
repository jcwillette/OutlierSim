---
name: frc-game-from-manual
description: Generate a playable OutlierSim game module from an FRC game manual (PDF) and reveal video, using only those sources. Use when the user provides a manual and/or game reveal video, asks to "make the game for <year>", or to add, update or stress-test a season. Comparing against real match data happens only when the user explicitly asks for it.
---

# FRC game from manual

Turn an FRC game manual (plus the reveal video) into `src/games/<year>-<slug>/`. That folder holds a typed `GameDefinition`, an optional `rules.ts` and `SOURCES.md`. The generic engine does the rest.

At kickoff the owner hands the result to students within hours or days, so **get to a playable, honest game first, then refine**. Every number must be traceable to the manual or marked as an assumption.

**Build only from the manual, the video and general FRC engineering knowledge.** At kickoff no matches have been played, so the pipeline must never depend on real match data. That holds for past seasons too: a stress test is a blind build, so the owner can judge it the way they'll judge 2027. **Don't look up real match results, scores, scouting data or event statistics** (The Blue Alliance, Statbotics, match13, videos of real matches, your own memory of how that season played out). Do that only if the user explicitly asks for a comparison with real matches. Then follow "Optional: compare with real matches" below.

Read `CLAUDE.md` first if it isn't already in context. The schema source of truth is `src/engine/sim/types.ts`, so read it fully before writing a definition. `src/games/0000-reference/` exercises every engine feature; `src/games/2023-chargedup/` is a full real-season build (node grid, shelf stations, a shared platform, declared fouls).

## Inputs

- **Manual PDF** (required). If the user gives a URL, `curl -L -o work/<id>/manual.pdf <url>`. FIRST's blob storage is reachable from the cloud container.
- **Archive what you built from.** FIRST replaces the file behind the manual URL with each revision (the 2023 URL now serves the April copy, so the January build can't be re-checked). Record the revision and date from the manual's footer and the SHA-256 (`work/<id>/manual/meta.txt` after ingest) in `SOURCES.md`, and the Team Updates you read. `work/` is git-ignored, so tell the owner to keep a copy of the kickoff PDF.
- **Reveal or animation video** (strongly recommended). YouTube is normally **blocked** in cloud sessions, so ask the user to upload the video file. Don't try to work around the network policy. If the user says the host is allowed, `pip install yt-dlp` and pass the URL.
- Optional: WPILib's AprilTag field layout JSON for the season (exact field size and element poses), and the official field drawings PDF.
- **Never commit manuals, videos or frames** (copyright, size).

Pick the id `<year>-<slug>` (lowercase game name, e.g. `2027-<name>`) and create a branch `game/<id>`.

## Step 1: Ingest

```bash
tools/ingest-manual.sh work/<id>/manual.pdf <id>
tools/ingest-video.sh work/<id>/video.mp4 <id> 3
```

Then **read, don't skim**:

1. `work/<id>/manual/headings.txt` and `index.md` map out the manual; `rules.md` lists every rule (G/H/R/...) with its page and first line; `meta.txt` has the SHA-256 and dates for `SOURCES.md`.
2. Read in full the text pages for: Game Overview, Arena/Field (every element), Game Pieces, Match timing and periods, Scoring (the points table), Ranking Points, Human Player rules, the robot construction limits that affect play (frame perimeter, height, extension, weight, motors), and the **robot-to-robot G-rules** (pinning, protected zones, "right of way", endgame protection). The exact wording of those rules decides the model ("any part of", "regardless of who initiates", "fully contained", how far apart ends a pin), so quote it in `SOURCES.md`.
3. Look at the contact sheets in `manual/sheets/`, then the high-res figure pages in `manual/hi/`. Dimensioned field drawings matter most. Render any page in more detail with `tools/ingest-manual.sh <pdf> <id> --page N`.
4. Look at the video sheets in `video/sheets/` for layout, element shapes, and how pieces move and get scored. Use `captions.txt` if present. **The manual wins every conflict with the video.**

## Step 2: Extract to a checklist (before writing code)

Copy `extraction-checklist.md` (in this skill folder) to `work/<id>/checklist.md` and fill in every row with a value, a citation (`Manual p.34, Table 6-2`), and a confidence (high / med / low). Convert all imperial units to meters and kilograms here, once, showing the arithmetic (`src/engine/sim/authoring.ts`: `IN`, `FT`, `LB`, `feet(ft, in)`).

Use `mapping-cookbook.md` to decide how each mechanic maps onto the schema, `rules.ts` or a simplification. List anything the engine can't represent under **Simplifications**. Tell the user about these. Don't silently drop rules.

## Step 3: Write the module

1. `cp -r src/games/_template src/games/<id>`. The template is typechecked in CI, so it always matches the schema. Fill in `definition.ts` from the checklist. Remember:
   - **Coordinates**: WPILib frame (meters, origin at the blue alliance wall corner, +X toward red, +Y left as seen from blue). Author **only the blue half**. Set `field.symmetry` to `'rotational'` or `'mirror'` to match the real field, and check the drawings rather than assuming by season. Ask which side of the field each alliance's scoring structures and loading zones sit on. 2023 (Charged Up) is **mirrored**: both alliances' grids are on the scoring-table side. 2024-style fields are mirrored too.
   - Mark anything that exists once (center-line pieces, shared elements) as `side: 'neutral'`.
   - Use the authoring helpers (`rect`, `poly`, `circle`, `cite`, `feet`, `IN`, `LB`) and keep the manual's own figures in the expressions (`feet(18, 0.5)`, `14.25 * IN`) so a reviewer can check them against the page.
   - Every `source` field cites the manual (`const M = cite('Manual')`, then `M(47, 'Table 6-2')`).
   - Model field geometry with the minimum set of boxes, cylinders and hulls that gives the right _driving_ feel: footprints, chokepoints, things to drive around or under, and scoring heights. **Keep heights true to the manual** and tell the bots' navigation how to treat an element with `nav`: `'ramp'` for platforms and ramps they drive over, `'wall'` for guards and curbs they must not cross, `'none'` for structures they fit under. Elements robots drive under, such as a high stage, need `solid: false` on the overhead part and separate solid legs.
   - Make apertures generous enough to reflect real scoring success, but no bigger than the real opening.
   - When one structure has many similar targets (a node grid, reef branches, shelves), generate them in a `layout.ts` that both `definition.ts` and `rules.ts` import (2023's grid is the pattern).
   - Start poses face the structure the preload goes to, inside the starting zone.
2. **Fouls**: declare the season's protected-zone contact rules as `fouls.contact` and its pin count as `fouls.pinning` (see the cookbook). The engine calls them on bumper contact, and the bots read the same zones, so they play clean around them. A rule whose penalty isn't a foul (2023 G209 awards points) goes to `botHints.endgameProtectedZones` plus Simplifications.
3. **Ranking points**: use the declarative kinds first (`piecesAtLeast`, `endgamePointsAtLeast`, `pointsAtLeast` with `sources`, `scoreAtLeast`); `custom` only for adjacency or coopertition logic.
4. **Robot archetypes** (4-7): design them from what the reveal and manual imply competitive robots will do. Typical set: a "full-field" all-rounder, a specialist for each high-value task (one game piece, the endgame), a mid-tier robot, a cheap or simple robot (what rookies build), and a defender (`defaultRole: 'defense'`). Use real-world numbers:
   - Drive and weight: don't type m/s numbers. Pick each archetype's COTS drivetrain and weighed robot weight, and derive the limits with `src/engine/sim/drivetrain.ts`: `mass: onFieldMass(lb)`, `drive: driveFor(swerve(MOTORS.krakenX60, GEARINGS.mk4L2, lb), maxOmega)`. Use `tank(...)` for kitbots and pushers, and `{ tipping }` for tall robots. That gives swerve 12.5-15.5 ft/s (3.8-4.7 m/s) and 23-31 ft/s², tank 10-13 ft/s. Weight comes from the manual's limit (125 lb excluding bumpers and battery through 2024; check the current rule): ~125 lb for full-weight robots, 90-110 lb for light or simple ones, plus ~13 lb battery and 12-15 lb bumpers. Use the season's legal motors (Kraken X60 / X44, NEO Vortex, Falcon 500, NEO). `maxOmega` 5-10 rad/s (driver comfort).
   - Intake 0.2-0.5 s.
   - Placing 0.4-1.5 s, more for high levels.
   - Shooter spread 1-3° for good robots, 4-6° for basic ones.
   - Climb 3-8 s.
   - Frame and bumper size from the robot rules, typically 0.8-0.95 m square with bumpers.
   - `reliability` 0.85 (rookie kitbot) to 0.97 (elite all-rounder). It drives breakdowns, power losses and bot lapses (see `RobotArchetype.reliability`).
   - Then add 4-7 `lineups`: alliance presets students can pick (a powerhouse, a typical alliance, specialists, a defense lineup, an endgame-first lineup, rookies), each with an optional `strategy`. `npm run plausibility` plays every one of them.
5. `rules.ts` holds only the mechanics the schema can't express (see the cookbook). Keep the rules state in `ctx.vars`. Use `ctx.setIndicator` so players can see the mechanic's state on the HUD. Recompute expensive state only when it can have changed (set a flag in `onScore`, act on it in `onTick`), take one `ctx.robots()` snapshot per tick, and never prefer a fixed direction or alliance order: blue and red must play the same game (ADR 0007).
6. `botHints` is optional. Use `targetWeights` to stop bots wasting time on low-value targets, `endgamePreference`, `endgameOrder` (boarding order on a shared platform), `protectedZones` / `endgameProtectedZones` only to override what the declared fouls give the bots, and a `defenseShare` (0-0.34) if defense is a big part of the game.
7. Register the game in `src/games/index.ts`, newest first.
8. Fill in `SOURCES.md` with the manual revision and SHA-256, every value with its citation and confidence, the fouls with their quoted wording, Simplifications and Open questions. Archetype numbers are engineering estimates. Say what each is based on (manual constraints, typical mechanism speeds), never real match results.

## Step 4: Verify

```bash
npm run typecheck && npm run lint
npx vitest run tests/games.test.ts tests/audit.test.ts tests/symmetry.test.ts
npm run plausibility -- --game <id> --md work/<id>/plausibility.md
npm run test:e2e                           # loads in a browser, no errors, screenshot in test-results/<id>.png
```

- The per-game tests run for every registered game: valid definition, an idle match, bots score, every robot type drives, red's navigation is blue's mirror image, and **the audit**: every target, shot, station, endgame zone and staged piece can be used by a robot type that has the mechanism, from the start poses. An audit error names what the bots can't use and why (a place zone smaller than the robot, a shot no hood can make, a zone walled off, a piece inside an element). Fix the definition, not the bots.
- **Validation warnings** (missing citations, odd sizes) usually point to extraction mistakes. Resolve them or justify them in SOURCES.md.
- **`npm run plausibility`** runs validation, the audit, a piece ceiling from the definition, and every lineup against itself at easy / normal / hard in parallel workers (~1-2 min for 7 lineups on 4 cores; `--matches 6 --difficulties normal` for a quick look). Paste its table into `SOURCES.md`. Read every WARN:
  - **Difficulty ordering**: easy < normal < hard on total score.
  - **Bonus-RP rates**: the GDC sets the thresholds as stretch goals. If `normal` bots reach one in most matches, the archetypes are probably too strong or the threshold was misread. Bots drive near-perfect paths, so a blind build runs optimistic: report it, and don't tune toward a remembered real rate.
  - **Piece ceiling**: pieces available (preload, staged, human player supply) against target capacity. Counts must be above 0 and well below it.
  - **Never used**: a target, endgame action or robot type the bots never score with. Unreachable, an impossible shot, never worth it, or a bot-planning gap (2023: kitbots never auto-dock).
  - **Blue vs red** with identical setups: wins and mean score should match within noise (ADR 0007). The tool gives every cell its own seeds; to confirm a suspicious split, run one lineup mirrored over a few hundred seeds.
- **Cycle math** by hand: divide teleop length by an estimated cycle time (travel distance ÷ speed + intake + score action) for each archetype. Bot piece counts should be near that, allowing for traffic.
- **Physics check of anything robots drive on**: drive each robot type onto ramps and platforms from a slow approach (the bots slow to 1.5 m/s on ramps), as `tests/chargedup.test.ts` does for the Charge Station. A sloped `hull` with `nav: 'ramp'` works at any speed; a box step only with a run-up.
- **Visual check**: build, run `vite preview`, and use Playwright (flags in CLAUDE.md) to screenshot the driver, chase and overhead views. Compare them side by side with video frames of the same area: element positions, relative sizes, colors and where pieces are staged. Fix anything that looks wrong.
- Play-test the student's experience: drive with the keyboard, score each target type, do the endgame action, and read the results screen.

## Step 5: Ship

- Update `CHANGELOG.md` and `docs/ROADMAP.md`.
- Commit on `game/<id>` with `feat(games): add <year> <name>` and open a PR. Its body should summarize the simplifications and open questions, show a screenshot, and include the plausibility table.
- After merge, Pages redeploys. Give the owner the student link: `https://<owner>.github.io/<repo>/?game=<id>`.
- Team Updates during the season change rules. Edit the definition, cite the update in SOURCES.md (`cite('TU07')`), and open a PR.

## Kickoff-day fast path

When time matters most, build in this order and ship after step 4, then iterate:

1. Timing, field size and symmetry, the scoring table, pieces and staging (an hour with the manual open).
2. Zones, scoring targets (place zones and apertures), stations, the main endgame action, start poses.
3. One all-rounder archetype and one kitbot, each from `drivetrain.ts`.
4. `npm run typecheck && npx vitest run tests/games.test.ts tests/audit.test.ts` and `npm run plausibility -- --game <id> --matches 6 --difficulties normal`. Fix audit errors first. Ship.
5. Then: declared fouls, `rules.ts` mechanics (list the skipped ones under Simplifications), the remaining archetypes, lineups, the full plausibility run, the visual check.

## Pitfalls from the stress tests

What the 2023 blind build ran into, so the next one doesn't:

- **Symmetry**: check the drawings. 2023 is mirrored with both grids on one side, and each alliance's loading zone sits at the opponent's end next to the opponent's community, which makes it a contact-foul hot spot.
- **Heights vs navigation**: the first 2023 build lowered the Charge Station top from 0.23 m to 0.18 m so the bots would treat it as drivable, and its robots could only get on with a run-up (from the bots' 1.5 m/s ramp speed every robot type stalled at the ramp base). Use `nav: 'ramp'` on a sloped hull and keep the manual's height.
- **Rule wording**: G207 said "any part of itself" and "regardless of who initiates contact"; the first version used the robot's center and excused contact the zone's owner caused. Quote the rule, model what it says, and list any leniency under Simplifications.
- **Piece choice at a station**: a station that hands out several piece types gives the first one the robot can hold, unless it has `choice: true` (players switch with F / X, bots ask for what they plan to score). 2023 was built before that existed and still models its double substation as one shelf per piece type.
- **Shared platforms**: `oneAtATime` actions plus `botHints.endgameOrder` (dock-only robots first, the balancer last); auto-only actions use `allowInAuto` and `availableAtRemainingSec: -1`; per-alliance auto limits ("1 robot max") go in `rules.ts`.
- **Bonus RPs too easy**: a blind build's bots are better drivers than real teams. Report the rates; don't tune toward remembered real numbers.
- **The manual URL changes**: record the revision and SHA-256 at build time.

## Optional: compare with real matches (only when the user asks)

Do this only on an explicit request like "compare it with real matches" or "calibrate against TBA". It never happens by default, including for past-season stress tests. It's done as a separate commit or PR, after the blind build has been reviewed.

1. `cp src/games/_template-calibration/calibration.ts src/games/<id>/` and register `calibration` next to the definition in `src/games/index.ts`.
2. Use the events the user names. If they name none, ask, or suggest an early-week district event, a strong district championship or regional, and a championship division.
3. Run `npm run calibrate -- --game <id> --dump` to see that year's `score_breakdown` fields. Write metrics for auto, teleop and endgame points plus the key piece counts.
4. Run the comparison:

   ```bash
   npm run calibrate -- --game <id> --matches 30 --difficulty hard
   npm run calibrate -- --game <id> --matches 30 --difficulty normal --write
   ```

5. Report the gaps plainly. That's the point of a stress test. Change archetype numbers only if the user asks for tuning, and note each change in `CALIBRATION.md`. Record gaps caused by missing engine capability in `docs/ROADMAP.md` under Known gaps.
