# Sources: 2024 CRESCENDO presented by Haas

**Built blind from the kickoff materials only** (owner's instruction for this stress test: nothing made after kickoff, 6 January 2024). No match results, scouting data, event statistics, real-match video or remembered results were used. The only reference model was this repository's own 2023 build and the skill's season-to-season robot baselines (`robot-baselines.md`, calibrated on 2023, general knowledge for seasons from 2024 on).

This is an unofficial simulation for team practice. **Confidence**: high (stated), med (derived from drawings), low (estimated or assumed). "p.N" = manual page of the copy below.

## What was read, and how the kickoff manual was recovered

- **Manual**: `firstfrc.blob.core.windows.net/frc2024/Manual/2024GameManual.pdf`. FIRST replaces the file with each revision; on 24 Nov 2026 it served the **9 April 2024 revision** (153 pages, created 9 Apr 2024, SHA-256 `1b7e1dc3fe1b1bd64d97a482d7e78eb419ec77d611a15226a16b0c7011069b94`). The kickoff copy isn't hosted any more, and the Wayback Machine isn't reachable from the build container.
- **Recovering the kickoff text**: Team Updates 00-21 (`.../frc2024/Manual/TeamUpdates/TeamUpdateNN.pdf`) were read **only to undo** each post-kickoff change: every Team Update prints the edited rule with deleted text struck through and added text highlighted. TU00 (dated 6 Jan 2024) is part of the kickoff release. Where TU01-TU21 changed something the sim uses, the sim plays the **kickoff** value. No Team Update rule was adopted.
- **Field drawings**: the `FieldAssets` PDFs now hosted are dated 22 Jan and 23 Feb 2024 (after kickoff), so they weren't used. Field positions come from the manual's text, and where the text gives none, from the manual's own dimensioned top view (Fig 6-2, measured at ~47 px/m: the blue driver stations at px 175.5 and the red at 954.5 span 16.54 m).
- **Reveal video**: not used. YouTube refuses downloads from the cloud container. If the owner uploads it, the visual check can be repeated against it.
- **Archive**: keep a copy of the kickoff PDF and the field drawings at the next kickoff (`work/` is git-ignored).

### Post-kickoff changes the sim deliberately does not play

| Team Update  | Change after kickoff                                                                                                                | Sim (kickoff)                                                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| TU01 (9 Jan) | AMPLIFICATION also ends after 4 SPEAKER NOTES ("meant to be in the original release")                                               | **10 s, no NOTE cap**                                                                                                               |
| TU01         | Field width "~802 cm" corrected to "~821 cm"; SPEAKER depth "16 in" to "1 ft 6 in"; G413 "~132 cm" / "~40 cm"                       | The inch figures, which the kickoff text and Fig 6-2 already agree with (26 ft 11¼ in, 1 ft 6 in, 4 ft, 1 ft)                       |
| TU02         | Banking capped at 2 NOTES for AMPLIFICATION / Coopertition; G424 A reworded; ONSTAGE contact list                                   | The kickoff text: "another 2 NOTES after AMPLIFICATION ends", which the sim plays as a bank of at most 2; G424 A not modeled anyway |
| TU14         | SPEAKER NOTES assessed for 5 s (was 3 s) after TELEOP                                                                               | Not modeled (shots in the air at the buzzer count when they land, as the engine does for any game)                                  |
| TU18, TU21   | MELODY 21 (18) at District Championships, 25 (21) at the Championship                                                               | **18 (15 with Coopertition)**, the kickoff value; the kickoff footnote says only that championship requirements "may increase"      |
| TU21         | R103 robot weight 125.5 lb (new radio)                                                                                              | **125 lb**                                                                                                                          |
| others       | Wording, rule-number and violation clarifications (G403 CONTROL, G405, G410, G414, G415, G420 pause, G423 "GAME PIECE CONTROLLED"…) | Kickoff wording; none of these changes a modeled value                                                                              |

## Values

| Value                 | Used in sim                                                                                                                                                                                                  | Source                                   | Confidence |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- | ---------- |
| Auto / delay / teleop | 15 s / 3 s / 135 s; "endgame" = the last 20 s (G424 B, G430)                                                                                                                                                 | p.45 §6.4, p.71-73                       | high       |
| Field                 | 54 ft 3¼ in × 26 ft 11¼ in = 16.54 × 8.21 m; guardrail 1 ft 8 in (0.51 m)                                                                                                                                    | p.21-22 §5.1                             | high       |
| Symmetry              | **mirror**: both AMPS on the far guardrail next to their own ALLIANCE WALL; each SOURCE in the scoring-table corner at the opposing end                                                                      | Fig 5-4, Fig 6-2                         | high       |
| ALLIANCE WALL         | 6 ft 6 in (1.98 m) tall below the SPEAKER, modeled solid so missed shots bounce back                                                                                                                         | p.32 Fig 5-16                            | high       |
| SPEAKER               | Opening 3 ft 5⅜ in (1.05 m) wide, from the top of the wall (6 ft 6 in) to 6 ft 10⅞ in (2.11 m), 1 ft 6 in (0.46 m) into the field, the plane tilted 14° up; centered 4 ft 9 in from the center line (y 5.55) | p.31 §5.6.1; y off Fig 6-2               | high / med |
| SUBWOOFER             | 3 ft ⅛ in (0.92 m) deep, 3 ft 1 in (0.94 m) tall, 8⅜ in vertical panels; ~1.93 m wide at the wall, ~0.95 m at the front                                                                                      | p.32; widths off Fig 6-2                 | high / med |
| AMP                   | Pocket 2 ft wide, 1 ft 6 in tall, bottom 2 ft 2 in up; the AMP's near edge 4 ft 1½ in from the ALLIANCE WALL; body ~1.16 m wide (center x 1.84)                                                              | p.25-26 §5.3; width off Fig 6-2          | high / med |
| AMP ZONE              | 10 ft 10 in × 1 ft 5¾ in (3.30 × 0.46 m) along the guardrail from the ALLIANCE WALL                                                                                                                          | p.24                                     | high       |
| SOURCE                | Wall across the corner at 30° to the guardrail: from the opposing wall at y 1.04 to the guardrail 1.80 m out; 6 ft 3¼ in opening, 3 ft ¾ in up                                                               | p.26-27 §5.4; corner off Fig 6-2         | med        |
| SOURCE ZONE           | Parallelogram 1 ft 6¾ in (0.48 m) deep from the SOURCE wall                                                                                                                                                  | p.24                                     | high       |
| ROBOT STARTING ZONE   | 6 ft 4⅛ in (1.93 m) from the ALLIANCE WALL, from the AMP ZONE to the opposing SOURCE ZONE tape (long edge 7.28 m in the sim vs 23 ft 8⅛ in = 7.22 m)                                                         | p.24                                     | high / med |
| STAGE                 | 3 truss legs in an equilateral triangle pointing at the wall; near (PODIUM) leg 10 ft 1 in out; leg centers ~2.62 m apart, the far legs at x ~5.5, y ±1.31 from the center line                              | p.27 §5.5; triangle off Fig 6-2          | high / med |
| STAGE core            | 6-sided, bottom 2 ft 4¼ in, **0.71 m clearance** at the gussets; top 1.93 m (MICROPHONE top 7 ft 4¼ in minus 1 ft); solid for NOTES, robots up to 0.71 m tall drive under it                                 | p.27-29                                  | high       |
| Chains                | 3 per STAGE, 4 ft up at the legs, lowest 2 ft 4¼ in, 1 ft 4⅝ in from the core face                                                                                                                           | p.27, Fig 5-9                            | high       |
| TRAP / MICROPHONE     | TRAP opening bottom 4 ft 8½ in; MICROPHONE 1 ft tall, 1.66 in OD, top 7 ft 4¼ in                                                                                                                             | p.28-29                                  | high       |
| PODIUM                | 1 ft 5¾ in × 10 in panel on the near leg, facing the wall                                                                                                                                                    | p.29                                     | high       |
| STAGE ZONE            | 6-sided tape outline: the leg triangle scaled 1.25× about its center, corners cut; tip at x 3.09, far edge x 5.68                                                                                            | p.25 Fig 5-5; off Fig 6-2 (3.17 / ~5.75) | med        |
| WING line             | x 5.84 (just past the far legs)                                                                                                                                                                              | p.25; off Fig 6-2                        | med        |
| NOTE                  | Orange foam ring, 14 in OD, 10 in ID, 2 in thick, 8.3 oz (0.235 kg); physics: a 14 in cylinder                                                                                                               | p.34 §5.7                                | high       |
| Staging               | 3 per WING on SPIKE MARKS 9 ft 6 in from the wall, 4 ft 9 in apart, the first on the center line; 5 on the CENTER LINE 5 ft 6 in apart; 45 per SOURCE AREA; 1 preload per robot                              | p.45 §6.3.4, Fig 6-2                     | high       |
| Scoring               | LEAVE 2; AMP 2 / 1; SPEAKER 5 / 2, AMPLIFIED 5; PARK 1; ONSTAGE 3, SPOTLIT 4; HARMONY +2 per extra robot; NOTE in TRAP 5 (1 per TRAP)                                                                        | p.49 Table 6-2                           | high       |
| AMPLIFICATION         | 2 AMP NOTES → the HUMAN PLAYER may press: SPEAKER AMPLIFIED for 10 s; another 2 NOTES after it ends                                                                                                          | p.47 §6.5.3 (kickoff text)               | high       |
| Coopertition          | Each alliance spends an AMP NOTE on its Coopertition button in the first 45 s of TELEOP → MELODY needs 15 instead of 18                                                                                      | p.48 §6.5.5, Table 6-2                   | high       |
| RPs                   | Win 2, tie 1, MELODY 18 (15) AMP + SPEAKER NOTES, ENSEMBLE 10 STAGE points and 2 ONSTAGE robots                                                                                                              | p.49 Table 6-2                           | high       |
| Fouls                 | FOUL 2, TECH FOUL 5                                                                                                                                                                                          | p.49 Table 6-3                           | high       |
| Robot rules           | R103 125 lb (kickoff) without bumpers and battery; R104 120 in frame perimeter, 4 ft tall; G413 4 ft tall, 1 ft extension; **R502 4 drive motors**; G403 / G409 1 NOTE at a time                             | p.66, p.78, TU00                         | high       |

## Fouls the engine calls (declared in `definition.fouls`)

Quoted from the kickoff text (the April wording of G423 and G424 adds "GAME PIECE CONTROLLED by either ROBOT"; G424 A was reworded in TU02):

- **G423** "A ROBOT may not contact (either directly or transitively through a NOTE and regardless of who initiates contact) an opponent ROBOT if any part of either ROBOT'S BUMPERS are in the opponent's SOURCE ZONE or AMP ZONE. Violation: TECH FOUL." Declared with the engine's new `inside: 'either'` (one call per contact, whichever robot is in the zone). `forgiveForced` skips contact the zone's owner clearly drove into, the same lenient stand-in for G211 as 2023.
- **G422** "Prior to the last 20 seconds of a MATCH, a ROBOT may not contact … an opponent ROBOT whose BUMPERS are in contact with their PODIUM. Violation: TECH FOUL." Contact with the PODIUM is modeled as any part of the robot within 5 cm in front of it. It is called in the last 20 s too, where G424 applies anyway.
- **G424 B** "… if … any part of either ROBOT'S BUMPERS are in the opponent's STAGE ZONE during the last 20 seconds of the MATCH. Violation: 2 TECH FOULS plus the opponent ALLIANCE is awarded the ENSEMBLE RP if a Qualification MATCH." Declared as two `endgameOnly`, `'either'` rules (`G424` and `G424 (2nd)`): two TECH FOULS per contact. The ENSEMBLE RP check gives the RP to the alliance whose opponent drew a G424 call.
- **G420** "A ROBOT may not PIN an opponent's ROBOT for more than 5 seconds. … A PIN count ends once … the ROBOTS have separated by at least 6 ft … for more than 5 seconds, … either ROBOT has moved 6 ft from where the PIN initiated for more than 5 seconds, or … the PINNING ROBOT gets PINNED. … Violation: FOUL, plus an additional TECH FOUL for every 5 seconds in which the situation is not corrected." `countSec` 5, release 6 ft, `repinSec` 5 (pinning again within 5 s resumes the count).

Bots treat the opponent's SOURCE ZONE, AMP ZONE, PODIUM and STAGE ZONE as protected all match (`botHints.protectedZones`), using copies grown by half a robot: the rules count any part of either robot, the bots test robot centers. The AMP and SOURCE copies are grown by a robot length (0.9 m): an opponent going after a loose NOTE in that corner kept brushing the zone (41 calls in one match). G424 is called once per pair of robots in the last 20 s (`repeatSec: 20`): a robot that broke down beside a climbing opponent is one instance, not one every 3 s. Together these cut foul points from ~21 to ~2 per alliance per match in random lineups (first build: defenders bumping robots partly inside their own AMP ZONE, robots crossing the opponent's STAGE ZONE to their own in the last 20 s).

