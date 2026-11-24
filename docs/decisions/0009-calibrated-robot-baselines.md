# 0009: Robot baselines calibrated once on 2023; new seasons stay blind

- Status: accepted
- Date: 2026-11-24

## Context

The 2023 stress test was built blind (ADR 0004). Its bots played about twice as well as real robots. Random alliances at normal difficulty scored 140 points against a real 2023 season average of 85, and even three kitbots scored 70, the real median. The owner considers the engine finished, and asked for a one-time comparison with the real 2023 season. The goal is to tune the robots, human players and field so averages match real life, and to carry the tuned numbers into the season-to-season guidance. The owner also asked not to change the rule that a game is built without looking at its own season's matches.

The comparison used every official 2023 qualification match on The Blue Alliance: 185 events, 27,076 alliance-matches, and component OPRs per event for robot tiers. The engine couldn't express what real robots do with the existing settings:

- **Pickup time cost nothing.** A one-piece robot grabbed a piece on contact; `intake.timeSec` only delayed the next pickup. The menu's "pickup time" didn't change a 2023 robot's cycle.
- **Every bot ran the planner's best auto.** Real robots mostly score one preload or nothing, and a quarter of the bottom tier's autos don't run. The sim scored 2.8 times the real auto pieces.
- **Drive teams were all as quick as the difficulty.** Real cycles per piece run from 16 s (top seventh of robots) to over 60 s (second-to-bottom), mostly in lining up, misses and retries. Putting that time into mechanism times also slows programmed autos, which real autos aren't. As a bot-side wait, a long line-up drew contact fouls and got dropped half-way.
- **Bots didn't build set bonuses** (2023 links: real alliances made 2.5 from 11 pieces, bots 1.4).
- **A long pickup or placement could make a bot miss its endgame**, because bots never checked whether they could finish before leaving.

## Decision

- `RobotArchetype` gains three optional settings. A game that doesn't set them plays as before, except for the pickup time change below.
  - `auto: { pieces, leave, success }` is the robot's autonomous routine as bots run it: most pieces it scores, whether it drives out of the starting zone afterwards (`leaveZoneInAuto`), and the chance it runs at all. A bot whose routine is done doesn't pick up more pieces in auto. The player's own auto routine always runs (`BotOptions.autoCanFail: false`).
  - `alignSec` is the robot's typical drive team's line-up per teleop pickup and placement. The engine adds it to those timed actions, scaled by `Robot.alignScale`, which `attachBots` sets from `SKILL[difficulty].align`. Auto (programmed) doesn't pay it, and neither do `MatchOptions.alignExempt` robots: the app passes the student's robot, because the student is its drive team.
  - The meaning of `intake.timeSec` changes: the robot stops for that long once a piece is in reach (floor), or after a station's `handoffSec`, as a timed `intake` action. This changes every game's matches slightly (ADR 0006: a model change, not a speed-up).
- `GameRules.botValue(ctx, alliance, targetId)` lets a game's rules tell bots that a target is worth more than its points right now (2023: the link it would complete, a pair a third piece can finish, a co-op node). It never changes the score.
- Bots don't start a pickup or placement whose drive plus action would still keep them busy when they must leave for their endgame action.
- `SKILL` gains `align`: easy 1.6, normal 1, hard 0.35. That makes easy bots score teleop like week-1 drive teams, normal like the season's average match, and hard like district championship drive teams.
- 2023's archetypes are calibrated: mechanism times and drivetrains stay the blind hardware estimates. Line-up, auto routine, Charge Station times and success, and reliability are fitted so the seven types match the seven tiers of real 2023 robots. Random alliances then match the season (85.8 vs 84.8 points, every component within a few percent). The real data also showed the April manual's Sustainability threshold (6 links, 5 with coopertition) applied only at the Championship. 2023 now plays the in-season 5 (4). Details and every changed value: `src/games/2023-chargedup/CALIBRATION.md`.
- `npm run calibrate` can compare with a whole season (`CalibrationSpec.season`), deals random robots like the menu (`runSims({ random: true })`), and `--write` refreshes only its own table in `CALIBRATION.md`.
- The tuned tiers become season-to-season guidance in the `frc-game-from-manual` skill (`robot-baselines.md`). A new season's blind build starts from them as general FRC knowledge.

## Consequences

- ADR 0004 stands unchanged: a game is built from its manual, video and general knowledge, never its own season's matches. The 2023-derived baselines count as general knowledge for seasons from 2024 on. A stress test of a season before 2023 must not use them, because for that season they are future knowledge.
- The 2023 game is no longer a blind build. Its blind values and the blind build's error are recorded in `CALIBRATION.md`, and git history keeps the blind definition.
- Line-up times are large for weak tiers (12-20 s per action). They stand for the real time lost in lining up, misses and retries, not a slow mechanism, which is why programmed autos and the student's robot don't pay them.
- What a single season's TBA data can't separate stays an estimate: human player speed against the robot's line-up, defense's effect, and per-action timing. Video of real matches would split these, but YouTube refused downloads from the cloud container.
