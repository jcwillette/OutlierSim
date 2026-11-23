# Sources: 2023 CHARGED UP presented by Haas

Generated from the **2023 FRC Game Manual** served at `firstfrc.blob.core.windows.net/frc2023/Manual/2023FRCGameManual.pdf`. That URL now serves the **11 April 2023 revision** (sections marked V1–V12). The kickoff (V0) copy is no longer hosted. **Team Updates 01–07 (10–31 January 2023)** were read. None of them changes a point value, the timing, the field dimensions or the RP thresholds. They cover extension rules (G107–G109), staging, the barrier corner inside a hybrid node (Table 6-1), setup (H309), G205, G306, H111, AprilTag markers, bumpers, control-system and district rules, and the PARK glossary entry. Team Updates from February on were deliberately **not** read (owner cutoff: January 2023). No match results, scouting data or event statistics were used. The reveal video wasn't used (YouTube is blocked in the build container).

This is an unofficial simulation for team practice. **Confidence**: high (stated), med (derived from drawings), low (estimated or assumed). "p.N" = manual page.

## Values

| Value                                   | Used in sim                                                                                                                                     | Source                                     | Confidence |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ---------- |
| Auto / delay / teleop / endgame         | 15 s / 3 s / 135 s / last 30 s                                                                                                                  | p.44 §6.2, §6.3                            | high       |
| Field                                   | 54 ft 3¼ in × 26 ft 3½ in = 16.54 × 8.01 m, guardrail 20 in (0.51 m)                                                                            | p.17, p.19 §5.1                            | high       |
| Symmetry                                | **mirror** across the center line. Both alliances' GRIDS are on the scoring-table side and both LOADING ZONES on the far side.                  | Fig 5-6 (p.20), Fig 6-1 (p.43)             | high       |
| GRIDS                                   | 5.50 m wide, 1.43 m deep incl. tape, at the alliance wall, y 0–5.50. Front face modeled at x 1.38.                                              | p.25 §5.5                                  | high       |
| Nodes                                   | 9 columns × 3 rows. Bottom row HYBRID (any piece), mid/top rows: cube nodes in columns 2, 5, 8, cone nodes elsewhere. CO-OP GRID = columns 4–6. | p.26, Fig 5-14                             | high       |
| Column pitch                            | 0.559 m (0.47 m hybrid node + ~0.09 m divider), centered at y 2.75                                                                              | Fig 5-15 (p.27), derived                   | med        |
| Cone node poles                         | mid 2 ft 10 in (0.87 m) tall, 0.58 m behind the face; top 3 ft 10 in (1.17 m), 1.01 m behind                                                    | p.26, Fig 5-16                             | high       |
| Cube nodes                              | mid wall 0.60 m, front 0.36 m behind the face; top wall 0.90 m, front 0.80 m behind; 0.43 m deep                                                | p.26, Fig 5-15/5-16                        | high       |
| Hybrid node / dividers                  | 0.41 m deep, dividers 5 in (0.13 m) tall                                                                                                        | p.26                                       | high       |
| BARRIER                                 | 7 ft 4 in (2.24 m) long, 1 ft ¼ in (0.31 m) tall, along y 5.49, x 1.12–3.36 (modeled 5 cm thick)                                                | p.22 §5.3, p.21                            | med        |
| CHARGE STATION                          | 2.47 × 1.93 m footprint, centered 2.51 m beyond the grid tape (3.94, 2.745); top 2.44 × 1.22 m; ramps on the long edges; guards on short edges  | p.22–23 §5.4                               | high       |
| CHARGE STATION top height               | 9⅛ in (0.23 m) real, **0.18 m in the sim**                                                                                                      | p.23                                       | high/simpl |
| COMMUNITY                               | 18 ft (5.49 m) wide; 3.36 m deep in the barrier lane, 4.91 m deep around the Charge Station; step at the station edge                           | p.21, Fig 5-6                              | med        |
| LOADING ZONE                            | 8 ft 3 in (2.52 m) wide; 3.36 m deep beside the barrier, 6.71 m deep along the guardrail; step at y 6.75                                        | p.21, Fig 5-6                              | med        |
| DOUBLE SUBSTATION                       | 2.44 m wide, 1.98 m tall, 0.36 m into the field at the opposing alliance wall; 2 sliding shelves at 3 ft 1⅜ in (0.95 m)                         | p.30–31 §5.6.2, Fig 5-20/5-21              | high       |
| SINGLE SUBSTATION                       | along the far guardrail; chute exits 2 ft 3⅛ in (0.69 m) above the carpet; chute ~2.0 m from the opposing wall                                  | p.29 §5.6.1; position measured off Fig 6-1 | low-med    |
| STAGING MARKS                           | 4 per alliance at x 7.12 (5.69 m beyond the grid tape), y 0.92 / 2.14 / 3.36 / 4.58; default cubes outer, cones inner                           | p.21 Fig 5-7, p.43 §6.1.1                  | high       |
| CONE                                    | 0.33 m tall, 8⅜ in (0.21 m) base, 1 lb 7 oz (0.65 kg), yellow                                                                                   | p.36 §5.8.1                                | high       |
| CUBE                                    | 9½ in (0.24 m), 2.5 oz (0.071 kg), purple                                                                                                       | p.37 §5.8.2                                | high       |
| Pieces per alliance                     | 27 cones + 22 cubes: 3 preloaded, 4 staged, 42 in the substation area                                                                           | p.43 §6.1.1                                | high       |
| Preload                                 | 1 cone, or 1 cube for cube-only robots                                                                                                          | p.43 §6.1.1 A                              | high       |
| Start                                   | bumpers inside the COMMUNITY. Sim: against the grid at columns 9, 5, 1, facing it.                                                              | p.43 §6.1.2                                | high/med   |
| Node points (auto / teleop)             | bottom 3 / 2, middle 4 / 3, top 6 / 5                                                                                                           | p.47 Table 6-2                             | high       |
| MOBILITY                                | 3                                                                                                                                               | Table 6-2                                  | high       |
| LINK                                    | 5 per 3 adjacent filled nodes in a row, each piece in ≤ 1 link (computed at match end)                                                          | p.45 §6.4.1, Table 6-2                     | high       |
| SUPERCHARGED node                       | 3 (teleop), only once all 27 nodes hold a piece                                                                                                 | p.46, Table 6-2                            | high       |
| DOCKED / ENGAGED                        | auto 8 / 12 (1 robot max), teleop 6 / 10 each                                                                                                   | p.47 §6.4.2, Table 6-2                     | high       |
| PARK                                    | 2 (in community, not docked)                                                                                                                    | Table 6-2, TU04 glossary                   | high       |
| RPs                                     | Win 2, Tie 1, SUSTAINABILITY ≥ 6 links (5 if both alliances have ≥ 3 pieces on their CO-OP GRID), ACTIVATION ≥ 26 Charge Station pts            | Table 6-2 (p.47–48)                        | high       |
| Fouls                                   | FOUL 5, TECH FOUL 12                                                                                                                            | p.48 Table 6-3                             | high       |
| Robot limits                            | frame perimeter ≤ 120 in, start height ≤ 4 ft 6 in, 48 in extension, 125 lb, 1 piece at a time                                                  | R103, R104, G106, G107, G403               | high       |
| Double substation supply split          | cone shelf 16, cube shelf 14, single chute 12 (= the 42 pieces left after default preload and staging)                                          | p.43 §6.1.1 C; split assumed               | low        |
| HP feed: shelf interval / robot handoff | 3 s per shelf / 1.5 s for the robot to line up and grab                                                                                         | engineering estimate                       | low        |
| HP feed: single chute interval          | 2.5 s                                                                                                                                           | engineering estimate                       | low        |