## Simplifications

- **Shooting**: the SPEAKER is a sensor volume under a solid hood, between the top of the wall and the hood's front edge. Shooters take the fastest shot they can (lowest hood angle) that is still rising at the middle of the opening, as the opening faces down and out (engine: `ScoringTarget.arc: 'rising'`, new for this game). Misses come from each robot type's aim spread; flat long shots miss more, because the opening seen along a flat path is only ~12 cm tall. NOTES are launched from the robot's center, above its frame.
- **G404 / G414** (no shots from outside the WING in AUTO, no full-court passes) aren't called. Every shooter's range keeps its shots inside its own WING, and bots never pass NOTES.
- **G405** (AUTO center-line crossing), G403 / G409's 2-NOTE rules (robots hold 1), G406-G408, G416 (chain length), G417-G419, G421, G425-G430 aren't modeled.
- **G424 A** (contact with an opponent robot that is off the carpet in its STAGE ZONE, at any time) isn't called. Climbs happen in the last 20 s, where G424 B covers them, and bots stay out of the opponent's STAGE ZONE anyway.
- **Climbing** is a timed action with a success chance (`endgameSuccess`) on one of six chain halves (two robots per chain, so HARMONY is possible). The robot doesn't rise. A failed climb earns nothing and the robot may try again; a robot left in the STAGE ZONE then PARKS. Bots don't plan HARMONY on purpose: it happens when two of them take the two halves of one chain.
- **TRAP**: a placement target per chain, open only in the last 20 s (a robot must be ONSTAGE to reach a TRAP 4 ft 8½ in up; G413 keeps a robot standing on the carpet under 4 ft). Its place time stands for scoring from the chain, and the climb is a separate action, so a TRAP robot climbs after placing instead of before.
- **SPOTLIT**: the HUMAN PLAYER throws the 3 HIGH NOTES at the MICROPHONES over the most ONSTAGE robots first; each lands with a 25 % chance (an estimate for a practiced player tossing a ring onto a 1.66 in post 7 ft up from 5-6 m). Every ONSTAGE robot under a spotlit MICROPHONE gets +1. Decided at the end of the match.
- **HUMAN PLAYERS** are the same for every alliance: they press AMP once a robot of theirs holding a NOTE is within 5.5 m of the SPEAKER (or with 12 s left), and always press Coopertition with their first banked NOTE in the first 45 s of TELEOP. Both alliances cooperate in about 9 matches in 10, so MELODY usually needs 15 NOTES. The Coopertition point (a ranking tiebreaker) isn't tracked.
- **Bots value the AMP**: an AMP NOTE that banks toward AMPLIFICATION is worth 2 more to them than its point (half of what a press usually gains), plus 1.5 for the Coopertition NOTE early in TELEOP; a SPEAKER NOTE is worth 3 more while AMPLIFIED (`botValue`, never scored).
- **SOURCE**: a hand-over station: a robot lined up in front of the CHUTE (0.42-0.95 m out, middle 1.2 m) gets a NOTE after 1 s, one every 1.5 s, 45 per alliance. NOTES aren't modeled sliding down the CHUTE or bouncing off the floor. Floor-intake and CHUTE-intake robots are treated alike.
- **SPEAKER and AMP NOTES leave play**. Field staff and the HUMAN PLAYERS returning NOTES to the SOURCE AREAS isn't modeled; 45 per SOURCE plus the field NOTES was more than any alliance used (34 at most).
- **Every robot type fits under the STAGE** (≤ 0.62 m tall): the 0.71 m clearance is a design driver the manual makes explicit, and the engine has one navigation grid for all robot types. A taller design would have to drive around it.
- **PARK** counts any part of the bumpers in the STAGE ZONE; the engine tests the robot's center, so PARK uses the STAGE ZONE grown by 0.4 m.
- **Rapier**: a resting NOTE settles a few micrometers differently on each half of the field (a cylinder's contact isn't mirror-exact), so `tests/symmetry.test.ts` stops comparing a robot's position once it goes after a loose piece; its plans are still compared all through the first 1.5 s.

