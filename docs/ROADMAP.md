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

## Known gaps / ideas

- Breakdown and lapse rates are engineering estimates, not measured. There's no partial failure (e.g. a broken intake that still drives), and no tipping.
- The player can't give partner bots instructions during a match (e.g. "you defend now"). Roles and strategies are set before the match.

- Teammate coordination is a shared blackboard (intended spots, yielding), not real multi-robot planning. Head-on meetings in narrow lanes still cost a second or two.
- Defense has no counter-defense (scorers don't route around a defender), and one defender is only worth about 3 points. Pin detection (G202) and protected-zone fouls (G207) are game rules in `2023-chargedup/rules.ts`, not engine features yet.
- Contact for G207 fouls is approximated by center distance (0.95 m), not real bumper contact.

- Spectator mode has no replay or scrubbing (it only plays forward), and no auto-director that cuts to the most interesting robot.

- 2023 stress test: the sim is optimistic. Strong alliances reach the bonus RPs in most normal matches. Bots drive perfect paths, there's no defense, balancing never fails and tipped cones cost nothing. A balance-failure chance or a loading-zone defense role would bring the rates down (see `src/games/2023-chargedup/SOURCES.md`).
- The 2023 manual URL now serves the April revision, so a blind January build can't verify that no value changed after January without reading later Team Updates. Archive the kickoff manual at kickoff for future stress tests.
- Charge Station tilt isn't simulated (static ramp; LEVEL is decided in `rules.ts`). Robots are still pitch/roll-locked boxes.
- Players can't pick which piece a multi-type station hands out. 2023 works around it with one station (and zone) per piece type.
- Placement uses the highest-value row first. There's no key to pick a lower row on purpose.

- There's no audio transcription for reveal videos. Captions are used only when a subtitle track exists, and the manual is the source of truth.
- The optional real-match comparison (`npm run calibrate`) covers alliance-level distributions only, not per-team cycle times.
- Bots don't reason about opponents beyond avoidance and the simple defense role. There's no shot-blocking or counter-defense.
- Bots don't plan auto routines per game. Auto uses the same planner, restricted to the bot's own half of the field.
- The reference game's tower recycles orbs right back to midfield, so scores are unrealistically high (~650/alliance). That's fine for an engine test.

- No touch controls, so phones and tablets can only use the menus. Matches need a keyboard or gamepad.
- The bundle is about 4.9 MB (Rapier's WASM is inlined by `rapier3d-compat`). Consider the non-compat build with a separate `.wasm` file if load time matters on school networks.
- Robots are drawn as generic boxes. Archetypes could get a simple visual hint per mechanism (shooter hood, elevator).
- Pieces held or scored inside targets aren't drawn in the target.

- The reference game was moved ahead of the client and AI (originally M4) so both have a real field to develop against.
- Shooters pick hood pitch and flywheel speed per shot (`solveShot`). Pieces are launched from above the robot's frame, not from a modeled exit point.

- No generic foul detection in the engine (pinning, protected zones, over-capacity). Games call `ctx.foul()` from `rules.ts`; 2023 does G202 and G207 there. `RobotInfo` carries velocity and commanded drive for contact rules.
- Robots are boxes with roll and pitch locked, so ramps and charge stations won't tip them realistically.
- Physics treats torus pieces as solid cylinders.
- Pieces aren't drawn inside targets after they're scored (they're consumed or recycled).
