# Extraction checklist: <year> <game name>

Fill every row before writing code. Units: meters, kg, seconds. Show any conversions (`src/engine/sim/authoring.ts` has `IN`, `FT`, `LB`, `feet(ft, in)`).
Confidence: **high** (stated explicitly), **med** (derived from a drawing or several statements), **low** (estimated from the video or assumed).

## Sources

| Item                                                 | Value | Notes |
| ---------------------------------------------------- | ----- | ----- |
| Manual revision and date (cover page / footer)       |       |       |
| Manual SHA-256 (`work/<id>/manual/meta.txt`)         |       |       |
| Team Updates read (numbers and dates)                |       |       |
| Reveal video (file name, length), or "not available" |       |       |
| Field drawings / AprilTag layout JSON used, if any   |       |       |

## Match

| Item                                                 | Value | Source | Conf |
| ---------------------------------------------------- | ----- | ------ | ---- |
| Auto length (s)                                      |       |        |      |
| Auto→teleop transition / delay (s)                   |       |        |      |
| Teleop length (s)                                    |       |        |      |
| Endgame window (last N s), if the manual defines one |       |        |      |
| Starting configuration / where robots start          |       |        |      |
| Preloaded pieces per robot                           |       |        |      |

## Field

| Item                                                                                                      | Value | Source | Conf |
| --------------------------------------------------------------------------------------------------------- | ----- | ------ | ---- |
| Field length × width (m)                                                                                  |       |        |      |
| Perimeter wall height (m)                                                                                 |       |        |      |
| Symmetry: rotational (180°) or mirror (check the drawings: where are each alliance's scoring structures?) |       |        |      |
| Each field element: name, shape, footprint, height, position (blue half), solid?, bots' `nav`             |       |        |      |
| Zones (starting line, alliance areas, protected zones, loading zones…)                                    |       |        |      |
| Human player stations: location, what they feed, rate, limits                                             |       |        |      |
| Staged pieces: type, count, positions                                                                     |       |        |      |

`nav` is how bots drive around an element: `auto` (by height), `wall` (a guard or curb they must not cross), `ramp` (a platform or ramp they climb, whatever its height) or `none` (they fit under it). Keep heights true to the manual and use `nav` rather than changing a height to steer the bots.

## Game pieces

| Item                                                              | Value | Source | Conf |
| ----------------------------------------------------------------- | ----- | ------ | ---- |
| Each type: name, shape, dimensions, mass, color                   |       |        |      |
| Total count in play per type (field + HP + preload)               |       |        |      |
| What happens after scoring (stays, removed, returned to field/HP) |       |        |      |

## Scoring

| Target | Pieces | Method (place / shoot / both) | Auto pts | Teleop pts | Capacity | Height / opening | Credit | Source |
| ------ | ------ | ----------------------------- | -------- | ---------- | -------- | ---------------- | ------ | ------ |
|        |        |                               |          |            |          |                  |        |        |

| Item                                                                             | Value | Source | Conf |
| -------------------------------------------------------------------------------- | ----- | ------ | ---- |
| Auto mobility / leave points                                                     |       |        |      |
| Endgame actions: name, where, points, robots per location, prerequisites         |       |        |      |
| Park points                                                                      |       |        |      |
| Foul point values (minor / major / tech)                                         |       |        |      |
| Special mechanics (multipliers, timed states, coopertition, element activation…) |       |        |      |

## Ranking points

| RP         | Exact criteria (quote) | Schema kind | Source |
| ---------- | ---------------------- | ----------- | ------ |
| Win / tie  |                        | `win`/`tie` |        |
| Bonus RP 1 |                        |             |        |
| Bonus RP 2 |                        |             |        |

Pick the declarative kind when it fits: `piecesAtLeast` (pieces in targets with given tags or ids), `endgamePointsAtLeast`, `pointsAtLeast` (points from listed sources, e.g. every Charge Station source incl. auto), `scoreAtLeast`. Use `custom` only for logic like adjacency or coopertition thresholds.

## Fouls the sim enforces (Section 7 / G-rules)

Quote the rule text: the exact wording decides the model ("any part of", "regardless of who initiates", "fully contained", the pin release distance).

| Rule | Kind                     | Zones (per alliance) | Who must be inside (`intruder` / `protected`), any part or fully | Endgame only? | Severity / repeat    | Source |
| ---- | ------------------------ | -------------------- | ---------------------------------------------------------------- | ------------- | -------------------- | ------ |
|      | protected-zone contact   |                      |                                                                  |               |                      |        |
|      | pinning (count, release) |                      | n/a                                                              | n/a           | first / each further |        |

Rules whose penalty isn't a foul (e.g. 2023 G209: touched robots count as engaged) can't be `fouls.contact`: give the bots the zone as `botHints.endgameProtectedZones` and list the penalty under Simplifications.

## Robot constraints that shape play

| Item                                                              | Value | Source | Conf |
| ----------------------------------------------------------------- | ----- | ------ | ---- |
| Max frame perimeter / starting size, bumpers included (m)         |       |        |      |
| Max height (m) and extension limits                               |       |        |      |
| Max robot weight (lb), and whether bumpers / battery are excluded |       |        |      |
| Bumper weight limit (lb), if any                                  |       |        |      |
| Legal drive motors (and any motor-count limit)                    |       |        |      |
| Piece-holding limits (e.g. "1 at a time")                         |       |        |      |
| Zones robots can't enter / contact restrictions that change paths |       |        |      |

## Archetypes (proposed)

| Name | Concept | Drivetrain (motor, module / gearbox) and weight | Capacity | Intake | Place/shoot times | Endgame | Reliability | Why it's plausible |
| ---- | ------- | ----------------------------------------------- | -------- | ------ | ----------------- | ------- | ----------- | ------------------ |
|      |         |                                                 |          |        |                   |         |             |                    |

## Lineups (alliance presets for the menu)

| Id  | Robots (and roles) | Strategy | What it shows students |
| --- | ------------------ | -------- | ---------------------- |
|     |                    |          |                        |

## Simplifications

- (each manual rule or mechanic the sim doesn't model, and how it's approximated)

## Open questions

- (ambiguities to raise with the owner or watch for in Team Updates / Q&A)
