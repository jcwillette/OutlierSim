# Sources: 2023 CHARGED UP presented by Haas

Generated from the **2023 FRC Game Manual** served at `firstfrc.blob.core.windows.net/frc2023/Manual/2023FRCGameManual.pdf`. That URL now serves the **11 April 2023 revision** (sections marked V1–V12; the copy re-read on 24 Nov 2026 for the G202/G207 wording has SHA-256 `b97e41fc77db8f67bd7f3c77c6f859825f58df92b08699a4bd6d192a1997fcc8`). The kickoff (V0) copy is no longer hosted. **Team Updates 01–07 (10–31 January 2023)** were read. None of them changes a point value, the timing, the field dimensions or the RP thresholds. They cover extension rules (G107–G109), staging, the barrier corner inside a hybrid node (Table 6-1), setup (H309), G205, G306, H111, AprilTag markers, bumpers, control-system and district rules, and the PARK glossary entry. Team Updates from February on were deliberately **not** read (owner cutoff: January 2023). No match results, scouting data or event statistics were used. The reveal video wasn't used (YouTube is blocked in the build container).

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
| CHARGE STATION top height               | 9⅛ in (0.23 m), modeled at that height (`nav: 'ramp'` makes it drivable for the bots)                                                           | p.23                                       | high       |
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
- **Charge Station** is a static ramp at its real height (9⅛ in). It doesn't tilt. It is a `hull` with `nav: 'ramp'`: the bots drive over it slowly, and in physics its ramps continue 3 cm below the floor so the box-shaped robots can drive up from any speed (the first build lowered the top to 0.18 m for the bots' navigation, and robots could only get on at speed). Guards on the short edges are modeled 0.20 m tall (`nav: 'wall'`) and set just outside the top, so robots (and bots) only climb on over the ramps, and three robots can overhang the short edges. Docking and engaging are timed actions on three robot-sized slots. The engage time stands in for balancing skill.
  - Robots get on **one at a time**: no one can start while a teammate is still settling.
  - At the end the station is **LEVEL only if the last robot to get on was one that balances** (an "engage" robot). Then every docked partner is engaged too (manual 6.4.2). If a dock-only robot climbs on last, the station tips and nobody is engaged.
  - Balancing never fails outright by default. A real auto or endgame balance attempt sometimes does, and this is the main reason the Activation RP rate below is high. The menu's robot tuning has an engage success chance per robot type (`endgameSuccess`); a failed engage still docks (`fallback`). With every engage at 75 %, Typical vs Typical (40 matches, normal) goes from 90 % to 58 % Activation and loses about 4 points.
  - Auto Charge Station scoring is limited to one robot per alliance. A robot that docked in auto is released at the start of teleop.
- **Substations**:
  - In reality the two double substation shelves each take either piece. In the sim, the guardrail-side shelf hands out cones and the grid-side shelf hands out cubes, so students and bots choose a piece by where they go.
  - Only robots whose intake reaches the 0.95 m shelf (elevator, arm) can use it.
  - The single substation drops a cube onto the floor if the robot can hold one, else a cone. A cone dropped down the chute lands on its side, which floor intakes handle far better with cubes.
  - Each station has its own supply count.