## Archetype rationale

Seven robot types, one per seventh of real robots (best to worst), from `robot-baselines.md`. Drivetrains and mechanism times are engineering estimates from the kickoff manual's constraints: under-stage height (0.71 m), the 4-drive-motor limit (R502, new in 2024), 125 lb (R103), a ring that a roller grabs from any direction, a SPEAKER that accepts shots from range, an AMP that wants a placement against the wall. The drive team's teleop line-up (`alignSec`), auto routines, endgame success and reliability start from the 2023-calibrated tiers:

- **Line-up per pickup and per placement** keeps the tier values (2.6 s top … 20.2 s bottom). The engine adds it to pickups and AMP / TRAP placements, not to SPEAKER shots, so a shooter's cycle carries one line-up where a 2023 robot carried two. That is the "scale down for a forgiving pickup and a big target" the baselines ask for: ground pickup of a ring needs no orientation, and a shot needs no pole to line up on. Shot misses come from the aim spread instead.
- **Auto pieces**: the WING NOTES are 1.45 m apart and ~1.6 m from the SUBWOOFER, so each extra NOTE costs ~3 s against ~8 s for a 2023 cone. The 2023 caps are doubled: top tier 4, tier 6 and 5 two, lower tiers 1, the defender 0, with the tier success rates.
- **Climbs**: each attempt succeeds 55 / 50 / 45 / 45 / 30 % of the time (top to tier 3), retried while time allows, so the tiers end ONSTAGE 74 / 66 / 63 / 88 / 44 % of matches: a little below their 2023 endgame rates (a chain climb is harder than a ramp dock), except the stage specialist. The bottom two tiers have no climber and park.

