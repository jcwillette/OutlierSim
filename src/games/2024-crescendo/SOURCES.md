# Sources: 2024 CRESCENDO presented by Haas

**Built blind from the kickoff materials only** (owner's instruction for this stress test: nothing made after kickoff, 6 January 2024). No match results, scouting data, event statistics, real-match video or remembered results were used. The only reference model was this repository's own 2023 build and the skill's season-to-season robot baselines (`robot-baselines.md`, calibrated on 2023, general knowledge for seasons from 2024 on).

**Then calibrated to the real 2024 season** at the owner's request (26 November 2026, ADR 0012): the rules as played, robot types as real teams built them, fitted tier by tier to every official 2024 qualification match on The Blue Alliance, and the strategies discussed on Chief Delphi (passing, SOURCE defense, timed AMPLIFICATION). **`CALIBRATION.md` is the record of that: every discrepancy, change and lesson.** This file keeps the manual's numbers and the blind build's reasoning; sections the calibration replaced say so.

This is an unofficial simulation for team practice. **Confidence**: high (stated), med (derived from drawings), low (estimated or assumed). "p.N" = manual page of the copy below.

## What was read, and how the kickoff manual was recovered

- **Manual**: `firstfrc.blob.core.windows.net/frc2024/Manual/2024GameManual.pdf`. FIRST replaces the file with each revision; on 24 Nov 2026 it served the **9 April 2024 revision** (153 pages, created 9 Apr 2024, SHA-256 `1b7e1dc3fe1b1bd64d97a482d7e78eb419ec77d611a15226a16b0c7011069b94`). The kickoff copy isn't hosted any more, and the Wayback Machine isn't reachable from the build container.
- **Recovering the kickoff text**: Team Updates 00-21 (`.../frc2024/Manual/TeamUpdates/TeamUpdateNN.pdf`) were read **only to undo** each post-kickoff change: every Team Update prints the edited rule with deleted text struck through and added text highlighted. TU00 (dated 6 Jan 2024) is part of the kickoff release. Where TU01-TU21 changed something the sim uses, the sim plays the **kickoff** value. No Team Update rule was adopted.
- **Field drawings**: the `FieldAssets` PDFs now hosted are dated 22 Jan and 23 Feb 2024 (after kickoff), so they weren't used. Field positions come from the manual's text, and where the text gives none, from the manual's own dimensioned top view (Fig 6-2, measured at ~47 px/m: the blue driver stations at px 175.5 and the red at 954.5 span 16.54 m).
- **Reveal video**: not used. YouTube refuses downloads from the cloud container. If the owner uploads it, the visual check can be repeated against it.
- **Archive**: keep a copy of the kickoff PDF and the field drawings at the next kickoff (`work/` is git-ignored).

### Post-kickoff changes

The blind build played the kickoff values below. Since the calibration (ADR 0012) the sim plays **Team Update 01's 4-NOTE cap**; the other rows are unchanged (MELODY keeps the in-season 18 / 15: district championships and the Championship aren't modeled as event levels).

| Team Update  | Change after kickoff                                                                                                                | Sim (kickoff)                                                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| TU01 (9 Jan) | AMPLIFICATION also ends after 4 SPEAKER NOTES ("meant to be in the original release")                                               | Blind: 10 s, no NOTE cap. **Now: 10 s or 4 NOTES**                                                                                  |
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

