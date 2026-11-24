# Roadmap

Status of the build plan. Update this file in every PR.

| Milestone             | Scope                                                                                                    | Status                        |
| --------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------- |
| M0 Scaffold           | Vite/TS/ESLint/Vitest, CI, Pages deploy, CLAUDE.md, ADRs                                                 | done                          |
| M1 Headless sim core  | `GameDefinition` + validation, Rapier field, swerve, pieces, mechanisms, scoring, clock, ledger          | done                          |
| M2 Reference game     | fictional `0000-reference` that exercises every engine feature, plus a games registry and per-game tests | done                          |
| M3 Playable 3D client | Three.js renderer, cameras, keyboard/gamepad, HUD, menus, post-match                                     | done                          |
| M4 Bot AI             | generic 3v3 AI, nav grid, difficulty, `npm run sim`                                                      | done                          |
| M5 Pipeline           | `frc-game-from-manual` skill, ingest + calibrate tools, Playwright smoke                                 | done                          |
| M6 Stress tests       | blind builds of past seasons from their manuals; real-match comparison only on request                   | 2023 Charged Up built (blind) |
| M7 Spectator mode     | watch six bots: sideline camera, follow any robot with bot commentary, 0.25x-4x playback                 | done                          |
| M8 Win probability    | Monte Carlo match-ups of one spectator setup in Web Workers: win chance ± 95 % CI, scores, RPs, replays  | done                          |
| M9 Lessons from 2023  | declared fouls, ramps, nav hints, RP kinds, failable endgame, geometry audit, `npm run plausibility`     | done                          |

## Known gaps / ideas

- Breakdown and lapse rates are engineering estimates, not measured. Partial failure is one kind only (all game-piece mechanisms at once, the climber keeps working). There's no tipping.
- The drive model is still constant acceleration up to `maxSpeed`. `drivetrain.ts` fits it to the real motor curve over a 5 m sprint, so very short moves are slightly slow and long ones about right. Pushing force is `mass × min(maxAccel, traction × g)`, not the stall-torque force, so a low-geared pusher's edge comes only through its higher fitted acceleration. Drive current limits (Falcon / Kraken 70 A, NEO 50 A, CIM 60 A) and the top-speed shares (85 % swerve, 77 % tank) are rules of thumb, not measurements.
- Menu tuning is per robot type, not per driver station: two robots of the same type always share their numbers. Capacity, intake reach and frame size aren't tunable yet, nor match timing.
- The player can't give partner bots instructions during a match (e.g. "you defend now"). Roles and strategies are set before the match.