| Robot (tier)                 | Drivetrain                                | Weighed / on field | Top speed, accel., 5 m | Pieces                                                                       | Line-up | Auto    | Climb       | Reliability |
| ---------------------------- | ----------------------------------------- | ------------------ | ---------------------- | ---------------------------------------------------------------------------- | ------- | ------- | ----------- | ----------- |
| Under-stage all-rounder (7)  | MK4i L3, 4 Kraken X60                     | 125 / 152 lb       | 14.5 ft/s, 28, 1.39 s  | ground 0.25 s; shooter 14 m/s, 1.0°, 4.8 m, hood 18-66°; AMP 0.6 s; TRAP 3 s | 2.6 s   | 4, 85 % | 5 s, 55 %   | 0.97        |
| Speaker shooter (6)          | MK4i L2, 4 Falcon 500                     | 120 / 147 lb       | 14.0 ft/s, 30, 1.40 s  | ground 0.3 s; shooter 13 m/s, 1.5°, 3.8 m                                    | 4.6 s   | 2, 85 % | 7 s, 50 %   | 0.95        |
| Amp and subwoofer scorer (5) | MAXSwerve 14T, 4 NEO                      | 110 / 137 lb       | 13.4 ft/s, 28, 1.47 s  | ground 0.3 s; AMP 0.5 s; SUBWOOFER shot 8 m/s, 2.5°, 2.0 m                   | 8.9 s   | 2, 85 % | 6 s, 45 %   | 0.92        |
| Stage specialist (4)         | MK4i L2, 4 NEO                            | 105 / 132 lb       | 12.5 ft/s, 31, 1.52 s  | ground 0.4 s; AMP 0.8 s; TRAP 2.5 s                                          | 13.6 s  | 1, 80 % | 4 s, 45 %   | 0.90        |
| Subwoofer shooter (3)        | MK4i L2, 4 NEO                            | 118 / 145 lb       | 12.5 ft/s, 28, 1.54 s  | ground 0.45 s; shooter 8.5 m/s, 3°, 2.4 m                                    | 12.1 s  | 1, 65 % | 8 s, 30 %   | 0.88        |
| Kitbot (2)                   | Kit of Parts tank, 4 CIM, 10.71:1, 6 in   | 90 / 117 lb        | 10.0 ft/s, 32, 1.80 s  | roller 0.6 s; SUBWOOFER fling 7 m/s, 4°, 2.0 m; AMP 1.2 s                    | 16.8 s  | 1, 45 % | none: parks | 0.78        |
| Defender (1)                 | tank, 4 Falcon 500 (R502), 10.71:1, tread | 125 / 153 lb       | 12.0 ft/s, 31, 1.56 s  | roller 0.5 s; SUBWOOFER fling 7 m/s, 5°; defends by default                  | 20.2 s  | 0, 30 % | none: parks | 0.75        |

