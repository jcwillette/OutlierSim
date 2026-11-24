# Sources: 2023 CHARGED UP presented by Haas

Generated from the **2023 FRC Game Manual** served at `firstfrc.blob.core.windows.net/frc2023/Manual/2023FRCGameManual.pdf`. That URL now serves the **11 April 2023 revision** (sections marked V1–V12; the copy re-read on 24 Nov 2026 for the G202/G207 wording has SHA-256 `b97e41fc77db8f67bd7f3c77c6f859825f58df92b08699a4bd6d192a1997fcc8`). The kickoff (V0) copy is no longer hosted. **Team Updates 01–07 (10–31 January 2023)** were read. None of them changes a point value, the timing, the field dimensions or the RP thresholds. They cover extension rules (G107–G109), staging, the barrier corner inside a hybrid node (Table 6-1), setup (H309), G205, G306, H111, AprilTag markers, bumpers, control-system and district rules, and the PARK glossary entry. Team Updates from February on were deliberately **not** read (owner cutoff: January 2023). No match results, scouting data or event statistics were used. The reveal video wasn't used (YouTube is blocked in the build container).

This is an unofficial simulation for team practice. **Confidence**: high (stated), med (derived from drawings), low (estimated or assumed). "p.N" = manual page.

**Calibrated since 24 Nov 2026.** At the owner's request the build was compared with every real 2023 qualification match on The Blue Alliance and tuned to the season's average match (ADR 0009, `CALIBRATION.md`). Three things changed:

- Each robot type's drive-team line-up, auto routine, Charge Station times and success chances, and reliability. Drivetrains and mechanism times are still the blind estimates below.
- The Sustainability threshold, to the in-season rule.
- The bots' sense of which node completes a link.

Everything else on this page is the blind build, and the plausibility tables are re-run with the calibrated robots.

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
| RPs                                     | Win 2, Tie 1, SUSTAINABILITY ≥ 5 links (4 if both alliances have ≥ 3 pieces on their CO-OP GRID), ACTIVATION ≥ 26 Charge Station pts            | Table 6-2 (p.47–48); see note              | high       |
| Fouls                                   | FOUL 5, TECH FOUL 12                                                                                                                            | p.48 Table 6-3                             | high       |
| Robot limits                            | frame perimeter ≤ 120 in, start height ≤ 4 ft 6 in, 48 in extension, 125 lb, 1 piece at a time                                                  | R103, R104, G106, G107, G403               | high       |
| Double substation supply split          | cone shelf 16, cube shelf 14, single chute 12 (= the 42 pieces left after default preload and staging)                                          | p.43 §6.1.1 C; split assumed               | low        |
| HP feed: shelf interval / robot handoff | 3 s per shelf / 1.5 s for the robot to line up and grab                                                                                         | engineering estimate                       | low        |
| HP feed: single chute interval          | 2.5 s                                                                                                                                           | engineering estimate                       | low        |

## Simplifications

- **Nodes are placement targets.** The robot's center must be in a 0.56 m lane in front of a column, facing the grid. Place times are the mechanism's. In teleop the drive team's line-up (`alignSec`: lining up on a 4 cm pole or a walled shelf, misses and retries) is added, calibrated per robot type; a programmed auto and the student's own robot don't pay it. Nobody launches cubes; the cube specialist's fast placement stands in for it. Scored pieces are drawn in their nodes.
- **Sustainability threshold**: the April manual (V4, p.47) says 6 LINKS, 5 with coopertition. Real 2023 results show every week-1-6 event and district championship awarded it at 5 (4), and only the Championship at 6 (5). The sim plays the in-season 5 (4), `SUSTAINABILITY_LINKS` in `layout.ts`.
- **Links are a bot goal**: real alliances build links on purpose. `rules.ts` tells the bots (`botValue`) that a node completing a link is worth 5 more, a pair that a third piece can finish 1.5 more, and one of the first three co-op nodes 0.25 more. It never changes the score.
- **Charge Station** is a static ramp at its real height (9⅛ in). It doesn't tilt. It is a `hull` with `nav: 'ramp'`: the bots drive over it slowly, and in physics its ramps continue 3 cm below the floor so the box-shaped robots can drive up from any speed (the first build lowered the top to 0.18 m for the bots' navigation, and robots could only get on at speed). Guards on the short edges are modeled 0.20 m tall (`nav: 'wall'`) and set just outside the top, so robots (and bots) only climb on over the ramps, and three robots can overhang the short edges. Docking and engaging are timed actions on three robot-sized slots. The engage time stands in for balancing skill.
  - Robots get on **one at a time**: no one can start while a teammate is still settling.
  - At the end the station is **LEVEL only if the last robot to get on was one that balances** (an "engage" robot). Then every docked partner is engaged too (manual 6.4.2). If a dock-only robot climbs on last, the station tips and nobody is engaged.
  - Balancing fails sometimes: each robot type has a calibrated engage success chance (`endgameSuccess`, 70-90 %), and a failed engage still docks (`fallback`). The kitbot's dock works on 40 % of its tries, and the defender doesn't dock. The menu's robot tuning can change all of these.
  - Auto Charge Station scoring is limited to one robot per alliance. A robot that docked in auto is released at the start of teleop.
