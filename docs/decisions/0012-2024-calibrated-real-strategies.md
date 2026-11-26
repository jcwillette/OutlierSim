# 0012: 2024 calibrated to the real season, with the strategies and robots teams really used

- Status: accepted
- Date: 2026-11-26

## Context

2024 Crescendo was built blind from the kickoff manual (ADR 0004). On 25 November 2026 the owner gave permission to look past January 2024: Chief Delphi's strategy discussion and The Blue Alliance's results. After a report of the differences, they asked to tune 2024 to match real life, to add the strategies and robot types teams really used, and to record every discrepancy, change and lesson. This is the second owner-approved real-match comparison (2023 was the first, ADR 0009).

Against every official 2024 qualification match (28,250 alliance-matches), the blind build scored about right in total (0.92) but for partly wrong reasons:

- **Endgame** 1.50×: robots climbed a chain far less often than they docked in 2023.
- **AMPLIFIED NOTES** 0.43×: bots shot as soon as they arrived, while real alliances held the bank and their shots for the press, which Team Update 01's 4-NOTE cap made worth timing.
- **Auto AMP NOTES** 21×.
- **HARMONY, SPOTLIT and Coopertition** were optimistic guesses.

Chief Delphi described strategies the engine couldn't express:

- feeders passing NOTES from the SOURCE side into the WING;
- defense at the SOURCE, using the STAGE as a choke point;
- full-size robots too tall to drive under the STAGE;
- robots driving under the opponent's STAGE until the last 20 s;
- drive teams holding shots for an AMPLIFICATION.

## Decision

- **2024 plays the rules as played**:
  - AMPLIFICATION ends after 10 s or 4 SPEAKER NOTES (Team Update 01).
  - HUMAN PLAYERS hold a full bank for their shooters, and cooperate 80 % of the time.
  - HIGH NOTES land 4 % of throws.
  - MELODY stays at the in-season 18 (15); the district championship and Championship thresholds are documented, not modeled (the sim has no event level).
- **Engine additions, all opt-in** (2023 and the reference game are bit-identical, `npm run bench -- --compare`):
  - `GameDefinition.passing` (`PassingRules`: landing spots in blue's frame, the opponent's zones passes may not come from, a minimum distance), `shooter.passRange`, and `RobotCommand.pass`. The engine refuses passes outside teleop, from forbidden zones, and from robots without a passing shooter. Players pass with T (or the left stick press).
  - `SpecialistRole.feeds`: a feeder passes what it fetches far from its goal and leaves pieces near the landing spots to its partners.
  - `SpecialistRole.defense: 'goal' | 'source'`: a game role can be a defender. `'source'` guards from just outside the opponents' loading area and holds up robots on their way in, not only carriers.
  - `FieldElement.clearance`: robots taller than this treat a `nav: 'none'` structure as a wall. Nav grids are cached per (alliance, inflation, height) only when a structure is too low for the robot (`navHeight`), so short robots share one grid as before.
  - `botHints.endgamePathZones`: opponent zones bots path around only from 5 s before the endgame (`MatchAI.endgamePenalty`).
  - `GameRules.botHold`: bots hold a ready shot while the game says it is about to be worth more, at most 14 s per arrival.
  - `intake.floor: false`: station-only intakes.
  - `RobotArchetype.dealWeight`: the random preset deals types by weight (0 = never dealt). With no weights declared, the deck is shuffled exactly as before.
- **2024's robot types are real designs**, one per seventh of real robots (component OPR per event), fitted tier by tier:
  - the top seventh comes in two builds, an under-stage all-rounder and a full-size turret shooter, dealt 0.6 / 0.4;
  - then a pivot shooter, an AMP and SUBWOOFER scorer, a tank-drive shooter, a SUBWOOFER shooter, the KitBot (SOURCE-only) and a low-resource robot;
  - the dedicated defender is kept for lineups and roles but not dealt.
- **New lineups and roles from real play**: _Double feed_, _Feed and choke_, _Source choke_; the `feeder` and `source-defense` roles.
- Details, every changed value and the blind build's error: `src/games/2024-crescendo/CALIBRATION.md`. The season-to-season guidance in `robot-baselines.md` now carries what 2024 taught.

## Consequences

- ADR 0004 stands: a new season is still built blind. 2024 is no longer a blind build; its blind values and error are recorded in `CALIBRATION.md`, and git history keeps the blind definition.
- Both calibrated seasons are general knowledge for seasons from 2025 on (2024's lessons must not inform a stress test of 2024 or earlier; 2023's baselines still apply from 2024 on).
- 2024's matches all change (a model change, ADR 0006). The ideal-alliance search was re-run on the calibrated robots (2024 `SOURCES.md`).
- What a season's TBA data can't separate stays a judgment call: defense's effect, the share of full-size robots, per-action timing.
- AMPLIFIED NOTES remain at 0.72 of real. The AMP's value to the planner is a knife edge against the SPEAKER shot.