Shooters launch from 0.2 m above their frame. Hood ranges set where a robot can shoot from: the subwoofer-only robots' 52-68° hoods reach the opening only from 1.2-2.0 m away. Turn rates (`maxOmega` 5-9 rad/s) are driver comfort.

### Alliance presets

- **Powerhouse**: three all-rounders.
- **Typical qualification alliance**: all-rounder, subwoofer shooter, kitbot.
- **Amplify**: AMP scorer, all-rounder, SPEAKER shooter.
- **Specialists**: SPEAKER shooter, AMP scorer, stage specialist.
- **Shutdown defense**: all-rounder, SPEAKER shooter and a defender, on _aggressive_.
- **Ensemble first**: stage specialist, AMP scorer, subwoofer shooter, on _early endgame_.
- **Rookie alliance**: three kitbots.

## Plausibility

`npm run plausibility -- --game 2024-crescendo` (each lineup against itself, 12 matches per cell, breakdowns on; means per alliance per match). Validation and the bots' geometry audit: 0 errors, 0 warnings.

| Lineup                         | Difficulty | Total | Auto | Teleop | Endgame | Fouls drawn | Pieces | melody RP | ensemble RP | Broke down | Mech failed |
| ------------------------------ | ---------- | ----- | ---- | ------ | ------- | ----------- | ------ | --------- | ----------- | ---------- | ----------- |
| Powerhouse                     | easy       | 77    | 38   | 29     | 9       | 0           | 20.3   | 100%      | 79%         | 3%         | 1%          |
| Powerhouse                     | normal     | 91    | 39   | 43     | 9       | 1           | 24.3   | 100%      | 71%         | 3%         | 8%          |
| Powerhouse                     | hard       | 115   | 41   | 65     | 8       | 2           | 30.9   | 100%      | 58%         | 1%         | 4%          |
| Typical qualification alliance | easy       | 44    | 22   | 16     | 6       | 0           | 12.5   | 4%        | 8%          | 4%         | 31%         |
| Typical qualification alliance | normal     | 51    | 19   | 25     | 6       | 1           | 15.5   | 50%       | 33%         | 1%         | 17%         |
| Typical qualification alliance | hard       | 69    | 22   | 40     | 5       | 2           | 21.4   | 100%      | 29%         | 3%         | 15%         |
| Amplify                        | easy       | 62    | 31   | 22     | 8       | 0           | 16.5   | 79%       | 42%         | 4%         | 10%         |
| Amplify                        | normal     | 75    | 30   | 34     | 10      | 1           | 21.2   | 100%      | 67%         | 1%         | 4%          |
| Amplify                        | hard       | 95    | 33   | 52     | 8       | 3           | 26.8   | 100%      | 63%         | 6%         | 8%          |
| Specialists                    | easy       | 49    | 23   | 16     | 10      | 0           | 12.6   | 13%       | 46%         | 3%         | 10%         |
| Specialists                    | normal     | 53    | 19   | 24     | 10      | 0           | 15.3   | 63%       | 54%         | 3%         | 14%         |
| Specialists                    | hard       | 76    | 19   | 46     | 9       | 3           | 23.5   | 100%      | 67%         | 6%         | 7%          |
| Shutdown defense               | easy       | 54    | 24   | 20     | 7       | 3           | 14.5   | 50%       | 29%         | 8%         | 13%         |
| Shutdown defense               | normal     | 62    | 25   | 28     | 7       | 3           | 18.1   | 100%      | 38%         | 4%         | 19%         |
| Shutdown defense               | hard       | 77    | 23   | 43     | 6       | 6           | 22.0   | 96%       | 50%         | 8%         | 22%         |
| Ensemble first                 | easy       | 34    | 14   | 11     | 10      | 0           | 8.3    | 0%        | 42%         | 3%         | 14%         |
| Ensemble first                 | normal     | 42    | 17   | 15     | 10      | 0           | 11.3   | 0%        | 58%         | 6%         | 8%          |
| Ensemble first                 | hard       | 55    | 16   | 29     | 10      | 0           | 17.1   | 88%       | 50%         | 3%         | 15%         |
| Rookie alliance                | easy       | 14    | 5    | 5      | 2       | 3           | 4.0    | 0%        | 0%          | 8%         | 24%         |
| Rookie alliance                | normal     | 17    | 7    | 7      | 2       | 1           | 5.4    | 0%        | 0%          | 13%        | 32%         |
| Rookie alliance                | hard       | 21    | 5    | 11     | 2       | 2           | 7.9    | 0%        | 8%          | 11%        | 40%         |