- **Passing** (since ADR 0012): robots with a `passRange` lob a NOTE onto a landing spot in their WING (between the SUBWOOFER and the AMP) for a partner. The engine refuses passes from the opponent's WING (G414), so G414 is never broken rather than called. Bots pass only as the `feeder` role.
- **Shooting**: the SPEAKER is a sensor volume under a solid hood, between the top of the wall and the hood's front edge. Shooters take the fastest shot they can (lowest hood angle) that is still rising at the middle of the opening, as the opening faces down and out (engine: `ScoringTarget.arc: 'rising'`, new for this game). Misses come from each robot type's aim spread; flat long shots miss more, because the opening seen along a flat path is only ~12 cm tall. NOTES are launched from the robot's center, above its frame.
- **G404** (no shots from outside the WING in AUTO) isn't called: every shooter's range keeps its shots inside its own WING. G414 (no passes from the opponent's WING): see Passing.
- **G405** (AUTO center-line crossing), G403 / G409's 2-NOTE rules (robots hold 1), G406-G408, G416 (chain length), G417-G419, G421, G425-G430 aren't modeled.
- **G424 A** (contact with an opponent robot that is off the carpet in its STAGE ZONE, at any time) isn't called. Climbs happen in the last 20 s, where G424 B covers them, and bots stay out of the opponent's STAGE ZONE anyway.
- **Climbing** is a timed action with a success chance (`endgameSuccess`) on one of six chain halves (two robots per chain, so HARMONY is possible). The robot doesn't rise. A failed climb earns nothing and the robot may try again; a robot left in the STAGE ZONE then PARKS. Bots don't plan HARMONY on purpose: it happens when two of them take the two halves of one chain.
- **TRAP**: a placement target per chain, open only in the last 20 s (a robot must be ONSTAGE to reach a TRAP 4 ft 8½ in up; G413 keeps a robot standing on the carpet under 4 ft). Its place time stands for scoring from the chain, and the climb is a separate action, so a TRAP robot climbs after placing instead of before.
- **SPOTLIT**: the HUMAN PLAYER throws the 3 HIGH NOTES at the MICROPHONES over the most ONSTAGE robots first; every ONSTAGE robot under a spotlit MICROPHONE gets +1. Decided at the end of the match. Each throw lands with a 4 % chance, fitted to the real 0.11 SPOTLIT points per alliance (blind: 25 %, an estimate for a practiced player).
- **HUMAN PLAYERS** are the same for every alliance (since ADR 0012, as real ones played): with 2 NOTES banked they press AMP once two robots of theirs hold a NOTE within 10 m of the SPEAKER and one is within 5.5 m, or after the full bank has waited 12 s, or with 12 s left. Each is willing to press Coopertition in 80 % of matches (with its first banked NOTE in the first 45 s of TELEOP), so both alliances cooperate in about 60 % of matches, as in 2024. The Coopertition point (a ranking tiebreaker) isn't tracked. Blind: pressed for one robot, always cooperated.
- **Bots value the AMP** in TELEOP only (`botValue`, never scored): an AMP NOTE that banks is worth 1.65 more, the one that fills the bank 2.8 more, plus 1.5 for the Coopertition NOTE; half a point less when it can't bank. A SPEAKER NOTE is worth 3 more while AMPLIFIED, and bots hold a ready SPEAKER shot (`botHold`, up to 14 s) while the bank is full or a partner is about to fill it. Fitted to the real AMP share (24 % of NOTES) and AUTO AMP NOTES (0.03). Blind: +2 in AUTO and TELEOP, no holding.
- **SOURCE**: a hand-over station: a robot lined up in front of the CHUTE (0.42-0.95 m out, middle 1.2 m) gets a NOTE after 1 s, one every 1.5 s, 45 per alliance. NOTES aren't modeled sliding down the CHUTE or bouncing off the floor. Floor-intake and CHUTE-intake robots are treated alike.
- **SPEAKER and AMP NOTES leave play**. Field staff and the HUMAN PLAYERS returning NOTES to the SOURCE AREAS isn't modeled; 45 per SOURCE plus the field NOTES was more than any alliance used (34 at most).
- **Robots and the STAGE**: the STAGE core has a 0.71 m `clearance`. Every robot type but the full-size turret shooter (1.0 m) fits under it; the full-size robot's nav grid treats the core as a wall, and physics stops it. Bots keep their paths out of the opponent's STAGE ZONE only from 5 s before the last 20 s (`endgamePathZones`, G424 B), so before that short robots drive under the opponent's STAGE to and from the SOURCE. Blind: every type fitted, and bots avoided the opponent's STAGE ZONE all match.
- **PARK** counts any part of the bumpers in the STAGE ZONE; the engine tests the robot's center, so PARK uses the STAGE ZONE grown by 0.4 m.
- **Rapier**: a resting NOTE settles a few micrometers differently on each half of the field (a cylinder's contact isn't mirror-exact), so `tests/symmetry.test.ts` stops comparing a robot's position once it goes after a loose piece; its plans are still compared all through the first 1.5 s.

## Archetype rationale

**Replaced by the calibration** (ADR 0012): the robot types are now designs real teams built in 2024, fitted tier by tier to real robots. `CALIBRATION.md` has every value, blind and now, and the real tiers they match. In short, one type per seventh of real robots (best to worst):

| Tier | Robot type                                  | Build                                                                                               |
| ---- | ------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 7    | Under-stage all-rounder (dealt 0.6 of tier) | MK4i L3, 4 Kraken X60, 0.62 m tall; pivot shooter to 5.5 m, passes 11 m, AMP, climb, TRAP           |
| 7    | Full-size turret shooter (0.4 of tier)      | MK4i L3, 4 Kraken X60, 1.0 m tall (drives around the STAGE); turret to 6 m, passes 12 m, AMP, climb |
| 6    | Pivot shooter                               | MK4i L2, 4 Falcon 500; shooter to 4 m, passes 9 m, AMP, climb                                       |
| 5    | AMP and SUBWOOFER scorer                    | MAXSwerve 14T, 4 NEO; one roller path to the AMP or a SUBWOOFER shot, climb                         |
| 4    | Tank-drive shooter                          | West Coast drive, 4 Falcon 500 at 8.45:1; fixed shooter to 2.6 m, AMP, sometimes climbs             |
| 3    | SUBWOOFER shooter                           | MK4i L2, 4 NEO; fixed shooter to 2.4 m, AMP, rarely climbs                                          |
| 2    | KitBot                                      | KoP tank, 4 CIM; launcher from the SUBWOOFER, loads only at the SOURCE, AMP, a few climb            |
| 1    | Low-resource robot                          | KoP-style tank, 4 CIM; simple roller to the AMP or SUBWOOFER, often breaks down                     |
| —    | Defender (not dealt at random)              | 4 Falcon 500 tank on tread, max weight; plays defense                                               |

The blind build's types (from the 2023 tiers): an under-stage all-rounder, a SPEAKER shooter with no AMP, the AMP and SUBWOOFER scorer, a stage specialist (climb 4 s, TRAP), a SUBWOOFER shooter, a kitbot with a floor intake, and a defender as the bottom tier. Line-ups 2.6-20.2 s, autos of 4 / 2 / 2 / 1 / 1 / 1 / 0 NOTES, climbs at 55 / 50 / 45 / 45 / 30 % per try.

### Alliance presets

- **Powerhouse**: three under-stage all-rounders.
- **Typical qualification alliance**: all-rounder, SUBWOOFER shooter, KitBot.
- **Double feed** (real: East Bay 2024 and later playoffs): a full-size shooter fed by two feeders.
- **Feed and choke**: a full-size shooter, one feeder, and a pivot shooter on SOURCE defense.
- **Amplify**: an AMP specialist and two shooters.
- **Shutdown defense**: all-rounder, pivot shooter and a defender in front of the opponents' SUBWOOFER, on _aggressive_.
- **Source choke** (Chief Delphi "Source Choke Point"): all-rounder, pivot shooter and a defender by the opponents' SOURCE.
- **Ensemble first**: pivot shooter, AMP scorer and tank-drive shooter, on _early endgame_.
- **Monte Carlo pick (qualifications)** and **(playoffs)**: see "Alliance composition".
- **Rookie alliance**: three KitBots.

## Plausibility

`npm run plausibility -- --game 2024-crescendo` with the calibrated robots (each lineup against itself, 12 matches per cell, breakdowns on; means per alliance per match). Validation and the bots' geometry audit: 0 errors, 0 warnings.

| Lineup                            | Difficulty | Total | Auto | Teleop | Endgame | Fouls drawn | Pieces | melody RP | ensemble RP | Broke down | Mech failed |
| --------------------------------- | ---------- | ----- | ---- | ------ | ------- | ----------- | ------ | --------- | ----------- | ---------- | ----------- |
| Powerhouse                        | easy       | 70    | 34   | 28     | 8       | 0           | 19.2   | 79%       | 54%         | 3%         | 3%          |
| Powerhouse                        | normal     | 84    | 33   | 40     | 7       | 4           | 22.7   | 100%      | 58%         | 3%         | 8%          |
| Powerhouse                        | hard       | 102   | 35   | 56     | 7       | 4           | 26.8   | 100%      | 54%         | 1%         | 4%          |
| Typical qualification alliance    | easy       | 43    | 18   | 20     | 5       | 0           | 12.8   | 4%        | 8%          | 4%         | 31%         |
| Typical qualification alliance    | normal     | 52    | 19   | 27     | 6       | 1           | 15.6   | 33%       | 25%         | 1%         | 17%         |
| Typical qualification alliance    | hard       | 67    | 18   | 44     | 4       | 1           | 21.0   | 100%      | 13%         | 3%         | 15%         |
| Double feed                       | easy       | 82    | 32   | 42     | 8       | 0           | 20.9   | 96%       | 38%         | 3%         | 8%          |
| Double feed                       | normal     | 106   | 31   | 66     | 7       | 3           | 27.5   | 100%      | 38%         | 1%         | 1%          |
| Double feed                       | hard       | 125   | 31   | 84     | 7       | 3           | 31.4   | 100%      | 46%         | 6%         | 3%          |
| Feed and choke                    | easy       | 73    | 31   | 30     | 7       | 4           | 17.9   | 79%       | 25%         | 4%         | 6%          |
| Feed and choke                    | normal     | 90    | 30   | 46     | 6       | 8           | 22.3   | 96%       | 38%         | 4%         | 7%          |
| Feed and choke                    | hard       | 110   | 33   | 57     | 6       | 14          | 24.9   | 100%      | 54%         | 3%         | 3%          |
| Amplify                           | easy       | 63    | 29   | 25     | 7       | 1           | 16.1   | 63%       | 46%         | 0%         | 10%         |
| Amplify                           | normal     | 76    | 29   | 37     | 7       | 3           | 19.9   | 88%       | 50%         | 1%         | 4%          |
| Amplify                           | hard       | 88    | 27   | 54     | 6       | 1           | 25.5   | 100%      | 21%         | 6%         | 13%         |
| Shutdown defense                  | easy       | 49    | 21   | 23     | 6       | 0           | 13.5   | 4%        | 13%         | 4%         | 13%         |
| Shutdown defense                  | normal     | 55    | 22   | 26     | 5       | 2           | 15.5   | 46%       | 25%         | 8%         | 10%         |
| Shutdown defense                  | hard       | 70    | 23   | 39     | 5       | 4           | 19.4   | 92%       | 33%         | 7%         | 13%         |
| Source choke                      | easy       | 49    | 23   | 18     | 6       | 2           | 13.4   | 13%       | 29%         | 7%         | 11%         |
| Source choke                      | normal     | 56    | 21   | 24     | 5       | 6           | 15.8   | 29%       | 46%         | 7%         | 15%         |
| Source choke                      | hard       | 68    | 21   | 34     | 6       | 7           | 19.0   | 83%       | 54%         | 8%         | 21%         |
| Ensemble first                    | easy       | 47    | 22   | 17     | 8       | 0           | 12.4   | 0%        | 17%         | 6%         | 8%          |
| Ensemble first                    | normal     | 57    | 27   | 22     | 7       | 0           | 15.4   | 50%       | 13%         | 6%         | 6%          |
| Ensemble first                    | hard       | 80    | 24   | 47     | 7       | 1           | 22.3   | 96%       | 33%         | 7%         | 13%         |
| Monte Carlo pick (qualifications) | easy       | 71    | 33   | 31     | 7       | 0           | 19.6   | 96%       | 46%         | 3%         | 1%          |
| Monte Carlo pick (qualifications) | normal     | 83    | 33   | 40     | 7       | 2           | 23.1   | 100%      | 54%         | 3%         | 8%          |
| Monte Carlo pick (qualifications) | hard       | 98    | 35   | 55     | 7       | 1           | 26.9   | 100%      | 63%         | 1%         | 6%          |
| Monte Carlo pick (playoffs)       | easy       | 86    | 33   | 44     | 8       | 2           | 23.1   | 100%      | 42%         | 1%         | 7%          |
| Monte Carlo pick (playoffs)       | normal     | 111   | 33   | 70     | 7       | 1           | 29.7   | 100%      | 33%         | 0%         | 6%          |
| Monte Carlo pick (playoffs)       | hard       | 124   | 34   | 82     | 7       | 2           | 33.0   | 100%      | 33%         | 0%         | 6%          |
| Rookie alliance                   | easy       | 18    | 7    | 6      | 3       | 2           | 4.6    | 0%        | 8%          | 11%        | 31%         |
| Rookie alliance                   | normal     | 22    | 7    | 9      | 3       | 2           | 6.1    | 0%        | 13%         | 19%        | 32%         |
| Rookie alliance                   | hard       | 33    | 7    | 17     | 4       | 5           | 10.0   | 4%        | 21%         | 10%        | 33%         |

Checks: difficulty ordering passes for every lineup; ENSEMBLE at most 75 % at normal; at most 36 NOTES by one alliance (ceiling 59); every target scored, every endgame action completed, every robot type scored; blue vs red with identical setups: wins 170 : 178 of 360 (z 0.4), score 69.6 : 70.1. MELODY warns, as before: the strong presets reach it every match (real district championship and Championship alliances did too, at their higher thresholds).

Head-to-head against a Typical alliance (`--against typical --matches 32 --difficulties normal`):

| Blue lineup                    | Difficulty | Blue score | Red score | Blue wins | Blue melody RP | Blue ensemble RP | Red teleop | Fouls on blue / red |
| ------------------------------ | ---------- | ---------- | --------- | --------- | -------------- | ---------------- | ---------- | ------------------- |
| Powerhouse                     | normal     | 84         | 47        | 100%      | 97%            | 44%              | 22         | 0.3 / 0.1           |
| Typical qualification alliance | normal     | 49         | 50        | 53%       | 41%            | 9%               | 25         | 0.1 / 0.1           |
| Double feed                    | normal     | 94         | 54        | 97%       | 97%            | 22%              | 28         | 0.7 / 0.2           |
| Feed and choke                 | normal     | 96         | 54        | 97%       | 100%           | 34%              | 26         | 1.0 / 0.7           |
| Amplify                        | normal     | 72         | 49        | 94%       | 100%           | 22%              | 25         | 0.2 / 0.1           |
| Shutdown defense               | normal     | 55         | 56        | 53%       | 59%            | 13%              | 28         | 0.8 / 0.3           |
| Source choke                   | normal     | 57         | 51        | 56%       | 47%            | 41%              | 24         | 0.8 / 0.6           |
| Ensemble first                 | normal     | 56         | 51        | 72%       | 69%            | 19%              | 27         | 0.0 / 0.1           |
| Rookie alliance                | normal     | 21         | 58        | 0%        | 0%             | 16%              | 33         | 0.5 / 0.4           |

Random lineups and the comparison with the real season: `CALIBRATION.md`.

### The blind build's numbers

Before the calibration, random lineups at normal scored 47.8 points per alliance (auto 17.9, teleop 21.6, endgame 6.5, fouls 1.8), 1.5 robots ONSTAGE, MELODY 46 %, ENSEMBLE 24 %. The blind tiers scored 9.8 / 7.9 / 4.9 / 3.3 / 3.4 / 1.8 / 0.9 NOTES per robot, with ONSTAGE 74 / 66 / 63 / 88 / 44 / 0 / 0 %. `CALIBRATION.md` sets these against the real season. Blue vs red then: 400 identical Typical-vs-Typical matches, wins 186 : 197 (z −0.6). The first blind build had red's endgame at 8.65 against blue's 7.08 (z −10), from HARMONY counting red robots on blue's chain positions; that was fixed in `rules.ts` and is covered by a test.

## Alliance composition (Monte Carlo)

**Re-run on the calibrated robots** (ADR 0012). `npm run alliances` plays every candidate on the same seeds against two opponent fields, with the spectator menu's `runMatchup`: normal bots, breakdowns on, the candidate on blue for half the seeds and red for the other half.

- **random**: the menu's random preset, which stands in for a qualification schedule. The measure is ranking points (RP) per match.
- **powerhouse**: three under-stage all-rounders on balanced, which stands in for a playoff final. The measure is the win share.

Candidates: the top-tier builds in every mix, the real strategies (feeders, SOURCE defense) and the blind build's pick (200 matches per field, seeds 5001-5200):

#### Against random

| #   | Alliance                                            | Win  | 95% CI   | Score | Opp. | Margin ± SE | RP   | melody | ensemble | Auto | Teleop | Endgame | Fouls for / against |
| --- | --------------------------------------------------- | ---- | -------- | ----- | ---- | ----------- | ---- | ------ | -------- | ---- | ------ | ------- | ------------------- |
| 1   | allround:trap,allround:trap,fullsize@close-out      | 99%  | 96%-100% | 80.8  | 45.5 | 35.4 ± 1.2  | 3.54 | 99%    | 58%      | 33.5 | 37.2   | 9.3     | 0.8 / 0.6           |
| 2   | allround,allround,fullsize                          | 100% | 97%-100% | 86.6  | 46.4 | 40.3 ± 1.4  | 3.51 | 100%   | 53%      | 33.5 | 44.4   | 7.2     | 1.5 / 1.9           |
| 3   | allround,allround,allround                          | 97%  | 93%-98%  | 82.5  | 46.9 | 35.6 ± 1.4  | 3.46 | 99%    | 55%      | 33.4 | 41.0   | 7.1     | 1.1 / 1.9           |
| 4   | allround:trap,allround:trap,allround:trap@close-out | 98%  | 95%-99%  | 77.0  | 46.5 | 30.4 ± 1.2  | 3.46 | 99%    | 52%      | 33.4 | 34.1   | 8.9     | 0.6 / 1.1           |
| 5   | allround:trap,fullsize,fullsize@close-out           | 98%  | 95%-99%  | 80.5  | 46.1 | 34.4 ± 1.3  | 3.40 | 99%    | 45%      | 33.4 | 37.7   | 8.9     | 0.5 / 0.7           |
| 6   | allround,fullsize,fullsize                          | 99%  | 96%-99%  | 85.7  | 46.8 | 38.9 ± 1.3  | 3.39 | 100%   | 43%      | 33.4 | 43.9   | 7.2     | 1.3 / 1.6           |
| 7   | fullsize,allround:feeder,allround                   | 100% | 98%-100% | 108.0 | 47.8 | 60.3 ± 1.4  | 3.35 | 100%   | 35%      | 33.3 | 67.1   | 7.0     | 0.7 / 2.7           |
| 8   | fullsize,fullsize,allround:feeder                   | 100% | 98%-100% | 104.5 | 47.8 | 56.7 ± 1.3  | 3.21 | 100%   | 21%      | 32.6 | 64.1   | 7.2     | 0.6 / 2.7           |
| 9   | fullsize,allround:feeder,shooter:feeder             | 99%  | 96%-99%  | 100.8 | 48.0 | 52.8 ± 1.7  | 3.16 | 99%    | 21%      | 31.5 | 61.4   | 7.0     | 0.8 / 2.4           |
| 10  | fullsize,fullsize,fullsize                          | 97%  | 94%-99%  | 84.7  | 46.5 | 38.2 ± 1.3  | 3.15 | 99%    | 22%      | 33.0 | 43.5   | 7.3     | 0.9 / 1.7           |
| 11  | fullsize,allround,shooter:source-defense            | 86%  | 80%-90%  | 71.5  | 50.2 | 21.4 ± 1.5  | 3.00 | 87%    | 43%      | 31.5 | 30.0   | 6.3     | 3.7 / 5.8           |
| 12  | allround,allround,defender:source-defense           | 74%  | 68%-80%  | 59.9  | 46.7 | 13.2 ± 1.4  | 2.57 | 77%    | 32%      | 23.6 | 28.5   | 5.2     | 2.5 / 3.4           |

#### Against Powerhouse

| #   | Alliance                                            | Win | 95% CI  | Score | Opp. | Margin ± SE | RP   | melody | ensemble | Auto | Teleop | Endgame | Fouls for / against |
| --- | --------------------------------------------------- | --- | ------- | ----- | ---- | ----------- | ---- | ------ | -------- | ---- | ------ | ------- | ------------------- |
| 1   | fullsize,allround:feeder,allround                   | 88% | 83%-92% | 104.8 | 83.7 | 21.0 ± 1.2  | 3.16 | 100%   | 40%      | 33.4 | 62.6   | 7.3     | 1.4 / 2.3           |
| 2   | fullsize,fullsize,allround:feeder                   | 85% | 79%-89% | 100.7 | 83.7 | 16.9 ± 1.2  | 2.93 | 100%   | 23%      | 32.9 | 59.4   | 6.8     | 1.6 / 2.1           |
| 3   | allround:trap,allround:trap,fullsize@close-out      | 64% | 57%-70% | 83.0  | 79.6 | 3.5 ± 0.9   | 2.81 | 99%    | 56%      | 33.9 | 40.0   | 7.3     | 1.9 / 1.6           |
| 4   | allround:trap,fullsize,fullsize@close-out           | 62% | 55%-68% | 83.0  | 79.2 | 3.8 ± 1.0   | 2.81 | 99%    | 58%      | 33.5 | 39.3   | 7.7     | 2.6 / 1.2           |
| 5   | allround,allround,fullsize                          | 63% | 56%-69% | 84.0  | 80.3 | 3.7 ± 1.0   | 2.79 | 99%    | 55%      | 33.9 | 40.7   | 7.0     | 2.4 / 2.0           |
| 6   | fullsize,allround:feeder,shooter:feeder             | 76% | 70%-82% | 98.2  | 86.4 | 11.8 ± 1.1  | 2.76 | 99%    | 25%      | 31.3 | 59.0   | 6.9     | 0.9 / 3.0           |
| 7   | fullsize,fullsize,fullsize                          | 68% | 61%-74% | 85.9  | 78.7 | 7.2 ± 1.2   | 2.75 | 100%   | 40%      | 33.0 | 41.5   | 7.3     | 4.1 / 1.8           |
| 8   | allround:trap,allround:trap,allround:trap@close-out | 54% | 47%-61% | 80.9  | 80.3 | 0.6 ± 1.1   | 2.69 | 96%    | 65%      | 33.5 | 38.6   | 7.2     | 1.6 / 1.6           |
| 9   | allround,fullsize,fullsize                          | 60% | 53%-67% | 83.6  | 78.7 | 4.9 ± 1.1   | 2.66 | 99%    | 47%      | 33.5 | 40.0   | 7.3     | 2.9 / 1.3           |
| 10  | allround,allround,allround                          | 53% | 46%-60% | 80.9  | 81.2 | -0.3 ± 1.3  | 2.65 | 98%    | 63%      | 33.5 | 38.1   | 7.2     | 2.1 / 2.4           |
| 11  | fullsize,allround,shooter:source-defense            | 17% | 12%-23% | 73.3  | 87.9 | -14.6 ± 1.2 | 1.80 | 83%    | 64%      | 31.3 | 28.4   | 6.5     | 7.1 / 6.4           |
| 12  | allround,allround,defender:source-defense           | 11% | 8%-16%  | 62.2  | 82.4 | -20.2 ± 1.2 | 1.47 | 67%    | 57%      | 23.4 | 25.9   | 5.1     | 7.7 / 3.4           |

**Verdict**:

- **Qualifications**: _Monte Carlo pick (qualifications)_, two under-stage all-rounders as TRAP specialists and a full-size shooter, on _close out_. It earns 3.54 RP a match. Every all-rounder / full-size mix is within 0.15 RP of it, so the robots are nearly all of it: what wins RP is the ENSEMBLE (58 %), which climbing early with a safe lead buys.
- **Playoffs**: _Monte Carlo pick (playoffs)_, a full-size turret shooter, an all-rounder feeding it from the SOURCE and an all-rounder scoring. It beat three all-rounders 88 % of the time by 21 points (three all-rounders against themselves: 53 %). One feeder beats two: the second feeder starves its own scoring. This is the passing meta of 2024's later events (Chief Delphi, East Bay and FiT Mercury).
- **SOURCE defense** loses in both fields here: 11-17 % against Powerhouse, and it is called for more fouls than it draws. The sim's defense is weaker than Chief Delphi describes (`CALIBRATION.md`, remaining gaps), so read this as "not with these bots", not as a real-world verdict.

Reproduce: `npm run alliances -- --game 2024-crescendo --candidates '<the list above, ;-separated>' --vs random,powerhouse --matches 200 --seed 5001`. About 0.7 s per match per core.

### The blind build's search (superseded)

With the blind robot types, the search found three under-stage all-rounders, all TRAP specialists, on _close out_ (3.78 RP against random alliances, no measurable playoff edge over three all-rounders playing balanced). Two all-rounders and a SPEAKER shooter came next, and defense never paid. It had no feeders, no full-size robot and no SOURCE defense to try. Git history has the full tables.

## Open questions

- **Reveal video**: not used. Upload it to repeat the visual check (stage and SUBWOOFER shapes, NOTE staging, SOURCE CHUTE).
- **Positions read off Fig 6-2** (SPEAKER y, SUBWOOFER widths, AMP width, SOURCE corner, STAGE triangle, WING line) are ±5-10 cm. The official field drawings would settle them; now that post-kickoff material is allowed for 2024 (ADR 0012), the January field drawings could be used.

Answered by the real season (`CALIBRATION.md`):

- **Coopertition**: both alliances cooperated in 60 % of qualification matches (44 % in week 1, 94 % at the Championship), not always. Now 80 % willingness per HUMAN PLAYER.
- **AMPLIFICATION timing**: real alliances held the bank and their shots for the press. Now modeled (`botHold` and the HUMAN PLAYER's wait).
- **The 4-NOTE cap** (TU01) is played since the calibration.
- **Climb and TRAP success**: a chain climb was much harder than a 2023 dock. Real tiers ended ONSTAGE in 61 / 47 / 39 / 33 / 24 / 12 / 5 % of matches; TRAP NOTES were 0.10 per alliance, nearly all by the top tier.
