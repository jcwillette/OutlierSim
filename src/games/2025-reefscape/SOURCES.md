# Sources: 2025 REEFSCAPE presented by Haas

**Built blind** (owner's instruction for this stress test, 26 November 2026): only the official 2025 game materials as they stood by the end of January 2025, general FRC engineering knowledge, and this repository's own 2023 and 2024 builds as the reference models (including the skill's season-to-season baselines, `robot-baselines.md`: the 2023 tiers and the "Lessons from 2024", both general knowledge for a 2025 build). No match results, scouting data, event statistics, real-match video, Chief Delphi strategy threads or remembered results were used, and nothing published after January 2025.

**Then calibrated to the real 2025 season** at the owner's request (26 November 2026, ADR 0014): the rules as played (the HUMAN PLAYER's real NET accuracy, Coopertition by agreement), robot types as real teams built them, fitted tier by tier to every official 2025 qualification match on The Blue Alliance, and the strategies discussed on Chief Delphi (L4 first, netting rather than processing ALGAE, knocking REEF ALGAE off, drive-forward autos, the CORAL RP only when in reach). **`CALIBRATION.md` is the record of that: every discrepancy, change and lesson.** This file keeps the manual's numbers and the blind build's reasoning; sections the calibration replaced say so.

This is an unofficial simulation for team practice. **Confidence**: high (stated in the manual or drawings), med (derived from drawings or figures), low (estimated or assumed). "p.N" = manual page of the copy below; "FE-2025" = the 2025 Field Layout and Marking drawing.

## What was read, and how the January rules were recovered

- **Manual**: `firstfrc.blob.core.windows.net/frc2025/Manual/2025GameManual.pdf`. FIRST replaces the file with each revision; on 26 Nov 2026 it served the **8 April 2025 revision** (164 pages, created 8 Apr 2025, SHA-256 `dc6aa9ddbeba25c679c58bae746bde14dba2af79a61a65d8c5f575ca6cdfd523`). The kickoff copy (4 Jan 2025) isn't hosted any more. The owner allowed the April manual and field drawings if nothing earlier is available.
- **Recovering the January rules**: the owner's cut-off is "nothing past January 2025", so Team Updates **00-08** (4-31 January 2025) are part of the build's rules and **09-21** (4 February-8 April) were read **only to undo** their changes (`.../frc2025/Manual/TeamUpdates/TeamUpdateNN.pdf`; each prints the edited text with deletions struck through and additions highlighted). Where a later update changed something the sim uses, the sim plays the January value.
- **Field drawings**: `.../frc2025/FieldAssets/2025FieldDrawings.pdf` (215 sheets, drawn 20 Dec 2024, file dated 18 Feb 2025). The layout sheets FE-2025 1-5 carry revisions A (6 Jan, tag rotation axis) and B (27 Jan, tape colors), both January, and C (13 Feb, an AndyMark-field tag table). The sim uses the welded field's AprilTag table (rev A/B) and not the rev C table.
- **Reveal video**: not used. YouTube refuses downloads from the cloud container. If the owner uploads it, repeat the visual check against it.
- **KitBot documentation**: not read (not in the manual or the field drawings); the KitBot type below is an engineering guess, see Open questions.
- **Archive**: keep a copy of the kickoff PDF, the field drawings and the reveal video at the next kickoff (`work/` is git-ignored).

### Changes after January that the sim undoes

| Team Update      | Change after January                                                                                       | Sim (January)                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| TU13 (18 Feb)    | CAGE points: "one of their ALLIANCE'S CAGES"; G419 ANCHOR exceptions reworded; G427 "or fully"             | Climbs are only modeled on the alliance's own CAGES anyway; G419 isn't modeled; G427 meaning unchanged |
| TU14             | G412 / G420 / G435 wording                                                                                 | Not modeled                                                                                            |
| TU16             | L1: "directly supported" by a CORAL in the trough                                                          | Trough capacity is an estimate either way                                                              |
| TU17             | BARGE lights; one HUMAN PLAYER "no more than" in the PROCESSOR AREA                                        | Not modeled                                                                                            |
| TU18             | G212; District Championship thresholds unchanged                                                           | —                                                                                                      |
| TU19, TU20       | AUTO points / ALGAE in AUTO for tiebreakers; AUTO CORAL removed from a BRANCH still counts for the AUTO RP | Tiebreakers aren't modeled; nothing de-scores CORAL in the sim                                         |
| **TU21** (8 Apr) | **CORAL RP 7 per level and BARGE RP 16 at the FIRST Championship** (the April table prints these)          | **5 per level and 14 points**, the in-season values (the January table)                                |
| others           | Bumper, radio, wiring, inspection, alliance-selection and tournament wording                               | Not modeled                                                                                            |

January updates the sim plays: TU02 (AUTO RP counts non-BYPASSED robots; ALGAE 16¼ in; ALLIANCE AREA 30 ft), TU03 (CORAL RP with Coopertition: 5 CORAL on each of 3 levels; G421 reworded to "1 defender at a time"; ALGAE staging wording), TU08 (L1 scoring criteria).

## Values

| Value                 | Used in sim                                                                                                                                                                   | Source                                        | Confidence |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ---------- |
| Auto / delay / teleop | 15 s / 3 s / 135 s; "endgame" = the last 20 s (G428, BARGE lights)                                                                                                            | p.46 §6.4, p.71                               | high       |
| Field                 | 57 ft 6⅞ in × 26 ft 5 in = 17.548 × 8.052 m; guardrail 1 ft 8 in                                                                                                              | p.19 §5.1; tags 1 / 12 at x 657.37 / 33.51 in | high       |
| Symmetry              | **rotational**: red's PROCESSOR (tag 3, 455.15, 317.15 in) is blue's (tag 16, 235.73, -0.15) rotated 180° about the field center; so are the REEFS and BARGE halves           | FE-2025 AprilTag table, sheets 3-5            | high       |
| REEF                  | Hexagon 5 ft 5½ in face to face, centered at (176.75, 158.5) in = (4.489, 4.026) m between tags 18 and 21; flat faces toward the ALLIANCE WALL and the BARGE                  | p.23 §5.3; FE-2025 tags 17-22                 | high       |
| REEF levels           | Trough front edge 1 ft 6 in; L2 top 2 ft 7⅞ in and L3 top 3 ft 11⅝ in (35° up, tips inset 1⅝ in); L4 top 6 ft (vertical, inset 1⅛ in); pipes 1 ft 1 in apart per face         | p.23-24 §5.3                                  | high       |
| REEF ZONE             | Hexagon 7 ft 9½ in face to face                                                                                                                                               | p.22 §5.2                                     | high       |
| CORAL STATIONS        | Two per alliance, cutting the corners of its own ALLIANCE WALL; faces through tags 12 (33.51, 25.80 in, facing 54°) and 13 (291.20 in, facing 306°); opening 6 ft 4 in        | p.32 §5.6.2; FE-2025 tags 12 / 13             | high / med |
| PROCESSOR             | In the scoring-table guardrail at x 235.73 in (5.988 m); opening 2 ft 4 in × 1 ft 8 in, 7 in up; its ALGAE rolls into the opponent's PROCESSOR AREA                           | p.28 §5.5; FE-2025 tag 16, sheet 5 (61.76)    | high       |
| BARGE                 | At mid-field, 3 ft 8 in deep, 8 ft 5 in tall; horizontal truss 5 ft 2 in up (robots drive under it), a 1 ft center support                                                    | p.25 §5.4; FE-2025 sheet 3                    | high / med |
| CAGES                 | 3 per alliance, 3 ft 5½ in, 7 ft ⅜ in, 10 ft 7⅜ in from mid-field; blue's over the half away from its PROCESSOR; 2 ft × 7⅜ in; bottom 3⅛ in (deep) or 2 ft 6⅛ in (shallow)    | p.25-26 §5.4.1, Fig 5-4; tags 14 / 15         | high       |
| BARGE ZONE            | 3 ft 10 in × 12 ft 2½ in around the alliance's half of the BARGE (x 8.19-9.36, y 4.33-8.05 for blue)                                                                          | p.22 §5.2; FE-2025 sheet 3 (46, 146.5)        | high       |
| NET                   | 4 ft × 12 ft, hung from the BARGE top, lowest point 6 ft 4 in; over the alliance's BARGE half                                                                                 | p.27 §5.4.2                                   | high / med |
| ROBOT STARTING LINE   | 7 ft 4 in from the REEF: near edge at x 297.49 in (7.556 m)                                                                                                                   | p.22 §5.2; FE-2025 sheet 5 (88, 249.49)       | high       |
| CORAL MARKS           | 4 ft from the ALLIANCE WALL, on the center line and 6 ft to each side                                                                                                         | FE-2025 sheet 3 (48, 72)                      | high       |
| CORAL                 | 11⅞ in long, 4½ in OD PVC pipe, 1.1-1.8 lb (1.45 lb used)                                                                                                                     | p.33 §5.7.1                                   | high       |
| ALGAE                 | 16¼ in ball (TU02). Mass not given: 1.2 lb assumed                                                                                                                            | p.34 §5.7.2                                   | high / low |
| Staging               | 1 CORAL standing on each CORAL MARK with an ALGAE on top; 6 ALGAE per REEF alternating high (on L3) and low (on L2); 1 CORAL preload; 29 CORAL per CORAL STATION              | p.45 §6.3.4, Fig 6-2, Fig 6-3                 | high       |
| Scoring               | LEAVE 3; CORAL L1 3 / 2, L2 4 / 3, L3 6 / 4, L4 7 / 5; PROCESSOR 6; NET 4; PARK 2; shallow CAGE 6; deep CAGE 12                                                               | p.50 Table 6-2                                | high       |
| RPs                   | Win 3, tie 1; AUTO RP (all robots LEAVE + 1 CORAL in AUTO); CORAL RP 5 on each level (each of 3 levels with Coopertition); BARGE RP 14 BARGE points                           | p.50 Table 6-2 (in-season values, TU03, TU21) | high       |
| Coopertition          | At least 2 ALGAE in each alliance's PROCESSOR                                                                                                                                 | p.49 §6.5.3                                   | high       |
| Fouls                 | MINOR 2, MAJOR 6                                                                                                                                                              | p.50 Table 6-3                                | high       |
| Robot rules           | R103 **115 lb** without BUMPERS and battery (down from 125, TU00); R104 120 in ROBOT PERIMETER, 3 ft 6 in tall at the start; R105 1 ft 6 in extension; G409 1 CORAL + 1 ALGAE | p.78, p.67                                    | high       |

## Mechanics in `rules.ts`

- **REEF ALGAE blocks BRANCHES.** "A CORAL is scored on L2-L4 BRANCH if … the CORAL is not in contact with … an ALGAE" (6.5.1), and "To unlock all scoring locations on the reef, robots must dislodge algae from the reef" (4). Each face's ALGAE rests on a pair of BRANCHES (Fig 6-3): a 16¼ in ball cradled on two tips 13 in apart sits 4⅞ in above them, so the low one (on L2) reaches ~45 in and the high one (on L3) ~60½ in. The sim closes **L2 and L3** behind a low ALGAE and **L3** behind a high one; "Staged ALGAE will not contact CORAL placed on L4" (6.3.4.2). Confidence med: the manual doesn't list which BRANCHES each ALGAE blocks; the geometry does. Which faces start high isn't stated either: the face toward the BARGE starts high, then they alternate (low).
- **Taking REEF ALGAE**: each face's ALGAE is a one-piece pickup in front of the face (a `HumanPlayerStation` with `supply: 1`, usable in AUTO), drawn on the REEF until taken. A robot gets it if its ALGAE mechanism reaches the ball's center (0.93 m low, 1.33 m high: `intake.maxHeight`), and keeps it (G409: 1 CORAL and 1 ALGAE at a time). Taking it opens the BRANCHES. Since the calibration (ADR 0014) a robot that reaches it can also knock it to the floor (`knockOff`; real robots cleared most REEF ALGAE that way), and bots only take it on purpose (`loadFrom`).
- **PROCESSOR → the opponent's HUMAN PLAYER → their NET**: "Once an ALGAE passes through the PROCESSOR, it rolls … into the opponent's PROCESSOR AREA" (5.5), and "HUMAN PLAYERS can score ALGAE in their NET once it has been passed to them via their opponent's PROCESSOR" (6.1). The HUMAN PLAYER, behind the opponent's PROCESSOR, throws each ALGAE 2.5 s after getting it and then every 3 s, TELEOP only (G404). The throw is a real ballistic ALGAE: it drops into the NET with a 35 % chance in the blind build (an estimate, kept low per "Lessons from 2024"; low confidence), **88 % since the calibration** (real HUMAN PLAYERS netted 0.86 per ALGAE their opponents processed), and otherwise falls short beside the BARGE, on the thrower's side, as a loose ALGAE.
- **Coopertition** lowers the CORAL RP to 3 levels; the HUD shows each alliance's CORAL per level, Coopertition and the HUMAN PLAYER's ALGAE.
- **G421** "No more than 1 ROBOT may be on the opponent's side of the FIELD … with its BUMPERS fully outside and beyond the BARGE ZONES. Violation: MINOR FOUL, and for every 3 seconds in which the situation is not corrected, a MAJOR FOUL." Called in `rules.ts` with the robot's center 0.45 m past the BARGE ZONES' far edge. Bots keep to it (`botHints.oneAcrossLine`).
- **Bot hints** (`botValue`, TELEOP only), the blind build's: +2 for the first 2 PROCESSOR ALGAE (Coopertition, which helps both alliances), then -1.4 (each one hands the opponents' HUMAN PLAYER a 35 % shot at 4 points); +1.5 for a CORAL on a level short of 5, +3 for the 5th (real teams build set bonuses on purpose; without it random alliances never made the CORAL RP). **Replaced by the calibration**: Coopertition by agreement, the PROCESSOR at its net worth, no ALGAE in AUTO, the CORAL RP push only when in reach, a value for clearing a REEF face (`CALIBRATION.md`, "Rules, as played").