- **Rules not modeled**: G403's multi-piece control (robots hold 1), G404 launch zone, G209's penalty (opponents touched become DOCKED/ENGAGED), G405 descoring, the 3 s post-period grading grace, auto points restoration after descoring, CHARGE STATION/LINK light states.
- **G207 right of way** (declared in `definition.fouls.contact`, called by the engine): a robot with **any part** of itself in the opponent's LOADING ZONE or COMMUNITY that touches an opponent robot (bumper boxes within 3 cm) draws a FOUL, once per pair per 3 s ("per instance"). The manual calls it "regardless of who initiates contact" and G201 excuses only deliberately forced violations; the sim still doesn't call contact the zone's owner clearly drove into (`forgiveForced`), which is lenient. Bots treat those zones as protected (by default, from the declared rule): they don't chase loose pieces there, don't defend there, keep their whole body out of them when they path around them, and give opponents extra room while partly inside one. About 1.6 G207 fouls per alliance per match remain in random lineups, mostly in traffic near the zone lines and when a defender pushes a scorer partly into its own zone (G201's example b says that is still a foul). The first version (center in the zone, centers within 0.95 m) called about 0.6.
- **G202 pinning** (declared in `definition.fouls.pinning`, called by the engine): pressing an opponent that is trying to move but can't (bumpers touching, opponent slower than 0.25 m/s while commanding a move) counts toward a 5 s pin, which draws a FOUL, then a TECH FOUL every further 5 s. The count pauses while the robots aren't touching and resumes if the pin starts again. As G202 says, the pin ends once they are 6 ft (1.83 m) apart, either robot has moved 6 ft from where it started, or the pinning robot gets pinned; pinning the same robot again within 3 s resumes the old count. Transitive pins (through a game piece or a partner) aren't detected. Chassis are frictionless boxes, so a robot pressed against a wall can still slide along it: most sim pins are shoving matches against a robot that can't push back.
- **Defense**: no dedicated defenders by default (`defenseShare: 0`). The Defender archetype, or any slot set to Defend, marks the opponent carrying the most. Any empty-handed bot may briefly (≤ 4 s) block a nearby opponent carrying a piece home when that costs the opponent more than the bot would score in the time; low-scoring robots (kitbot) do this most. Defense is clean by design:
  - It never targets an opposing defender (blocking a blocker scores nothing). A Defender with no worthwhile target scores instead.
  - It drops an opponent that comes within 0.6 m of its community or loading zone, and never waits inside them (G207).
  - It breaks off after 3 s pressed against a stopped opponent, backs off past 6 ft so the pin count ends, and leaves that robot alone for 4 s (G202's 5-count, 3 s before re-pinning).
  - In the endgame it leaves robots on or near their Charge Station alone (G209, `botHints.endgameProtectedZones`). In 2023 the station is inside the community anyway.
- **Pieces**: cones are rigid; physics treats a cone as a cylinder of 80% base radius. Tipped cones can be intaken in any orientation.

## Archetype rationale

All numbers are engineering estimates from the manual's constraints and typical 2020s FRC mechanisms. None comes from match results.

**Drive and weight** come from each robot's assumed 2023-era COTS drivetrain through `src/engine/sim/drivetrain.ts`:

- **Speed**: free speed from the vendor motor spec and gearing (motor rpm ÷ ratio × wheel circumference). Practical top speed is 85 % of that for swerve and 77 % for tank. The tank figure is the share AndyMark uses for its Kit of Parts chassis: a CIM at 4100 rpm, which gives 12.7 ft/s at 8.45:1.
- **Acceleration**: the motor curve with typical drive current limits (Falcon 70 A, NEO 50 A, CIM 60 A), 90 % gearbox efficiency, traction (μ 1.1 swerve tread, 1.0 Kit of Parts wheels, 1.35 high-grip tread), and for tall robots a tipping limit (g × wheelbase ÷ CG height). It is fitted to the engine's constant-acceleration model by matching the time for a 5 m sprint.
- **Weight**: weighed robot (R103: 125 lb max, excluding bumpers and battery), plus about 13 lb of battery and 14 lb of bumpers (15 lb for the Defender's).

Motor specs at 12 V:

| Motor      | Free speed (rpm) | Stall torque (N·m) | Stall current (A) |
| ---------- | ---------------- | ------------------ | ----------------- |
| Falcon 500 | 6380             | 4.69               | 257               |
| NEO        | 5676             | 2.6                | 105               |
| CIM        | 5310             | 2.42               | 133               |

| Robot                     | Drivetrain                                                 | Weighed / on field | Top speed (free) | Acceleration                         | 5 m from rest |
| ------------------------- | ---------------------------------------------------------- | ------------------ | ---------------- | ------------------------------------ | ------------- |
| Elevator all-rounder      | MK4i L2 (6.75:1, 4 in), 4 Falcon 500                       | 125 / 152 lb       | 14.0 ft/s (16.5) | 23 ft/s², tipping-limited (CG 0.4 m) | 1.47 s        |
| Mid-level arm             | MK4i L2, 4 NEO                                             | 118 / 145 lb       | 12.5 ft/s (14.7) | 28 ft/s²                             | 1.54 s        |
| Cube specialist           | MK4i L3 (6.12:1), 4 Falcon 500                             | 105 / 132 lb       | 15.5 ft/s (18.2) | 30 ft/s²                             | 1.32 s        |
| Kitbot                    | Kit of Parts tank, 4 CIM, 10.71:1, 6 in                    | 90 / 117 lb        | 10.0 ft/s (13.0) | 32 ft/s², traction-limited           | 1.80 s        |
| Cone specialist           | MK4i L2, 4 Falcon 500                                      | 122 / 149 lb       | 14.0 ft/s (16.5) | 23 ft/s², tipping-limited            | 1.47 s        |
| Charge Station specialist | MAXSwerve 14T (4.71:1, 3 in), 4 NEO                        | 100 / 127 lb       | 13.4 ft/s (15.8) | 30 ft/s²                             | 1.45 s        |
| Defender                  | 6-wheel tank, 6 Falcon 500, 10.71:1, 6 in, high-grip tread | 125 / 155 lb       | 12.0 ft/s (15.6) | 44 ft/s², traction-limited           | 1.50 s        |

Low-geared tank drives launch hardest off the line, but they top out early. Swerve robots win any sprint longer than a couple of meters. Turn rates (`maxOmega`, 5-9 rad/s) are driver comfort, not hardware.

- **Elevator all-rounder** (default): swerve (see the drive table; a tall robot can't accelerate as hard). An angled elevator and claw reach the top pole, which is 1.01 m behind the grid face and 1.17 m up; the 48 in extension limit (G107) allows it. Place times: hybrid 0.8 s, mid cube 1.3 s, mid cone 2.0 s, top cube 1.6 s, top cone 2.8 s. Cones are slower because the driver must line the cone up over a 4 cm pole. Floor and shelf intake 0.35 s. Engages in 4 s.
- **Mid-level arm**: NEO swerve, a bit slower. A single-jointed arm reaches the mid pole (0.58 m deep) but not the top one. Shelf and floor intake. Engages in 5.5 s.
- **Cube specialist**: fast L3 swerve, cubes only. A low intake can't reach the 0.95 m shelf, so it uses the single substation and the floor. Cube nodes are walled shelves and the cube weighs 71 g, so placing (or launching in the community, G404) is quick: hybrid 0.6 s, mid 1.0 s, top 1.3 s. Engages in 3.5 s.
- **Kitbot**: Kit of Parts tank drive (10 ft/s), roller intake (floor only), bottom row only (1.2 s). It can drive up the ramp and dock but not balance. This is what a rookie builds.
- **Cone specialist**: an elevator with a cone-only claw and a funnel that self-centers on the 1.66 in pole, so top cones take 2.0 s instead of the all-rounder's 2.8 s. Loads upright cones off the shelf. No cubes, no auto balance.
- **Charge Station specialist**: light (about 100 lb) low swerve with a gyro auto-balance. It engages in 2.5 s (3 s in auto), because a light, low robot settles the ±15° station fastest. It scores only low: hybrid nodes, plus mid cubes with a simple flipper.
- **Defender**: max-weight, max-frame six-wheel tank with high-grip treads (traction 1.35). It defends by default (`defaultRole: 'defense'`) and stays out of the opponent's protected zones. It can push a piece into the bottom row and dock.

### Reliability (breakdowns)

With breakdowns on (the app's default for bots, and `npm run sim` unless `--perfect`), a robot with reliability R has about a 0.6 × (1 − R) chance to break down (dead), which clears 10–35 s later with chance 0.7 − 3 × (1 − R). It has about a 1.5 × (1 − R) chance of a mechanism failure, where it still drives and can do the endgame but can't handle pieces; that clears 5–25 s later with chance 0.85 − 3 × (1 − R). It also loses power or comms about 5 × (1 − R) times per match, for 2–6 s each. The menu's tuning section can override any of these per robot type. As a bot, it has tunnel-vision lapses, where it ignores teammates' calls and right of way, for a share of the match of about 1.5 × (1 − R) plus a difficulty term (easy 20%, normal 8%, hard 2%). These are engineering estimates of how often FRC robots die or brown out, not data.

| Robot                                   | Reliability | Breaks down (comes back) | Mechanism failure (fixed) | Power losses (per match) | Why                                 |
| --------------------------------------- | ----------- | ------------------------ | ------------------------- | ------------------------ | ----------------------------------- |
| Elevator all-rounder                    | 0.97        | ~2% (61%)                | ~5% (76%)                 | ~0.15                    | top-tier team, practiced and robust |
| Cone / Cube / Charge Station specialist | 0.95        | ~3% (55%)                | ~8% (70%)                 | ~0.25                    | simpler single-purpose mechanisms   |
| Defender                                | 0.93        | ~4% (49%)                | ~11% (64%)                | ~0.35                    | simple, but takes and gives hits    |
| Mid-level arm                           | 0.92        | ~5% (46%)                | ~12% (61%)                | ~0.4                     | mid-tier team                       |
| Kitbot                                  | 0.85        | ~9% (25%)                | ~23% (40%)                | ~0.75                    | rookie wiring and brownouts         |

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

Head-to-head against a _Typical_ alliance (`npm run plausibility -- --game 2023-chargedup --against typical --matches 32 --difficulties normal`, breakdowns on):

| Blue lineup                    | Difficulty | Blue score | Red score | Blue wins | Blue sustainability RP | Blue activation RP | Red teleop | Fouls on blue / red |
| ------------------------------ | ---------- | ---------- | --------- | --------- | ---------------------- | ------------------ | ---------- | ------------------- |
| Powerhouse                     | normal     | 187        | 166       | 88%       | 97%                    | 88%                | 91         | 2.4 / 1.3           |
| Typical qualification alliance | normal     | 161        | 160       | 53%       | 94%                    | 88%                | 91         | 1.3 / 1.3           |
| Specialists                    | normal     | 173        | 154       | 81%       | 97%                    | 97%                | 85         | 1.2 / 1.7           |
| Link race                      | normal     | 187        | 164       | 94%       | 100%                   | 97%                | 92         | 1.2 / 1.3           |
| Shutdown defense               | normal     | 173        | 158       | 75%       | 97%                    | 84%                | 85         | 2.3 / 4.2           |
| Activation first               | normal     | 108        | 159       | 0%        | 25%                    | 88%                | 90         | 1.1 / 0.8           |
| Rookie alliance                | normal     | 74         | 157       | 0%        | 0%                     | 66%                | 91         | 0.4 / 0.5           |

Typical vs Typical comes out 53 % here. The defender costs the Typical alliance about 6 teleop points (85 against Shutdown vs 90-92 against most others; Specialists also hold it to 85 by sharing the substations). Against Shutdown the Typical alliance draws 4.2 G207 fouls per match: the defended robots get pushed partly into the defender's own zones, which G201's blue box says is still a foul. Fouls the defended robot clearly forced aren't called (`forgiveForced`).

## Plausibility (blind, manual-derived)

`npm run plausibility -- --game 2023-chargedup --matches 16`: every lineup preset against itself (so each match gives two alliance samples), easy / normal / hard bots, breakdowns on; validation and the bots' geometry audit are clean. Means per alliance per match:

| Lineup                         | Difficulty | Total | Auto | Teleop | Endgame | Fouls drawn | Pieces | sustainability RP | activation RP | Broke down | Mech failed |
| ------------------------------ | ---------- | ----- | ---- | ------ | ------- | ----------- | ------ | ----------------- | ------------- | ---------- | ----------- |
| Powerhouse                     | easy       | 154   | 39   | 89     | 22      | 3           | 22.7   | 94%               | 81%           | 2%         | 4%          |
| Powerhouse                     | normal     | 189   | 50   | 108    | 23      | 8           | 27.3   | 100%              | 91%           | 2%         | 6%          |
| Powerhouse                     | hard       | 199   | 53   | 114    | 22      | 10          | 29.7   | 100%              | 78%           | 1%         | 4%          |
| Typical qualification alliance | easy       | 129   | 34   | 69     | 23      | 2           | 19.4   | 19%               | 84%           | 5%         | 9%          |
| Typical qualification alliance | normal     | 163   | 39   | 94     | 23      | 7           | 23.3   | 100%              | 84%           | 1%         | 9%          |
| Typical qualification alliance | hard       | 169   | 43   | 94     | 25      | 7           | 24.0   | 97%               | 88%           | 4%         | 10%         |
| Specialists                    | easy       | 154   | 40   | 82     | 25      | 6           | 21.2   | 72%               | 97%           | 3%         | 9%          |
| Specialists                    | normal     | 176   | 52   | 90     | 26      | 8           | 24.0   | 100%              | 100%          | 2%         | 5%          |
| Specialists                    | hard       | 177   | 52   | 94     | 24      | 7           | 24.7   | 97%               | 100%          | 3%         | 3%          |
| Link race                      | easy       | 160   | 42   | 94     | 22      | 3           | 23.1   | 94%               | 84%           | 3%         | 4%          |
| Link race                      | normal     | 189   | 53   | 107    | 21      | 8           | 27.4   | 100%              | 88%           | 2%         | 8%          |
| Link race                      | hard       | 196   | 56   | 110    | 21      | 9           | 29.0   | 100%              | 78%           | 3%         | 6%          |
| Shutdown defense               | easy       | 135   | 36   | 68     | 20      | 11          | 19.0   | 34%               | 56%           | 2%         | 5%          |
| Shutdown defense               | normal     | 157   | 47   | 77     | 21      | 12          | 21.1   | 72%               | 69%           | 2%         | 6%          |
| Shutdown defense               | hard       | 167   | 51   | 79     | 23      | 15          | 21.8   | 88%               | 81%           | 7%         | 7%          |
| Activation first               | easy       | 104   | 33   | 42     | 27      | 2           | 14.3   | 3%                | 91%           | 1%         | 8%          |
| Activation first               | normal     | 109   | 39   | 41     | 25      | 4           | 14.9   | 25%               | 94%           | 5%         | 11%         |
| Activation first               | hard       | 112   | 40   | 43     | 27      | 2           | 15.2   | 44%               | 97%           | 5%         | 13%         |
| Rookie alliance                | easy       | 69    | 27   | 24     | 17      | 1           | 8.8    | 0%                | 66%           | 7%         | 16%         |
| Rookie alliance                | normal     | 76    | 32   | 22     | 16      | 6           | 9.0    | 0%                | 41%           | 10%        | 16%         |
| Rookie alliance                | hard       | 74    | 35   | 20     | 17      | 1           | 9.0    | 0%                | 56%           | 7%         | 21%         |

"Fouls drawn" is penalty points awarded to the alliance (the opponents' G207 and G202 fouls). Endgame actions completed per alliance per match (more than one auto action can happen, but only one robot's counts):

| Lineup                         | Difficulty | auto-engage | auto-dock | engage | dock |
| ------------------------------ | ---------- | ----------- | --------- | ------ | ---- |
| Powerhouse                     | easy       | 0.66        | 0.16      | 2.13   | 0.00 |
| Powerhouse                     | normal     | 0.56        | 0.38      | 2.13   | 0.00 |
| Powerhouse                     | hard       | 0.50        | 0.34      | 2.03   | 0.00 |
| Typical qualification alliance | easy       | 0.56        | 0.38      | 1.41   | 0.91 |
| Typical qualification alliance | normal     | 0.47        | 0.38      | 1.16   | 1.00 |
| Typical qualification alliance | hard       | 0.50        | 0.38      | 1.53   | 0.91 |
| Specialists                    | easy       | 0.56        | 0.38      | 2.47   | 0.00 |
| Specialists                    | normal     | 0.94        | 0.06      | 2.53   | 0.00 |
| Specialists                    | hard       | 0.88        | 0.09      | 2.34   | 0.00 |
| Link race                      | easy       | 0.63        | 0.34      | 2.00   | 0.00 |
| Link race                      | normal     | 0.81        | 0.09      | 1.97   | 0.00 |
| Link race                      | hard       | 0.88        | 0.00      | 1.97   | 0.00 |
| Shutdown defense               | easy       | 0.56        | 0.28      | 1.34   | 0.91 |
| Shutdown defense               | normal     | 0.63        | 0.31      | 1.31   | 0.91 |
| Shutdown defense               | hard       | 0.84        | 0.13      | 1.38   | 0.88 |
| Activation first               | easy       | 0.69        | 0.28      | 1.75   | 0.97 |
| Activation first               | normal     | 0.44        | 0.56      | 1.66   | 0.81 |
| Activation first               | hard       | 0.53        | 0.47      | 1.84   | 0.81 |
| Rookie alliance                | easy       | 0.00        | 0.88      | 0.00   | 2.75 |
| Rookie alliance                | normal     | 0.00        | 0.72      | 0.00   | 2.59 |
| Rookie alliance                | hard       | 0.00        | 0.91      | 0.00   | 2.66 |

- **Ceiling**: 27 nodes plus supercharge per alliance; the most an alliance can score in pieces is the 49 it owns (3 preloaded, 4 staged, 42 from its human players), or 53 if it also takes the opponent's staged pieces. The best alliance-match scored 33 pieces; an all-elevator alliance fills the grid (27-29 pieces) and starts supercharging on hard.
- **Cycle math**: grid to double substation is about 13.7 m. At 4.27 m/s (14 ft/s) × 0.85 (normal) plus path overhead that's ~4.5 s each way, plus 1.5 s handoff and 1.3–2.8 s placing, so ~11–13 s per cycle and ~9–10 pieces per elevator robot in teleop before the endgame. The bots score 8–11. A kitbot at 3.05 m/s (10 ft/s) with a ~17 s cycle manages 5–7.
- **Difficulty ordering**: easy < normal < hard for every lineup except the rookie alliance (69 / 76 / 74), whose total hardly depends on the driver: three kitbots are limited by the robot, and the order flips within noise.
- **Blue vs red** with identical setups: 161 : 160 wins of 336 (z 0.1). Two separate 2,000-match mirrored Powerhouse runs during this work: 998 : 966 (z 0.7) and, after the last bot change, 1003 : 943 (z 1.4) with non-foul scores of 180.3 vs 180.3.
- **Design intent**: the bonus RPs are meant as stretch goals. Here **Sustainability is reached in nearly every normal match by any alliance with an elevator robot, and Activation in 69-100 % of matches (41-66 % for three kitbots, which need all three docked plus an auto dock).** So the sim is optimistic. Robots break down and lose power and bots have lapses, but bots still drive near-perfect paths, defense is mostly opportunistic, every balance attempt that isn't interrupted succeeds (unless the menu lowers the success chance), and tipped cones cost nothing. Archetype speeds were not tuned down to hit a target rate, because that target would come from knowledge of the real season. Treat sim scores as an upper bound for well-driven robots.

## Open questions

- The manual at the given URL is the April revision. A January-era value that changed in a later Team Update would be wrong here, and I can't detect that without reading post-January material. The scoring table and RP thresholds aren't touched by TU01–07.
- Single substation chute position (read off Fig 6-1) and the loading zone / community step positions (Fig 5-6) are medium/low confidence. WPILib's 2023 AprilTag layout or the official field drawings would pin them down.
- Real auto and endgame balance success rates: should 2023 default to a success chance below 100 %? The knob exists now (menu tuning, `endgameSuccess`, a failed engage still docks); 75 % takes a Typical alliance's Activation rate from 90 % to 58 %.
- G207 is called "regardless of who initiates contact" (G201 excuses only deliberate forcing), but the sim still doesn't call contact the zone's owner clearly drove into (`forgiveForced` on the G207 rule). Turn it off to follow the manual more strictly; expect more fouls on robots defended near the zones.
- Should some bots play dedicated defense (`defenseShare`)? Bots only defend opportunistically now, outside the protected zones.
- Should both double substation shelves hand out either piece (`choice: true`), as the real shelves do? This build splits them into a cone shelf and a cube shelf (it predates `choice`). Measured with both shelves offering either piece, 15 each (40 matches per lineup at normal, both alliances): Typical 160 → 166 total (teleop 88 → 95), Powerhouse 187 → 191, Specialists unchanged (172 → 171; their cube robot can't reach the shelf). `supply` counts a station's pieces, not each type's, so the 16-cone / 14-cube split would become 15 per shelf.
