# 0014: 2025 calibrated to the real season: knocked-off pieces, drive-forward autos, line-up per target

- Status: accepted
- Date: 2026-11-26

## Context

2025 REEFSCAPE was built blind from the January 2025 materials (ADR 0013), with the 2023 tiers and the 2024 lessons as its only reference. On 26 November 2026 the owner gave permission to look past January 2025: Chief Delphi's strategy discussion and The Blue Alliance's results. They asked to tune 2025 to match real life, to add the strategies and robot types teams really used, to log the discrepancies and changes, and to record the lessons. This is the third owner-approved real-match comparison (2023: ADR 0009; 2024: ADR 0012).

Against every official 2025 qualification match (29,610 alliance-matches), the blind build scored about right in total (1.07) for the wrong reasons:

- **PROCESSOR ALGAE 4.65×, Coopertition in 98 % of matches** (real 22 %). The HUMAN PLAYER's NET throw was guessed at 35 %; real ones netted 86 % of what they got, so real teams processed only for Coopertition, and agreed on it in pairs.
- **LEAVE 0.70, the AUTO RP 0.36**: a failed auto routine sat still, where real robots drove forward without scoring.
- **Shallow CAGE 25×**: real robots built for the deep CAGE or none.
- **TELEOP CORAL 0.67, L2 0.50, L4 0.57**: the middle tiers' designs couldn't reach L4, and the bots spent TELEOP on ALGAE.

Chief Delphi described play the engine couldn't express:

- robots knocking REEF ALGAE to the floor to open L2 and L3, without scoring it;
- autos that only drive forward (the AUTO RP needs every robot to LEAVE);
- the trough as a wide, forgiving target and L4 as the most precise one;
- going for the CORAL RP only when it is safely in reach.

The comparison also exposed an engine artifact: bots keep their intake up, so a bot placing CORAL in front of a REEF face took the ALGAE resting there without meaning to.

## Decision

- **Engine additions, all opt-in** (2023, 2024 and the reference game are bit-identical, `npm run bench -- --compare`):
  - `HumanPlayerStation.knockOff` and `RobotCommand.knock`: a robot that reaches a piece resting on a structure can knock it to the floor instead of taking it (and does when it can't hold it). It falls beside the robot as a loose piece; the station's supply is used, so the rules see it go.
  - `GameRules.botStationValue`: what clearing a station is worth to an alliance's bots. Added to taking its piece; the only value of knocking it off (`BotBrain.knockOptions`, TELEOP).
  - `RobotCommand.loadFrom`: bots name the station they load from ('' otherwise). A `knockOff` station's piece goes only to a robot loading from it; players (undefined) take it as before. Read only for `knockOff` stations.
  - `AutoRoutine.driveOut`: when a routine doesn't run, the chance the robot still drives out of the starting zone, scoring nothing.
  - `ScoringTarget.alignScale`: multiplies the drive team's line-up for placements on that target (default 1, an exact no-op).
  - `CalibrationMetric.real(b, score, opp)` and `sim(s, opp)` see the other alliance (2025's Coopertition).
- **2025 plays the rules as played** (`rules.ts`): the HUMAN PLAYER nets 88 % of throws; alliances play for Coopertition by agreement (15 % of matches both, otherwise 15 % each alone); bots value a PROCESSOR ALGAE at the opponents' expected NET points against it; no ALGAE in AUTO; the CORAL RP push only while it fits in the time left; each BRANCH a REEF ALGAE blocks is worth 0.7 to clear. In-season RP thresholds stay (the Championship's 7 and 16 aren't modeled).
- **2025's robot types are real designs**, one per seventh of real robots (per-event contributions), each fitted to its tier: the full-REEF elevator (2-5 CORAL autos, NET, fast deep climb), the CORAL elevator, a pivot arm, a tank-drive elevator and a budget elevator (all reaching L4), the KitBot and the Everybot sharing tier 2 (dealt 0.6 / 0.4), the low-resource robot; the defender stays undealt. Climbs are deep only.
- **New lineups and roles from real play**: _Triple offense_, _Fill the REEF_, _Low-resource alliance_; the `trough` role.
- Details, every changed value and the blind build's error: `src/games/2025-reefscape/CALIBRATION.md`. The season-to-season guidance in `robot-baselines.md` now carries what 2025 taught.

## Consequences

- ADR 0004 stands: a new season is still built blind. 2025 is no longer a blind build; its blind values and error are recorded in `CALIBRATION.md`, and git history keeps the blind definition.
- The three calibrated seasons are general knowledge for later seasons only: the 2025 lessons inform 2026 and 2027, never a stress test of 2025 or earlier.
- 2025's matches all change (a model change, ADR 0006).
- Known gaps: non-climbers that start long pickups late miss the PARK while failed climbers always park (PARK 1.16); fouls under rules the engine doesn't call (0.51); hard difficulty over-nets ALGAE; forced Coopertition and bump autos aren't modeled.
- A knocked-off piece falls to a side picked from the match's random stream: statistically symmetric for blue and red (ADR 0007), not mirror-exact.