- **Substations**:
  - In reality the two double substation shelves each take either piece. In the sim, the guardrail-side shelf hands out cones and the grid-side shelf hands out cubes, so students and bots choose a piece by where they go.
  - Only robots whose intake reaches the 0.95 m shelf (elevator, arm) can use it.
  - The single substation drops a cube onto the floor if the robot can hold one, else a cone. A cone dropped down the chute lands on its side, which floor intakes handle far better with cubes.
  - Each station has its own supply count.
- **Rules not modeled**: G403's multi-piece control (robots hold 1), G404 launch zone, G209's penalty (opponents touched become DOCKED/ENGAGED), G405 descoring, the 3 s post-period grading grace, auto points restoration after descoring, CHARGE STATION/LINK light states.
- **G207 right of way** (declared in `definition.fouls.contact`, called by the engine): a robot with **any part** of itself in the opponent's LOADING ZONE or COMMUNITY that touches an opponent robot (bumper boxes within 3 cm) draws a FOUL, once per pair per 3 s ("per instance"). The manual calls it "regardless of who initiates contact" and G201 excuses only deliberately forced violations; the sim still doesn't call contact the zone's owner clearly drove into (`forgiveForced`), which is lenient. Bots treat those zones as protected (by default, from the declared rule): they don't chase loose pieces there, don't defend there, keep their whole body out of them when they path around them, and give opponents extra room while partly inside one. About 1.6 G207 fouls per alliance per match remain in random lineups, mostly in traffic near the zone lines and when a defender pushes a scorer partly into its own zone (G201's example b says that is still a foul). The first version (center in the zone, centers within 0.95 m) called about 0.6.
- **G202 pinning** (declared in `definition.fouls.pinning`, called by the engine): pressing an opponent that is trying to move but can't (bumpers touching, opponent slower than 0.25 m/s while commanding a move, and pressed against a wall, a field element or another robot beyond it, so a head-on shoving match isn't a pin) counts toward a 5 s pin, which draws a FOUL, then a TECH FOUL every further 5 s. The count pauses while the robots aren't touching and resumes if the pin starts again. As G202 says, the pin ends once they are 6 ft (1.83 m) apart, either robot has moved 6 ft from where it started, or the pinning robot gets pinned; pinning the same robot again within 3 s resumes the old count. Transitive pins (through a game piece or a partner) aren't detected. Chassis are frictionless boxes, so a robot pressed against a wall can still slide along it: most sim pins are shoving matches against a robot that can't push back.
- **Defense**: no dedicated defenders by default (`defenseShare: 0`). The Defender archetype, or any slot set to Defend, marks the opponent carrying the most. Any empty-handed bot may briefly (≤ 4 s) block a nearby opponent carrying a piece home when that costs the opponent more than the bot would score in the time; low-scoring robots (kitbot) do this most. Defense is clean by design:
  - It never targets an opposing defender (blocking a blocker scores nothing). A Defender with no worthwhile target scores instead.
  - It drops an opponent that comes within 0.6 m of its community or loading zone, and never waits inside them (G207).
  - It breaks off after 3 s pressed against a stopped opponent, backs off past 6 ft so the pin count ends, and leaves that robot alone for 4 s (G202's 5-count, 3 s before re-pinning).
  - In the endgame it leaves robots on or near their Charge Station alone (G209, `botHints.endgameProtectedZones`). In 2023 the station is inside the community anyway.
- **Pieces**: cones are rigid; physics treats a cone as a cylinder of 80% base radius. Tipped cones can be intaken in any orientation.

## Archetype rationale

The drivetrains and mechanism times below are engineering estimates from the manual's constraints and typical 2020s FRC mechanisms, as built blind. The calibration added, per robot type, the drive team's teleop line-up (`alignSec`), an auto routine, calibrated Charge Station times and success chances, and new reliability values. Each type stands for one seventh of real 2023 robots, top to bottom: elevator, cone, cube, Charge Station specialist, arm, kitbot, defender. `CALIBRATION.md` lists every value with its blind value.

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

- **Elevator all-rounder** (default): swerve (see the drive table; a tall robot can't accelerate as hard). An angled elevator and claw reach the top pole, which is 1.01 m behind the grid face and 1.17 m up; the 48 in extension limit (G107) allows it. Place times: hybrid 0.8 s, mid cube 1.3 s, mid cone 2.0 s, top cube 1.6 s, top cone 2.8 s. Cones are slower because the driver must line the cone up over a 4 cm pole. Floor and shelf intake 0.35 s. Line-up 2.6 s per teleop pickup and placement. Two-piece auto. Engages in 6 s (90 %), and in auto in 5 s (85 %).
- **Mid-level arm**: NEO swerve, a bit slower. A single-jointed arm reaches the mid pole (0.58 m deep) but not the top one. Shelf and floor intake. Line-up 12.1 s. One-piece auto that runs 65 % of the time. Engages in 8 s (70 %, else docked); no auto dock.
- **Cube specialist**: fast L3 swerve, cubes only. A low intake can't reach the 0.95 m shelf, so it uses the single substation and the floor. Cube nodes are walled shelves and the cube weighs 71 g, so placing (or launching in the community, G404) is quick: hybrid 0.6 s, mid 1.0 s, top 1.3 s. Line-up 8.9 s. One-piece auto, then it engages in auto in 5 s (80 %). Engages in 6 s (85 %).
- **Kitbot**: Kit of Parts tank drive (10 ft/s), roller intake (floor only), bottom row only (1.2 s). Line-up 16.8 s. Its auto (one piece) runs 45 % of the time. Docking takes 8 s and works on 40 % of its tries; it can't balance. This is what a rookie builds.
- **Cone specialist**: an elevator with a cone-only claw and a funnel that self-centers on the 1.66 in pole, so top cones take 2.0 s instead of the all-rounder's 2.8 s. Loads upright cones off the shelf. Line-up 4.6 s. One-piece auto, no auto balance. Engages in 7 s (85 %).
- **Charge Station specialist**: light (about 100 lb) low swerve with a gyro auto-balance. It engages in 4 s (90 %; 85 % in auto), because a light, low robot settles the ±15° station fastest. Its auto scores the preload and drives straight onto the station (no MOBILITY). It scores only low and slowly (line-up 13.6 s): hybrid nodes, plus mid cubes with a simple flipper.
- **Defender**: max-weight, max-frame six-wheel tank with high-grip treads (traction 1.35). It defends by default (`defaultRole: 'defense'`) and stays out of the opponent's protected zones. It rarely scores (line-up 20.2 s), its auto only leaves the community (30 % of the time), and it parks instead of docking.

### Reliability (breakdowns)

With breakdowns on (the app's default for bots, and `npm run sim` unless `--perfect`), a robot with reliability R has about a 0.6 × (1 − R) chance to break down (dead), which clears 10–35 s later with chance 0.7 − 3 × (1 − R). It has about a 1.5 × (1 − R) chance of a mechanism failure, where it still drives and can do the endgame but can't handle pieces; that clears 5–25 s later with chance 0.85 − 3 × (1 − R). It also loses power or comms about 5 × (1 − R) times per match, for 2–6 s each. The menu's tuning section can override any of these per robot type. As a bot, it has tunnel-vision lapses, where it ignores teammates' calls and right of way, for a share of the match of about 1.5 × (1 − R) plus a difficulty term (easy 20%, normal 8%, hard 2%). The model is an engineering estimate. The reliability values were chosen in the calibration, falling with each type's tier; real 2023 robots did nothing measurable in 1 % (top seventh) to 25 % (bottom seventh) of their matches.

| Robot                     | Reliability | Breaks down (comes back) | Mechanism failure (fixed) | Power losses (per match) | Why                           |
| ------------------------- | ----------- | ------------------------ | ------------------------- | ------------------------ | ----------------------------- |
| Elevator all-rounder      | 0.97        | ~2% (61%)                | ~5% (76%)                 | ~0.15                    | top seventh of 2023 robots    |
| Cone specialist           | 0.95        | ~3% (55%)                | ~8% (70%)                 | ~0.25                    | sixth seventh                 |
| Cube specialist           | 0.92        | ~5% (46%)                | ~12% (61%)                | ~0.4                     | fifth seventh                 |
| Charge Station specialist | 0.90        | ~6% (40%)                | ~15% (55%)                | ~0.5                     | fourth seventh                |
| Mid-level arm             | 0.88        | ~7% (34%)                | ~18% (49%)                | ~0.6                     | third seventh                 |
| Kitbot                    | 0.78        | ~13% (5%)                | ~33% (19%)                | ~1.1                     | second seventh: rookie wiring |
| Defender                  | 0.75        | ~15% (5%)                | ~38% (10%)                | ~1.25                    | bottom seventh                |

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

Head-to-head against a _Typical_ alliance (`npm run plausibility -- --game 2023-chargedup --against typical --matches 32 --difficulties normal`, breakdowns on), calibrated robots:

| Blue lineup                    | Difficulty | Blue score | Red score | Blue wins | Blue sustainability RP | Blue activation RP | Red teleop | Fouls on blue / red |
| ------------------------------ | ---------- | ---------- | --------- | --------- | ---------------------- | ------------------ | ---------- | ------------------- |
| Powerhouse                     | normal     | 150        | 85        | 100%      | 100%                   | 56%                | 47         | 0.5 / 0.6           |
| Typical qualification alliance | normal     | 83         | 88        | 44%       | 13%                    | 13%                | 50         | 0.4 / 0.0           |
| Specialists                    | normal     | 111        | 90        | 91%       | 16%                    | 91%                | 52         | 0.2 / 0.2           |
| Link race                      | normal     | 139        | 86        | 100%      | 100%                   | 84%                | 49         | 0.4 / 0.5           |
| Shutdown defense               | normal     | 115        | 86        | 94%       | 22%                    | 69%                | 50         | 0.4 / 1.7           |
| Activation first               | normal     | 55         | 87        | 3%        | 0%                     | 31%                | 52         | 0.3 / 0.3           |
| Rookie alliance                | normal     | 35         | 88        | 0%        | 0%                     | 0%                 | 52         | 0.1 / 0.2           |

Typical vs Typical comes out 44 % (88 : 83 points, within noise of even over 32 matches). With calibrated robots a defender hardly slows a Typical alliance: its teleop is 50 against Shutdown and 47-52 against the others, because real-paced robots cycle little enough that blocking them pays off less. The blind build, whose bots cycled about 1.7 times as fast, lost 6 teleop points to one. Contact fouls fell with the traffic: the Typical alliance draws 1.7 G207 fouls per match against Shutdown (4.2 blind) and under 1 against the rest. The blind analysis still holds for where they happen: mostly a robot on its way to its grid touching the defender at the edge of the defender's loading zone.

## Plausibility (calibrated)

`npm run plausibility -- --game 2023-chargedup --matches 16`: every lineup preset against itself (so each match gives two alliance samples), easy / normal / hard bots, breakdowns on; validation and the bots' geometry audit are clean. Means per alliance per match:

| Lineup                         | Difficulty | Total | Auto | Teleop | Endgame | Fouls drawn | Pieces | sustainability RP | activation RP | Broke down | Mech failed |
| ------------------------------ | ---------- | ----- | ---- | ------ | ------- | ----------- | ------ | ----------------- | ------------- | ---------- | ----------- |
| Powerhouse                     | easy       | 128   | 34   | 68     | 24      | 2           | 16.0   | 81%               | 78%           | 2%         | 4%          |
| Powerhouse                     | normal     | 150   | 40   | 84     | 24      | 2           | 21.1   | 100%              | 63%           | 2%         | 6%          |
| Powerhouse                     | hard       | 172   | 40   | 101    | 25      | 6           | 25.1   | 100%              | 69%           | 1%         | 4%          |
| Typical qualification alliance | easy       | 72    | 22   | 36     | 14      | 1           | 9.4    | 0%                | 16%           | 5%         | 25%         |
| Typical qualification alliance | normal     | 86    | 20   | 50     | 15      | 1           | 12.9   | 3%                | 13%           | 2%         | 18%         |
| Typical qualification alliance | hard       | 114   | 27   | 72     | 13      | 2           | 18.1   | 94%               | 19%           | 7%         | 15%         |
| Specialists                    | easy       | 89    | 27   | 36     | 26      | 0           | 9.2    | 0%                | 88%           | 4%         | 19%         |
| Specialists                    | normal     | 109   | 27   | 55     | 24      | 1           | 12.6   | 9%                | 91%           | 3%         | 11%         |
| Specialists                    | hard       | 140   | 29   | 82     | 26      | 3           | 19.2   | 94%               | 97%           | 3%         | 5%          |
| Link race                      | easy       | 115   | 37   | 54     | 23      | 0           | 12.6   | 25%               | 88%           | 3%         | 5%          |
| Link race                      | normal     | 134   | 35   | 74     | 23      | 2           | 16.6   | 94%               | 75%           | 3%         | 8%          |
| Link race                      | hard       | 166   | 39   | 98     | 24      | 5           | 22.6   | 100%              | 81%           | 2%         | 6%          |
| Shutdown defense               | easy       | 91    | 28   | 39     | 19      | 6           | 9.7    | 0%                | 59%           | 9%         | 18%         |
| Shutdown defense               | normal     | 108   | 30   | 54     | 20      | 4           | 13.2   | 16%               | 63%           | 7%         | 21%         |
| Shutdown defense               | hard       | 136   | 30   | 73     | 19      | 13          | 17.8   | 91%               | 72%           | 11%        | 22%         |
| Activation first               | easy       | 47    | 20   | 11     | 16      | 0           | 5.6    | 0%                | 31%           | 4%         | 20%         |
| Activation first               | normal     | 58    | 18   | 23     | 17      | 0           | 7.8    | 0%                | 34%           | 8%         | 17%         |
| Activation first               | hard       | 71    | 18   | 39     | 13      | 2           | 12.1   | 3%                | 19%           | 9%         | 19%         |
| Rookie alliance                | easy       | 29    | 9    | 11     | 9       | 0           | 4.8    | 0%                | 0%            | 9%         | 28%         |
| Rookie alliance                | normal     | 36    | 8    | 19     | 10      | 1           | 6.4    | 0%                | 0%            | 13%        | 30%         |
| Rookie alliance                | hard       | 45    | 7    | 29     | 9       | 0           | 8.7    | 0%                | 0%            | 13%        | 40%         |

"Fouls drawn" is penalty points awarded to the alliance (the opponents' G207 and G202 fouls). Endgame actions completed per alliance per match (more than one auto action can happen, but only one robot's counts; an `auto-dock` here is a failed auto engage):

| Lineup                         | Difficulty | auto-engage | auto-dock | engage | dock |
| ------------------------------ | ---------- | ----------- | --------- | ------ | ---- |
| Powerhouse                     | easy       | 0.59        | 0.16      | 2.19   | 0.28 |
| Powerhouse                     | normal     | 0.47        | 0.06      | 2.06   | 0.31 |
| Powerhouse                     | hard       | 0.41        | 0.03      | 2.09   | 0.38 |
| Typical qualification alliance | easy       | 0.63        | 0.03      | 0.72   | 0.47 |
| Typical qualification alliance | normal     | 0.19        | 0.03      | 0.69   | 0.66 |
| Typical qualification alliance | hard       | 0.53        | 0.19      | 0.56   | 0.47 |
| Specialists                    | easy       | 0.84        | 0.16      | 2.22   | 0.38 |
| Specialists                    | normal     | 0.78        | 0.13      | 2.16   | 0.34 |
| Specialists                    | hard       | 0.91        | 0.09      | 2.41   | 0.28 |
| Link race                      | easy       | 0.75        | 0.25      | 1.94   | 0.41 |
| Link race                      | normal     | 0.69        | 0.13      | 1.88   | 0.41 |
| Link race                      | hard       | 0.72        | 0.19      | 2.03   | 0.41 |
| Shutdown defense               | easy       | 0.75        | 0.16      | 1.44   | 0.44 |
| Shutdown defense               | normal     | 0.69        | 0.19      | 1.63   | 0.28 |
| Shutdown defense               | hard       | 0.75        | 0.22      | 1.59   | 0.25 |
| Activation first               | easy       | 0.56        | 0.19      | 0.84   | 0.47 |
| Activation first               | normal     | 0.75        | 0.06      | 0.97   | 0.63 |
| Activation first               | hard       | 0.72        | 0.06      | 0.66   | 0.50 |
| Rookie alliance                | easy       | 0.00        | 0.00      | 0.00   | 0.78 |
| Rookie alliance                | normal     | 0.00        | 0.00      | 0.00   | 0.94 |
| Rookie alliance                | hard       | 0.00        | 0.00      | 0.00   | 0.81 |

- **Ceiling**: 27 nodes plus supercharge per alliance; the most an alliance can score in pieces is the 49 it owns (3 preloaded, 4 staged, 42 from its human players), or 53 if it also takes the opponent's staged pieces. The best alliance-match scored 29 pieces (Powerhouse, hard); three elevators at normal place about 21.
- **Cycle math**: grid to double substation is about 13.7 m. At 4.27 m/s (14 ft/s) × 0.85 (normal) plus path overhead that's ~4.5 s each way, plus the 1.5 s handoff, a 0.35 s grab, 0.8-2.8 s placing and the elevator's 2.6 s line-up twice: ~17 s per cycle, or about 6 pieces in the ~100 s before the endgame. The bots place 6.0, the real top seventh of 2023 robots 6.1. A kitbot (10 ft/s, floor pickups, 16.8 s line-ups) needs about a minute per piece: sim 1.6, real second-to-bottom seventh 1.6.
- **Difficulty ordering**: easy < normal < hard for every lineup. Difficulty now scales the drive teams' line-up (`SKILL.align`), so even three kitbots gain with better drivers (29 / 36 / 45).
- **Blue vs red** with identical setups: 153 : 176 wins of 336 (z 1.3), non-foul scores 99.4 : 100.2.
- **Design intent**: the bonus RPs are stretch goals. With calibrated robots, ordinary lineups at normal reach Sustainability in 3-16 % of matches. Lineups with two or three top-seventh robots reach it almost always (94-100 %), as real district championship alliances often did (69 %). Activation depends on having an auto-docking robot: 13 % for Typical, whose only auto-capable robot runs a two-piece auto, and 91 % for Specialists. The real 2023 season: Sustainability 24 % and Activation 57 % (in-season events 14 % and 52 %). The random preset gives 18 % and 48 % (`CALIBRATION.md`).

## Open questions

- The manual at the given URL is the April revision. A January-era value that changed in a later Team Update would be wrong here, and I can't detect that without reading post-January material. The scoring table and RP thresholds aren't touched by TU01–07. The real-match comparison found one: the Sustainability threshold (see Simplifications); every point value matched real breakdowns.
- Single substation chute position (read off Fig 6-1) and the loading zone / community step positions (Fig 5-6) are medium/low confidence. WPILib's 2023 AprilTag layout or the official field drawings would pin them down.
- ~~Real auto and endgame balance success rates~~: calibrated (70-90 % per robot type; `CALIBRATION.md`).
- G207 is called "regardless of who initiates contact" (G201 excuses only deliberate forcing), but the sim still doesn't call contact the zone's owner clearly drove into (`forgiveForced` on the G207 rule). Turn it off to follow the manual more strictly; expect more fouls on robots defended near the zones.
- Should some bots play dedicated defense (`defenseShare`)? Bots only defend opportunistically now, outside the protected zones.
- Should both double substation shelves hand out either piece (`choice: true`), as the real shelves do? This build splits them into a cone shelf and a cube shelf (it predates `choice`). Measured with both shelves offering either piece, 15 each (40 matches per lineup at normal, both alliances): Typical 160 → 166 total (teleop 88 → 95), Powerhouse 187 → 191, Specialists unchanged (172 → 171; their cube robot can't reach the shelf). `supply` counts a station's pieces, not each type's, so the 16-cone / 14-cube split would become 15 per shelf.