## Fouls the engine calls (declared in `definition.fouls`)

- **G427** "A ROBOT may not contact, directly or transitively through a SCORING ELEMENT, an opponent ROBOT partially or fully inside the opponent's BARGE ZONE or REEF ZONE regardless of who initiates contact. Violation: MAJOR FOUL." Declared `inside: 'protected'` (any part of the protected robot), all match. As in 2024, `forgiveForced` skips contact the protected robot clearly drove into (a lenient stand-in for G211's forced violations). Bots keep away from copies of both zones grown by half a robot (`bot-reef-zone`, `bot-barge-zone`).
- **G428** "A ROBOT may not contact … an opponent ROBOT in contact with an opponent CAGE during the last 20 seconds regardless of who initiates contact. Violation: MAJOR FOUL and the opponent ALLIANCE is awarded the BARGE RP." Declared on the climbing spots, `endgameOnly`, once per pair of robots (`repeatSec: 20`); the BARGE RP check reads it.
- **G425** "A ROBOT may not PIN an opponent's ROBOT for more than 3 seconds … A PIN count ends once … the ROBOTS have separated by at least 6 ft … for more than 3 seconds, either ROBOT has moved 6 ft from where the PIN initiated for more than 3 seconds, or the PINNING ROBOT gets PINNED. Violation: MINOR FOUL, and for every 3 seconds in which the situation is not corrected, a MAJOR FOUL." `countSec` 3, release 6 ft, `repinSec` 3.

## Simplifications

- **Placing CORAL** is a timed action in a zone in front of each BRANCH (or the face, for the trough), facing it. Bots and players line up on a specific BRANCH; nothing models CORAL falling off, landing on the wrong BRANCH, or pushing trough CORAL out.
- **Trough capacity**: 4 CORAL per face (3 end to end on a ~38 in face, plus one resting on them, 6.5.1 B). An estimate.
- **The NET**: an elevator robot drops ALGAE in from its side of the BARGE (a placement with a line-up); no robot shoots ALGAE from range. Thrown ALGAE count when they drop into the NET's volume.
- **CAGES** are drawn at the deep position and aren't solid; climbing is a timed action at one of the alliance's three CAGES with a success chance (`endgameSuccess`). Each robot type climbs the depth it is built for (teams pick their CAGE height, 6.3.5). A failed climb earns nothing; the robot may retry, or ends PARKED (its climbing spot is in the PARK area).
- **PARK** counts the robot's center within half a robot (0.35 m) of the BARGE ZONE.
- **LEAVE** counts once the robot's footprint has been off the ROBOT STARTING LINE at any time in AUTO (the manual: at the end of AUTO).
- **The HUMAN PLAYER's storage limit** (G435, 4 ALGAE) isn't needed: they throw them as they come.
- Not modeled: G403 (AUTO contact past the BARGE ZONE: bots stay on their side in AUTO), G405 / G418 (opponent CAGES: bots only use their own), G406-G412 (CORAL launching, de-scoring, ALGAE on the opponent's REEF, CONTROL limits; robots hold 1 CORAL + 1 ALGAE), G419 ANCHORS, G420 (NET contact), G422-G424, G426, G429-G435 (human rules), and ranking tiebreakers.
- **No passing**: G412 forbids launching CORAL outside the robot's REEF ZONE, and nothing makes passing ALGAE worth it on this layout.
- **The KitBot** is guessed (see Open questions).

## Robot types

**Replaced by the calibration** (ADR 0014): the robot types are now designs real teams built in 2025, fitted tier by tier to real robots. `CALIBRATION.md` has every value, blind and now, and the real tiers they match. In short, one type per seventh of real robots (best to worst):

| Tier | Robot type                     | Build                                                                                                                              |
| ---- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| 7    | Full-REEF elevator             | MK4i L3, 4 Kraken X60; ground + station intake; L1-L4; both ALGAE heights and the floor; NET and PROCESSOR; 3-CORAL auto; deep 5 s |
| 6    | CORAL elevator                 | MK4i L2, 4 Kraken X60; station funnel; L1-L4; both ALGAE heights; PROCESSOR; deep                                                  |
| 5    | Pivot arm                      | MAXSwerve, 4 NEO Vortex; L1-L4; both ALGAE heights; PROCESSOR; deep, rarely                                                        |
| 4    | Tank-drive elevator            | West Coast, 4 NEO at 8.45:1; L1-L4; low ALGAE only; PROCESSOR; deep, rarely                                                        |
| 3    | Budget elevator                | MK4i L2, 4 NEO; slow single-stage elevator, L1-L4; low ALGAE only; PROCESSOR; deep, rarely                                         |
| 2    | KitBot (dealt 0.6 of the tier) | FIRST's 2025 KitBot: kit tank, a CORAL roller from the CORAL STATION to the trough; PARKS                                          |
| 2    | Everybot (0.4 of the tier)     | the Robonauts' 2025 Everybot: kit tank, trough CORAL, floor and low REEF ALGAE to the PROCESSOR, a CAGE climber                    |
| 1    | Low-resource robot             | 6 CIM tank, a CORAL chute to the trough; its auto usually only drives forward; often breaks down                                   |
| —    | Dedicated defender (not dealt) | 6 Kraken X60 tank; trough only; defense by default                                                                                 |

### The blind build's types

One type per seventh of real robots, best to worst, as kickoff engineering knowledge expects them to be built for this game; the drive-team numbers start from the 2023 tiers and the 2024 lessons in `robot-baselines.md`. Drive limits come from COTS hardware through `drivetrain.ts` at R103's 115 lb (plus ~13 lb battery and ~13 lb BUMPERS).

| Tier | Robot type         | Build                                                                                        | `alignSec` | Auto routine   | Endgame (s, success per try) | `reliability` |
| ---- | ------------------ | -------------------------------------------------------------------------------------------- | ---------- | -------------- | ---------------------------- | ------------- |
| 7    | Full-REEF elevator | MK4i L3, 4 Kraken X60; ground + station intake; L1-L4; both ALGAE heights; NET and PROCESSOR | 2.6        | 3 pieces, 90 % | deep 6, 45 %                 | 0.97          |
| 6    | CORAL elevator     | MK4i L2, 4 Falcon 500; L1-L4; both ALGAE heights; PROCESSOR                                  | 4.6        | 2, 85 %        | deep 7, 32 %                 | 0.95          |
| 5    | Pivot arm (L1-L3)  | MAXSwerve 14T, 4 NEO; L1-L3; both ALGAE heights; PROCESSOR                                   | 8.9        | 2, 75 %        | shallow 6, 35 %              | 0.92          |
| 4    | Tank-drive arm     | West Coast, 4 NEO at 8.45:1; L1-L3; low ALGAE only; PROCESSOR                                | 12.1       | 1, 60 %        | shallow 7, 22 %              | 0.90          |
| 3    | Trough and L2      | MK4i L2, 4 NEO; L1-L2; low ALGAE only; PROCESSOR                                             | 13.6       | 1, 55 %        | shallow 8, 13 %              | 0.88          |
| 2    | KitBot             | KoP tank, 4 CIM; CORAL from the CORAL STATION only, trough only; no ALGAE; PARKS             | 16.8       | 1, 50 %        | —                            | 0.78          |
| 1    | Low-resource robot | 6 CIM tank; CORAL from the station into the trough; PARKS; can be given defense              | 20.2       | 1, 30 %        | —                            | 0.75          |
| —    | Dedicated defender | 6 Kraken X60 tank (not dealt at random); trough only; defense by default                     | 14         | 1, 60 %        | —                            | 0.90          |

- **Line-ups** are the 2023 tier values unchanged: placing a CORAL on a BRANCH is as precise as 2023's cone on a pole. The 2024 lesson says to scale them down only for a forgiving target or pickup; the CORAL STATION's CHUTE is forgiving, the BRANCHES aren't, so the two are taken to balance.
- **Mechanism times** (engineering estimates): intake 0.3-0.5 s; placing L1 0.4-0.8 s, L2 0.7-1.0 s, L3 0.9-1.4 s, L4 1.3-1.5 s (an elevator to 6 ft), PROCESSOR 0.5-0.8 s, NET 1.2 s (an elevator to over 8 ft 5 in).
- **Climbs**: a deep or shallow CAGE is a hanging climb, so the rates start from 2024's chain climb (top tier 40-45 % per try, retried: ONSTAGE in 61 % of real matches), not 2023's drive-on platform. Deep (12 points) is taken to be harder than shallow (6); the top two tiers build for deep, the middle ones for shallow, the bottom two don't climb.
- **Autos** follow the 2024 lesson: the top tier capped at 3 pieces (the REEF is 3 m from the start line and the CORAL MARKS and the CORAL STATION are close), 1-2 below.
- **KitBot** loads only at the CORAL STATION (like 2024's) and has no ALGAE mechanism or climber.

### Alliance presets

- **Powerhouse**: three full-REEF elevators.
- **Triple offense** (real: Championship playoffs): three full-REEF elevators, two on CORAL (`coral` role) and one netting ALGAE (`algae` role), then three deep climbs.
- **Typical qualification alliance**: CORAL elevator, budget elevator, KitBot.
- **Fill the REEF** (real: strong alliances from week 5 on): two elevators on the BRANCHES and a tank-drive elevator filling the trough (`trough` role), for the CORAL RP without Coopertition.
- **REEF and ALGAE**: two elevators keep to CORAL (`coral` role) while a pivot arm clears and scores the ALGAE (`algae` role), opening L2 and L3.
- **BARGE first**: CORAL elevator, pivot arm, tank-drive elevator on _early endgame_, for the BARGE RP.
- **Shutdown defense**: elevator, CORAL elevator and the dedicated defender on _aggressive_.
- **CORAL STATION defense**: elevator, CORAL elevator and a low-resource robot defending by the opponents' CORAL STATIONS (the `station-defense` role: no zone protects robots there, G421 allows one defender).
- **Low-resource alliance**: KitBot, Everybot, budget elevator.
- **Rookie alliance**: three KitBots.

The blind build had Powerhouse, Typical (elevator, trough-and-L2 scorer, KitBot), REEF and ALGAE, BARGE first, the two defense presets and the Rookie alliance.

## Plausibility

`npm run plausibility -- --game 2025-reefscape --difficulties normal --matches 24` with the calibrated robots (each lineup against itself, breakdowns on; means per alliance per match). Validation: 0 errors, 0 warnings. The bots' geometry audit: 0 errors, 1 warning (no robot type climbs a shallow CAGE, as real robots almost never did: 0.02 per alliance).

| Lineup                         | Difficulty | Total | Auto | Teleop | Endgame | Fouls drawn | Pieces | auto RP | coral RP | barge RP | Broke down | Mech failed |
| ------------------------------ | ---------- | ----- | ---- | ------ | ------- | ----------- | ------ | ------- | -------- | -------- | ---------- | ----------- |
| Powerhouse                     | normal     | 221   | 47   | 148    | 25      | 0           | 41.8   | 98%     | 98%      | 96%      | 2%         | 3%          |
| Triple offense                 | normal     | 210   | 47   | 141    | 22      | 1           | 40.8   | 98%     | 100%     | 90%      | 3%         | 6%          |
| Typical qualification alliance | normal     | 85    | 16   | 58     | 9       | 1           | 13.4   | 75%     | 0%       | 38%      | 6%         | 20%         |
| Fill the REEF                  | normal     | 142   | 30   | 94     | 18      | 1           | 27.8   | 90%     | 98%      | 77%      | 2%         | 8%          |
| REEF and ALGAE                 | normal     | 175   | 32   | 127    | 14      | 1           | 30.0   | 98%     | 100%     | 65%      | 1%         | 8%          |
| BARGE first                    | normal     | 105   | 22   | 65     | 17      | 1           | 17.1   | 81%     | 6%       | 77%      | 5%         | 12%         |
| Shutdown defense               | normal     | 121   | 30   | 70     | 15      | 6           | 20.7   | 92%     | 31%      | 67%      | 3%         | 10%         |
| CORAL STATION defense          | normal     | 126   | 28   | 74     | 16      | 8           | 21.1   | 75%     | 29%      | 79%      | 10%        | 19%         |
| Low-resource alliance          | normal     | 48    | 10   | 31     | 6       | 1           | 7.4    | 27%     | 0%       | 13%      | 9%         | 28%         |
| Rookie alliance                | normal     | 24    | 10   | 11     | 3       | 1           | 6.1    | 31%     | 0%       | 0%       | 10%        | 28%         |

Endgame actions completed per alliance per match:

| Lineup                         | Difficulty | deep | shallow |
| ------------------------------ | ---------- | ---- | ------- |
| Powerhouse                     | normal     | 1.94 | 0.00    |
| Triple offense                 | normal     | 1.56 | 0.00    |
| Typical qualification alliance | normal     | 0.42 | 0.00    |
| Fill the REEF                  | normal     | 1.17 | 0.00    |
| REEF and ALGAE                 | normal     | 0.83 | 0.00    |
| BARGE first                    | normal     | 1.15 | 0.00    |
| Shutdown defense               | normal     | 0.88 | 0.00    |
| CORAL STATION defense          | normal     | 1.08 | 0.00    |
| Low-resource alliance          | normal     | 0.10 | 0.00    |
| Rookie alliance                | normal     | 0.00 | 0.00    |

Head-to-head against the typical alliance, normal (`--against typical --difficulties normal --matches 32`; blue plays the lineup):

| Blue lineup                    | Difficulty | Blue score | Red score | Blue wins | Blue auto RP | Blue coral RP | Blue barge RP | Red teleop | Fouls on blue / red |
| ------------------------------ | ---------- | ---------- | --------- | --------- | ------------ | ------------- | ------------- | ---------- | ------------------- |
| Powerhouse                     | normal     | 209        | 87        | 100%      | 100%         | 97%           | 94%           | 62         | 0.5 / 0.2           |
| Triple offense                 | normal     | 212        | 87        | 100%      | 94%          | 100%          | 88%           | 60         | 0.7 / 0.4           |
| Typical qualification alliance | normal     | 84         | 86        | 47%       | 78%          | 0%            | 34%           | 59         | 0.4 / 0.1           |
| Fill the REEF                  | normal     | 136        | 87        | 100%      | 91%          | 100%          | 69%           | 58         | 0.2 / 0.2           |
| REEF and ALGAE                 | normal     | 160        | 103       | 100%      | 100%         | 100%          | 78%           | 75         | 0.3 / 0.3           |
| BARGE first                    | normal     | 107        | 85        | 97%       | 91%          | 0%            | 88%           | 58         | 0.1 / 0.2           |
| Shutdown defense               | normal     | 121        | 84        | 100%      | 84%          | 63%           | 66%           | 55         | 0.7 / 0.2           |
| CORAL STATION defense          | normal     | 122        | 89        | 100%      | 72%          | 59%           | 69%           | 57         | 1.3 / 0.1           |
| Low-resource alliance          | normal     | 45         | 82        | 0%        | 38%          | 0%            | 9%            | 54         | 0.4 / 0.3           |
| Rookie alliance                | normal     | 28         | 75        | 0%        | 31%          | 0%            | 3%            | 49         | 0.1 / 0.3           |

Random lineups, difficulty and the comparison with the real season: `CALIBRATION.md`.

Reading the checks:

- **Bonus RPs** (WARN for the strongest presets): three top-seventh robots make all three nearly every match, as real Championship alliances did (AUTO 93 %, CORAL 50 % at 7 per level, BARGE 78 % at 16 points). A typical alliance makes the AUTO RP 75 % of the time, the BARGE RP 38 % and the CORAL RP never; random alliances 66 / 20 / 47 % against a real 65 / 18 / 47 %.
- **Blue vs red**: mirrored runs show no bias. Typical vs Typical, 400 matches without breakdowns: blue − red -0.14 points (z -0.25), wins 198 : 178 (z 1.0). Powerhouse vs Powerhouse, 300 matches: +0.44 points (z 0.44), wins 141 : 145. Random alliances with breakdowns, 400 matches: -0.31 points (z -0.15).
- **Defense**: the two defense presets take 2-4 TELEOP points off the typical alliance (59 when it plays itself). Real defense was effective at district events and had little effect at the Championship (Chief Delphi); TBA can't measure it.
- **REEF and ALGAE** feeds the opponents: its ALGAE specialist can only process, and the opponents' HUMAN PLAYER nets 88 % of them (the Typical alliance scores 103 against it, 84-89 against the others).

### The blind build's numbers

Before the calibration, random lineups at normal scored 100 points per alliance (auto 22, teleop 65, endgame 11, fouls 1.6); AUTO RP 18 %, CORAL RP 5 %, BARGE RP 39 %; 0.38 deep and 0.49 shallow CAGES per alliance; PROCESSOR 4.9 and NET 2.1 ALGAE per alliance. Pieces per robot: elevator 13.5, CORAL elevator 8.8, pivot arm 5.7, tank-drive arm 3.6, trough-and-L2 3.1, KitBot 2.7, low-resource 2.0. Blue vs red then: typical vs typical, 400 matches without breakdowns, blue − red -0.06 points (z -0.09). Git history has the full tables; `CALIBRATION.md` sets them against the real season.

**Cycle math** (the blind build's top tier, by hand): CORAL STATION to a REEF face and back is ~3.5 m each way, ~1 s each at 3.5-4 m/s with acceleration; intake 0.3 + hand-off 0.6, placing 0.9-1.3 s, plus 2 × 2.6 s of line-up: ~9.5 s per CORAL, ~11 in 105 s of cycling, less traffic, defense and the endgame. The elevator scores 13.5 pieces of all kinds (about 11 CORAL and ALGAE in TELEOP and 2.5 in AUTO). That is 1.5× 2024's top tier (9.0 NOTES) because this game's cycles are much shorter (2024's ran most of the field) and an ALGAE comes off the REEF next to where the CORAL goes; per piece of line-up and mechanism the tiers are 2023's.

## Open questions

- **Reveal video**: not used. Upload it to check the REEF, BARGE and CAGE shapes, the ALGAE staging and the CORAL STATION CHUTE against the sim.
- **Which BRANCHES a REEF ALGAE blocks**, and which faces start high, are inferred from the geometry (above).
- **ALGAE mass**: not in the manual (1.2 lb assumed).
- **CAGE x position**: the CAGES are taken to hang at the BARGE's center line (the tags above them are on both faces of the BARGE).

Answered by the real season (`CALIBRATION.md`):

- **The KitBot**: FIRST's 2025 KitBot took CORAL at the CORAL STATION and scored the trough, as guessed. Teams added climbers and ALGAE mechanisms; the Robonauts' Everybot (L1, ALGAE to the PROCESSOR, a CAGE climb) now shares the tier.
- **Human player NET throws**: 86 % of the ALGAE an opponent processed ended in the NET, every event level. Now 88 % per throw.
- **Coopertition**: not automatic. Both alliances met it in 22 % of matches, one in 35 %; 56 % of alliances never used the PROCESSOR.
- **The BARGE RP** at 14 points: 47 % of real alliances, 39 % in the blind build. The deep climb at 45 % per try was right for the top tier.
- **The CORAL RP**: 18 % of real alliances (11 % in-season), against the blind build's 5 %.