ONSTAGE robots per alliance per match:

| Lineup                         | Difficulty | onstage |
| ------------------------------ | ---------- | ------- |
| Powerhouse                     | easy       | 2.38    |
| Powerhouse                     | normal     | 2.25    |
| Powerhouse                     | hard       | 1.96    |
| Typical qualification alliance | easy       | 1.33    |
| Typical qualification alliance | normal     | 1.38    |
| Typical qualification alliance | hard       | 1.13    |
| Amplify                        | easy       | 2.25    |
| Amplify                        | normal     | 2.29    |
| Amplify                        | hard       | 1.88    |
| Specialists                    | easy       | 2.50    |
| Specialists                    | normal     | 2.38    |
| Specialists                    | hard       | 1.96    |
| Shutdown defense               | easy       | 1.67    |
| Shutdown defense               | normal     | 1.42    |
| Shutdown defense               | hard       | 1.46    |
| Ensemble first                 | easy       | 2.42    |
| Ensemble first                 | normal     | 2.50    |
| Ensemble first                 | hard       | 2.50    |
| Rookie alliance                | easy       | 0.00    |
| Rookie alliance                | normal     | 0.00    |
| Rookie alliance                | hard       | 0.00    |

Points per robot per match, by robot type:

| Robot    | Matches | Points |
| -------- | ------- | ------ |
| ampbot   | 216     | 17.7   |
| allround | 432     | 30.6   |
| shooter  | 216     | 29.1   |
| stagebot | 144     | 9.1    |
| midbot   | 144     | 13.8   |
| kitbot   | 288     | 5.2    |
| defender | 72      | 2.5    |