## Simplifications

- **Nodes are placement targets.** The robot's center must be in a 0.56 m lane in front of a column, facing the grid. Place times include the driver lining up on a 4 cm pole or a walled shelf. Nobody launches cubes; the cube specialist's fast placement stands in for it. Scored pieces are drawn in their nodes.
- **Charge Station** is a static ramp. It doesn't tilt. Its top is modeled 0.18 m high instead of 0.23 m so the bot navigation treats it as drivable. Guards on the short edges are modeled 0.20 m tall and set just outside the top, so robots (and bots) only climb on over the ramps, and three robots can overhang the short edges. Docking and engaging are timed actions on three robot-sized slots. The engage time stands in for balancing skill.
  - Robots get on **one at a time**: no one can start while a teammate is still settling.
  - At the end the station is **LEVEL only if the last robot to get on was one that balances** (an "engage" robot). Then every docked partner is engaged too (manual 6.4.2). If a dock-only robot climbs on last, the station tips and nobody is engaged.
  - Balancing never fails outright. A real auto or endgame balance attempt sometimes does. This is the main reason the Activation RP rate below is high.
  - Auto Charge Station scoring is limited to one robot per alliance. A robot that docked in auto is released at the start of teleop.
- **Substations**:
  - In reality the two double substation shelves each take either piece. In the sim, the guardrail-side shelf hands out cones and the grid-side shelf hands out cubes, so students and bots choose a piece by where they go.
  - Only robots whose intake reaches the 0.95 m shelf (elevator, arm) can use it.
  - The single substation drops a cube onto the floor if the robot can hold one, else a cone. A cone dropped down the chute lands on its side, which floor intakes handle far better with cubes.
  - Each station has its own supply count.
