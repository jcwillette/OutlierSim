# Extraction checklist: <year> <game name>

Fill every row before writing code. Units: meters, kg, seconds. Show any conversions.
Confidence: **high** (stated explicitly), **med** (derived from a drawing or several statements), **low** (estimated from the video or assumed).

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

| Item                                                                             | Value | Source | Conf |
| -------------------------------------------------------------------------------- | ----- | ------ | ---- |
| Field length × width (m)                                                         |       |        |      |
| Perimeter wall height (m)                                                        |       |        |      |
| Symmetry: rotational (180°) or mirror                                            |       |        |      |
| Each field element: name, shape, footprint, height, position (blue half), solid? |       |        |      |
| Zones (starting line, alliance areas, protected zones, loading zones…)           |       |        |      |
| Human player stations: location, what they feed, rate, limits                    |       |        |      |
| Staged pieces: type, count, positions                                            |       |        |      |

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
| Ranking points: win / tie / each bonus RP and its exact criteria                 |       |        |      |
| Foul point values (minor / major / tech)                                         |       |        |      |
| Special mechanics (multipliers, timed states, coopertition, element activation…) |       |        |      |

## Robot constraints that shape play

| Item                                                              | Value | Source | Conf |
| ----------------------------------------------------------------- | ----- | ------ | ---- |
| Max frame perimeter / starting size, bumpers included (m)         |       |        |      |
| Max height (m) and extension limits                               |       |        |      |
| Max robot weight (kg)                                             |       |        |      |
| Piece-holding limits (e.g. "1 at a time")                         |       |        |      |
| Zones robots can't enter / contact restrictions that change paths |       |        |      |

## Archetypes (proposed)

| Name | Concept | Speed | Capacity | Intake | Place/shoot times | Endgame | Why it's plausible |
| ---- | ------- | ----- | -------- | ------ | ----------------- | ------- | ------------------ |
|      |         |       |          |        |                   |         |                    |

## Simplifications

- (each manual rule or mechanic the sim doesn't model, and how it's approximated)

## Open questions

- (ambiguities to raise with the owner or watch for in Team Updates / Q&A)