Checks:

- PASS Difficulty ordering for Powerhouse: easy 77 < normal 91 < hard 115
- PASS Difficulty ordering for Typical qualification alliance: easy 44 < normal 51 < hard 69
- PASS Difficulty ordering for Amplify: easy 62 < normal 75 < hard 95
- PASS Difficulty ordering for Specialists: easy 49 < normal 53 < hard 76
- PASS Difficulty ordering for Shutdown defense: easy 54 < normal 62 < hard 77
- PASS Difficulty ordering for Ensemble first: easy 34 < normal 42 < hard 55
- PASS Difficulty ordering for Rookie alliance: easy 14 < normal 17 < hard 21
- WARN MELODY (18 AMP & SPEAKER NOTES, 15 with Coopertition): up to 100% of alliances at normal (bonus RPs are stretch goals; most matches reaching one suggests robots that are too strong or a misread threshold)
- PASS ENSEMBLE (10 STAGE points and 2 ROBOTS ONSTAGE): up to 71% of alliances at normal (bonus RPs are stretch goals; most matches reaching one suggests robots that are too strong or a misread threshold)
- PASS Pieces: at most 34 by one alliance in one match; ceiling 59 (available 59: 3 preloaded + 11 staged on the field (both alliances' and neutral ones) + 45 from its human players; target capacity unbounded)
- PASS Every target was scored in
- PASS Every endgame action was completed
- PASS Every robot type scored
- PASS Blue vs red with identical setups: wins 127 : 118 of 252 (z 0.6), score 59.0 : 58.6

The MELODY warning comes from the strong presets (Powerhouse, Amplify), which reach 15-18 NOTES every match. The ordinary Typical alliance reaches it in about half its matches at normal, mostly because both HUMAN PLAYERS always cooperate (threshold 15). Random lineups (`npm run sim -- --random --matches 100`, normal): **47.8 points per alliance** (auto 17.9, teleop 21.6, endgame 6.5, fouls 1.8), 10.0 SPEAKER + 4.1 AMP + 0.2 TRAP NOTES, 1.5 robots ONSTAGE, **MELODY 46 %, ENSEMBLE 24 %**. Nothing was tuned toward a real 2024 rate.

Head-to-head against a Typical alliance (`--against typical --matches 32 --difficulties normal`):

| Blue lineup                    | Difficulty | Blue score | Red score | Blue wins | Blue melody RP | Blue ensemble RP | Red teleop | Fouls on blue / red |
| ------------------------------ | ---------- | ---------- | --------- | --------- | -------------- | ---------------- | ---------- | ------------------- |
| Powerhouse                     | normal     | 99         | 47        | 100%      | 100%           | 78%              | 20         | 0.1 / 0.1           |
| Typical qualification alliance | normal     | 53         | 50        | 47%       | 59%            | 28%              | 22         | 0.2 / 0.7           |
| Amplify                        | normal     | 80         | 47        | 100%      | 100%           | 53%              | 21         | 0.0 / 1.0           |
| Specialists                    | normal     | 55         | 50        | 72%       | 84%            | 41%              | 22         | 0.0 / 0.2           |
| Shutdown defense               | normal     | 64         | 51        | 81%       | 100%           | 25%              | 22         | 0.6 / 0.8           |
| Ensemble first                 | normal     | 39         | 51        | 16%       | 0%             | 59%              | 21         | 0.1 / 0.1           |
| Rookie alliance                | normal     | 17         | 55        | 0%        | 0%             | 0%               | 27         | 0.2 / 0.2           |

### Against the 2023-calibrated tiers

Random lineups, 80 matches at normal, per robot per match (`robot-baselines.md` tier in brackets: 2023 teleop + auto pieces; endgame = docked or engaged; LEAVE = mobility):

| Robot (tier)                 | NOTES | 2023 pieces | ONSTAGE | 2023 endgame | LEAVE | 2023 leave |
| ---------------------------- | ----- | ----------- | ------- | ------------ | ----- | ---------- |
| Under-stage all-rounder (7)  | 9.8   | 7.5         | 74 %    | 71 %         | 83 %  | 85 %       |
| Speaker shooter (6)          | 7.9   | 5.4         | 66 %    | 72 %         | 81 %  | 68 %       |
| Amp and subwoofer scorer (5) | 4.9   | 4.3         | 63 %    | 71 %         | 82 %  | 59 %       |
| Stage specialist (4)         | 3.3   | 3.4         | 88 %    | 66 %         | 75 %  | 55 %       |
| Subwoofer shooter (3)        | 3.4   | 2.6         | 44 %    | 57 %         | 64 %  | 53 %       |
| Kitbot (2)                   | 1.8   | 2.0         | parks   | 49 %         | 37 %  | 44 %       |
| Defender (1)                 | 0.9   | 1.2         | parks   | 33 %         | 25 %  | 29 %       |

The good shooters score 30-45 % more pieces than their 2023 tier, as intended: a SPEAKER shot carries no line-up (only the pickup does), the ring needs no orientation, and the WING NOTES sit close to the SPEAKER, so autos also leave the zone more often. Per-attempt climb success (55 / 50 / 45 / 45 / 30 %, retried while there is time) was set so each tier ends ONSTAGE a little less often than it docked in 2023, a chain climb being harder than driving onto a ramp; the stage specialist is the exception by design. Shot accuracy in the sim: ~85 % for the shooters, ~55 % for the SUBWOOFER-only robots.

### Blue vs red

400 identical Typical-vs-Typical matches with the final robots (`npm run sim -- --lineups typical,typical --matches 400 --seed 5001`): wins 186 : 197 (z -0.6), total 51.2 : 51.5 (z -0.5), auto z -1.5, teleop z +0.7, endgame 5.9 : 6.1 (z -1.0), MELODY 57 % : 56 %, ENSEMBLE 25 % : 24 %. The first build had red's endgame at 8.65 against blue's 7.08 (z -10): HARMONY counted red robots on blue's chain positions. Fixed in `rules.ts` and covered by a test.

## Open questions

- **Reveal video**: not used. Upload it to repeat the visual check (stage and SUBWOOFER shapes, NOTE staging, SOURCE CHUTE).
- **Positions read off Fig 6-2** (SPEAKER y, SUBWOOFER widths, AMP width, SOURCE corner, STAGE triangle, WING line) are ±5-10 cm. The official field drawings from kickoff would settle them.
- **Coopertition**: the HUMAN PLAYERS always cooperate. Whether real teams press the button in most matches is a strategy call the manual leaves open; turning it off makes MELODY need 18 NOTES.
- **AMPLIFICATION timing**: the HUMAN PLAYER presses as soon as a robot is ready to shoot. Holding the bank for a moment when two robots are ready would score more.
- **The kickoff AMPLIFICATION has no NOTE cap**, and TU01 says the cap was meant to be there. The sim follows the kickoff text, so an alliance with three fast shooters can score more than 4 AMPLIFIED NOTES in 10 s.
- **Climb and TRAP success** are estimates from 2023's Charge Station tiers; how hard a chain climb and a TRAP really are is unknown before the season.
