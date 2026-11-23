# Changelog

Format: newest first. One entry per merged PR.

## Unreleased

- Imperfect robots:
  - `RobotArchetype.reliability` (0..1, default 0.95). With `MatchOptions.breakdowns`, a robot can break down for the rest of the match (about 0.6 × (1 − R)) or lose power / comms for 2-6 s (about 5 × (1 − R) per match). Its action is interrupted, it is drawn gray with a DISABLED / NO POWER tag, and the HUD announces it.
  - Bots have tunnel-vision lapses where they ignore teammates' calls and right of way. These are more frequent for easy bots and low-reliability robots.
  - The app's Breakdowns setting can be off, bots only (the default) or everyone. `npm run sim` has breakdowns on unless you pass `--perfect`, and it reports breakdown rates.
- Alliance composition in the menu:
  - Per driver station, pick a robot type (or Random) and a role (Auto / Score / Defend).
  - Per alliance, pick a strategy (`balanced`, `max-cycles`, `early-endgame`, `aggressive`) and one of the game's presets (`GameDefinition.lineups`). This replaces the old "Robot types: Mixed / All default" choice.
  - `npm run sim` takes `--lineups blue,red` and `--strategy`.
  - The results screen shows breakdowns.
- Engine:
  - `RobotArchetype.defaultRole` (the reference game's Defender defends by default).
  - `attachBots` takes `roles` and `strategies`.
  - `botHints.endgameOrder` sets the boarding order on a shared platform.
  - `RobotInfo` carries velocity.
  - The bot retries a path without parked robots if they wall off the only way through.
- 2023 Charged Up:
  - New Cone specialist, Charge Station specialist and Defender archetypes, and reliability for all seven.
  - Seven alliance presets.
  - Dock-only robots board the Charge Station before the balancer.
  - G201: a G207 contact the zone's owner forced isn't a foul.
- Fix: robots that got shoved off their dock or climb spot mid-action were still credited when the timer ran out, then frozen in place (they looked like they were floating at the grid). An endgame action now fails if the robot leaves its zone, like placing does.
- Bot teamwork:
  - Alliance bots share where they're headed and avoid spots a teammate has called, including the node next door.
  - They plan paths around stopped robots.
  - In a lane conflict, the lower-priority teammate steps aside (priority: docking, then carrying a piece, then robot number).
  - Teammate contact in 2023 dropped from ~27 s to ~7 s per match. Reference game scores rose (normal ~650 → ~715) because fewer cycles are lost to collisions.
- Opportunistic defense: an empty-handed bot near an opponent carrying a piece home may block it for up to 4 s, when that costs the opponent more than the bot would score (`botHints.defenseOpportunism`, default 1, 0 disables). Low-scoring robots defend most.
- `botHints.protectedZones`: bots don't defend inside, or chase loose pieces into, the opponent's protected zones, and they path around them when that's not much longer.
- Navigation: ramps and platforms (drivable elements 0.05-0.2 m tall) cost 3× in pathfinding, and bots drive at most 1.5 m/s on them. Bots stopped launching off the far side of the Charge Station (hops in 90 matches: 145 → 21).
- 2023 Charged Up: G207 right of way is enforced. Contact while in the opponent's loading zone or community is a 5-point foul on the intruder.
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