- **Rules not modeled**: G403's multi-piece control (robots hold 1), G404 launch zone, G209's penalty (opponents touched become DOCKED/ENGAGED), G405 descoring, the 3 s post-period grading grace, auto points restoration after descoring, CHARGE STATION/LINK light states.
- **G207 right of way** (modeled, `rules.ts`): a robot whose center is in the opponent's LOADING ZONE or COMMUNITY and that touches an opponent robot (centers within 0.95 m) draws a FOUL, once per pair per 3 s. Bots treat those zones as protected (`botHints.protectedZones`): they don't chase loose pieces there, don't defend there, and path around them when that isn't much longer. A few incidental fouls per match remain.
- **G202 pinning** (modeled, `rules.ts`): driving into an opponent that is trying to move but can't (centers within 0.95 m, opponent slower than 0.25 m/s while commanding a move) for 5 s straight is a FOUL, then a TECH FOUL every further 5 s. The count resets once they separate.
- **Defense**: no dedicated defenders by default (`defenseShare: 0`). The Defender archetype, or any slot set to Defend, marks the opponent carrying the most. Any empty-handed bot may briefly (≤ 4 s) block a nearby opponent carrying a piece home when that costs the opponent more than the bot would score in the time; low-scoring robots (kitbot) do this most. Defense is clean by design:
  - It never targets an opposing defender (blocking a blocker scores nothing). A Defender with no worthwhile target scores instead.
  - It drops an opponent that comes within 0.6 m of its community or loading zone, and never waits inside them (G207).
  - It breaks off after 3 s pressed against a stopped opponent and leaves that robot alone for 4 s (G202's 5-count, 3 s before re-pinning).
  - In the endgame it leaves robots on or near their Charge Station alone (G209, `botHints.endgameProtectedZones`). In 2023 the station is inside the community anyway.
- **Pieces**: cones are rigid; physics treats a cone as a cylinder of 80% base radius. Tipped cones can be intaken in any orientation.

## Archetype rationale

All numbers are engineering estimates from the manual's constraints and typical 2020s FRC mechanisms. None comes from match results.

- **Elevator all-rounder** (default): swerve, 4.3 m/s, 9 m/s² (a tall robot can't accelerate as hard). An angled elevator and claw reach the top pole, which is 1.01 m behind the grid face and 1.17 m up; the 48 in extension limit (G107) allows it. Place times: hybrid 0.8 s, mid cube 1.3 s, mid cone 2.0 s, top cube 1.6 s, top cone 2.8 s. Cones are slower because the driver must line the cone up over a 4 cm pole. Floor and shelf intake 0.35 s. Engages in 4 s.
- **Mid-level arm**: swerve, 4.0 m/s. A single-jointed arm reaches the mid pole (0.58 m deep) but not the top one. Shelf and floor intake. Engages in 5.5 s.
- **Cube specialist**: fast swerve (4.6 m/s), cubes only. A low intake can't reach the 0.95 m shelf, so it uses the single substation and the floor. Cube nodes are walled shelves and the cube weighs 71 g, so placing (or launching in the community, G404) is quick: hybrid 0.6 s, mid 1.0 s, top 1.3 s. Engages in 3.5 s.
- **Kitbot**: tank drive 3.2 m/s, 6 m/s², roller intake (floor only), bottom row only (1.2 s). It can drive up the ramp and dock but not balance. This is what a rookie builds.
- **Cone specialist**: an elevator with a cone-only claw and a funnel that self-centers on the 1.66 in pole, so top cones take 2.0 s instead of the all-rounder's 2.8 s. Loads upright cones off the shelf. No cubes, no auto balance.
- **Charge Station specialist**: light (about 100 lb) low swerve with a gyro auto-balance. It engages in 2.5 s (3 s in auto), because a light, low robot settles the ±15° station fastest. It scores only low: hybrid nodes, plus mid cubes with a simple flipper.
- **Defender**: max-weight, max-frame six-wheel tank with high-grip treads (traction 1.35). It defends by default (`defaultRole: 'defense'`) and stays out of the opponent's protected zones. It can push a piece into the bottom row and dock.

### Reliability (breakdowns)

With breakdowns on (the app's default for bots, and `npm run sim` unless `--perfect`), a robot with reliability R has about a 0.6 × (1 − R) chance to break down for the rest of the match. It also loses power or comms about 5 × (1 − R) times per match, for 2–6 s each. As a bot, it has tunnel-vision lapses, where it ignores teammates' calls and right of way, for a share of the match of about 1.5 × (1 − R) plus a difficulty term (easy 20%, normal 8%, hard 2%). These are engineering estimates of how often FRC robots die or brown out, not data.

| Robot                                   | Reliability | Breaks down (per match) | Power losses (per match) | Why                                 |
| --------------------------------------- | ----------- | ----------------------- | ------------------------ | ----------------------------------- |
| Elevator all-rounder                    | 0.97        | ~2%                     | ~0.15                    | top-tier team, practiced and robust |
| Cone / Cube / Charge Station specialist | 0.95        | ~3%                     | ~0.25                    | simpler single-purpose mechanisms   |
| Defender                                | 0.93        | ~4%                     | ~0.35                    | simple, but takes and gives hits    |
| Mid-level arm                           | 0.92        | ~5%                     | ~0.4                     | mid-tier team                       |
| Kitbot                                  | 0.85        | ~9%                     | ~0.75                    | rookie wiring and brownouts         |

### Alliance presets and strategies

The menu offers these compositions (`lineups` in `definition.ts`), plus a strategy per alliance:

- **Powerhouse**: three elevators.
- **Typical qualification alliance**: elevator, arm, kitbot.
- **Specialists**: cone + cube + Charge Station specialist.
- **Link race**: elevator, cone, cube on _max cycles_ (score until the buzzer).
- **Shutdown defense**: elevator, cube, and a defender on _aggressive_.
- **Activation first**: Charge Station specialist, arm and kitbot on _early endgame_.
- **Rookie alliance**: three kitbots.

Bots board the Charge Station dock-only robots first and the balancer last (`botHints.endgameOrder`), because the station is LEVEL only if a balancer gets on last.

Head-to-head against a _Typical_ alliance (16 matches each, normal, breakdowns on):

| Blue lineup      | Blue score | Red (Typical) score | Blue wins | Blue Sustainability | Blue Activation | Red teleop |
| ---------------- | ---------- | ------------------- | --------- | ------------------- | --------------- | ---------- |
| Powerhouse       | 190        | 144                 | 100%      | 100%                | 81%             | 84         |
| Typical          | 147        | 159                 | 19%       | 94%                 | 56%             | 96         |
| Specialists      | 167        | 146                 | 100%      | 100%                | 81%             | 88         |
| Link race        | 188        | 150                 | 100%      | 100%                | 75%             | 90         |
| Shutdown defense | 169        | 150                 | 88%       | 94%                 | 50%             | 87         |
| Activation first | 110        | 157                 | 0%        | 50%                 | 81%             | 96         |
| Rookie alliance  | 67         | 154                 | 0%        | 0%                  | 6%              | 92         |

One defender is worth about 3 teleop points against a typical alliance. That's measured with the same Shutdown lineup and the Defender defending vs scoring, over 40 matches: −3.1 points of red teleop. The 16-match table above is too noisy to show it. Defending adds about 0.3 fouls per match by the defending alliance, mostly incidental traffic while the Defender is loading or docking. Over 24 Shutdown matches, only one foul happened while a robot was actually defending. Opponents still draw some G207 fouls bumping into blue robots inside blue's own zones. Fouls forced by the defender driving into an opponent aren't called (G201).

## Plausibility (blind, manual-derived)

`npm run sim -- --game 2023-chargedup --matches 20 [--difficulty d] [--archetypes a,b,c]`, means per alliance:

| Lineup                         | Difficulty | Total | Auto | Teleop | Endgame | Fouls drawn | Pieces | Sustainability RP | Activation RP | Robots broke down |
| ------------------------------ | ---------- | ----- | ---- | ------ | ------- | ----------- | ------ | ----------------- | ------------- | ----------------- |
| elevator / elevator / elevator | easy       | 154   | 40   | 93     | 20      | 1           | 23.3   | 93%               | 70%           | 2%                |
| elevator / elevator / elevator | normal     | 179   | 50   | 107    | 20      | 2           | 27.5   | 98%               | 68%           | 2%                |
| elevator / elevator / elevator | hard       | 193   | 57   | 113    | 19      | 4           | 30.1   | 100%              | 68%           | 2%                |
| elevator / arm / kitbot        | easy       | 128   | 34   | 73     | 20      | 1           | 19.9   | 43%               | 75%           | 8%                |
| elevator / arm / kitbot        | normal     | 153   | 39   | 92     | 20      | 3           | 22.9   | 95%               | 60%           | 8%                |
| elevator / arm / kitbot        | hard       | 156   | 42   | 90     | 20      | 3           | 23.1   | 88%               | 68%           | 7%                |
| cube specialist / arm / kitbot | easy       | 110   | 34   | 53     | 22      | 2           | 17.2   | 20%               | 60%           | 7%                |
| cube specialist / arm / kitbot | normal     | 127   | 43   | 63     | 21      | 1           | 19.4   | 73%               | 83%           | 7%                |
| cube specialist / arm / kitbot | hard       | 125   | 43   | 59     | 21      | 2           | 18.9   | 58%               | 75%           | 8%                |

Breakdowns are on (`npm run sim` default). "Fouls drawn" is penalty points awarded to the alliance (the opponents' G207 fouls).

- **Ceiling**: 27 nodes plus supercharge per alliance; the most an alliance can score in pieces is the 49 it owns. An all-elevator alliance nearly fills the grid (26–28 pieces) and starts supercharging on hard.
- **Cycle math**: grid to double substation is about 13.7 m. At 4.3 m/s × 0.85 (normal) plus path overhead that's ~4.5 s each way, plus 1.5 s handoff and 1.3–2.8 s placing, so ~11–13 s per cycle and ~9–10 pieces per elevator robot in teleop before the endgame. The bots score 8–11. A kitbot at 3.2 m/s with a ~17 s cycle manages 5–7.
- **Difficulty ordering**: easy < normal < hard, except cube specialist / arm / kitbot, where hard and normal are within noise (125 vs 127; σ of the mean ≈ 3).
- **Design intent**: the bonus RPs are meant as stretch goals. Here **Sustainability is reached in most normal matches by any alliance with an elevator robot (95-100%), and Activation in 50-85% of matches.** So the sim is optimistic. Robots break down and lose power and bots have lapses, but bots still drive near-perfect paths, defense is mostly opportunistic, every balance attempt that isn't interrupted succeeds, and tipped cones cost nothing. Archetype speeds were not tuned down to hit a target rate, because that target would come from knowledge of the real season. Treat sim scores as an upper bound for well-driven robots.

## Open questions

- The manual at the given URL is the April revision. A January-era value that changed in a later Team Update would be wrong here, and I can't detect that without reading post-January material. The scoring table and RP thresholds aren't touched by TU01–07.
- Single substation chute position (read off Fig 6-1) and the loading zone / community step positions (Fig 5-6) are medium/low confidence. WPILib's 2023 AprilTag layout or the official field drawings would pin them down.
- Real auto and endgame balance success rates: should the sim add a failure chance? That would bring the Activation RP rate down. The owner may want this as a difficulty knob.
- Should some bots play dedicated defense (`defenseShare`)? Bots only defend opportunistically now, outside the protected zones.