- Teammate coordination is a shared blackboard (intended spots, yielding), not real multi-robot planning. Head-on meetings in narrow lanes still cost a second or two.
- Defense has no counter-defense (scorers don't route around a defender). In 2023 one defender costs a typical alliance about 6 teleop points.
- Declared contact fouls (ADR 0008): bots keep their whole body out of the opponent's protected zones and give opponents room while partly inside one, but they don't anticipate a defender pushing them over a zone line. In 2023 random lineups that leaves ~1.6 G207 fouls per alliance per match, ~4 for an alliance facing a defender. Only protected-zone contact and pinning are declarable; other fouls (over-capacity, extension, launching) still need `rules.ts`.
- Robot chassis are frictionless boxes, so a robot pressed against a wall slides along it: sim pins happen against a robot that can't push back, or in corners and against field elements. Bot defenders break off before the 5 s count (0 pin fouls in 120 Shutdown vs Typical matches), so pin calls are mostly what students do. Transitive pins (through a game piece) aren't detected.

- Alliance symmetry (ADR 0007): within one match, Rapier's contact solver still resolves a contact and its mirror image a little differently, so blue's and red's robots aren't exact mirror images once they touch pieces or each other. Alternating the physics frame by seed cancels this over a run (consecutive seeds alternate exactly; an odd-sized run has one extra match one way). Statistical symmetry is only checked by hand (identical alliances, thousands of matches); CI checks the exact parts: navigation, decisions, and the first seconds of physics.

- Spectator mode has no scrubbing (it only plays forward), and no auto-director that cuts to the most interesting robot. It can replay a sampled win-probability match-up from its seed.
- Win probability: 1000 match-ups still take minutes, not seconds (each headless match is ~0.6-0.9 s of CPU; a 2023 run takes about 2.7 min on a 4-core machine). About half of a match is now Rapier's WASM physics, which can't get faster without changing results (ADR 0006). Rapier's SIMD build was only 1.14× faster and changed every match. What's left: adaptive stopping (end the run once the 95 % range is narrow enough), and keeping the workers alive between runs. There's no strategy matrix (every strategy pair in one run), no per-robot "what if I swap this robot" comparison, and runs aren't saved across reloads. The worker bundle duplicates the engine and Rapier (+4.4 MB, loaded only when a run starts). The numbers are as good as the bots and archetype estimates, which are blind-build guesses, not measurements.

- 2023 stress test: the sim is optimistic. Strong alliances reach both bonus RPs in most normal matches (`npm run plausibility` warns). Bots drive near-perfect paths, balancing never fails by default and tipped cones cost nothing. The menu can now set a balance success chance per robot type (`endgameSuccess`); the owner decides whether 2023 should default below 100 % (see `src/games/2023-chargedup/SOURCES.md`).
- Bots don't plan auto routines per game: auto uses the same planner, restricted to the bot's own half of the field. An auto-only action (2023's auto dock) is attempted when the end of auto comes near, so a slow robot that went for a second piece may not make it back (rookie kitbots dock in ~72-91 % of auto periods). Committing early lost more than it gained (no piece, and no Mobility without driving out first), so there's no explicit "leave, then dock" routine yet.
- The 2023 manual URL now serves the April revision, so a blind January build can't verify that no value changed after January without reading later Team Updates. Archive the kickoff manual at kickoff for future stress tests.
- Charge Station tilt isn't simulated (static ramp at its real height; LEVEL is decided in `rules.ts`). Robots are pitch/roll-locked boxes; ramps (`nav: 'ramp'` hulls) continue 3 cm below the floor in physics so they can drive up at any speed.
- A station hands out the first piece type the robot can hold unless it has `choice: true` (players switch with F / gamepad X; bots ask for what they plan to score). 2023 still models its double substation as one shelf per piece type, from before `choice` existed; merging them would be a model change for the owner to decide (measured in its SOURCES.md open questions: +4 to +6 points for alliances whose robots use the shelf). `supply` is per station, not per piece type.
- Placement uses the highest-value target first; players switch levels with V (D-pad ← →). Bots always weigh every level by points per second.

- There's no audio transcription for reveal videos. Captions are used only when a subtitle track exists, and the manual is the source of truth.
- The optional real-match comparison (`npm run calibrate`) covers alliance-level distributions only, not per-team cycle times.
- Bots don't reason about opponents beyond avoidance and the simple defense role. There's no shot-blocking or counter-defense.
- The reference game's tower recycles orbs right back to midfield, so scores are unrealistically high (~650/alliance). That's fine for an engine test.

- No touch controls, so phones and tablets can only use the menus. Matches need a keyboard or gamepad.
- No graphics quality setting: soft shadows (every mesh casts), antialiasing and up to 1.5× pixel ratio are always on. Untested on low-end school laptops (CI renders in software); a low setting (no shadows, pixel ratio 1) would be the first thing to try if students report slow frames.
- The bundle is about 4.9 MB (Rapier's WASM is inlined by `rapier3d-compat`). Consider the non-compat build with a separate `.wasm` file if load time matters on school networks.
- Robots are drawn as generic boxes. Archetypes could get a simple visual hint per mechanism (shooter hood, elevator).
- Scored pieces are drawn only in targets with a `display` point (2023's nodes); elsewhere they vanish (consumed) or reappear at the recycle exits.

- The reference game was moved ahead of the client and AI (originally M4) so both have a real field to develop against.
- Shooters pick hood pitch and flywheel speed per shot (`solveShot`). Pieces are launched from above the robot's frame, not from a modeled exit point.

- Fouls beyond protected-zone contact and pinning (over-capacity, extension, launching) aren't detected by the engine. Games call `ctx.foul()` from `rules.ts`. `RobotInfo` carries velocity and commanded drive for contact rules.
- `npm run plausibility` judges a game only against the manual (ADR 0004). Its blue-vs-red check covers one run; to confirm a symmetry change, run one lineup mirrored over a few hundred seeds (ADR 0007).
- Physics treats torus pieces as solid cylinders.
